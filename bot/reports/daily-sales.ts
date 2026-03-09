/* eslint-disable @typescript-eslint/no-explicit-any */
import Sale from '../../models/Sale'
import Expense from '../../models/Expense'
import { sendToAll, sendTo } from '../utils/send'
import { formatPrice, getTodayRange, formatDate } from '../utils/format'

export async function sendDailySalesReport(bot: any, chatId?: string | number): Promise<void> {
  const { from, to } = getTodayRange()
  const dateFilter = { $gte: from, $lte: to }

  // Sales aggregation (same as reports/route.ts)
  const [salesAgg] = await Sale.aggregate([
    { $match: { createdAt: dateFilter } },
    { $unwind: '$items' },
    {
      $group: {
        _id: null,
        totalSales: { $addToSet: '$_id' },
        totalRevenue: { $sum: { $multiply: ['$items.qty', '$items.salePrice'] } },
        totalCost: { $sum: { $multiply: ['$items.qty', '$items.costPrice'] } },
      },
    },
    {
      $project: {
        salesCount: { $size: '$totalSales' },
        totalRevenue: 1,
        totalProfit: { $subtract: ['$totalRevenue', '$totalCost'] },
      },
    },
  ]).allowDiskUse(true)

  // Expenses
  const [expensesAgg] = await Expense.aggregate([
    { $match: { date: dateFilter } },
    { $group: { _id: null, totalExpenses: { $sum: '$amount' } } },
  ]).allowDiskUse(true)

  // Payment methods
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

  const salesCount = salesAgg?.salesCount || 0
  const totalRevenue = salesAgg?.totalRevenue || 0
  const totalProfit = salesAgg?.totalProfit || 0
  const totalExpenses = expensesAgg?.totalExpenses || 0
  const netProfit = totalProfit - totalExpenses

  const methodNames: Record<string, string> = { cash: 'Naqd', card: 'Karta', terminal: 'Terminal' }

  const lines: string[] = [
    '<b>BUGUNGI SOTUV HISOBOTI</b>',
    formatDate(from),
    '━━━━━━━━━━━━━━━━━━━━',
    `Sotuvlar: ${salesCount} ta`,
    `Tushum: ${formatPrice(totalRevenue)}`,
    `Foyda: ${formatPrice(totalProfit)}`,
    `Xarajat: ${formatPrice(totalExpenses)}`,
    `Sof foyda: ${formatPrice(netProfit)}`,
    '━━━━━━━━━━━━━━━━━━━━',
    'To\'lov turlari:',
  ]

  for (const pm of paymentMethodStats) {
    const name = methodNames[pm.method] || pm.method
    lines.push(`  ${name}: ${formatPrice(pm.total)} (${pm.count} ta)`)
  }

  if (paymentMethodStats.length === 0) {
    lines.push('  Ma\'lumot yo\'q')
  }

  const text = lines.join('\n')
  chatId ? await sendTo(bot, chatId, text) : await sendToAll(bot, text)
}
