import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Sale from '@/models/Sale'
import Expense from '@/models/Expense'
import Debt from '@/models/Debt'

export async function GET() {
  await connectDB()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 6)
  weekStart.setHours(0, 0, 0, 0)

  const [todayStats, todayProfitAgg, todayExpenseAgg, debtAgg, weekAgg] = await Promise.all([
    // Today: count, revenue, total
    Sale.aggregate([
      { $match: { createdAt: { $gte: todayStart } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$paid' }, total: { $sum: '$total' } } },
    ]),
    // Today: profit (needs unwind)
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
    // Total active debt
    Debt.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$remainingAmount' } } },
    ]),
    // Week chart: group by sale first, then by date
    Sale.aggregate([
      { $match: { createdAt: { $gte: weekStart } } },
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
    ]),
  ])

  const today = todayStats[0] || { count: 0, revenue: 0, total: 0 }

  // Build week chart with all 7 days
  const dayMap: Record<string, { revenue: number; profit: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dayMap[key] = { revenue: 0, profit: 0 }
  }
  for (const day of weekAgg) {
    if (dayMap[day._id]) {
      dayMap[day._id] = { revenue: day.revenue, profit: day.profit }
    }
  }

  const chart = Object.entries(dayMap).map(([date, v]) => ({
    date: date.slice(5),
    ...v,
  }))

  return NextResponse.json({
    today: {
      sales: today.count,
      revenue: today.revenue,
      total: today.total,
      profit: todayProfitAgg[0]?.profit || 0,
      expenses: todayExpenseAgg[0]?.total || 0,
    },
    totalDebt: debtAgg[0]?.total || 0,
    chart,
  })
}
