/* eslint-disable @typescript-eslint/no-explicit-any */
import archiver from 'archiver'
import { PassThrough } from 'stream'
import Product from '../../models/Product'
import Category from '../../models/Category'
import Customer from '../../models/Customer'
import Debt from '../../models/Debt'
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
    products, categories, customers, debts, sales,
    expenses, expenseSources, users, cashbackPayouts,
    savedCarts, settings, counters
  ] = await Promise.all([
    Product.find({ isActive: true }).populate('category', 'name').lean(),
    Category.find().lean(),
    Customer.find().lean(),
    Debt.find().populate('customer', 'name phone').populate('sale', 'receiptNo').lean(),
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
    products, categories, customers, debts, sales,
    expenses, expenseSources, users, cashbackPayouts,
    savedCarts, settings, counters
  }
}

function stripImages(products: any[]): any[] {
  return products.map((p: any) => {
    const { image, ...rest } = p
    return rest
  })
}

function extractImages(products: any[]): { name: string; buffer: Buffer; ext: string }[] {
  const images: { name: string; buffer: Buffer; ext: string }[] = []
  for (const product of products) {
    if (!product.image || !product.image.startsWith('data:')) continue
    const matches = product.image.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches) continue
    const safeName = product.name.replace(/[/\\?%*:|"<>]/g, '_')
    images.push({
      name: safeName,
      buffer: Buffer.from(matches[2], 'base64'),
      ext: matches[1]
    })
  }
  return images
}

async function createFullZip(data: Record<string, any>, images: { name: string; buffer: Buffer; ext: string }[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []
    const stream = new PassThrough()

    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)

    archive.pipe(stream)

    // Add each collection as JSON file
    for (const [name, docs] of Object.entries(data)) {
      const json = JSON.stringify(docs, null, 2)
      archive.append(Buffer.from(json, 'utf-8'), { name: `${name}.json` })
    }

    // Add images in images/ folder
    for (const img of images) {
      archive.append(img.buffer, { name: `images/${img.name}.${img.ext}` })
    }

    archive.finalize()
  })
}

export async function sendDbDump(bot: any, chatId?: string | number): Promise<void> {
  const allData = await collectAllData()
  const dateStr = formatDate(new Date())

  const images = extractImages(allData.products)

  // Build ZIP data (products without base64 images)
  const zipData: Record<string, any> = {
    products: stripImages(allData.products),
    categories: allData.categories,
    customers: allData.customers,
    debts: allData.debts,
    sales: allData.sales,
    expenses: allData.expenses,
    expense_sources: allData.expenseSources,
    users: allData.users,
    cashback_payouts: allData.cashbackPayouts,
    saved_carts: allData.savedCarts,
    settings: allData.settings,
    counters: allData.counters,
  }

  const zipBuffer = await createFullZip(zipData, images)
  const filename = `crm_backup_${dateStr}.zip`
  const caption = `📦 CRM Backup — ${dateStr}\n` +
    `Mahsulotlar: ${allData.products.length}, ` +
    `Sotuvlar: ${allData.sales.length}, ` +
    `Qarzlar: ${allData.debts.length}, ` +
    `Rasmlar: ${images.length}`

  if (chatId) {
    await sendDocumentTo(bot, chatId, zipBuffer, filename, caption)
  } else {
    await sendDocumentToAll(bot, zipBuffer, filename, caption)
  }
}
