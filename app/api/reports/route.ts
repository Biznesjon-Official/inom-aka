import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Sale from '@/models/Sale'
import Expense from '@/models/Expense'
import Debt from '@/models/Debt'

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
          grossCost: { $sum: { $multiply: ['$items.qty', '$items.costPrice'] } },
          returnedTotal: { $first: { $ifNull: ['$returnedTotal', 0] } },
          returnedCostTotal: { $first: { $ifNull: ['$returnedCostTotal', 0] } },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $addToSet: '$_id' },
          totalRevenue: { $sum: { $subtract: ['$saleTotal', '$returnedTotal'] } },
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

    // Daily breakdown for chart (accounting for returns)
    const dailyBreakdown = await Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      { $unwind: '$items' },
      {
        $group: {
          _id: { saleId: '$_id', date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
          saleTotal: { $first: '$total' },
          cost: { $sum: { $multiply: ['$items.qty', '$items.costPrice'] } },
          returnedTotal: { $first: { $ifNull: ['$returnedTotal', 0] } },
          returnedCostTotal: { $first: { $ifNull: ['$returnedCostTotal', 0] } },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          revenue: { $sum: { $subtract: ['$saleTotal', '$returnedTotal'] } },
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

    // Payment methods stats
    const paymentMethodStats = await Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      { $unwind: { path: '$payments', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$payments.method',
          total: { $sum: '$payments.amount' },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, method: '$_id', total: 1, count: 1 } },
    ]).allowDiskUse(true)

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
      totalRevenue: salesAgg?.totalRevenue || 0,
      totalProfit: salesAgg?.totalProfit || 0,
      totalExpenses: expensesAgg?.totalExpenses || 0,
      netProfit: (salesAgg?.totalProfit || 0) - (expensesAgg?.totalExpenses || 0),
      newDebt: debtsAgg?.newDebt || 0,
      paidDebt: debtsAgg?.paidDebt || 0,
      daily,
      topProducts,
      cashierStats,
      paymentMethods: paymentMethodStats,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
