/* eslint-disable @typescript-eslint/no-explicit-any */
import Product from '../../models/Product'
import '../../models/Category'
import { sendToAll, sendTo } from '../utils/send'
import { escapeHTML } from '../utils/format'

export async function sendLowStockReport(bot: any, chatId?: string | number): Promise<void> {
  const products = await Product.find({ isActive: true, stock: { $lte: 1 } })
    .populate('category', 'name')
    .sort({ stock: 1 })
    .lean()

  if (products.length === 0) {
    const text = '<b>KAM QOLGAN MAHSULOTLAR</b> (stock ≤ 1)\n\nHammasi yetarli'
    chatId ? await sendTo(bot, chatId, text) : await sendToAll(bot, text)
    return
  }

  const lines: string[] = [
    '<b>KAM QOLGAN MAHSULOTLAR</b> (stock ≤ 1)',
    '━━━━━━━━━━━━━━━━━━━━',
  ]

  products.forEach((p: any, i: number) => {
    const cat = p.category?.name ? ` (${escapeHTML(p.category.name)})` : ''
    lines.push(`${i + 1}. ${escapeHTML(p.name)} — ${p.stock} dona${cat}`)
  })

  lines.push('━━━━━━━━━━━━━━━━━━━━')
  lines.push(`Jami: ${products.length} ta`)

  const text = lines.join('\n')
  chatId ? await sendTo(bot, chatId, text) : await sendToAll(bot, text)
}
