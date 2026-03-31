# 🔒 XAVFSIZLIK YO'RIQNOMASI

## ⚠️ JIDDIY MUAMMO TUZATILDI!

**Muammo:** Barcha ma'lumotlar ochiq edi - authentication yo'q edi!

**Yechim:** Quyidagi o'zgarishlar kiritildi:

### 1. ✅ Middleware qo'shildi (`middleware.ts`)
- Barcha sahifalar himoyalandi
- Faqat login sahifasi ochiq
- API routelar ham himoyalangan

### 2. ✅ AppLayout da authentication tekshiruvi
- Session yo'q bo'lsa, login sahifasiga yo'naltiradi
- Loading holatini ko'rsatadi

## 🚨 DARHOL BAJARING:

### 1. Serverni qayta ishga tushiring
```bash
# Ctrl+C bilan to'xtating
# Keyin qayta ishga tushiring:
npm run dev
```

### 2. Tekshiring
1. Brauzerda saytni oching
2. Logout qiling
3. Boshqa sahifaga kirishga harakat qiling
4. Login sahifasiga yo'naltirilishi kerak

### 3. Parollarni o'zgartiring
Barcha foydalanuvchilar parollarini o'zgartirsin:
- Sozlamalar → Parolni o'zgartirish

## 🔐 Xavfsizlik qoidalari:

### ❌ QILMANG:
- Parolni boshqalarga bermang
- Ochiq Wi-Fi da ishlamang
- Brauzerda "Remember me" ni ishlatmang
- Kompyuterdan ketayotganda logout qilmasdan ketmang

### ✅ QILING:
- Kuchli parol ishlating (kamida 8 ta belgi)
- Har safar ishdan keyin logout qiling
- Faqat ishonchli kompyuterda ishlang
- Parolni muntazam o'zgartiring (har oyda)

## 🛡️ Qo'shimcha himoya:

### 1. HTTPS ishlatish (production uchun)
```bash
# SSL sertifikat olish (Let's Encrypt)
# Domain bo'lsa:
sudo certbot --nginx -d yourdomain.com
```

### 2. Firewall sozlash
```bash
# Faqat kerakli portlarni ochish
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 3. Database himoyasi
```env
# .env.local da
MONGODB_URI=mongodb://username:password@localhost:27017/inomaka
```

### 4. Rate limiting (kelajakda)
API ga ko'p so'rov yuborishni cheklash

## 📋 Xavfsizlik tekshiruv ro'yxati:

- [x] Middleware qo'shildi
- [x] AppLayout authentication
- [ ] HTTPS sozlandi (production)
- [ ] Database parol o'rnatildi
- [ ] Firewall sozlandi
- [ ] Barcha foydalanuvchilar parolini o'zgartirdi
- [ ] Backup tizimi sozlandi
- [ ] Error logging yoqildi

## 🆘 Muammo bo'lsa:

1. Darhol serverni to'xtating
2. Backup tiklang
3. Muammoni aniqlang
4. Yordam so'rang

## 📞 Qo'llab-quvvatlash:

Agar xavfsizlik muammosi topsangiz, darhol xabar bering!

---

**Eslatma:** Bu yo'riqnomani o'qing va bajaring. Xavfsizlik - eng muhim narsa!
