const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const { authenticateSocket } = require('./middleware/auth');
const MessageService = require('./services/MessageService');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Socket.io connection handling
const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Authenticate socket connection
  socket.on('authenticate', async (token) => {
    try {
      const user = await authenticateSocket(token);
      if (user) {
        socket.userId = user._id.toString();
        onlineUsers.set(socket.userId, socket.id);

        // Broadcast user online status
        io.emit('user:online', { userId: socket.userId });

        // Send list of online users to the new client
        const onlineUserIds = Array.from(onlineUsers.keys());
        socket.emit('users:online:list', { onlineUsers: onlineUserIds });

        socket.emit('authenticated', { userId: socket.userId });
        console.log(`User ${socket.userId} authenticated`);
      }
    } catch (error) {
      socket.emit('auth:error', { message: 'Authentication failed' });
    }
  });

  // Send private message
  socket.on('message:send', async (data) => {
    try {
      const { recipientId, content, type, fileUrl, fileName, fileSize } = data;

      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Save message to bucket using MessageService
      const savedMessage = await MessageService.sendMessage({
        sender: socket.userId,
        recipient: recipientId,
        content,
        type: type || 'text',
        fileUrl,
        fileName,
        fileSize
      });

      const recipientSocketId = onlineUsers.get(recipientId);

      const messageData = {
        ...savedMessage,
        senderId: socket.userId,
        recipientId,
        timestamp: savedMessage.createdAt
      };

      // Send to recipient if online
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('message:receive', messageData);
      }

      // Confirm to sender with saved message data
      socket.emit('message:sent', messageData);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing:start', (data) => {
    const { recipientId } = data;
    const recipientSocketId = onlineUsers.get(recipientId);

    if (recipientSocketId) {
      io.to(recipientSocketId).emit('typing:start', { userId: socket.userId });
    }
  });

  socket.on('typing:stop', (data) => {
    const { recipientId } = data;
    const recipientSocketId = onlineUsers.get(recipientId);

    if (recipientSocketId) {
      io.to(recipientSocketId).emit('typing:stop', { userId: socket.userId });
    }
  });

  // Group message
  socket.on('group:message', async (data) => {
    try {
      const { groupId, content, type, fileUrl, fileName, fileSize } = data;

      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Save message to bucket using MessageService
      const savedMessage = await MessageService.sendMessage({
        sender: socket.userId,
        group: groupId,
        content,
        type: type || 'text',
        fileUrl,
        fileName,
        fileSize
      });

      const messageData = {
        ...savedMessage,
        senderId: socket.userId,
        groupId,
        timestamp: savedMessage.createdAt
      };

      // Broadcast to all group members (will implement group membership check)
      io.emit('group:message:receive', messageData);
    } catch (error) {
      console.error('Error sending group message:', error);
      socket.emit('error', { message: 'Failed to send group message' });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      io.emit('user:offline', { userId: socket.userId });
      console.log(`User ${socket.userId} disconnected`);
    }
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = { app, io };
