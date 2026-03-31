# Environment Variables Setup

## Development (.env.local)

Local development uchun `.env.local` faylini yarating:

```env
MONGODB_URI=mongodb+srv://inomboy5558:inomboy5558@cluster0.5lvn7eu.mongodb.net/?appName=Cluster0
NEXTAUTH_SECRET=inomaka-crm-super-secret-2026
NEXTAUTH_URL=http://localhost:3000
TELEGRAM_BOT_TOKEN=8699360195:AAEmtY_45l3fnBDpTsgu-MwCd0-D9VCa6Sk
TELEGRAM_CHAT_IDS=6583615169,215014807
```

## Production (.env.production)

Production serverda `.env.production` faylini yarating:

```env
MONGODB_URI=mongodb+srv://inomboy5558:inomboy5558@cluster0.5lvn7eu.mongodb.net/?appName=Cluster0
NEXTAUTH_SECRET=inomaka-crm-super-secret-2026
NEXTAUTH_URL=https://inomaka.biznesjon.uz
TELEGRAM_BOT_TOKEN=8699360195:AAEmtY_45l3fnBDpTsgu-MwCd0-D9VCa6Sk
TELEGRAM_CHAT_IDS=6583615169,215014807
```

## Muhim farqlar

### NEXTAUTH_URL
- **Development**: `http://localhost:3000` (yoki qaysi portda ishlatayotgan bo'lsangiz)
- **Production**: `https://inomaka.biznesjon.uz` (sizning domain)

Bu juda muhim! Agar noto'g'ri URL bo'lsa, authentication ishlamaydi.

## Xavfsizlik

⚠️ **DIQQAT**: 
- `.env*` fayllar `.gitignore` da
- Hech qachon env fayllarni git ga commit qilmang
- Production parollarni xavfsiz saqlang
- `NEXTAUTH_SECRET` ni o'zgartiring (production uchun)

## Yangi secret yaratish

Yangi `NEXTAUTH_SECRET` yaratish uchun:

```bash
openssl rand -base64 32
```

yoki Node.js da:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
