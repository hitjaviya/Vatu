# Quick Start Guide

## Prerequisites

Before running the application, ensure you have:

1. **Node.js 18+** installed
2. **MongoDB** installed and running locally
3. **npm** package manager

## Installation

```bash
# Install all dependencies
npm install
```

This will install dependencies for all packages (server, desktop, shared).

## Running the Application

### Step 1: Start MongoDB

**Windows:**
```bash
net start MongoDB
```

**macOS:**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
```

### Step 2: Start the Backend Server

Open a terminal and run:

```bash
npm run dev:server
```

The server will start on `http://localhost:5000`

### Step 3: Start the Desktop App

Open another terminal and run:

```bash
npm run dev:desktop
```

This will:
1. Start the Vite dev server on `http://localhost:5173`
2. Launch the Electron desktop application

## First Time Setup

1. **Register a new account** - Click "Sign Up" on the login screen
2. **Create multiple accounts** - To test chat functionality, create 2-3 accounts
3. **Start chatting** - Select a user from the sidebar to begin messaging

## Features Available

### ✅ Phase 1 (Current)
- User registration and login
- One-to-one messaging
- Real-time message delivery
- File sharing (images, documents)
- Group chat creation and messaging
- Online/offline status indicators
- Typing indicators
- Beautiful modern UI with dark theme

### 📋 Coming Soon
- Voice/video calls
- Message reactions
- Message search
- User profiles
- Notifications
- Web version
- Mobile apps

## Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running: `mongod --version`
- Check if MongoDB service is active
- Verify connection string in `packages/server/.env`

### Port Already in Use
- Server (5000): Change `PORT` in `packages/server/.env`
- Vite (5173): Change port in `packages/desktop/vite.config.js`

### Dependencies Not Installing
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Project Structure

```
chat-app/
├── packages/
│   ├── server/          # Backend (Node.js + Express + Socket.io)
│   ├── desktop/         # Desktop app (Electron + React)
│   └── shared/          # Shared components and utilities
└── package.json         # Monorepo configuration
```

## Development Tips

- **Hot Reload**: Both server and desktop app support hot reload
- **DevTools**: Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac) in desktop app
- **Database**: Use MongoDB Compass to view database contents
- **API Testing**: Use Postman or curl to test API endpoints

## Building for Production

```bash
# Build desktop app
npm run build:desktop

# The built app will be in packages/desktop/dist/
```

## Support

For issues or questions, check the README.md or create an issue in the repository.
