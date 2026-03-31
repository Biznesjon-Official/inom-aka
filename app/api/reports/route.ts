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

    const fromDate = new Date(from + 'T00:00:00')
    const toDate = new Date(to + 'T23:59:59.999')

    const dateFilter = { $gte: fromDate, $lte: toDate }

    // Sales count — createdAt bo'yicha (sotuv qachon yaratilgani)
    const salesCount = await Sale.countDocuments({ createdAt: dateFilter })

    // Sales revenue/profit — calcSaleRevenue/calcSaleProfit (lib/utils.ts) bilan bir xil formula
    // kirim = paid - max(0, ret - debt) = paid - max(0, ret - (total-paid))
    // foyda = (total-ret) - (cost-retCost)
    const [salesAgg] = await Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$_id',
          paid: { $first: '$paid' },
          total: { $first: '$total' },
          returnedTotal: { $first: { $ifNull: ['$returnedTotal', 0] } },
          returnedCostTotal: { $first: { $ifNull: ['$returnedCostTotal', 0] } },
          cost: { $sum: { $multiply: ['$items.costPrice', '$items.qty'] } },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $subtract: [
                '$paid',
                { $max: [0, { $subtract: ['$returnedTotal', { $subtract: ['$total', '$paid'] }] }] },
              ],
            },
          },
          totalProfit: {
            $sum: {
              $subtract: [
                { $subtract: ['$total', '$returnedTotal'] },
                { $subtract: ['$cost', '$returnedCostTotal'] },
              ],
            },
          },
        },
      },
    ]).allowDiskUse(true)

    // Qarz to'lovlari (faqat sale ref yo'q bo'lganlar — sale bor bo'lsa allaqachon Sale.payments ga sync bo'lgan)
    const [manualDebtPaymentsAgg] = await Debt.aggregate([
      { $match: { sale: null } },
      { $unwind: '$payments' },
      { $match: { 'payments.date': dateFilter, 'payments.fromSale': { $ne: true }, 'payments.refunded': { $ne: true } } },
      { $group: { _id: null, totalPayments: { $sum: '$payments.amount' } } },
    ]).allowDiskUse(true)

    // Expenses aggregation
    const [expensesAgg] = await Expense.aggregate([
      { $match: { date: dateFilter } },
      { $group: { _id: null, totalExpenses: { $sum: '$amount' } } },
    ]).allowDiskUse(true)

    // Debts aggregation — newDebt: entries.date bo'yicha, paidDebt: payments.date bo'yicha
    const [newDebtAgg] = await Debt.aggregate([
      { $unwind: '$entries' },
      { $match: { 'entries.date': dateFilter } },
      { $group: {
        _id: null,
        newDebt: { $sum: '$entries.amount' },
      }},
    ]).allowDiskUse(true)

    const [paidDebtAgg] = await Debt.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.date': dateFilter, 'payments.refunded': { $ne: true }, 'payments.fromSale': { $ne: true } } },
      { $group: { _id: null, paidDebt: { $sum: '$payments.amount' } } },
    ]).allowDiskUse(true)

    // Static data (not date-filtered)
    const [customerDebtAgg, personalDebtAgg, productStatsAgg] = await Promise.all([
      Debt.aggregate([{ $match: { status: 'active', $or: [{ type: 'customer' }, { type: { $exists: false } }] } }, { $group: { _id: null, total: { $sum: '$remainingAmount' } } }]).allowDiskUse(true),
      PersonalDebt.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$remainingAmount' } } }]).allowDiskUse(true),
      Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, totalProducts: { $sum: 1 }, warehouseValue: { $sum: { $multiply: ['$costPrice', '$stock'] } } } }]).allowDiskUse(true),
    ])

    // Daily breakdown — createdAt bo'yicha, kassa/sotuvlar bilan bir xil formula
    const dailyBreakdown = await Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            sid: '$_id',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            paid: '$paid',
            total: '$total',
            rt: { $ifNull: ['$returnedTotal', 0] },
            rct: { $ifNull: ['$returnedCostTotal', 0] },
          },
          cost: { $sum: { $multiply: ['$items.costPrice', '$items.qty'] } },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          revenue: {
            $sum: {
              $subtract: [
                '$_id.paid',
                { $max: [0, { $subtract: ['$_id.rt', { $subtract: ['$_id.total', '$_id.paid'] }] }] },
              ],
            },
          },
          profit: {
            $sum: {
              $subtract: [
                { $subtract: ['$_id.total', '$_id.rt'] },
                { $subtract: ['$cost', '$_id.rct'] },
              ],
            },
          },
          sales: { $addToSet: '$_id.sid' },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          revenue: 1,
          profit: 1,
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

    // Daily qarz to'lovlari (faqat sale ref yo'q bo'lganlar)
    const dailyManualDebtPayments = await Debt.aggregate([
      { $match: { sale: null } },
      { $unwind: '$payments' },
      { $match: { 'payments.date': dateFilter, 'payments.fromSale': { $ne: true }, 'payments.refunded': { $ne: true } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$payments.date' } },
          manualPayment: { $sum: '$payments.amount' },
        },
      },
      { $project: { _id: 0, date: '$_id', manualPayment: 1 } },
    ]).allowDiskUse(true)

    // Merge daily data
    const dailyMap = new Map<string, { date: string; revenue: number; profit: number; expense: number; sales: number }>()

    // Sales data
    for (const d of dailyBreakdown) {
      dailyMap.set(d.date, { date: d.date, revenue: d.revenue, profit: d.profit, expense: 0, sales: d.sales })
    }

    // Manual debt payments
    for (const d of dailyManualDebtPayments) {
      const existing = dailyMap.get(d.date)
      if (existing) {
        existing.revenue += d.manualPayment
        existing.profit += d.manualPayment
      } else {
        dailyMap.set(d.date, { date: d.date, revenue: d.manualPayment, profit: d.manualPayment, expense: 0, sales: 0 })
      }
    }

    // Expenses
    for (const d of dailyExpenses) {
      const existing = dailyMap.get(d.date)
      if (existing) {
        existing.expense = d.expense
      } else {
        dailyMap.set(d.date, { date: d.date, revenue: 0, profit: 0, expense: d.expense, sales: 0 })
      }
    }

    const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    // Payment methods — createdAt bo'yicha, to'langan miqdorlar
    const paymentMethodStats = await Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      { $unwind: '$payments' },
      { $group: { _id: '$payments.method', total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
      { $project: { _id: 0, method: '$_id', total: 1, count: 1 } },
    ]).allowDiskUse(true)

    // Qarz to'lovlari by method (faqat sale ref yo'q bo'lganlar)
    const manualDebtPaymentsByMethod = await Debt.aggregate([
      { $match: { sale: null } },
      { $unwind: '$payments' },
      { $match: { 'payments.date': dateFilter, 'payments.fromSale': { $ne: true }, 'payments.refunded': { $ne: true } } },
      { $group: { _id: { $ifNull: ['$payments.method', 'cash'] }, total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
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

    // Total calculations
    const manualDebtPayments = manualDebtPaymentsAgg?.totalPayments || 0
    const totalRevenue = (salesAgg?.totalRevenue || 0) + manualDebtPayments
    const totalProfit = (salesAgg?.totalProfit || 0) + manualDebtPayments

    return NextResponse.json({
      salesCount,
      totalRevenue,
      totalProfit,
      totalExpenses: expensesAgg?.totalExpenses || 0,
      netProfit: totalProfit - (expensesAgg?.totalExpenses || 0),
      newDebt: newDebtAgg?.newDebt || 0,
      paidDebt: paidDebtAgg?.paidDebt || 0,
      daily,
      cashierStats,
      paymentMethods: mergedPaymentMethods,
      customerDebt: customerDebtAgg[0]?.total || 0,
      personalDebt: personalDebtAgg[0]?.total || 0,
      totalProducts: productStatsAgg[0]?.totalProducts || 0,
      warehouseValue: productStatsAgg[0]?.warehouseValue || 0,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
