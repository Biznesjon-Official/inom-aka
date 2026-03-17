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

    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    // Last month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

    // 30 days ago for chart
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    thirtyDaysAgo.setHours(0, 0, 0, 0)

    const [
      todaySalesAgg, todayProfitAgg, todayExpenseAgg,
      monthSalesAgg, monthProfitAgg, monthExpenseAgg,
      lastMonthSalesAgg, lastMonthProfitAgg, lastMonthExpenseAgg,
      debtAgg,
      chartSalesAgg, chartExpenseAgg,
      topProductsAgg,
      lowStockProducts,
      paymentMethodsAgg,
      monthPaymentMethodsAgg,
      productStatsAgg,
      personalDebtAgg,
    ] = await Promise.all([
      // Today sales
      Sale.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$paid' }, total: { $sum: '$total' } } },
      ]),
      // Today profit
      Sale.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $unwind: '$items' },
        { $group: { _id: null, profit: { $sum: { $multiply: [{ $subtract: ['$items.salePrice', '$items.costPrice'] }, '$items.qty'] } } } },
      ]),
      // Today expenses
      Expense.aggregate([
        { $match: { date: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // This month sales
      Sale.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$paid' }, total: { $sum: '$total' } } },
      ]),
      // This month profit
      Sale.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        { $unwind: '$items' },
        { $group: { _id: null, profit: { $sum: { $multiply: [{ $subtract: ['$items.salePrice', '$items.costPrice'] }, '$items.qty'] } } } },
      ]),
      // This month expenses
      Expense.aggregate([
        { $match: { date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // Last month sales
      Sale.aggregate([
        { $match: { createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$paid' } } },
      ]),
      // Last month profit
      Sale.aggregate([
        { $match: { createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $unwind: '$items' },
        { $group: { _id: null, profit: { $sum: { $multiply: [{ $subtract: ['$items.salePrice', '$items.costPrice'] }, '$items.qty'] } } } },
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
      // 30-day chart: sales grouped by date
      Sale.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: { saleId: '$_id', date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
            paid: { $first: '$paid' },
            profit: { $sum: { $multiply: [{ $subtract: ['$items.salePrice', '$items.costPrice'] }, '$items.qty'] } },
          },
        },
        {
          $group: {
            _id: '$_id.date',
            revenue: { $sum: '$paid' },
            profit: { $sum: '$profit' },
          },
        },
        { $sort: { _id: 1 } },
      ]).allowDiskUse(true),
      // 30-day chart: expenses grouped by date
      Expense.aggregate([
        { $match: { date: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            expense: { $sum: '$amount' },
          },
        },
      ]).allowDiskUse(true),
      // Today's top 5 products
      Sale.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productName',
            qty: { $sum: '$items.qty' },
            revenue: { $sum: { $multiply: ['$items.qty', '$items.salePrice'] } },
          },
        },
        { $sort: { qty: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, name: '$_id', qty: 1, revenue: 1 } },
      ]),
      // Low stock products (stock <= 5, only active ones)
      Product.find({ stock: { $lte: 5 }, isActive: true })
        .select('name stock unit salePrice')
        .sort({ stock: 1 })
        .limit(10)
        .lean(),
      // Today payment methods
      Sale.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $unwind: { path: '$payments', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$payments.method', total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
        { $project: { _id: 0, method: '$_id', total: 1, count: 1 } },
      ]),
      // Month payment methods
      Sale.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        { $unwind: { path: '$payments', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$payments.method', total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
        { $project: { _id: 0, method: '$_id', total: 1, count: 1 } },
      ]),
      // Product stats for dashboard
      Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            warehouseValue: { $sum: { $multiply: ['$costPrice', '$stock'] } },
          },
        },
      ]),
      // Personal debts
      PersonalDebt.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$remainingAmount' } } },
      ]),
    ])

    const todayData = todaySalesAgg[0] || { count: 0, revenue: 0, total: 0 }
    const todayProfit = todayProfitAgg[0]?.profit || 0
    const todayExpenses = todayExpenseAgg[0]?.total || 0

    const monthData = monthSalesAgg[0] || { count: 0, revenue: 0, total: 0 }
    const monthProfit = monthProfitAgg[0]?.profit || 0
    const monthExpenses = monthExpenseAgg[0]?.total || 0

    const lastMonthData = lastMonthSalesAgg[0] || { count: 0, revenue: 0 }
    const lastMonthProfit = lastMonthProfitAgg[0]?.profit || 0
    const lastMonthExpenses = lastMonthExpenseAgg[0]?.total || 0

    // Build 30-day chart
    const expenseMap = new Map(chartExpenseAgg.map((d: { _id: string; expense: number }) => [d._id, d.expense]))
    const salesMap = new Map(chartSalesAgg.map((d: { _id: string; revenue: number; profit: number }) => [d._id, d]))

    const chart: { date: string; revenue: number; profit: number; expense: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const sale = salesMap.get(key)
      chart.push({
        date: key.slice(5), // MM-DD
        revenue: sale?.revenue || 0,
        profit: sale?.profit || 0,
        expense: expenseMap.get(key) || 0,
      })
    }

    return NextResponse.json({
      today: {
        sales: todayData.count,
        revenue: todayData.revenue,
        profit: todayProfit,
        expenses: todayExpenses,
        netProfit: todayProfit - todayExpenses,
      },
      month: {
        sales: monthData.count,
        revenue: monthData.revenue,
        profit: monthProfit,
        expenses: monthExpenses,
        netProfit: monthProfit - monthExpenses,
      },
      lastMonth: {
        sales: lastMonthData.count,
        revenue: lastMonthData.revenue,
        profit: lastMonthProfit,
        expenses: lastMonthExpenses,
        netProfit: lastMonthProfit - lastMonthExpenses,
      },
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
