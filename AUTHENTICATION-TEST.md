# 🔐 Authentication Test Yo'riqnomasi

## ✅ Nima qilindi:

### 1. Middleware qo'shildi
- Barcha sahifalar va API routelar himoyalandi
- Login sahifasi va `/api/auth/*` ochiq qoldirildi
- Session yo'q bo'lsa, avtomatik login sahifasiga yo'naltiradi

### 2. AppLayout authentication
- Session tekshiruvi qo'shildi
- Loading holatini ko'rsatadi
- Session yo'q bo'lsa, login sahifasiga yo'naltiradi

### 3. API himoyasi
- `requireAuth()` utility funksiya yaratildi
- Muhim API routelarga qo'shimcha himoya qo'shildi

## 🧪 Test qilish:

### Test 1: Login sahifasi
1. Brauzerda `http://localhost:3000/login` oching
2. ✅ Login sahifasi ochilishi kerak
3. ✅ Login forma ko'rinishi kerak

### Test 2: Login qilish
1. Login: `admin` (yoki sizning username)
2. Parol: sizning parolingiz
3. "Kirish" tugmasini bosing
4. ✅ Dashboard yoki Kassa sahifasiga yo'naltirilishi kerak

### Test 3: Himoyalangan sahifalar
1. Logout qiling
2. Brauzerda `http://localhost:3000/dashboard` oching
3. ✅ Avtomatik login sahifasiga yo'naltirilishi kerak

### Test 4: API himoyasi
1. Logout qiling
2. Brauzerda `http://localhost:3000/api/products` oching
3. ✅ 401 Unauthorized xatosi ko'rinishi kerak

### Test 5: Login qilib API
1. Login qiling
2. Brauzerda `http://localhost:3000/api/products` oching
3. ✅ Mahsulotlar ro'yxati JSON formatda ko'rinishi kerak

## 🐛 Muammolar va yechimlar:

### Muammo 1: Login qilib bo'lmayapti
**Yechim:**
```bash
# Serverni qayta ishga tushiring
# Ctrl+C
npm run dev
```

### Muammo 2: "Unauthorized" xatosi
**Yechim:**
1. Logout qiling
2. Qayta login qiling
3. Browser cache ni tozalang (Ctrl+Shift+Delete)

### Muammo 3: Middleware ishlamayapti
**Yechim:**
```bash
# .next papkasini o'chiring va qayta build qiling
rm -rf .next
npm run dev
```

### Muammo 4: Session saqlanmayapti
**Yechim:**
`.env.local` faylida `NEXTAUTH_SECRET` borligini tekshiring:
```env
NEXTAUTH_SECRET=your-secret-key-here
```

## 📋 Xavfsizlik tekshiruv ro'yxati:

- [x] Middleware qo'shildi
- [x] AppLayout authentication
- [x] API himoyasi (requireAuth)
- [x] Login sahifasi ishlayapti
- [ ] Barcha foydalanuvchilar parolini o'zgartirdi
- [ ] HTTPS sozlandi (production)
- [ ] Database parol o'rnatildi

## 🚀 Keyingi qadamlar:

1. ✅ Serverni qayta ishga tushiring
2. ✅ Barcha testlarni o'tkazing
3. ✅ Parollarni o'zgartiring
4. ✅ Har kuni backup oling

## 💡 Maslahatlar:

- Har safar logout qiling (ish tugagandan keyin)
- Kuchli parol ishlating
- Parolni hech kimga bermang
- Shubhali faoliyat ko'rsangiz, darhol xabar bering

---

**Eslatma:** Agar biror test muvaffaqiyatsiz bo'lsa, darhol xabar bering!
