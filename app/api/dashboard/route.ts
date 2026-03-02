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

  const [todaySales, todayExpenses, activeDebts, weekSales] = await Promise.all([
    Sale.find({ createdAt: { $gte: todayStart } }),
    Expense.find({ date: { $gte: todayStart } }),
    Debt.find({ status: 'active' }),
    Sale.find({ createdAt: { $gte: weekStart } }).sort({ createdAt: 1 }),
  ])

  const todayRevenue = todaySales.reduce((s, x) => s + x.paid, 0)
  const todayTotal = todaySales.reduce((s, x) => s + x.total, 0)
  const todayProfit = todaySales.reduce((s: number, x) =>
    s + x.items.reduce((a: number, i: { salePrice: number; costPrice: number; qty: number }) =>
      a + (i.salePrice - i.costPrice) * i.qty, 0), 0)
  const todayExpenseTotal = todayExpenses.reduce((s, x) => s + x.amount, 0)
  const totalDebt = activeDebts.reduce((s, x) => s + x.remainingAmount, 0)

  // Group week sales by day
  const dayMap: Record<string, { revenue: number; profit: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dayMap[key] = { revenue: 0, profit: 0 }
  }
  for (const sale of weekSales) {
    const key = new Date(sale.createdAt).toISOString().slice(0, 10)
    if (dayMap[key]) {
      dayMap[key].revenue += sale.paid
      dayMap[key].profit += sale.items.reduce(
        (a: number, i: { salePrice: number; costPrice: number; qty: number }) =>
          a + (i.salePrice - i.costPrice) * i.qty, 0)
    }
  }

  const chart = Object.entries(dayMap).map(([date, v]) => ({
    date: date.slice(5), // MM-DD
    ...v,
  }))

  return NextResponse.json({
    today: {
      sales: todaySales.length,
      revenue: todayRevenue,
      total: todayTotal,
      profit: todayProfit,
      expenses: todayExpenseTotal,
    },
    totalDebt,
    chart,
  })
}
