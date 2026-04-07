/* eslint-disable @typescript-eslint/no-explicit-any */
import archiver from 'archiver'
import { PassThrough } from 'stream'
import { readFileSync, existsSync } from 'fs'
import { resolve, extname } from 'path'
import Product from '../../models/Product'
import Category from '../../models/Category'
import Customer from '../../models/Customer'
import Debt from '../../models/Debt'
import PersonalDebt from '../../models/PersonalDebt'
import Sale from '../../models/Sale'
import Expense from '../../models/Expense'
import ExpenseSource from '../../models/ExpenseSource'
import User from '../../models/User'
import CashbackPayout from '../../models/CashbackPayout'
import SavedCart from '../../models/SavedCart'
import Settings from '../../models/Settings'
import Counter from '../../models/Counter'
import { sendDocumentToAll, sendDocumentTo } from '../utils/send'
import { formatDate } from '../utils/format'

async function collectAllData() {
  const [
    products, categories, customers, debts, personalDebts, sales,
    expenses, expenseSources, users, cashbackPayouts,
    savedCarts, settings, counters
  ] = await Promise.all([
    Product.find({ isActive: true }).populate('category', 'name').lean(),
    Category.find().lean(),
    Customer.find().lean(),
    Debt.find().populate('customer', 'name phone').populate('sale', 'receiptNo').lean(),
    PersonalDebt.find().lean(),
    Sale.find().populate('cashier', 'name').populate('customer', 'name phone')
      .populate('items.product', 'name').populate('returnedItems.product', 'name').lean(),
    Expense.find().populate('source', 'name').lean(),
    ExpenseSource.find().lean(),
    User.find().select('-password').lean(),
    CashbackPayout.find().populate('customer', 'name phone').lean(),
    SavedCart.find().populate('items.product', 'name').populate('createdBy', 'name').lean(),
    Settings.find().lean(),
    Counter.find().lean(),
  ])

  return {
    products, categories, customers, debts, personalDebts, sales,
    expenses, expenseSources, users, cashbackPayouts,
    savedCarts, settings, counters
  }
}

function extractImages(products: any[]): { name: string; buffer: Buffer; ext: string }[] {
  const uploadsDir = resolve(process.cwd(), 'public/uploads')
  const images: { name: string; buffer: Buffer; ext: string }[] = []
  for (const product of products) {
    if (!product.image) continue
    const filename = product.image.replace(/^\/api\/uploads\//, '')
    const filePath = resolve(uploadsDir, filename)
    if (!existsSync(filePath)) continue
    try {
      const buffer = readFileSync(filePath)
      const safeName = product.name.replace(/[/\\?%*:|"<>]/g, '_')
      const ext = extname(filename).replace('.', '') || 'webp'
      images.push({ name: safeName, buffer, ext })
    } catch { /* skip unreadable files */ }
  }
  return images
}

function createZipFromEntries(entries: { name: string; buffer: Buffer }[]): Promise<Buffer> {
  return new Promise((res, rej) => {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []
    const stream = new PassThrough()
    stream.on('data', (c: Buffer) => chunks.push(c))
    stream.on('end', () => res(Buffer.concat(chunks)))
    archive.on('error', rej)
    archive.pipe(stream)
    for (const entry of entries) {
      archive.append(entry.buffer, { name: entry.name })
    }
    archive.finalize()
  })
}

async function send(bot: any, chatId: string | number | undefined, buf: Buffer, filename: string, caption: string) {
  if (chatId) {
    await sendDocumentTo(bot, chatId, buf, filename, caption)
  } else {
    await sendDocumentToAll(bot, buf, filename, caption)
  }
}

export async function sendDbDump(bot: any, chatId?: string | number): Promise<void> {
  const allData = await collectAllData()
  const dateStr = formatDate(new Date())

  // Part 1: JSON data
  const jsonEntries = Object.entries({
    products: allData.products,
    categories: allData.categories,
    customers: allData.customers,
    debts: allData.debts,
    personal_debts: allData.personalDebts,
    sales: allData.sales,
    expenses: allData.expenses,
    expense_sources: allData.expenseSources,
    users: allData.users,
    cashback_payouts: allData.cashbackPayouts,
    saved_carts: allData.savedCarts,
    settings: allData.settings,
    counters: allData.counters,
  }).map(([name, docs]) => ({
    name: `${name}.json`,
    buffer: Buffer.from(JSON.stringify(docs, null, 2), 'utf-8'),
  }))

  const jsonZip = await createZipFromEntries(jsonEntries)
  await send(bot, chatId, jsonZip, `crm_db_${dateStr}.zip`,
    `📦 CRM DB — ${dateStr}\n` +
    `Mahsulotlar: ${allData.products.length}, Sotuvlar: ${allData.sales.length}, ` +
    `Qarzlar: ${allData.debts.length}, Shaxsiy qarzlar: ${allData.personalDebts.length}\n` +
    `(1/${allData.products.length > 0 ? '3' : '1'} — JSON ma\'lumotlar)`
  )

  // Part 2 & 3: Images split in half
  const images = extractImages(allData.products)
  if (images.length === 0) return

  const half = Math.ceil(images.length / 2)
  const parts = [images.slice(0, half), images.slice(half)]

  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i]
    if (chunk.length === 0) continue
    const entries = chunk.map(img => ({
      name: `images/${img.name}.${img.ext}`,
      buffer: img.buffer,
    }))
    const zipBuf = await createZipFromEntries(entries)
    const partNum = i + 2
    await send(bot, chatId, zipBuf, `crm_images_part${i + 1}_${dateStr}.zip`,
      `🖼 Rasmlar ${i + 1}-qism — ${dateStr}\n` +
      `${chunk.length} ta rasm (${partNum}/3)`
    )
  }
}
