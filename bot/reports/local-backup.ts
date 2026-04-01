/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs'
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
const MAX_BACKUPS = 48 // 48 soat = 2 kunlik backup

function formatDateTime(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

// Eski backuplarni o'chirish (MAX_BACKUPS dan ortiqlarini)
function cleanOldBackups() {
  if (!existsSync(BACKUP_DIR)) return
  const dirs = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup_'))
    .sort()
    .reverse()

  // MAX_BACKUPS dan ortiqlarini o'chir
  for (const dir of dirs.slice(MAX_BACKUPS)) {
    try {
      const fullPath = resolve(BACKUP_DIR, dir)
      // Papka ichidagi fayllarni o'chir
      for (const file of readdirSync(fullPath)) {
        unlinkSync(resolve(fullPath, file))
      }
      require('fs').rmdirSync(fullPath)
      console.log(`  🗑️  Deleted old backup: ${dir}`)
    } catch { /* skip */ }
  }
}

export async function saveLocalBackup(): Promise<void> {
  const now = new Date()
  const dateStr = formatDateTime(now)
  const backupPath = resolve(BACKUP_DIR, `backup_${dateStr}`)

  // Papka yaratish
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })
  mkdirSync(backupPath, { recursive: true })

  console.log(`[${now.toISOString()}] 💾 Saving local backup to ${backupPath}...`)

  // Barcha ma'lumotlarni olish
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

  const collections: Record<string, any[]> = {
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

  // Har bir collection ni JSON fayl sifatida saqlash
  for (const [name, data] of Object.entries(collections)) {
    writeFileSync(
      resolve(backupPath, `${name}.json`),
      JSON.stringify(data, null, 2),
      'utf-8'
    )
  }

  // Eski backuplarni tozalash
  cleanOldBackups()

  const total = Object.values(collections).reduce((s, d) => s + d.length, 0)
  console.log(`  ✅ Backup saved: ${total} total records across ${Object.keys(collections).length} collections`)
  console.log(`  📁 Path: ${backupPath}`)
}
