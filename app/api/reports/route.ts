import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Sale from '@/models/Sale'
import Expense from '@/models/Expense'
import Debt from '@/models/Debt'
import PersonalDebt from '@/models/PersonalDebt'
import Product from '@/models/Product'

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
    }

    const fromDate = new Date(from)
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)

    const dateFilter = { $gte: fromDate, $lte: toDate }

    console.log('Reports API - Date filter:', { from, to, fromDate, toDate })

    // Sales aggregation - using createdAt for simplicity and accuracy
    const [salesAgg] = await Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$_id',
          saleTotal: { $first: '$total' },
          paid: { $first: '$paid' },
          grossCost: { $sum: { $multiply: ['$items.qty', '$items.costPrice'] } },
          returnedTotal: { $first: { $ifNull: ['$returnedTotal', 0] } },
          returnedCostTotal: { $first: { $ifNull: ['$returnedCostTotal', 0] } },
        },
      },
      {
        $addFields: {
          netTotal: { $subtract: ['$saleTotal', '$returnedTotal'] },
          netCost: { $subtract: ['$grossCost', '$returnedCostTotal'] },
          netPaid: { $subtract: ['$paid', { $max: [0, { $subtract: ['$returnedTotal', { $subtract: ['$saleTotal', '$paid'] }] }] }] },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $addToSet: '$_id' },
          totalRevenue: { $sum: '$netPaid' },
          totalNetCost: { $sum: '$netCost' },
        },
      },
      {
        $project: {
          salesCount: { $size: '$totalSales' },
          totalRevenue: 1,
          totalProfit: { $subtract: ['$totalRevenue', '$totalNetCost'] },
        },
      },
    ]).allowDiskUse(true)

    console.log('Reports API - Sales aggregation result:', salesAgg)

    // Manual debt payments (debts without sale) — these are pure revenue
    const [manualDebtPaymentsAgg] = await Debt.aggregate([
      { $match: { sale: { $exists: false }, createdAt: dateFilter, paidAmount: { $gt: 0 } } },
      { $group: { _id: null, totalPayments: { $sum: '$paidAmount' } } },
    ]).allowDiskUse(true)

    // Expenses aggregation
    const [expensesAgg] = await Expense.aggregate([
      { $match: { date: dateFilter } },
      { $group: { _id: null, totalExpenses: { $sum: '$amount' } } },
    ]).allowDiskUse(true)

    // Debts aggregation
    const [debtsAgg] = await Debt.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: null,
          newDebt: { $sum: '$totalAmount' },
          paidDebt: { $sum: '$paidAmount' },
        },
      },
    ]).allowDiskUse(true)

    // Static data (not date-filtered)
    const [customerDebtAgg, personalDebtAgg, productStatsAgg, lowStockProducts] = await Promise.all([
      Debt.aggregate([{ $match: { status: 'active', $or: [{ type: 'customer' }, { type: { $exists: false } }] } }, { $group: { _id: null, total: { $sum: '$remainingAmount' } } }]),
      PersonalDebt.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$remainingAmount' } } }]),
      Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, totalProducts: { $sum: 1 }, warehouseValue: { $sum: { $multiply: ['$costPrice', '$stock'] } } } }]),
      Product.find({ stock: { $lte: 5 }, isActive: true }).select('name stock unit salePrice').sort({ stock: 1 }).limit(10).lean(),
    ])

    // Daily breakdown for chart (accounting for returns)
    const dailyBreakdown = await Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      { $unwind: '$items' },
      {
        $group: {
          _id: { saleId: '$_id', date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
          saleTotal: { $first: '$total' },
          paid: { $first: '$paid' },
          cost: { $sum: { $multiply: ['$items.qty', '$items.costPrice'] } },
          returnedTotal: { $first: { $ifNull: ['$returnedTotal', 0] } },
          returnedCostTotal: { $first: { $ifNull: ['$returnedCostTotal', 0] } },
        },
      },
      { $match: { $expr: { $lt: ['$returnedTotal', '$saleTotal'] } } },
      {
        $group: {
          _id: '$_id.date',
          revenue: { $sum: { $subtract: ['$paid', { $max: [0, { $subtract: ['$returnedTotal', { $subtract: ['$saleTotal', '$paid'] }] }] }] } },
          cost: { $sum: { $subtract: ['$cost', '$returnedCostTotal'] } },
          sales: { $addToSet: '$_id.saleId' },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          revenue: 1,
          profit: { $subtract: ['$revenue', '$cost'] },
          sales: { $size: '$sales' },
        },
      },
      { $sort: { date: 1 } },
    ]).allowDiskUse(true)

    // Daily expenses for chart
    const dailyExpenses = await Expense.aggregate([
      { $match: { date: dateFilter } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          expense: { $sum: '$amount' },
        },
      },
      { $project: { _id: 0, date: '$_id', expense: 1 } },
    ]).allowDiskUse(true)

    // Daily manual debt payments (debts without sale) - simplified
    const dailyManualDebtPayments = await Debt.aggregate([
      { $match: { sale: { $exists: false }, createdAt: dateFilter, paidAmount: { $gt: 0 } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          manualPayment: { $sum: '$paidAmount' },
        },
      },
      { $project: { _id: 0, date: '$_id', manualPayment: 1 } },
    ]).allowDiskUse(true)

    // Merge daily data
    const expenseMap = new Map(dailyExpenses.map((d: { date: string; expense: number }) => [d.date, d.expense]))
    const manualPaymentMap = new Map(dailyManualDebtPayments.map((d: { date: string; manualPayment: number }) => [d.date, d.manualPayment]))
    const daily = dailyBreakdown.map((d: { date: string; revenue: number; profit: number; sales: number }) => {
      const manualPayment = manualPaymentMap.get(d.date) || 0
      return {
        date: d.date,
        revenue: d.revenue + manualPayment,
        profit: d.profit + manualPayment, // manual payments are pure profit
        expense: expenseMap.get(d.date) || 0,
        sales: d.sales,
      }
    })

    // Add days that only have manual payments (no sales)
    for (const [date, manualPayment] of manualPaymentMap) {
      if (!daily.find(d => d.date === date)) {
        daily.push({
          date,
          revenue: manualPayment,
          profit: manualPayment,
          expense: expenseMap.get(date) || 0,
          sales: 0,
        })
      }
    }
    daily.sort((a, b) => a.date.localeCompare(b.date))

    // Top 10 products (accounting for returns)
    const topProducts = await Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      { $unwind: '$items' },
      {
        $group: {
          _id: { saleId: '$_id', productName: '$items.productName' },
          soldQty: { $sum: '$items.qty' },
          soldRevenue: { $sum: { $multiply: ['$items.qty', '$items.salePrice'] } },
          returnedItems: { $first: '$returnedItems' },
        },
      },
      { $unwind: { path: '$returnedItems', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$_id.productName',
          soldQty: { $sum: '$soldQty' },
          soldRevenue: { $sum: '$soldRevenue' },
          returnedQty: { $sum: { $cond: [
            { $eq: ['$returnedItems.productName', '$_id.productName'] },
            '$returnedItems.qty',
            0,
          ]}},
          returnedRevenue: { $sum: { $cond: [
            { $eq: ['$returnedItems.productName', '$_id.productName'] },
            { $multiply: ['$returnedItems.qty', '$returnedItems.salePrice'] },
            0,
          ]}},
        },
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          qty: { $subtract: ['$soldQty', '$returnedQty'] },
          revenue: { $subtract: ['$soldRevenue', '$returnedRevenue'] },
        },
      },
      { $match: { qty: { $gt: 0 } } },
      { $sort: { qty: -1 } },
      { $limit: 10 },
    ]).allowDiskUse(true)

    // Payment methods stats - simplified using createdAt
    const paymentMethodStats = await Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      { $addFields: {
        netPaid: { $subtract: ['$paid', { $max: [0, { $subtract: [{ $ifNull: ['$returnedTotal', 0] }, { $subtract: ['$total', '$paid'] }] }] }] },
        paymentMethod: { $ifNull: ['$paymentType', 'cash'] },
      }},
      {
        $facet: {
          byPaymentType: [
            { $group: { _id: '$paymentType', total: { $sum: '$netPaid' }, count: { $sum: 1 } } },
          ],
          byPaymentMethod: [
            { $match: { payments: { $exists: true, $ne: [] } } },
            { $unwind: '$payments' },
            { $group: { _id: '$payments.method', total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
          ],
        },
      },
      { $project: {
        combined: { $concatArrays: ['$byPaymentType', '$byPaymentMethod'] },
      }},
      { $unwind: '$combined' },
      { $replaceRoot: { newRoot: '$combined' } },
      { $group: { _id: '$_id', total: { $sum: '$total' }, count: { $sum: '$count' } } },
      { $project: { _id: 0, method: { $ifNull: ['$_id', 'cash'] }, total: 1, count: 1 } },
    ]).allowDiskUse(true)

    // Manual debt payments by method - simplified (assume cash if no method specified)
    const manualDebtPaymentsByMethod = await Debt.aggregate([
      { $match: { sale: { $exists: false }, createdAt: dateFilter, paidAmount: { $gt: 0 } } },
      { $group: { _id: 'cash', total: { $sum: '$paidAmount' }, count: { $sum: 1 } } },
      { $project: { _id: 0, method: '$_id', total: 1, count: 1 } },
    ]).allowDiskUse(true)

    // Merge payment methods
    const paymentMethodMap = new Map(paymentMethodStats.map((p: { method: string; total: number; count: number }) => [p.method, p]))
    for (const mp of manualDebtPaymentsByMethod) {
      const existing = paymentMethodMap.get(mp.method)
      if (existing) {
        existing.total += mp.total
        existing.count += mp.count
      } else {
        paymentMethodMap.set(mp.method, mp)
      }
    }
    const mergedPaymentMethods = Array.from(paymentMethodMap.values())

    // Cashier stats
    const cashierStats = await Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: '$cashier',
          salesCount: { $sum: 1 },
          totalAmount: { $sum: { $subtract: ['$total', { $ifNull: ['$returnedTotal', 0] }] } },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          name: '$user.name',
          salesCount: 1,
          totalAmount: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]).allowDiskUse(true)

    // Add manual debt payments to revenue and profit
    const manualDebtPayments = manualDebtPaymentsAgg?.totalPayments || 0
    const totalRevenue = (salesAgg?.totalRevenue || 0) + manualDebtPayments
    const totalProfit = (salesAgg?.totalProfit || 0) + manualDebtPayments // manual debt payments are pure profit (no cost)

    return NextResponse.json({
      salesCount: salesAgg?.salesCount || 0,
      totalRevenue,
      totalProfit,
      totalExpenses: expensesAgg?.totalExpenses || 0,
      netProfit: totalProfit - (expensesAgg?.totalExpenses || 0),
      newDebt: debtsAgg?.newDebt || 0,
      paidDebt: debtsAgg?.paidDebt || 0,
      daily,
      topProducts,
      cashierStats,
      paymentMethods: mergedPaymentMethods,
      customerDebt: customerDebtAgg[0]?.total || 0,
      personalDebt: personalDebtAgg[0]?.total || 0,
      totalProducts: productStatsAgg[0]?.totalProducts || 0,
      warehouseValue: productStatsAgg[0]?.warehouseValue || 0,
      lowStock: lowStockProducts,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
