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
