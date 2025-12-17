# 🚀 Quick Deployment Guide

This is a simplified guide to get your chat application deployed quickly.

---

## 🎯 Choose Your Deployment Method

### Option 1: Cloud Platform (Easiest - Recommended for Beginners)
**Time:** 15-30 minutes  
**Cost:** Free tier available  
**Best for:** Quick deployment, no server management

### Option 2: VPS/Server (More Control)
**Time:** 1-2 hours  
**Cost:** $5-20/month  
**Best for:** Full control, custom configurations

### Option 3: Docker (Modern Approach)
**Time:** 30 minutes  
**Cost:** Depends on hosting  
**Best for:** Containerized deployment, easy scaling

---

## 🌐 Option 1: Deploy to Railway.app (Easiest)

### Step 1: Prepare Your Code

1. **Update API URLs in desktop app:**
   ```bash
   # You'll need to do this after getting your Railway URL
   # We'll come back to this
   ```

2. **Push code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/your-repo.git
   git push -u origin main
   ```

### Step 2: Deploy Server to Railway

1. Go to [Railway.app](https://railway.app) and sign up

2. Click **"New Project"** → **"Deploy from GitHub repo"**

3. Select your repository

4. **Add MongoDB Database:**
   - Click **"New"** → **"Database"** → **"Add MongoDB"**
   - Railway will automatically create a MongoDB instance

5. **Configure Server:**
   - Click on your service
   - Go to **"Settings"**
   - Set **Root Directory**: `packages/server`
   - Set **Start Command**: `npm start`

6. **Add Environment Variables:**
   - Go to **"Variables"** tab
   - Click **"New Variable"**
   - Add these variables:
     ```
     NODE_ENV=production
     JWT_SECRET=your-random-secret-key-here
     CORS_ORIGIN=*
     ```
   - Railway automatically provides `MONGODB_URI` from the database

7. **Deploy:**
   - Click **"Deploy"**
   - Wait for deployment to complete
   - Copy your deployment URL (e.g., `https://your-app.up.railway.app`)

### Step 3: Build Desktop App

1. **Update API URLs:**
   
   Edit `packages/shared/api.js`:
   ```javascript
   const API_URL = 'https://your-app.up.railway.app/api';
   ```
   
   Edit `packages/shared/hooks/useSocket.js`:
   ```javascript
   const SOCKET_URL = 'https://your-app.up.railway.app';
   ```

2. **Build the app:**
   ```bash
   # On Windows
   build-production.bat
   
   # On Mac/Linux
   chmod +x build-production.sh
   ./build-production.sh
   ```

3. **Distribute:**
   - Find installer in `packages/desktop/dist/`
   - Share with users!

**✅ Done! Your app is deployed!**

---

## 🖥️ Option 2: Deploy to VPS (DigitalOcean/AWS)

### Step 1: Create VPS

1. Sign up for [DigitalOcean](https://www.digitalocean.com) or [AWS](https://aws.amazon.com)
2. Create a new Droplet/EC2 instance:
   - OS: Ubuntu 22.04 LTS
   - Size: Basic ($6/month)
   - Add SSH key

### Step 2: Connect and Setup

```bash
# Connect to your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod

# Install PM2
npm install -g pm2
```

### Step 3: Deploy Application

```bash
# Clone your repository
cd /var/www
git clone https://github.com/yourusername/your-repo.git chat-app
cd chat-app

# Install dependencies
npm install
cd packages/server
npm install

# Create .env file
nano .env
```

Add this content:
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chatapp
JWT_SECRET=your-super-secret-key-here
CORS_ORIGIN=*
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

```bash
# Start with PM2
pm2 start server.js --name chat-server
pm2 save
pm2 startup
```

### Step 4: Setup Nginx (Optional but Recommended)

```bash
# Install Nginx
apt install -y nginx

# Create config
nano /etc/nginx/sites-available/chat-app
```

Add this:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/chat-app /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Step 5: Setup SSL (Free with Let's Encrypt)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d your-domain.com

# Test auto-renewal
certbot renew --dry-run
```

### Step 6: Build Desktop App

Same as Option 1, Step 3 - but use your VPS IP or domain instead.

**✅ Done!**

---

## 🐳 Option 3: Deploy with Docker

### Step 1: Install Docker

**On Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt install -y docker-compose
```

**On Windows/Mac:**
- Download [Docker Desktop](https://www.docker.com/products/docker-desktop)

### Step 2: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit with your values
nano .env
```

Update these values:
```env
MONGO_USERNAME=admin
MONGO_PASSWORD=your-secure-password
JWT_SECRET=your-secret-key
CORS_ORIGIN=*
```

### Step 3: Deploy

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

Your server will be running at `http://localhost:5000`

### Step 4: Build Desktop App

Same as previous options - update URLs and build.

**✅ Done!**

---

## 📱 Building Desktop App for Distribution

### Windows

```bash
cd packages/desktop
npm run build
```

Output: `dist/ChatApp Setup 1.0.0.exe`

**Distribute:**
- Upload to your website
- Share download link
- Or use Microsoft Store

### macOS

```bash
cd packages/desktop
npm run build
```

Output: `dist/ChatApp-1.0.0.dmg`

**Note:** Requires macOS to build. For code signing, you need an Apple Developer account.

### Linux

```bash
cd packages/desktop
npm run build
```

Output: `dist/ChatApp-1.0.0.AppImage`

---

## ✅ Post-Deployment Checklist

- [ ] Server is running and accessible
- [ ] MongoDB is connected
- [ ] Can register a new user
- [ ] Can send messages
- [ ] Can upload files
- [ ] Desktop app connects to server
- [ ] SSL certificate installed (production)
- [ ] Environment variables are secure
- [ ] Backups are configured

---

## 🆘 Troubleshooting

### Server won't start
```bash
# Check logs
pm2 logs chat-server
# or
docker-compose logs server
```

### Can't connect to MongoDB
```bash
# Check MongoDB status
systemctl status mongod
# or
docker-compose logs mongodb
```

### Desktop app can't connect
- Check if server URL is correct in `api.js` and `useSocket.js`
- Check if server is running: `curl http://your-server-url/api/health`
- Check CORS settings in server `.env`

### Port already in use
```bash
# Find what's using port 5000
lsof -i :5000
# or on Windows
netstat -ano | findstr :5000

# Kill the process or change port in .env
```

---

## 📚 Need More Help?

- **Full Documentation:** See `DEPLOYMENT.md`
- **Application Review:** See `.agent/application_review.md`
- **Issues:** Check server logs and browser console

---

## 🎉 Success!

Your chat application is now deployed and ready to use!

**Next Steps:**
1. Test all features
2. Invite users to try it
3. Monitor performance
4. Plan updates and improvements

---

**Quick Links:**
- Railway: https://railway.app
- DigitalOcean: https://www.digitalocean.com
- MongoDB Atlas: https://www.mongodb.com/cloud/atlas
- Let's Encrypt: https://letsencrypt.org
