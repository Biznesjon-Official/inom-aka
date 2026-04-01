/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, rmdirSync, copyFileSync } from 'fs'
import { resolve } from 'path'
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
import DebtCategory from '../../models/DebtCategory'

const BACKUP_DIR = resolve(process.cwd(), 'backups')
const MAX_HOURLY = 48  // 48 soat = 2 kunlik hourly backup
const MAX_DAILY = 30   // 30 kunlik daily backup

function formatDateTime(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

function cleanOldBackups(prefix: string, max: number) {
  if (!existsSync(BACKUP_DIR)) return
  const dirs = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith(prefix))
    .sort()
    .reverse()

  for (const dir of dirs.slice(max)) {
    try {
      const fullPath = resolve(BACKUP_DIR, dir)
      for (const file of readdirSync(fullPath)) {
        const filePath = resolve(fullPath, file)
        try {
          // Agar papka bo'lsa (images)
          if (require('fs').statSync(filePath).isDirectory()) {
            for (const img of readdirSync(filePath)) {
              unlinkSync(resolve(filePath, img))
            }
            rmdirSync(filePath)
          } else {
            unlinkSync(filePath)
          }
        } catch { /* skip */ }
      }
      rmdirSync(fullPath)
      console.log(`  🗑️  Deleted old backup: ${dir}`)
    } catch { /* skip */ }
  }
}

async function collectAllData() {
  const [
    products, categories, customers, debts, personalDebts, sales,
    expenses, expenseSources, users, cashbackPayouts,
    savedCarts, settings, counters, debtCategories
  ] = await Promise.all([
    Product.find().lean(),
    Category.find().lean(),
    Customer.find().lean(),
    Debt.find().lean(),
    PersonalDebt.find().lean(),
    Sale.find().lean(),
    Expense.find().lean(),
    ExpenseSource.find().lean(),
    User.find().select('-password').lean(),
    CashbackPayout.find().lean(),
    SavedCart.find().lean(),
    Settings.find().lean(),
    Counter.find().lean(),
    DebtCategory.find().lean(),
  ])

  return {
    products,
    categories,
    customers,
    debts,
    personal_debts: personalDebts,
    sales,
    expenses,
    expense_sources: expenseSources,
    users,
    cashback_payouts: cashbackPayouts,
    saved_carts: savedCarts,
    settings,
    counters,
    debt_categories: debtCategories,
  }
}

function saveJsonFiles(backupPath: string, data: Record<string, any[]>) {
  for (const [name, docs] of Object.entries(data)) {
    writeFileSync(
      resolve(backupPath, `${name}.json`),
      JSON.stringify(docs, null, 2),
      'utf-8'
    )
  }
}

function copyUploads(backupPath: string) {
  const uploadsDir = resolve(process.cwd(), 'public/uploads')
  const imagesDir = resolve(process.cwd(), 'images')
  let count = 0

  // public/uploads papkasini ko'chirish
  if (existsSync(uploadsDir)) {
    const destUploads = resolve(backupPath, 'uploads')
    mkdirSync(destUploads, { recursive: true })
    for (const file of readdirSync(uploadsDir)) {
      try {
        copyFileSync(resolve(uploadsDir, file), resolve(destUploads, file))
        count++
      } catch { /* skip */ }
    }
  }

  // images papkasini ko'chirish
  if (existsSync(imagesDir)) {
    const destImages = resolve(backupPath, 'images')
    mkdirSync(destImages, { recursive: true })
    for (const file of readdirSync(imagesDir)) {
      try {
        copyFileSync(resolve(imagesDir, file), resolve(destImages, file))
        count++
      } catch { /* skip */ }
    }
  }

  return count
}

// Har soat - faqat JSON backup
export async function saveHourlyBackup(): Promise<void> {
  const now = new Date()
  const dateStr = formatDateTime(now)
  const backupPath = resolve(BACKUP_DIR, `hourly_${dateStr}`)

  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })
  mkdirSync(backupPath, { recursive: true })

  console.log(`[${now.toISOString()}] ⏰ Hourly JSON backup...`)

  const data = await collectAllData()
  saveJsonFiles(backupPath, data)
  cleanOldBackups('hourly_', MAX_HOURLY)

  const total = Object.values(data).reduce((s, d) => s + d.length, 0)
  console.log(`  ✅ Hourly backup: ${total} records → ${backupPath}`)
}

// Har kuni 22:00 - JSON + uploads/images full backup
export async function saveDailyBackup(): Promise<void> {
  const now = new Date()
  const dateStr = formatDateTime(now)
  const backupPath = resolve(BACKUP_DIR, `daily_${dateStr}`)

  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })
  mkdirSync(backupPath, { recursive: true })

  console.log(`[${now.toISOString()}] 📦 Daily full backup (JSON + uploads)...`)

  const data = await collectAllData()
  saveJsonFiles(backupPath, data)

  const imgCount = copyUploads(backupPath)
  cleanOldBackups('daily_', MAX_DAILY)

  const total = Object.values(data).reduce((s, d) => s + d.length, 0)
  console.log(`  ✅ Daily backup: ${total} records + ${imgCount} images → ${backupPath}`)
}

// Eski saveLocalBackup - backward compat
export const saveLocalBackup = saveHourlyBackup
