# 🚀 Deployment Guide - Chat Application

This guide covers deploying both the **server** (backend) and **desktop application** (Electron app) for production use.

---

## 📋 Table of Contents

1. [Server Deployment](#server-deployment)
   - [Option 1: VPS (DigitalOcean, AWS EC2, etc.)](#option-1-vps-deployment)
   - [Option 2: Platform as a Service (Heroku, Railway, Render)](#option-2-platform-as-a-service)
   - [Option 3: Docker Deployment](#option-3-docker-deployment)
2. [Desktop App Distribution](#desktop-app-distribution)
3. [Environment Configuration](#environment-configuration)
4. [Security Checklist](#security-checklist)
5. [Monitoring & Maintenance](#monitoring--maintenance)

---

## 🖥️ Server Deployment

### Prerequisites
- Node.js 18+ installed
- MongoDB database (local or cloud like MongoDB Atlas)
- Domain name (optional but recommended)
- SSL certificate (Let's Encrypt recommended)

---

### Option 1: VPS Deployment

**Recommended for:** Full control, custom configurations

#### Step 1: Prepare Your VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Install Nginx (Reverse Proxy)
sudo apt install -y nginx

# Install Certbot (for SSL)
sudo apt install -y certbot python3-certbot-nginx
```

#### Step 2: Setup MongoDB

**Option A: Install MongoDB on VPS**
```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Create list file
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

**Option B: Use MongoDB Atlas (Recommended)**
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Get your connection string
4. Whitelist your server IP

#### Step 3: Deploy Application

```bash
# Create app directory
sudo mkdir -p /var/www/chat-app
cd /var/www/chat-app

# Clone your repository (or upload files)
git clone <your-repo-url> .

# Install dependencies
npm install

# Navigate to server package
cd packages/server
npm install
```

#### Step 4: Configure Environment Variables

```bash
# Create .env file
nano packages/server/.env
```

Add the following:
```env
# Server Configuration
NODE_ENV=production
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/chatapp
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chatapp

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# CORS Origins (your domain)
CORS_ORIGIN=https://yourdomain.com

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

#### Step 5: Setup PM2

```bash
# Start server with PM2
cd /var/www/chat-app/packages/server
pm2 start server.js --name chat-server

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions shown
```

#### Step 6: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/chat-app
```

Add this configuration:
```nginx
# HTTP - Redirect to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API and Socket.io
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads
    location /uploads {
        alias /var/www/chat-app/packages/server/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/chat-app /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### Step 7: Setup SSL with Let's Encrypt

```bash
# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

#### Step 8: Setup Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

### Option 2: Platform as a Service

#### Railway.app (Recommended - Easy & Free Tier)

1. **Create Account:** Go to [Railway.app](https://railway.app)

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository

3. **Configure Service:**
   ```bash
   # Railway will auto-detect Node.js
   # Set root directory to: packages/server
   ```

4. **Add Environment Variables:**
   - Go to Variables tab
   - Add all variables from `.env` file
   - Railway provides MongoDB plugin (click "New" → "Database" → "MongoDB")

5. **Deploy:**
   - Railway auto-deploys on git push
   - Get your deployment URL

#### Render.com

1. **Create Account:** Go to [Render.com](https://render.com)

2. **Create Web Service:**
   - New → Web Service
   - Connect repository
   - Root Directory: `packages/server`
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Add MongoDB:**
   - Create new MongoDB instance in Render
   - Copy connection string to environment variables

4. **Configure Environment:**
   - Add all environment variables
   - Set `NODE_ENV=production`

#### Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create your-chat-app

# Add MongoDB addon
heroku addons:create mongolab:sandbox

# Set environment variables
heroku config:set JWT_SECRET=your-secret-key
heroku config:set NODE_ENV=production

# Deploy
git subtree push --prefix packages/server heroku main
```

---

### Option 3: Docker Deployment

#### Create Dockerfile

```dockerfile
# packages/server/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose port
EXPOSE 5000

# Start application
CMD ["npm", "start"]
```

#### Create docker-compose.yml

```yaml
# docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:6
    container_name: chat-mongodb
    restart: always
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: your-secure-password
    ports:
      - "27017:27017"

  server:
    build: ./packages/server
    container_name: chat-server
    restart: always
    ports:
      - "5000:5000"
    environment:
      NODE_ENV: production
      PORT: 5000
      MONGODB_URI: mongodb://admin:your-secure-password@mongodb:27017/chatapp?authSource=admin
      JWT_SECRET: your-super-secret-jwt-key
    depends_on:
      - mongodb
    volumes:
      - ./packages/server/uploads:/app/uploads

volumes:
  mongodb_data:
```

#### Deploy with Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f server

# Stop
docker-compose down
```

---

## 💻 Desktop App Distribution

### Prerequisites

```bash
# Install dependencies
cd packages/desktop
npm install
```

### Update Configuration

Before building, update the API URL in your code:

**packages/shared/api.js:**
```javascript
// Change from localhost to your production server
const API_URL = 'https://api.yourdomain.com/api';
```

**packages/shared/hooks/useSocket.js:**
```javascript
// Change from localhost to your production server
const SOCKET_URL = 'https://api.yourdomain.com';
```

---

### Build for Windows

```bash
cd packages/desktop

# Build
npm run build

# The installer will be in: dist/ChatApp Setup 1.0.0.exe
```

**Distribution:**
- Upload to your website
- Use Microsoft Store (requires developer account)
- Use Chocolatey for package management

---

### Build for macOS

```bash
cd packages/desktop

# Build (requires macOS)
npm run build

# The installer will be in: dist/ChatApp-1.0.0.dmg
```

**Code Signing (Required for macOS):**
```bash
# Get Apple Developer account
# Install certificate
# Update package.json:
```

```json
{
  "build": {
    "mac": {
      "identity": "Developer ID Application: Your Name (TEAM_ID)",
      "hardenedRuntime": true,
      "entitlements": "build/entitlements.mac.plist"
    }
  }
}
```

**Distribution:**
- Upload to your website
- Submit to Mac App Store
- Use Homebrew Cask

---

### Build for Linux

```bash
cd packages/desktop

# Build
npm run build

# The installer will be in: dist/ChatApp-1.0.0.AppImage
```

**Distribution:**
- Upload to your website
- Create .deb and .rpm packages
- Submit to Snap Store or Flatpak

---

### Auto-Update Setup

Install electron-updater:

```bash
npm install electron-updater
```

**Update main.js:**
```javascript
const { autoUpdater } = require('electron-updater');

app.whenReady().then(() => {
    createWindow();
    
    // Check for updates
    autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on('update-available', () => {
    console.log('Update available');
});

autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall();
});
```

**Host update files:**
- Upload builds to GitHub Releases
- Or use your own server with proper file structure

---

## 🔐 Environment Configuration

### Production Environment Variables

Create `.env.production` files:

**Server (.env):**
```env
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/chatapp

# Security
JWT_SECRET=generate-a-very-strong-random-string-here
JWT_EXPIRE=7d

# CORS
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Desktop App:**
Update hardcoded URLs in:
- `packages/shared/api.js`
- `packages/shared/hooks/useSocket.js`

---

## 🔒 Security Checklist

### Server Security

- [ ] Use HTTPS/SSL certificates
- [ ] Set strong JWT_SECRET
- [ ] Enable CORS with specific origins
- [ ] Implement rate limiting
- [ ] Sanitize user inputs
- [ ] Use helmet.js for security headers
- [ ] Keep dependencies updated
- [ ] Use environment variables for secrets
- [ ] Enable MongoDB authentication
- [ ] Regular security audits (`npm audit`)
- [ ] Implement request validation
- [ ] Add CSP headers
- [ ] Enable CSRF protection

### Desktop App Security

- [ ] Enable context isolation
- [ ] Disable nodeIntegration
- [ ] Use preload scripts
- [ ] Validate all user inputs
- [ ] Code sign applications
- [ ] Implement auto-updates
- [ ] Use secure storage for tokens
- [ ] Regular dependency updates

---

## 📊 Monitoring & Maintenance

### Server Monitoring

**Install PM2 Monitoring:**
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

**Useful PM2 Commands:**
```bash
# View logs
pm2 logs chat-server

# Monitor resources
pm2 monit

# Restart app
pm2 restart chat-server

# View status
pm2 status

# Update app
cd /var/www/chat-app
git pull
cd packages/server
npm install
pm2 restart chat-server
```

### Application Monitoring

**Recommended Tools:**
- **Sentry** - Error tracking
- **LogRocket** - Session replay
- **New Relic** - Performance monitoring
- **Uptime Robot** - Uptime monitoring

### Backup Strategy

**MongoDB Backup:**
```bash
# Create backup script
nano /usr/local/bin/backup-mongodb.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"
mkdir -p $BACKUP_DIR

mongodump --out $BACKUP_DIR/backup_$DATE

# Keep only last 7 days
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} \;
```

```bash
# Make executable
chmod +x /usr/local/bin/backup-mongodb.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-mongodb.sh
```

---

## 🚀 Quick Deployment Checklist

### Pre-Deployment
- [ ] Test application locally
- [ ] Update all dependencies
- [ ] Run security audit
- [ ] Update API URLs in desktop app
- [ ] Set production environment variables
- [ ] Test with production database

### Server Deployment
- [ ] Choose hosting platform
- [ ] Setup MongoDB (Atlas or self-hosted)
- [ ] Configure environment variables
- [ ] Deploy application
- [ ] Setup SSL certificate
- [ ] Configure domain/DNS
- [ ] Test API endpoints
- [ ] Setup monitoring

### Desktop App Distribution
- [ ] Update API URLs
- [ ] Build for target platforms
- [ ] Code sign applications (macOS/Windows)
- [ ] Test installers
- [ ] Create release notes
- [ ] Upload to distribution channels
- [ ] Setup auto-update server

### Post-Deployment
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Test all features
- [ ] Setup automated backups
- [ ] Document deployment process
- [ ] Create rollback plan

---

## 📞 Support & Resources

- **MongoDB Atlas:** https://www.mongodb.com/cloud/atlas
- **Let's Encrypt:** https://letsencrypt.org/
- **PM2 Documentation:** https://pm2.keymetrics.io/
- **Electron Builder:** https://www.electron.build/
- **Railway:** https://railway.app/
- **Render:** https://render.com/

---

## 🎉 Congratulations!

Your chat application is now deployed and ready for production use!

**Next Steps:**
1. Monitor application performance
2. Gather user feedback
3. Plan feature updates
4. Regular security updates
5. Scale as needed

---

**Last Updated:** 2025-12-05  
**Version:** 1.0.0
