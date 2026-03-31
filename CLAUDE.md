# Inomaka CRM - Project Rules

## Import Conventions
```
@/lib/db          — connectDB()
@/lib/auth        — authOptions
@/lib/utils       — cn, formatPrice, escapeRegex, getMonthRange, getYearRange
@/lib/api-utils   — errorResponse
@/lib/hooks       — useFetchWithCache, useDebounce
@/models/*        — Mongoose models
@/components/ui/* — shadcn components
```

## API Route Pattern
```ts
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params  // Next.js 16: params MUST be awaited
    // ...
  } catch (err) { return errorResponse(err) }
}
```

## Key Rules
- `connectDB()` — har bir API handler boshida chaqirilishi SHART
- `params` — Next.js 16 da `Promise`, `await` qilish kerak
- Model export: `models.X || model('X', Schema)` — hot reload uchun
- Client pages: `'use client'` + `useFetchWithCache` + `useDebounce` + `toast` (sonner)
- MongoDB aggregation/sort: `.allowDiskUse(true)` qo'shish (memory limit oldini olish)

## Existing Utilities (qayta yozma!)
- `formatPrice(amount)` — "1,000 so'm" format
- `cn(...inputs)` — tailwind class merge
- `escapeRegex(str)` — regex special chars escape
- `getMonthRange(date?)` — { from, to } shu oy
- `getYearRange(date?)` — { from, to } shu yil
- `errorResponse(err)` — API error handler (CastError → 400)
- `useFetchWithCache(url)` — cached SWR-like fetch hook
- `useDebounce(value, delay)` — debounce hook
