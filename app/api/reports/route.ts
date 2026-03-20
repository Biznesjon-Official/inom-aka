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

    // Sales aggregation (accounting for returns)
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
        $group: {
          _id: null,
          totalSales: { $addToSet: '$_id' },
          totalRevenue: { $sum: { $subtract: ['$paid', '$returnedTotal'] } },
          totalNetCost: { $sum: { $subtract: ['$grossCost', '$returnedCostTotal'] } },
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

    // Manual debt payments (old debts not linked to a sale) as revenue
    const [manualDebtPayAgg] = await Debt.aggregate([
      { $match: { sale: null, $or: [{ type: 'customer' }, { type: { $exists: false } }] } },
      { $unwind: '$payments' },
      { $match: { 'payments.date': dateFilter } },
      { $group: { _id: null, total: { $sum: '$payments.amount' } } },
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
      {
        $group: {
          _id: '$_id.date',
          revenue: { $sum: { $subtract: ['$paid', '$returnedTotal'] } },
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

    // Merge daily data
    const expenseMap = new Map(dailyExpenses.map((d: { date: string; expense: number }) => [d.date, d.expense]))
    const daily = dailyBreakdown.map((d: { date: string; revenue: number; profit: number; sales: number }) => ({
      ...d,
      expense: expenseMap.get(d.date) || 0,
    }))

    // Top 10 products
    const topProducts = await Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productName',
          totalQty: { $sum: '$items.qty' },
          totalRevenue: { $sum: { $multiply: ['$items.qty', '$items.salePrice'] } },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, name: '$_id', qty: '$totalQty', revenue: '$totalRevenue' } },
    ]).allowDiskUse(true)

    // Payment methods stats (sales + manual debt payments)
    const [saleMethodStats, debtMethodStats] = await Promise.all([
      Sale.aggregate([
        { $match: { createdAt: dateFilter } },
        { $unwind: { path: '$payments', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$payments.method', total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
        { $project: { _id: 0, method: '$_id', total: 1, count: 1 } },
      ]).allowDiskUse(true),
      Debt.aggregate([
        { $match: { sale: null, $or: [{ type: 'customer' }, { type: { $exists: false } }] } },
        { $unwind: '$payments' },
        { $match: { 'payments.date': dateFilter } },
        { $group: { _id: '$payments.method', total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
        { $project: { _id: 0, method: '$_id', total: 1, count: 1 } },
      ]).allowDiskUse(true),
    ])
    const methodMap: Record<string, { total: number; count: number }> = {}
    for (const s of [...saleMethodStats, ...debtMethodStats]) {
      const m = s.method || 'cash'
      if (!methodMap[m]) methodMap[m] = { total: 0, count: 0 }
      methodMap[m].total += s.total
      methodMap[m].count += s.count
    }
    const paymentMethodStats = Object.entries(methodMap).map(([method, v]) => ({ method, ...v }))

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

    return NextResponse.json({
      salesCount: salesAgg?.salesCount || 0,
      totalRevenue: (salesAgg?.totalRevenue || 0) + (manualDebtPayAgg?.total || 0),
      totalProfit: (salesAgg?.totalProfit || 0) + (manualDebtPayAgg?.total || 0),
      totalExpenses: expensesAgg?.totalExpenses || 0,
      netProfit: (salesAgg?.totalProfit || 0) + (manualDebtPayAgg?.total || 0) - (expensesAgg?.totalExpenses || 0),
      newDebt: debtsAgg?.newDebt || 0,
      paidDebt: debtsAgg?.paidDebt || 0,
      daily,
      topProducts,
      cashierStats,
      paymentMethods: paymentMethodStats,
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
