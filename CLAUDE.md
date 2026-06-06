# Inomaka CRM - Project Rules

## Import Conventions
```
@/lib/db          — connectDB()
@/lib/auth        — authOptions
@/lib/auth-utils  — requireAuth(), requireAdmin(), requireRole()
@/lib/utils       — cn, formatPrice, escapeRegex, getMonthRange, getYearRange,
                    calcSaleRevenue, calcSaleProfit, calcSaleDebt,
                    PAYMENT_STATUS, PAYMENT_METHODS, DEBT_STATUS
@/lib/api-utils   — errorResponse
@/lib/hooks       — useFetchWithCache, useDebounce, useBarcodeScan
@/lib/print       — printReceipt, printLabel, printLabels, printDebtReceipt
@/lib/error-logger — logError, getErrorLogs
@/models/*        — Mongoose models
@/components/ui/* — shadcn components
```

## API Route Pattern
```ts
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import { requireAdmin } from '@/lib/auth-utils'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params  // Next.js 16: params MUST be awaited
    // ...
  } catch (err) { return errorResponse(err) }
}

// Admin-only route pattern:
export async function DELETE(req: Request) {
  const { response } = await requireAdmin()
  if (response) return response
  // ...
}
```

## Key Rules
- `connectDB()` — har bir API handler boshida chaqirilishi SHART
- `params` — Next.js 16 da `Promise`, `await` qilish kerak
- Model export: `models.X || model('X', Schema)` — hot reload uchun
- Client pages: `'use client'` + `useFetchWithCache` + `useDebounce` + `toast` (sonner)
- MongoDB aggregation/sort: `.allowDiskUse(true)` qo'shish (memory limit oldini olish)
- Page-specific components (masalan, CartPanel, PaymentDialog) sahifa papkasi ichida joylashadi: `app/(main)/kassa/ComponentName.tsx`

## Existing Utilities (qayta yozma!)

### lib/utils.ts
- `formatPrice(amount)` — "1,000 so'm" format
- `cn(...inputs)` — tailwind class merge
- `escapeRegex(str)` — regex special chars escape
- `getMonthRange(date?)` — { from, to } shu oy
- `getYearRange(date?)` — { from, to } shu yil
- `calcSaleRevenue(sale)` — paid - returned cash
- `calcSaleProfit(sale)` — revenue - cost
- `calcSaleDebt(sale)` — remaining debt amount
- `PAYMENT_STATUS` — { full, partial, debt } badge configs
- `PAYMENT_METHODS` — { cash, card, terminal }
- `DEBT_STATUS` — { active, paid }

### lib/api-utils.ts
- `errorResponse(err)` — API error handler (CastError → 400, else 500)

### lib/auth-utils.ts
- `requireAuth()` — session yo'q → 401 qaytaradi
- `requireAdmin()` — admin emas → 403 qaytaradi
- `requireRole(role)` — role mos kelmasa → 403

### lib/hooks.ts
- `useFetchWithCache(url)` — cached SWR-like fetch hook → { data, loading, refresh }
- `useDebounce(value, delay?)` — debounce hook (default 300ms)
- `useBarcodeScan(onScan)` — barcode skaner (6+ char, Enter bilan tugaydi)

### lib/print.ts
- `printReceipt(data)` — 80mm chek bosish (items, totals, QR)
- `printLabel(product)` — 58mm mahsulot label
- `printLabels(products[])` — batch label bosish
- `printDebtReceipt(data)` — qarz cheki

### lib/error-logger.ts
- `logError(log)` — localStorage'ga error saqlash
- `getErrorLogs()` — loglarni olish
- `downloadErrorLogs()` — JSON sifatida yuklab olish

## Model Relationships (key refs)
```
Sale → Customer (ref), User/cashier (ref), User/usta (ref), Debt (ref)
Debt → Customer (ref), Sale (ref), DebtCategory (ref)
PersonalDebt → Customer (ref, optional), DebtCategory (ref)
Product → Category (ref)
Expense → ExpenseSource (ref)
CashbackPayout → Customer (ref)
SavedCart → Product (ref, items[]), User/createdBy (ref)
```

## Scripts
```
npm run dev         — Next.js dev server
npm run bot         — Telegram bot (bot/index.ts)
npm run create:admin — yangi admin yaratish
npm run migrate:*   — ma'lumot migratsiyalari
```
