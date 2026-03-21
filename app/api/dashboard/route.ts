import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Sale from '@/models/Sale'
import Expense from '@/models/Expense'
import Debt from '@/models/Debt'
import PersonalDebt from '@/models/PersonalDebt'
import Product from '@/models/Product'

export async function GET() {
  try {
    await connectDB()

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    thirtyDaysAgo.setHours(0, 0, 0, 0)

    const [
      todayRevenueAgg, todayProfitAgg, todayExpenseAgg,
      monthRevenueAgg, monthProfitAgg, monthExpenseAgg,
      lastMonthRevenueAgg, lastMonthProfitAgg, lastMonthExpenseAgg,
      debtAgg,
      chartSalesAgg, chartExpenseAgg,
      topProductsAgg,
      lowStockProducts,
      paymentMethodsAgg,
      monthPaymentMethodsAgg,
      productStatsAgg,
      personalDebtAgg,
      todayManualDebtAgg,
      monthManualDebtAgg,
      lastMonthManualDebtAgg,
      chartManualDebtAgg,
      todaySalesCountAgg,
      monthSalesCountAgg,
      lastMonthSalesCountAgg
    ] = await Promise.all([
      // Today revenue
      Sale.aggregate([
        { $unwind: '$payments' },
        { $match: { 'payments.date': { $gte: todayStart } } },
        { $group: { _id: null, revenue: { $sum: '$payments.amount' } } },
      ]),
      // Today profit
      Sale.aggregate([
        { $unwind: '$payments' },
        { $match: { 'payments.date': { $gte: todayStart } } },
        { $project: { paymentAmount: '$payments.amount', total: '$total', items: '$items', returnedTotal: { $ifNull: ['$returnedTotal', 0] }, returnedCostTotal: { $ifNull: ['$returnedCostTotal', 0] } }},
        { $unwind: '$items' },
        { $group: { _id: { sid: '$_id', pid: '$payments._id', pamt: '$paymentAmount', tot: '$total', rt: '$returnedTotal', rct: '$returnedCostTotal' }, cost: { $sum: { $multiply: ['$items.costPrice', '$items.qty'] } } } },
        { $project: { pamt: '$_id.pamt', tot: '$_id.tot', profit: { $subtract: [{ $subtract: ['$_id.tot', '$_id.rt'] }, { $subtract: ['$cost', '$_id.rct'] }] } } },
        { $group: { _id: null, profit: { $sum: { $cond: [{ $gt: ['$tot', 0] }, { $multiply: ['$profit', { $divide: ['$pamt', '$tot'] }] }, 0] } } } }
      ]),
      // Today expenses
      Expense.aggregate([
        { $match: { date: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // This month revenue
      Sale.aggregate([
        { $unwind: '$payments' },
        { $match: { 'payments.date': { $gte: monthStart } } },
        { $group: { _id: null, revenue: { $sum: '$payments.amount' } } },
      ]),
      // This month profit
      Sale.aggregate([
        { $unwind: '$payments' },
        { $match: { 'payments.date': { $gte: monthStart } } },
        { $project: { paymentAmount: '$payments.amount', total: '$total', items: '$items', returnedTotal: { $ifNull: ['$returnedTotal', 0] }, returnedCostTotal: { $ifNull: ['$returnedCostTotal', 0] } }},
        { $unwind: '$items' },
        { $group: { _id: { sid: '$_id', pamt: '$paymentAmount', tot: '$total', rt: '$returnedTotal', rct: '$returnedCostTotal' }, cost: { $sum: { $multiply: ['$items.costPrice', '$items.qty'] } } } },
        { $project: { pamt: '$_id.pamt', tot: '$_id.tot', profit: { $subtract: [{ $subtract: ['$_id.tot', '$_id.rt'] }, { $subtract: ['$cost', '$_id.rct'] }] } } },
        { $group: { _id: null, profit: { $sum: { $cond: [{ $gt: ['$tot', 0] }, { $multiply: ['$profit', { $divide: ['$pamt', '$tot'] }] }, 0] } } } }
      ]),
      // This month expenses
      Expense.aggregate([
        { $match: { date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // Last month revenue
      Sale.aggregate([
        { $unwind: '$payments' },
        { $match: { 'payments.date': { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, revenue: { $sum: '$payments.amount' } } },
      ]),
      // Last month profit
      Sale.aggregate([
        { $unwind: '$payments' },
        { $match: { 'payments.date': { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $project: { paymentAmount: '$payments.amount', total: '$total', items: '$items', returnedTotal: { $ifNull: ['$returnedTotal', 0] }, returnedCostTotal: { $ifNull: ['$returnedCostTotal', 0] } }},
        { $unwind: '$items' },
        { $group: { _id: { sid: '$_id', pamt: '$paymentAmount', tot: '$total', rt: '$returnedTotal', rct: '$returnedCostTotal' }, cost: { $sum: { $multiply: ['$items.costPrice', '$items.qty'] } } } },
        { $project: { pamt: '$_id.pamt', tot: '$_id.tot', profit: { $subtract: [{ $subtract: ['$_id.tot', '$_id.rt'] }, { $subtract: ['$cost', '$_id.rct'] }] } } },
        { $group: { _id: null, profit: { $sum: { $cond: [{ $gt: ['$tot', 0] }, { $multiply: ['$profit', { $divide: ['$pamt', '$tot'] }] }, 0] } } } }
      ]),
      // Last month expenses
      Expense.aggregate([
        { $match: { date: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // Active customer debts
      Debt.aggregate([
        { $match: { status: 'active', $or: [{ type: 'customer' }, { type: { $exists: false } }] } },
        { $group: { _id: null, total: { $sum: '$remainingAmount' } } },
      ]),
      // Chart Revenue & Profit
      Sale.aggregate([
        { $unwind: '$payments' },
        { $match: { 'payments.date': { $gte: thirtyDaysAgo } } },
        { $project: { pamt: '$payments.amount', date: '$payments.date', total: '$total', items: '$items', rt: { $ifNull: ['$returnedTotal', 0] }, rct: { $ifNull: ['$returnedCostTotal', 0] } }},
        { $unwind: '$items' },
        { $group: { _id: { sid: '$_id', pdate: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, pamt: '$pamt', tot: '$total', rt: '$rt', rct: '$rct' }, cost: { $sum: { $multiply: ['$items.costPrice', '$items.qty'] } } } },
        { $project: { pamt: '$_id.pamt', tot: '$_id.tot', date: '$_id.pdate', profit: { $subtract: [{ $subtract: ['$_id.tot', '$_id.rt'] }, { $subtract: ['$cost', '$_id.rct'] }] } } },
        { $group: { _id: '$date', revenue: { $sum: '$pamt' }, profit: { $sum: { $cond: [{ $gt: ['$tot', 0] }, { $multiply: ['$profit', { $divide: ['$pamt', '$tot'] }] }, 0] } } } }
      ]).allowDiskUse(true),
      // Chart expenses
      Expense.aggregate([
        { $match: { date: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, expense: { $sum: '$amount' } } }
      ]).allowDiskUse(true),
      // Top 5 products
      Sale.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.productName', qty: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.qty', '$items.salePrice'] } } } },
        { $sort: { qty: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, name: '$_id', qty: 1, revenue: 1 } },
      ]),
      Product.find({ stock: { $lte: 5 }, isActive: true }).select('name stock unit salePrice').sort({ stock: 1 }).limit(10).lean(),
      // Payment methods
      Sale.aggregate([
        { $unwind: '$payments' },
        { $match: { 'payments.date': { $gte: todayStart } } },
        { $group: { _id: '$payments.method', total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
        { $project: { _id: 0, method: '$_id', total: 1, count: 1 } }
      ]),
      Sale.aggregate([
        { $unwind: '$payments' },
        { $match: { 'payments.date': { $gte: monthStart } } },
        { $group: { _id: '$payments.method', total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
        { $project: { _id: 0, method: '$_id', total: 1, count: 1 } }
      ]),
      Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, totalProducts: { $sum: 1 }, warehouseValue: { $sum: { $multiply: ['$costPrice', '$stock'] } } } }]),
      PersonalDebt.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$remainingAmount' } } }]),
      Debt.aggregate([{ $match: { sale: { $exists: false } } }, { $unwind: '$payments' }, { $match: { 'payments.date': { $gte: todayStart } } }, { $group: { _id: null, amount: { $sum: '$payments.amount' } } }]),
      Debt.aggregate([{ $match: { sale: { $exists: false } } }, { $unwind: '$payments' }, { $match: { 'payments.date': { $gte: monthStart } } }, { $group: { _id: null, amount: { $sum: '$payments.amount' } } }]),
      Debt.aggregate([{ $match: { sale: { $exists: false } } }, { $unwind: '$payments' }, { $match: { 'payments.date': { $gte: lastMonthStart, $lte: lastMonthEnd } } }, { $group: { _id: null, amount: { $sum: '$payments.amount' } } }]),
      Debt.aggregate([{ $match: { sale: { $exists: false } } }, { $unwind: '$payments' }, { $match: { 'payments.date': { $gte: thirtyDaysAgo } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$payments.date' } }, amount: { $sum: '$payments.amount' } } }]),
      Sale.countDocuments({ createdAt: { $gte: todayStart } }),
      Sale.countDocuments({ createdAt: { $gte: monthStart } }),
      Sale.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
    ]) as any

    const todayManualDebt = todayManualDebtAgg[0]?.amount || 0
    const monthManualDebt = monthManualDebtAgg[0]?.amount || 0
    const lastMonthManualDebt = lastMonthManualDebtAgg[0]?.amount || 0

    const todayRevenue = (todayRevenueAgg[0]?.revenue || 0) + todayManualDebt
    const todayProfit = (todayProfitAgg[0]?.profit || 0) + todayManualDebt
    const todayExpenses = todayExpenseAgg[0]?.total || 0

    const monthRevenue = (monthRevenueAgg[0]?.revenue || 0) + monthManualDebt
    const monthProfit = (monthProfitAgg[0]?.profit || 0) + monthManualDebt
    const monthExpenses = monthExpenseAgg[0]?.total || 0

    const lastMonthRevenue = (lastMonthRevenueAgg[0]?.revenue || 0) + lastMonthManualDebt
    const lastMonthProfit = (lastMonthProfitAgg[0]?.profit || 0) + lastMonthManualDebt
    const lastMonthExpenses = lastMonthExpenseAgg[0]?.total || 0

    const expenseMap = new Map<string, number>(chartExpenseAgg.map((d: any) => [d._id, d.expense || d.total || 0]))
    const salesMap = new Map<string, { revenue: number; profit: number }>(chartSalesAgg.map((d: any) => [d._id, { revenue: d.revenue, profit: d.profit }]))
    const manualDebtMap = new Map<string, number>(chartManualDebtAgg.map((d: any) => [d._id, d.amount]))

    const chart: { date: string; revenue: number; profit: number; expense: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const sale = salesMap.get(key)
      const manualDebt = Number(manualDebtMap.get(key)) || 0
      chart.push({
        date: key.slice(5),
        revenue: (sale?.revenue || 0) + manualDebt,
        profit: (sale?.profit || 0) + manualDebt,
        expense: (expenseMap.get(key) as number) || 0,
      })
    }

    return NextResponse.json({
      today: { sales: todaySalesCountAgg, revenue: todayRevenue, profit: todayProfit, expenses: todayExpenses, netProfit: todayProfit - todayExpenses },
      month: { sales: monthSalesCountAgg, revenue: monthRevenue, profit: monthProfit, expenses: monthExpenses, netProfit: monthProfit - monthExpenses },
      lastMonth: { sales: lastMonthSalesCountAgg, revenue: lastMonthRevenue, profit: lastMonthProfit, expenses: lastMonthExpenses, netProfit: lastMonthProfit - lastMonthExpenses },
      customerDebt: debtAgg[0]?.total || 0,
      personalDebt: personalDebtAgg[0]?.total || 0,
      totalProducts: productStatsAgg[0]?.totalProducts || 0,
      warehouseValue: productStatsAgg[0]?.warehouseValue || 0,
      chart,
      topProducts: topProductsAgg,
      lowStock: lowStockProducts,
      paymentMethods: paymentMethodsAgg,
      monthPaymentMethods: monthPaymentMethodsAgg,
    })
  } catch (err) { return errorResponse(err) }
}
