# 👷 Ishchi huquqlari - Worker Permissions

## 📋 Umumiy ma'lumot

CRM tizimida 2 xil rol mavjud:
1. **Admin** - To'liq huquqlar
2. **Ishchi (Worker)** - Cheklangan huquqlar

---

## 🔐 Ishchi huquqlari

### ✅ Ishchi ko'ra oladi:

| № | Sahifa | Icon | Tavsif |
|---|--------|------|--------|
| 1 | **Kassa** | 🛒 | Sotuv qilish, mahsulot sotish |
| 2 | **Tovarlar** | 📦 | Mahsulotlarni ko'rish, qo'shish, tahrirlash |
| 3 | **Sotuvlar** | 🧾 | Barcha sotuvlarni ko'rish, chek chop etish |
| 4 | **Qarz daftarcha** | 📖 | Qarzlarni ko'rish, qo'shish, to'lovlarni qabul qilish |
| 5 | **Xarajatlar** | 📉 | Xarajatlarni ko'rish, qo'shish |
| 6 | **Ustalar** | 👥 | Ustalarni ko'rish, keshbek hisoblash |

### ❌ Ishchi ko'ra olmaydi:

| № | Sahifa | Icon | Sabab |
|---|--------|------|-------|
| 1 | **Dashboard** | 📊 | Boshqaruv uchun, faqat admin |
| 6 | **Shaxsiy qarzlar** | 💰 | Maxfiy ma'lumotlar |
| 9 | **Ishchilar** | 👷 | Xodimlarni boshqarish, faqat admin |
| 10 | **Sozlamalar** | ⚙️ | Tizim sozlamalari, faqat admin |

---

## 🔄 Admin vs Ishchi

### Admin ko'radi (10 ta):
```
✅ Dashboard
✅ Kassa
✅ Tovarlar
✅ Sotuvlar
✅ Qarz daftarcha
✅ Shaxsiy qarzlar
✅ Xarajatlar
✅ Ustalar
✅ Ishchilar
✅ Sozlamalar
```

### Ishchi ko'radi (6 ta):
```
✅ Kassa
✅ Tovarlar
✅ Sotuvlar
✅ Qarz daftarcha
✅ Xarajatlar
✅ Ustalar
```

---

## 🎯 Ishchi nima qila oladi?

### 1. **Kassa** 🛒
- ✅ Mahsulot qo'shish
- ✅ Sotuv qilish
- ✅ Naqd/karta/terminal to'lov qabul qilish
- ✅ Qarz yozish
- ✅ Chek chop etish
- ✅ Tovar qaytarish
- ✅ Usta tanlash

### 2. **Tovarlar** 📦
- ✅ Barcha tovarlarni ko'rish
- ✅ Tovar qo'shish
- ✅ Tovar tahrirlash
- ✅ Tovar rasmini yuklash
- ✅ Kategoriya qo'shish
- ✅ Stok miqdorini o'zgartirish
- ✅ Narxlarni belgilash

### 3. **Sotuvlar** 🧾
- ✅ Barcha sotuvlarni ko'rish
- ✅ Qidirish (mijoz, chek №)
- ✅ Filter (sana, to'lov turi)
- ✅ Chekni qayta chop etish
- ✅ Tovar qaytarish
- ✅ Statistika ko'rish

### 4. **Qarz daftarcha** 📖
- ✅ Barcha qarzlarni ko'rish
- ✅ Yangi qarz qo'shish
- ✅ To'lov qabul qilish
- ✅ Qarz cheki chop etish
- ✅ Qarzdorlarni qidirish
- ✅ Tovar qaytarish (qarzdan)

### 5. **Xarajatlar** 📉
- ✅ Barcha xarajatlarni ko'rish
- ✅ Yangi xarajat qo'shish
- ✅ Xarajat kategoriyasi qo'shish
- ✅ Xarajat manbai qo'shish
- ✅ Statistika ko'rish

### 6. **Ustalar** 👥
- ✅ Barcha ustalarni ko'rish
- ✅ Yangi usta qo'shish
- ✅ Keshbek hisoblash
- ✅ Keshbek to'lash
- ✅ Usta aktivlik statusini o'zgartirish

---

## ❌ Ishchi nima qila olmaydi?

### 1. **Dashboard** 📊
- ❌ Umumiy statistika
- ❌ Grafiklar
- ❌ Hisobotlar

### 2. **Shaxsiy qarzlar** 💰
- ❌ Shaxsiy qarzlarni ko'rish
- ❌ Qarz qo'shish/to'lash

### 3. **Ishchilar** 👷
- ❌ Ishchilarni ko'rish
- ❌ Yangi ishchi qo'shish
- ❌ Ishchi parolini o'zgartirish
- ❌ Ishchi huquqlarini o'zgartirish

### 4. **Sozlamalar** ⚙️
- ❌ Do'kon sozlamalari
- ❌ Parol o'zgartirish
- ❌ Backup yuklash
- ❌ Bank karta sozlamalari

---

## 🔒 Xavfsizlik

### Parol o'zgartirish:
- ❌ Ishchi o'z parolini **o'zgartira olmaydi**
- ✅ Faqat **admin** ishchi parolini o'zgartirishi mumkin

### Backup:
- ❌ Ishchi backup **yuklay olmaydi**
- ✅ Faqat **admin** backup olishi mumkin

### Tizim sozlamalari:
- ❌ Ishchi hech qanday **sozlamani o'zgartira olmaydi**
- ✅ Faqat **admin** sozlamalarga kirishi mumkin

---

## 🎓 Qo'shimcha ma'lumot

### Ishchi yaratish:
```
1. Admin sifatida kirish
2. Ishchilar sahifasiga o'tish
3. "Yangi ishchi" tugmasini bosish
4. Ma'lumotlarni to'ldirish
5. Role: "worker" tanlash
6. Saqlash
```

### Ishchi login qilish:
```
Username: ishchi123
Password: ishchi_paroli
Role: Worker (avtomatik)
```

### Ishchi logout qilish:
```
Sidebar → Chiqish tugmasi
```

---

## ✅ Xulosa

**Ishchi profilida:**
- ✅ 6 ta sahifa ko'rinadi
- ✅ Asosiy operatsiyalar (sotuv, tovar, qarz)
- ✅ To'liq CRUD huquqlari (qo'shish, o'zgartirish, o'chirish)
- ❌ Maxfiy ma'lumotlar yashirilgan
- ❌ Tizim sozlamalariga kirish yo'q
- ❌ Ishchilarni boshqarish yo'q

**Bu yondoshuv:**
- 🔒 Xavfsizlikni ta'minlaydi
- 👍 Ishchiga kerakli huquqlarni beradi
- 🚫 Keraksiz imkoniyatlarni yashiradi
- 📊 Adminning nazoratini saqlaydi

---

**Oxirgi yangilanish:** 2026-06-04
