/* eslint-disable @typescript-eslint/no-explicit-any */
import Debt from '../../models/Debt'
import { sendToAll, sendTo } from '../utils/send'
import { formatPrice, escapeHTML, formatDate } from '../utils/format'

export async function sendDebtsReport(bot: any, chatId?: string | number): Promise<void> {
  const debts = await Debt.find({ status: 'active' })
    .populate('customer', 'name phone')
    .sort({ remainingAmount: -1 })
    .lean()

  if (debts.length === 0) {
    const text = '<b>QARZDORLAR HISOBOTI</b>\n\nQarzdorlar yo\'q'
    chatId ? await sendTo(bot, chatId, text) : await sendToAll(bot, text)
    return
  }

  let total = 0
  const lines: string[] = ['<b>QARZDORLAR HISOBOTI</b>', '━━━━━━━━━━━━━━━━━━━━']

  debts.forEach((debt: any, i: number) => {
    const name = escapeHTML(debt.customer?.name || 'Noma\'lum')
    const phone = debt.customer?.phone || '-'
    const date = formatDate(new Date(debt.createdAt))
    total += debt.remainingAmount

    lines.push(
      `${i + 1}. <b>${name}</b>`,
      `   Qoldi: ${formatPrice(debt.remainingAmount)} / Jami: ${formatPrice(debt.totalAmount)}`,
      `   Sana: ${date} | Tel: ${escapeHTML(phone)}`,
      '━━━━━━━━━━━━━━━━━━━━'
    )
  })

  lines.push(`Jami: ${debts.length} ta | ${formatPrice(total)}`)
  const text = lines.join('\n')
  chatId ? await sendTo(bot, chatId, text) : await sendToAll(bot, text)
}
