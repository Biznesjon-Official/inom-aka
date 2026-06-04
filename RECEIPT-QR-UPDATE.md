# 📱 Chek dizayni yangilandi - QR Code va Table format

## ✅ Yangiliklar:

### 1. **Bank kartasi QR Code** 🎯
- Sozlamalarda bank karta raqamini kiritish mumkin
- Chekda avtomatik QR code paydo bo'ladi
- Mijozlar QR kodni skanerlash orqali to'lov qilishlari mumkin

### 2. **Table formatda mahsulotlar** 📊
- Mahsulotlar endi professional jadval ko'rinishida
- Ustunlar: №, Mahsulot, Soni, Narxi, Jami
- Ko'proq ma'lumot, kamroq joy

## 🔧 Qanday sozlash:

### 1. Sozlamalar sahifasiga kiring
```
Dashboard → Sozlamalar
```

### 2. Bank karta ma'lumotini kiriting
- **Karta raqami:** 8600 1234 5678 9012
- **yoki To'lov havolasi:** https://example.com/pay/yourshop

### 3. Saqlang
- "Saqlash" tugmasini bosing
- Sozlamalar darhol qo'llaniladi

## 📋 Chek ko'rinishi:

```
┌─────────────────────────────┐
│      Inomaka Do'kon         │
│       +998 XX XXX XX XX     │
│         Chek #123           │
├─────────────────────────────┤
│ Sana: 04.06.2026 14:30      │
│ Kassir: Admin               │
├─────────────────────────────┤
│ № │ Mahsulot │ Soni │ Narx │
├───┼──────────┼──────┼──────┤
│ 1 │ Tovar A  │ 2 d  │ 50K  │
│ 2 │ Tovar B  │ 1 m  │ 30K  │
├─────────────────────────────┤
│ JAMI:              80,000   │
├─────────────────────────────┤
│ To'landi: 80,000 so'm       │
├─────────────────────────────┤
│   Karta orqali to'lov       │
│      ┌─────────┐            │
│      │  █ ██ █ │  QR Code   │
│      │ ██  █ ██│            │
│      └─────────┘            │
│   QR kodni skanerlang       │
├─────────────────────────────┤
│ Rahmat! Yana tashrif buyur. │
│      Inomaka Do'kon         │
└─────────────────────────────┘
```

## 🎯 Xususiyatlar:

### QR Code:
- ✅ Avtomatik yaratiladi (agar bank karta ma'lumoti bo'lsa)
- ✅ 35mm x 35mm o'lchamda
- ✅ Chekda pastda joylashgan
- ✅ Mobil qurilmalar bilan oson skanerlash mumkin

### Table format:
- ✅ Professional ko'rinish
- ✅ Har bir mahsulot alohida qatorda
- ✅ Raqamlangan (1, 2, 3...)
- ✅ Aniq ustunlar (№, Mahsulot, Soni, Narxi, Jami)
- ✅ 80mm termal printer uchun optimallashtirilgan

## 📱 QR Code uchun maslahatlar:

### Karta raqami formati:
```
8600 1234 5678 9012
```

### Yoki to'lov havolasi:
```
https://payme.uz/merchant/12345
https://click.uz/pay/yourshop
```

### Yoki boshqa ma'lumot:
- Bank nomi va karta raqami
- Telegram bot havolasi
- WhatsApp raqami
- Ijtimoiy tarmoq havolasi

## 🔍 Qayerda ishlaydi:

✅ **Kassa sahifasi** - yangi sotuv qilganda
✅ **Sotuvlar sahifasi** - avvalgi chekni qayta chop etganda
✅ **Sales Log** - bugungi sotuvlarni chop etganda

## 🛠️ Texnik ma'lumotlar:

### Fayllar o'zgartirildi:
- `lib/print.ts` - QR Code va table format qo'shildi
- `app/(main)/sozlamalar/page.tsx` - Bank karta maydon qo'shildi
- `app/(main)/kassa/page.tsx` - Bank karta parametr qo'shildi
- `app/(main)/kassa/SalesLog.tsx` - Bank karta parametr qo'shildi
- `app/(main)/sotuvlar/page.tsx` - Bank karta parametr qo'shildi

### Ishlatilgan kutubxonalar:
- `qrcode` v1.5.4 - QR Code yaratish uchun
- `jsbarcode` v3.12.3 - Barcode yaratish uchun

## ✅ Test qilish:

1. **Sozlamalarni to'ldiring:**
   - Sozlamalar → Bank karta ma'lumoti
   - Masalan: `8600 1234 5678 9012`

2. **Sotuv qiling:**
   - Kassa → Mahsulot qo'shing
   - To'lov qiling

3. **Chekni tekshiring:**
   - QR Code paydo bo'lishi kerak
   - Mahsulotlar jadval formatda bo'lishi kerak

## 🎉 Xulosa:

- ✅ QR Code ishlaydi
- ✅ Table format yaxshi ko'rinadi
- ✅ Barcha sahifalarda qo'llaniladi
- ✅ Build muvaffaqiyatli
- ✅ Xatosiz ishlaydi

---

**Eslatma:** QR Code faqat bank karta ma'lumoti kiritilgan bo'lsa ko'rsatiladi. Agar bo'sh bo'lsa, QR Code chiqmaydi.
