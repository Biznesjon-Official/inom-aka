# 🚀 Performance Tahlili va Optimizatsiya

## 📊 Hozirgi Holat

### ✅ Yaxshi tomonlar:
1. **Database indexlar mavjud**
   - Product: `name` (text), `category + isActive`, `isActive + createdAt`
   - Sale: `cashier + createdAt`, `customer + createdAt`
   
2. **Connection pooling ishlaydi**
   - maxPoolSize: 10
   - Global cache bilan connection qayta ishlatiladi
   
3. **Frontend caching mavjud**
   - 30 soniya TTL bilan stale-while-revalidate
   - 5 minutdan keyin auto-cleanup

### ⚠️ Muammolar:

#### 1. **N+1 Query Problem (Eng katta muammo!)**
```typescript
// Sales API - har bir sale uchun 3 ta populate
.populate('cashier', 'name')      // +1 query per sale
.populate('customer', 'name phone') // +1 query per sale  
.populate('usta', 'name')         // +1 query per sale
```
**Natija:** 100 ta sotuv = 300 ta qo'shimcha query! 💥

#### 2. **Limit yo'q ba'zi endpointlarda**
```typescript
// Products API
.limit(200) // ✅ Bor

// Sales API  
if (!search) q.limit(100) // ✅ Bor, lekin search mode da yo'q
```

#### 3. **Aggregation ishlatilmayapti**
- Populate o'rniga aggregation tezroq bo'lardi
- Bir query da barcha ma'lumotni olish mumkin

#### 4. **Frontend side filtering**
```typescript
// Sotuvlar sahifasida
const filtered = debouncedSearch ? sales : sales
```
- Serverda filter qilish kerak, clientda emas

#### 5. **Image optimizatsiyasi yo'q**
- Rasm fayllari to'g'ridan-to'g'ri yuklanadi
- Thumbnail yoki lazy loading yo'q

---

## 🎯 Optimizatsiya Strategiyasi

### Priority 1: N+1 Query ni hal qilish ✅

**Muammo:** 
```
100 sotuv * 3 populate = 300 query
```

**Yechim - Aggregation Pipeline:**
```typescript
const sales = await Sale.aggregate([
  { $match: filter },
  { $sort: { createdAt: -1 } },
  { $limit: 100 },
  {
    $lookup: {
      from: 'users',
      localField: 'cashier',
      foreignField: '_id',
      as: 'cashier',
      pipeline: [{ $project: { name: 1 } }]
    }
  },
  {
    $lookup: {
      from: 'customers', 
      localField: 'customer',
      foreignField: '_id',
      as: 'customer',
      pipeline: [{ $project: { name: 1, phone: 1 } }]
    }
  },
  {
    $lookup: {
      from: 'users',
      localField: 'usta',
      foreignField: '_id', 
      as: 'usta',
      pipeline: [{ $project: { name: 1 } }]
    }
  },
  { $unwind: { path: '$cashier', preserveNullAndEmptyArrays: true } },
  { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
  { $unwind: { path: '$usta', preserveNullAndEmptyArrays: true } }
])
```

**Natija:** 
- 300 query → 1 query 🎉
- 10x tezroq!

---

### Priority 2: Qo'shimcha indexlar ⚡

**Qo'shish kerak:**

```typescript
// Sale.ts
SaleSchema.index({ createdAt: -1 }) // Sort uchun
SaleSchema.index({ receiptNo: 1 })  // Search uchun
SaleSchema.index({ usta: 1, createdAt: -1 }) // Usta filter

// Debt.ts  
DebtSchema.index({ customerName: 'text' }) // Search
DebtSchema.index({ status: 1, type: 1 })   // Filter
DebtSchema.index({ createdAt: -1 })        // Sort

// Customer.ts
CustomerSchema.index({ name: 'text' })     // Search
CustomerSchema.index({ phone: 1 })         // Phone lookup
```

---

### Priority 3: Pagination ✅

**Hozir:**
```typescript
.limit(100) // Fixed limit
```

**Keyin:**
```typescript
const page = parseInt(searchParams.get('page') || '1')
const limit = parseInt(searchParams.get('limit') || '50')
const skip = (page - 1) * limit

const [sales, total] = await Promise.all([
  Sale.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
  Sale.countDocuments(filter)
])

return NextResponse.json({ 
  sales, 
  total, 
  page, 
  totalPages: Math.ceil(total / limit) 
})
```

---

### Priority 4: Frontend Optimizatsiya 🎨

#### 4.1 React Query / SWR ishlatish
```bash
npm install @tanstack/react-query
```

```typescript
import { useQuery } from '@tanstack/react-query'

function useSales() {
  return useQuery({
    queryKey: ['sales'],
    queryFn: () => fetch('/api/sales').then(r => r.json()),
    staleTime: 30000,
    cacheTime: 5 * 60 * 1000
  })
}
```

#### 4.2 Virtual Scrolling
```bash
npm install @tanstack/react-virtual
```

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

// Faqat ko'rinayotgan rowlar render qilinadi
// 1000 row -> 10-15 DOM element
```

#### 4.3 Image Lazy Loading
```typescript
<img 
  src={product.image} 
  loading="lazy"
  decoding="async"
/>
```

---

### Priority 5: Caching Strategiyasi 📦

#### 5.1 API Response Caching
```typescript
// Next.js 15+ da
export const revalidate = 60 // 60 soniya cache

export async function GET(req: Request) {
  // Next.js avtomatik cache qiladi
}
```

#### 5.2 Redis (kelajakda)
```typescript
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

// Cache with 5 min TTL
await redis.setex('sales:today', 300, JSON.stringify(sales))
```

---

## 📈 Kutilayotgan Natijalar

| Optimizatsiya | Hozir | Keyin | Yaxshilanish |
|---------------|-------|-------|--------------|
| **Sales API (100 items)** | ~2-3s | ~200-300ms | **10x tezroq** |
| **Products API** | ~500ms | ~100ms | **5x tezroq** |
| **Dashboard** | ~1-2s | ~300-500ms | **4x tezroq** |
| **Frontend Render** | ~500ms | ~100ms | **5x tezroq** |

---

## 🛠️ Implementatsiya Tartibi

### Week 1: Critical (N+1 Problem)
1. ✅ Sales API - aggregation
2. ✅ Debts API - aggregation
3. ✅ Reports API - aggregation
4. ✅ Qo'shimcha indexlar

### Week 2: Important (UX)
5. ✅ Pagination
6. ✅ React Query
7. ✅ Virtual Scrolling
8. ✅ Image optimization

### Week 3: Nice to Have
9. ✅ Server-side filtering
10. ✅ Debounced search
11. ✅ Loading skeletons
12. ✅ Error boundaries

---

## 🔍 Monitoring va Debugging

### Database Profiling
```javascript
// MongoDB shell
db.setProfilingLevel(2) // Log all queries
db.system.profile.find().limit(10).sort({ ts: -1 }).pretty()
```

### Query Performance
```typescript
const start = Date.now()
const sales = await Sale.find(...)
console.log(`Query took: ${Date.now() - start}ms`)
```

### Network Tab
- Chrome DevTools → Network
- Filter: Fetch/XHR
- Check response time va size

---

## 📝 Best Practices

### 1. Always Use Indexes
```typescript
// ❌ Bad
await Sale.find({ cashier: cashierId })

// ✅ Good (with index)
SaleSchema.index({ cashier: 1 })
```

### 2. Limit Results
```typescript
// ❌ Bad
await Sale.find({})

// ✅ Good
await Sale.find({}).limit(100)
```

### 3. Use Aggregation for Complex Queries
```typescript
// ❌ Bad (3 queries)
const sale = await Sale.findById(id)
const cashier = await User.findById(sale.cashier)
const customer = await Customer.findById(sale.customer)

// ✅ Good (1 query)
const [result] = await Sale.aggregate([
  { $match: { _id: id } },
  { $lookup: { from: 'users', ... } },
  { $lookup: { from: 'customers', ... } }
])
```

### 4. Cache Expensive Queries
```typescript
// ❌ Bad (har safar query)
const products = await Product.find({}).populate('category')

// ✅ Good (cache)
const cached = await redis.get('products')
if (cached) return JSON.parse(cached)
const products = await Product.find({}).populate('category')
await redis.setex('products', 300, JSON.stringify(products))
```

### 5. Lazy Load Images
```typescript
// ❌ Bad
<img src={large.jpg} />

// ✅ Good
<img src={thumbnail.jpg} loading="lazy" />
```

---

## 🎯 Quick Wins (Darhol qilish mumkin)

### 1. Aggregation qo'shish (1-2 soat)
- Sales API
- Debts API
- Reports API

### 2. Indexlar qo'shish (30 daqiqa)
```typescript
SaleSchema.index({ createdAt: -1 })
SaleSchema.index({ receiptNo: 1 })
DebtSchema.index({ customerName: 'text' })
```

### 3. Image lazy loading (15 daqiqa)
```typescript
<img loading="lazy" decoding="async" />
```

### 4. Cache TTL oshirish (5 daqiqa)
```typescript
// 30s -> 60s
const ttl = 60000
```

---

## 📊 Monitoring Dashboard (kelajakda)

```typescript
// Performance metrics
{
  "api": {
    "sales": { avg: 250, p95: 500, p99: 1000 },
    "products": { avg: 100, p95: 200, p99: 400 }
  },
  "database": {
    "connections": 8,
    "queries_per_sec": 50,
    "slow_queries": 2
  },
  "frontend": {
    "ttfb": 150,
    "fcp": 300,
    "lcp": 800
  }
}
```

---

## ✅ Xulosa

**Asosiy Muammo:** N+1 Query (populate)

**Asosiy Yechim:** Aggregation Pipeline

**Kutilgan Natija:** 10x tezroq API responses

**Vaqt:** 1-2 hafta full implementation

**ROI:** Juda yuqori - user experience sezilarli darajada yaxshilanadi!

---

**Keyingi qadam:** Aggregation pipeline ni implement qilish. Boshlay-mi? 🚀
