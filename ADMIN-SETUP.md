# Admin User Setup

## Admin yaratish

Admin user yaratish uchun quyidagi buyruqni ishga tushiring:

```bash
npm run create:admin
```

## Login ma'lumotlari

Script ishga tushgandan keyin quyidagi ma'lumotlar bilan login qilishingiz mumkin:

```
Username: admin
Password: admin123
```

## Birinchi kirish

1. Brauzerda loyihani oching: `http://localhost:3000` yoki production URL
2. Login sahifasiga o'ting
3. Yuqoridagi ma'lumotlar bilan kirish
4. Sozlamalar sahifasiga o'ting va parolni o'zgartiring

## Parolni o'zgartirish

Admin sifatida kirganingizdan keyin:

1. Sozlamalar sahifasiga o'ting
2. "Parolni o'zgartirish" bo'limini toping
3. Yangi parol kiriting va saqlang

## Xavfsizlik

⚠️ **MUHIM**: 
- Birinchi kirishdan keyin darhol parolni o'zgartiring!
- Standart parol (`admin123`) xavfsiz emas
- Kuchli parol ishlating (kamida 8 ta belgi, harflar va raqamlar)
- Parolni hech kimga bermang

## Muammolar

Agar login qila olmasangiz:

1. MongoDB ulanganligini tekshiring
2. Admin user yaratilganligini tekshiring:
   ```bash
   npm run create:admin
   ```
3. `.env.local` faylida `NEXTAUTH_SECRET` sozlanganligini tekshiring
4. Brauzer cache ni tozalang va qaytadan urinib ko'ring

## Qo'shimcha foydalanuvchilar

Yangi foydalanuvchilar (ishchilar/ustalar) qo'shish uchun:

1. Admin sifatida kirish
2. "Ishchilar" yoki "Ustalar" sahifasiga o'tish
3. "Yangi qo'shish" tugmasini bosish
4. Ma'lumotlarni to'ldirish va saqlash

Har bir foydalanuvchi o'z username va paroli bilan kiradi.
