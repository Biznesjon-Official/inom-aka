export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + " so'm"
}

export function escapeHTML(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function getTodayRange(): { from: Date; to: Date } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { from, to }
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}
