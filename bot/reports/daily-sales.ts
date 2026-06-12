/* eslint-disable @typescript-eslint/no-explicit-any */
import { getReportStats } from '../../lib/report-stats'
import { sendToAll, sendTo } from '../utils/send'
import { formatPrice, getTodayRange, formatDate } from '../utils/format'

export async function sendDailySalesReport(bot: any, chatId?: string | number): Promise<void> {
  const { from, to } = getTodayRange()

  // Same calculation as the dashboard (/api/reports) — numbers always match
  const stats = await getReportStats(from, to)

  const methodNames: Record<string, string> = { cash: 'Naqd', card: 'Karta', terminal: 'Terminal' }

  const lines: string[] = [
    '<b>BUGUNGI SOTUV HISOBOTI</b>',
    formatDate(from),
    '━━━━━━━━━━━━━━━━━━━━',
    `Sotuvlar: ${stats.salesCount} ta`,
    `Tushum: ${formatPrice(stats.totalRevenue)}`,
    `Foyda: ${formatPrice(stats.totalProfit)}`,
    `Xarajat: ${formatPrice(stats.totalExpenses)}`,
    `Sof foyda: ${formatPrice(stats.netProfit)}`,
    '━━━━━━━━━━━━━━━━━━━━',
    `Yangi qarz: ${formatPrice(stats.newDebt)}`,
    `Qarz to'landi: ${formatPrice(stats.paidDebt)}`,
    '━━━━━━━━━━━━━━━━━━━━',
    'To\'lov turlari:',
  ]

  for (const pm of stats.paymentMethods) {
    const name = methodNames[pm.method] || pm.method
    lines.push(`  ${name}: ${formatPrice(pm.total)} (${pm.count} ta)`)
  }

  if (stats.paymentMethods.length === 0) {
    lines.push('  Ma\'lumot yo\'q')
  }

  const text = lines.join('\n')
  chatId ? await sendTo(bot, chatId, text) : await sendToAll(bot, text)
}
