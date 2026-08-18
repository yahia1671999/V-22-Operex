# Deployment Guide: Salarix Management System on VPS (Ubuntu)

This guide provides step-by-step instructions for deploying the Salarix ERP application on a VPS running Ubuntu.

## 1. Prerequisites

- SSH access to your VPS
- Domain name pointed to your VPS IP address
- Basic knowledge of the terminal

## 2. Server Preparation

Update your system and install necessary dependencies:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm nginx git
```

Install `pm2` globally to manage the Node.js process:

```bash
sudo npm install -g pm2
```

## 3. Clone and Install

Clone your repository and install dependencies:

```bash
git clone <your-repo-url> /var/www/salarix
cd /var/www/salarix
npm install
```

## 4. Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
nano .env
```

Ensure the following values are set:
- `PORT=3000`
- `NODE_ENV=production`
- `DATABASE_PATH=./server/database/app.db`
- `JWT_SECRET=your_secure_random_secret`
- `CLIENT_URL=https://your-domain.com`

## 5. Build for Production

Build the frontend and backend bundle:

```bash
npm run build
```

## 6. Database Setup

Ensure the database directory exists:

```bash
mkdir -p server/database
```

## 7. Starting the Server

Start the application using PM2:

```bash
pm2 start dist/server.cjs --name "salarix"
pm2 save
pm2 startup
```

## 8. Nginx Reverse Proxy

Copy the provided `salarix.nginx.conf` to `/etc/nginx/sites-available/` and enable it:

```bash
sudo cp salarix.nginx.conf /etc/nginx/sites-available/salarix
sudo ln -s /etc/nginx/sites-available/salarix /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 9. SSL Configuration (Let's Encrypt)

Secure your application with HTTPS:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## 10. Database Backups

Set up the automated backup script:

```bash
chmod +x backup-db.sh
# Add to crontab for daily backup at 3 AM
(crontab -l 2>/dev/null; echo "0 3 * * * /var/www/salarix/backup-db.sh") | crontab -
```

## 11. Firewall Setup

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```
