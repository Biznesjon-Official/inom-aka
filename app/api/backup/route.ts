/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import archiver from 'archiver'
import { PassThrough } from 'stream'
import path from 'path'
import fs from 'fs'

import Product from '@/models/Product'
import Category from '@/models/Category'
import Customer from '@/models/Customer'
import Debt from '@/models/Debt'
import PersonalDebt from '@/models/PersonalDebt'
import Sale from '@/models/Sale'
import Expense from '@/models/Expense'
import ExpenseSource from '@/models/ExpenseSource'
import User from '@/models/User'
import CashbackPayout from '@/models/CashbackPayout'
import SavedCart from '@/models/SavedCart'
import Settings from '@/models/Settings'
import Counter from '@/models/Counter'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return new Response('Forbidden', { status: 403 })
    }

    await connectDB()

    // Fetch all collections in parallel
    const [
      products, categories, customers, debts, personalDebts, sales,
      expenses, expenseSources, users, cashbackPayouts,
      savedCarts, settings, counters,
    ] = await Promise.all([
      Product.find().populate('category', 'name').lean(),
      Category.find().lean(),
      Customer.find().lean(),
      Debt.find().populate('customer', 'name phone').populate('sale', 'receiptNo').lean(),
      PersonalDebt.find().lean(),
      Sale.find().populate('cashier', 'name').populate('customer', 'name phone').lean(),
      Expense.find().populate('source', 'name').lean(),
      ExpenseSource.find().lean(),
      User.find().lean(),
      CashbackPayout.find().populate('customer', 'name phone').lean(),
      SavedCart.find().populate('items.product', 'name').populate('createdBy', 'name').lean(),
      Settings.find().lean(),
      Counter.find().lean(),
    ])

    const collections: Record<string, any> = {
      products, categories, customers, debts, personalDebts, sales,
      expenses, expenseSources, users, cashbackPayouts,
      savedCarts, settings, counters,
    }

    // Create ZIP
    const archive = archiver('zip', { zlib: { level: 6 } })
    const chunks: Buffer[] = []
    const stream = new PassThrough()
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))

    const done = new Promise<Buffer>((resolve, reject) => {
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)
    })

    archive.pipe(stream)

    // Add each collection as JSON
    for (const [name, docs] of Object.entries(collections)) {
      archive.append(JSON.stringify(docs, null, 2), { name: `db/${name}.json` })
    }

    // Add uploaded images
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir)
      for (const file of files) {
        const filePath = path.join(uploadsDir, file)
        if (fs.statSync(filePath).isFile()) {
          archive.file(filePath, { name: `uploads/${file}` })
        }
      }
    }

    await archive.finalize()
    const zipBuffer = await done

    const date = new Date().toISOString().slice(0, 10)
    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="inomaka_backup_${date}.zip"`,
      },
    })
  } catch (err) { return errorResponse(err) }
}
