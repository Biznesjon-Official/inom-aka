# Production Server Setup

## 1. MongoDB ulanish muammosi

Agar `MongoServerSelectionError: Socket 'secureConnect' timed out` xatosi chiqsa:

### Serverda `.env.local` faylini tekshiring:

```bash
cd /root/inomaka-crm
cat .env.local
```

### To'g'ri sozlamalar:

```env
MONGODB_URI=mongodb+srv://inomboy5558:inomboy5558@cluster0.5lvn7eu.mongodb.net/?appName=Cluster0
NEXTAUTH_SECRET=inomaka-crm-super-secret-2026
NEXTAUTH_URL=https://inomaka.biznesjon.uz
TELEGRAM_BOT_TOKEN=8699360195:AAEmtY_45l3fnBDpTsgu-MwCd0-D9VCa6Sk
TELEGRAM_CHAT_IDS=6583615169,215014807
```

### Agar fayl yo'q bo'lsa, yarating:

```bash
cd /root/inomaka-crm
nano .env.local
```

Yuqoridagi ma'lumotlarni kiriting, keyin:
- `Ctrl + O` - saqlash
- `Enter` - tasdiqlash
- `Ctrl + X` - chiqish

## 2. MongoDB Atlas sozlamalari

MongoDB Atlas da IP whitelist tekshiring:

1. https://cloud.mongodb.com ga kiring
2. Network Access bo'limiga o'ting
3. Server IP ni qo'shing: `45.67.216.61`
4. Yoki `0.0.0.0/0` (barcha IP lar) qo'shing

## 3. PM2 ni qayta ishga tushiring

```bash
cd /root/inomaka-crm
pm2 restart 4
pm2 logs 4
```

## 4. Admin user yaratish

MongoDB ulanishdan keyin:

```bash
cd /root/inomaka-crm
npm run create:admin
```

Bu admin user yaratadi:
- Username: `admin`
- Password: `admin123`

## 5. Tekshirish

```bash
# Logs ni ko'rish
pm2 logs 4

# Status ni ko'rish
pm2 status

# Saytni ochish
curl http://localhost:3001
```

## 6. Agar hali ham ishlamasa

### MongoDB connection string ni test qiling:

```bash
node -e "const mongoose = require('mongoose'); mongoose.connect('mongodb+srv://inomboy5558:inomboy5558@cluster0.5lvn7eu.mongodb.net/?appName=Cluster0').then(() => console.log('Connected!')).catch(err => console.error('Error:', err))"
```

### Firewall tekshiring:

```bash
# Outbound connections ochiq ekanligini tekshiring
curl -I https://cloud.mongodb.com
```

## 7. Xavfsizlik

Production da ishlagandan keyin:

1. Admin parolni o'zgartiring (Sozlamalar sahifasida)
2. `NEXTAUTH_SECRET` ni yangilang:
   ```bash
   openssl rand -base64 32
   ```
3. MongoDB parolini yangilang

## Tez-tez uchraydigan xatolar:

### "Login yoki parol noto'g'ri"
- MongoDB ulanmagan
- Admin user yaratilmagan
- `.env.local` da `NEXTAUTH_URL` noto'g'ri

### "MongoServerSelectionError"
- MongoDB Atlas IP whitelist
- Internet ulanishi
- MongoDB URI noto'g'ri

### "Unauthorized"
- Session yo'q
- Cookie bloklangan
- NEXTAUTH_SECRET noto'g'ri
