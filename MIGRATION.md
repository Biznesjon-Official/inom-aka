# JSON to MongoDB Migration

Bu script barcha JSON fayllarni MongoDB ga migrate qiladi.

## Ishlatish

```bash
npm run migrate:json
```

## Nima qiladi?

Script quyidagi JSON fayllarni o'qiydi va MongoDB ga yuklaydi:

- `categories.json` → Category collection
- `customers.json` → Customer collection
- `products.json` → Product collection
- `sales.json` → Sale collection
- `expenses.json` → Expense collection
- `expense_sources.json` → ExpenseSource collection
- `debts.json` → Debt collection
- `debt_categories.json` → DebtCategory collection
- `users.json` → User collection
- `saved_carts.json` → SavedCart collection
- `cashback_payouts.json` → CashbackPayout collection
- `settings.json` → Settings collection
- `counters.json` → Counter collection

## Muhim eslatmalar

⚠️ **DIQQAT**: Script ishga tushirilganda:
1. Har bir collection avval tozalanadi (`deleteMany({})`)
2. Keyin JSON fayldagi ma'lumotlar yuklanadi
3. Mavjud ma'lumotlar o'chiriladi!

## Xavfsizlik

Migration qilishdan oldin:
1. MongoDB backup oling
2. Test muhitda sinab ko'ring
3. Production da ishlatishdan oldin ma'lumotlarni tekshiring

## Oxirgi migration natijalari

```
✅ Category: 59 records
✅ Customer: 36 records
✅ Product: 1327 records
✅ Sale: 471 records
✅ ExpenseSource: 4 records
✅ Debt: 176 records
✅ SavedCart: 3 records
✅ Settings: 4 records
✅ Counter: 2 records
```

## Muammolar

Agar migration muvaffaqiyatsiz bo'lsa:
1. `.env.local` faylida `MONGODB_URI` to'g'ri sozlanganligini tekshiring
2. MongoDB serveriga ulanish borligini tekshiring
3. JSON fayllar to'g'ri formatda ekanligini tekshiring
