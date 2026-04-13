import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + " so'm"
}

export function getMonthRange(date = new Date()): { from: Date; to: Date } {
  const from = new Date(date.getFullYear(), date.getMonth(), 1)
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  return { from, to }
}

export function getYearRange(date = new Date()): { from: Date; to: Date } {
  const from = new Date(date.getFullYear(), 0, 1)
  const to = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999)
  return { from, to }
}

// Sale revenue/profit helpers — used in SalesLog, Sotuvlar, reports API
export type SaleForCalc = {
  total: number
  paid: number
  returnedTotal?: number
  items: { costPrice: number; qty: number }[]
  returnedItems?: { costPrice?: number; qty: number }[]
}

// kirim = paid - qaytarilgan naqd
// qaytarilgan naqd = max(0, returnedTotal - qolgan_qarz)
export function calcSaleRevenue(s: SaleForCalc): number {
  const debt = s.total - s.paid
  const ret = s.returnedTotal || 0
  return s.paid - Math.max(0, ret - debt)
}

// qarz = sotuvdan qolgan to'lanmagan summa (qaytarilgan ayirilgan)
export function calcSaleDebt(s: Pick<SaleForCalc, 'total' | 'paid' | 'returnedTotal'>): number {
  return Math.max(0, (s.total - s.paid) - (s.returnedTotal || 0))
}

// foyda = max(0, olingan_pul - tannarx)
// Avval tannarx qoplanadi, keyin qolgan qism foyda
export function calcSaleProfit(s: SaleForCalc): number {
  const cost = s.items.reduce((a, i) => a + i.costPrice * i.qty, 0)
  const retCost = (s.returnedItems || []).reduce((a, i) => a + (i.costPrice || 0) * i.qty, 0)
  const netCost = cost - retCost
  const revenue = calcSaleRevenue(s)
  return Math.max(0, revenue - netCost)
}

// Payment status badges
export const PAYMENT_STATUS = {
  full: { label: "To'liq", variant: 'default' as const },
  partial: { label: 'Qisman', variant: 'secondary' as const },
  debt: { label: 'Qarz', variant: 'destructive' as const },
} as const

export type PaymentType = keyof typeof PAYMENT_STATUS

// Payment method labels
export const PAYMENT_METHODS = {
  cash: 'Naqd',
  card: 'Karta',
  terminal: 'Terminal',
} as const

// Debt status badges
export const DEBT_STATUS = {
  active: { label: 'Faol', variant: 'destructive' as const },
  paid: { label: "To'langan", variant: 'default' as const },
} as const

export type DebtStatusType = keyof typeof DEBT_STATUS
