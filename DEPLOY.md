# VPS Deploy (Ubuntu 22/24 + Domen)

## 1. VPS ga kirish
```bash
ssh root@YOUR_VPS_IP
```

## 2. System yangilash + kerakli paketlar
```bash
apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx ufw
```

## 3. Node.js 20 o'rnatish
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v  # v20.x
```

## 4. MongoDB o'rnatish
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod
mongosh --eval "db.runCommand({ping:1})"  # test
```

## 5. Firewall sozlash
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

## 6. Loyihani klonlash
```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/YOUR_USER/inomaka-crm.git
cd inomaka-crm
```

## 7. Environment sozlash
```bash
cat > .env.local << 'EOF'
MONGODB_URI=mongodb://127.0.0.1:27017/inomaka-crm
NEXTAUTH_SECRET=your-random-secret-here-change-me
NEXTAUTH_URL=https://inomaka.biznesjon.uz
EOF
```
> `NEXTAUTH_SECRET` generatsiya: `openssl rand -base64 32`

## 8. Build
```bash
npm install
npm run build
```

## 9. Seed (admin user)
```bash
npm run seed
```

## 10. PM2 bilan ishga tushirish
```bash
npm install -g pm2
pm2 start npm --name "inomaka-crm" -- start
pm2 save
pm2 startup  # reboot dan keyin avtomatik ishga tushadi
```

## 11. Nginx konfiguratsiya
```bash
cat > /etc/nginx/sites-available/inomaka-crm << 'EOF'
server {
    listen 80;
    server_name inomaka.biznesjon.uz;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/inomaka-crm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

## 12. SSL sertifikat (Let's Encrypt)
> DNS da domen A record VPS IP ga yo'naltirilgan bo'lishi kerak!

```bash
certbot --nginx -d inomaka.biznesjon.uz
```
Certbot so'rasa:
- Email: o'zingizniki
- Agree: Y
- Redirect HTTP to HTTPS: 2 (Yes)

Avtomatik yangilanish tekshirish:
```bash
certbot renew --dry-run
```

## 13. Test
```bash
curl -I https://inomaka.biznesjon.uz
# HTTP/2 200 bo'lishi kerak

curl https://inomaka.biznesjon.uz/api/auth/providers
# {"credentials":...} qaytishi kerak
```

Brauzerda: `https://inomaka.biznesjon.uz` → Login: **admin / admin123**

## 14. Yangilash (keyinchalik)
```bash
cd /var/www/inomaka-crm
git pull
npm install
npm run build
pm2 restart inomaka-crm
```

---

## Xulosa (buyruqlar ketma-ketligi)
```
ssh root@VPS_IP
apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
# MongoDB o'rnatish (yuqoridagi 4-qadam)
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
cd /var/www && git clone https://github.com/Biznesjon-Official/inom-aka.git && cd inomaka-crm
# .env.local yaratish
npm install && npm run build && npm run seed
npm i -g pm2 && pm2 start npm --name "inomaka-crm" -- start && pm2 save && pm2 startup
# Nginx config (yuqoridagi 11-qadam)
certbot --nginx -d inomaka.biznesjon.uz
curl -I https://inomaka.biznesjon.uz
```
