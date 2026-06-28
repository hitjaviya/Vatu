const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const config = require('./config/config');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const fileRoutes = require('./routes/files');
const { authenticateSocket } = require('./middleware/auth');
const MessageService = require('./services/MessageService');
const S3Service = require('./services/S3Service');
const SharedFile = require('./models/SharedFile');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = socketIo(server, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/files', fileRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Socket.io connection handling
const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {

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
      }
    } catch (error) {
      socket.emit('auth:error', { message: 'Authentication failed' });
    }
  });

  // Send private message
  socket.on('message:send', async (data) => {
    try {
      const { recipientId, content, type, fileUrl, fileName, fileSize, replyTo, tempId, sharedFileId } = data;

      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Resolve file details from SharedFile if forwarding
      let resolvedFileUrl = fileUrl;
      let resolvedFileName = fileName;
      let resolvedFileSize = fileSize;
      let resolvedType = type || 'text';
      let resolvedSharedFileId = sharedFileId || null;

      if (sharedFileId && !fileUrl) {
        // Forwarding a file — look up SharedFile, get fresh presigned URL
        const sharedFile = await SharedFile.findById(sharedFileId);
        if (sharedFile) {
          resolvedFileUrl = await S3Service.getDownloadUrl(sharedFile.s3Key);
          resolvedFileName = sharedFile.fileName;
          resolvedFileSize = sharedFile.fileSize;
          resolvedType = sharedFile.fileType;

          // Increment share count
          sharedFile.shareCount += 1;
          await sharedFile.save();
        } else {
          socket.emit('error', { message: 'Shared file not found' });
          return;
        }
      }

      // Save message to bucket using MessageService
      const savedMessage = await MessageService.sendMessage({
        sender: socket.userId,
        recipient: recipientId,
        content: content || resolvedFileName,
        type: resolvedType,
        fileUrl: resolvedFileUrl,
        fileName: resolvedFileName,
        fileSize: resolvedFileSize,
        replyTo,
        sharedFile: resolvedSharedFileId
      });


      const recipientSocketId = onlineUsers.get(recipientId);

      const messageData = {
        ...savedMessage,
        senderId: socket.userId,
        recipientId,
        timestamp: savedMessage.createdAt,
        delivered: true, // Mark as delivered if recipient is online
        deliveredAt: new Date(),
        ...(tempId && { tempId }) // Pass tempId back for optimistic update replacement
      };

      // Send to recipient if online
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('message:receive', messageData);
        // Emit delivery confirmation back to sender
        socket.emit('message:delivered', {
          messageId: savedMessage._id || savedMessage.id,
          deliveredAt: messageData.deliveredAt
        });
      } else {
        // If recipient is offline, send without delivered status
        socket.emit('message:sent', { ...messageData, delivered: false, deliveredAt: null });
        return;
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

  // Handle message read receipt
  socket.on('message:read', (data) => {
    const { messageId, senderId } = data;
    const senderSocketId = onlineUsers.get(senderId);

    if (senderSocketId) {
      // Notify sender that their message was read
      io.to(senderSocketId).emit('message:read', {
        messageId,
        readAt: new Date()
      });
    }
  });

  // Handle private message deletion
  socket.on('message:deleted', (data) => {
    const { messageId, chatId } = data;
    const recipientSocketId = onlineUsers.get(chatId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message:deleted', { messageId, chatId: socket.userId });
    }
  });

  // Handle group message deletion
  socket.on('group:message:deleted', (data) => {
    const { messageId, chatId } = data;
    io.emit('group:message:deleted', { messageId, groupId: chatId });
  });

  // Handle private message pin
  socket.on('message:pinned', (data) => {
    const { messageId, chatId, pinned } = data;
    const recipientSocketId = onlineUsers.get(chatId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message:pinned', { messageId, chatId: socket.userId, pinned });
    }
  });

  // Handle group message pin
  socket.on('group:message:pinned', (data) => {
    const { messageId, chatId, pinned } = data;
    io.emit('group:message:pinned', { messageId, groupId: chatId, pinned });
  });

  // Handle private message reaction
  socket.on('message:reaction', (data) => {
    const { messageId, chatId, reactions } = data;
    const recipientSocketId = onlineUsers.get(chatId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message:reaction', { messageId, chatId: socket.userId, reactions });
    }
  });

  // Handle group message reaction
  socket.on('group:message:reaction', (data) => {
    const { messageId, chatId, reactions } = data;
    io.emit('group:message:reaction', { messageId, groupId: chatId, reactions });
  });

  // Group message
  socket.on('group:message', async (data) => {
    try {
      const { groupId, content, type, fileUrl, fileName, fileSize, replyTo, tempId, sharedFileId } = data;



      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Resolve file details from SharedFile if forwarding
      let resolvedFileUrl = fileUrl;
      let resolvedFileName = fileName;
      let resolvedFileSize = fileSize;
      let resolvedType = type || 'text';
      let resolvedSharedFileId = sharedFileId || null;

      if (sharedFileId && !fileUrl) {
        // Forwarding a file — look up SharedFile, get fresh presigned URL
        const sharedFile = await SharedFile.findById(sharedFileId);
        if (sharedFile) {
          resolvedFileUrl = await S3Service.getDownloadUrl(sharedFile.s3Key);
          resolvedFileName = sharedFile.fileName;
          resolvedFileSize = sharedFile.fileSize;
          resolvedType = sharedFile.fileType;

          sharedFile.shareCount += 1;
          await sharedFile.save();
        } else {
          socket.emit('error', { message: 'Shared file not found' });
          return;
        }
      }

      // Save message to bucket using MessageService
      const savedMessage = await MessageService.sendMessage({
        sender: socket.userId,
        group: groupId,
        content: content || resolvedFileName,
        type: resolvedType,
        fileUrl: resolvedFileUrl,
        fileName: resolvedFileName,
        fileSize: resolvedFileSize,
        replyTo,
        sharedFile: resolvedSharedFileId
      });

      const messageData = {
        ...savedMessage,
        senderId: socket.userId,
        groupId,
        timestamp: savedMessage.createdAt,
        ...(tempId && { tempId })
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
    }
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
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server URL: ${config.serverUrl}`);
  console.log(`Client URL: ${config.clientUrl}`);
});

module.exports = { app, io };
