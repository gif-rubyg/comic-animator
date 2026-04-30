# Comic Animator — Deployment Guide
## Target: animate.crowncrew.dev (DigitalOcean Droplet)

---

## 1. Prerequisites on the Droplet

```bash
# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PM2
npm install -g pm2

# Install MySQL (if not already installed)
sudo apt-get install -y mysql-server
sudo mysql_secure_installation
```

---

## 2. Database Setup

```bash
# Create database and user
sudo mysql -u root -p
```

```sql
CREATE DATABASE comic_animator CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'comicapp'@'localhost' IDENTIFIED BY 'your-strong-password';
GRANT ALL PRIVILEGES ON comic_animator.* TO 'comicapp'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

```bash
# Run the migration
mysql -u comicapp -p comic_animator < scripts/migrate.sql
```

---

## 3. Clone & Configure

```bash
# Clone the repo
git clone https://github.com/gif-rubyg/comic-animator.git /var/www/comic-animator
cd /var/www/comic-an```bash
# Create .env manually
nano .env
```

Paste the following into `.env` (fill in your values):
```
DATABASE_URL=mysql://comicapp:your-strong-password@localhost:3306/comic_animator
JWT_SECRET=generate-a-64-char-random-string-here
NODE_ENV=production
PORT=3001
VITE_APP_TITLE=Comic Animator
VITE_APP_ID=
OAUTH_SERVER_URL=
OWNER_OPEN_ID=
OWNER_NAME=
VITE_OAUTH_PORTAL_URL=
VITE_ANALYTICS_ENDPOINT=
VITE_ANALYTICS_WEBSITE_ID=
VITE_APP_LOGO=
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_URL=
```

---

## 4. Install & Build

```bash
cd /var/www/comic-animator
pnpm install
pnpm build
```

---

## 5. Seed Users

```bash
node scripts/seed.mjs
```

This creates:
| Email | Password | Role |
|---|---|---|
| rubyg.lgd@gmail.com | Passw0rd000 | admin |
| miniwleder@gmail.com | Passw0rd001 | user |
| rubylen20@gmail.com | Passw0rd002 | user |

---

## 6. Create Uploads Directory

```bash
mkdir -p /var/www/comic-animator/uploads
chmod 755 /var/www/comic-animator/uploads
```

---

## 7. Start with PM2

```bash
cd /var/www/comic-animator
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## 8. Nginx Setup

```bash
sudo cp nginx.conf /etc/nginx/sites-available/comic-animator
sudo ln -s /etc/nginx/sites-available/comic-animator /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. SSL Certificate

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d animate.crowncrew.dev
```

---

## 10. Update Deployment

```bash
cd /var/www/comic-animator
git pull
pnpm install
pnpm build
pm2 restart comic-animator
```

---

## Troubleshooting

- **App not starting**: Check `pm2 logs comic-animator`
- **Database errors**: Verify `DATABASE_URL` in `.env`
- **Upload issues**: Ensure `uploads/` directory is writable
- **SSL errors**: Run `sudo certbot renew` to renew certificates
