# Chat Application

A cross-platform chat application built with Electron, React, and Node.js. Features include one-to-one messaging, file sharing, and group chat functionality.

## Tech Stack

- **Frontend**: React 18 with modern hooks
- **Desktop**: Electron for cross-platform desktop apps
- **Web**: Vite for fast web development
- **Backend**: Node.js + Express + Socket.io
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: WebSocket via Socket.io
- **Authentication**: JWT-based auth

## Project Structure

```
chat-app/
├── packages/
│   ├── desktop/          # Electron desktop application
│   ├── web/              # Web application (Vite + React)
│   ├── shared/           # Shared React components & utilities
│   └── server/           # Backend Node.js server
└── package.json          # Monorepo configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- MongoDB installed and running locally

### Installation

```bash
# Install all dependencies
npm install

# Start MongoDB (if not running)
# Windows: net start MongoDB
# macOS: brew services start mongodb-community
# Linux: sudo systemctl start mongod
```

### Development

```bash
# Terminal 1: Start backend server
npm run dev:server

# Terminal 2: Start desktop app
npm run dev:desktop

# Or start web app
npm run dev:web
```

### Building

```bash
# Build desktop app
npm run build:desktop

# Build web app
npm run build:web
```

## Features

### Phase 1 (Current)
- ✅ User authentication (register/login)
- ✅ One-to-one messaging
- ✅ Real-time message delivery
- ✅ Online/offline status

### Phase 2 (Planned)
- 📋 File sharing (images, documents)
- 📋 Image preview and gallery
- 📋 Drag-and-drop uploads

### Phase 3 (Planned)
- 📋 Group chat creation
- 📋 Group member management
- 📋 Group notifications

### Phase 4 (Future)
- 📋 Web version deployment
- 📋 React Native mobile apps
- 📋 Voice/video calls

## License

MIT
