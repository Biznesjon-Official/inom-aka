---
inclusion: manual
---

# Test rejimi bo'yicha yo'riqnoma

## Test muhitini sozlash

1. Test database yarating:
```bash
# MongoDB Compass yoki mongosh orqali
use inomaka-test
```

2. `.env.local` faylida test database qo'shing:
```env
# Production
MONGODB_URI=mongodb://localhost:27017/inomaka

# Test (faqat test qilish uchun)
MONGODB_URI_TEST=mongodb://localhost:27017/inomaka-test
```

3. Test rejimda ishga tushirish:
```bash
MONGODB_URI=$MONGODB_URI_TEST npm run dev
```

## Test qilish jarayoni

### Har safar yangi funksiya qo'shganda:

1. ✅ Test database da sinab ko'ring
2. ✅ Barcha stsenariylarni tekshiring:
   - Oddiy holat
   - Xato holatlari
   - Chegara qiymatlari
3. ✅ Faqat ishonch hosil qilgandan keyin production ga o'tkazing

### Xavfli operatsiyalar:

- Sotuv qaytarish
- Qarz o'chirish
- Mahsulot o'chirish
- Narx o'zgartirish

Bu operatsiyalarni doim test database da sinab ko'ring!

## Backup strategiyasi

1. **Har kuni 2 marta backup:**
   - Ertalab ish boshida
   - Kechqurun ish oxirida

2. **Backup saqlash:**
   - Kompyuterda: `D:/Backups/inomaka/`
   - Google Drive yoki Dropbox
   - USB flash drive

3. **Backup nomlanishi:**
   - `inomaka_backup_2024-01-15_morning.zip`
   - `inomaka_backup_2024-01-15_evening.zip`

## Muammo yuzaga kelganda

1. **Darhol to'xtating** - boshqa operatsiya qilmang
2. **Oxirgi backupni tiklang**
3. **Muammoni aniqlang** - qaysi operatsiya xatoga olib keldi
4. **Test database da tuzating**
5. **Qayta sinab ko'ring**

## Xavfsizlik qoidalari

❌ **QILMANG:**
- Production database da test qilish
- Backup olmasdan katta o'zgarishlar kiritish
- Bir vaqtning o'zida ko'p operatsiya qilish

✅ **QILING:**
- Har doim backup oling
- Test database da sinang
- Asta-sekin o'zgartiring
- Har bir o'zgarishdan keyin tekshiring
