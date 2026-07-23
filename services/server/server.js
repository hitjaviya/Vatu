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
const friendRoutes = require('./routes/friends');
const themeRoutes = require('./routes/themes');
const { authenticateSocket } = require('./middleware/auth');
const MessageService = require('./services/MessageService');
const S3Service = require('./services/S3Service');
const aiRoutes = require('./routes/ai');
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
app.use('/api/friends', friendRoutes);
app.use('/api/themes', themeRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Socket.io connection handling
const onlineUsers = new Map(); // userId -> Set of socketIds

io.on('connection', (socket) => {

  // Authenticate socket connection
  socket.on('authenticate', async (token) => {
    try {
      const user = await authenticateSocket(token);
      if (user) {
        socket.userId = user._id.toString();
        if (!onlineUsers.has(socket.userId)) {
          onlineUsers.set(socket.userId, new Set());
        }
        onlineUsers.get(socket.userId).add(socket.id);

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

      const recipientSockets = onlineUsers.get(recipientId);
      const isRecipientOnline = recipientSockets && recipientSockets.size > 0;

      const messageData = {
        ...savedMessage,
        senderId: socket.userId,
        recipientId,
        timestamp: savedMessage.createdAt,
        delivered: isRecipientOnline, // Mark as delivered if recipient is online
        deliveredAt: isRecipientOnline ? new Date() : null,
        ...(tempId && { tempId }) // Pass tempId back for optimistic update replacement
      };

      // Send to recipient's sockets if online
      if (isRecipientOnline) {
        recipientSockets.forEach(sid => {
          io.to(sid).emit('message:receive', messageData);
        });
        // Emit delivery confirmation back to sender
        socket.emit('message:delivered', {
          messageId: savedMessage._id || savedMessage.id,
          deliveredAt: messageData.deliveredAt
        });
      }

      // Sync/Confirm to sender's other sockets (e.g. mobile app when sent from desktop)
      const senderSockets = onlineUsers.get(socket.userId);
      if (senderSockets) {
        senderSockets.forEach(sid => {
          io.to(sid).emit('message:sent', messageData);
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing:start', (data) => {
    const { recipientId } = data;
    const recipientSockets = onlineUsers.get(recipientId);
    if (recipientSockets) {
      recipientSockets.forEach(sid => {
        io.to(sid).emit('typing:start', { userId: socket.userId });
      });
    }
  });

  socket.on('typing:stop', (data) => {
    const { recipientId } = data;
    const recipientSockets = onlineUsers.get(recipientId);
    if (recipientSockets) {
      recipientSockets.forEach(sid => {
        io.to(sid).emit('typing:stop', { userId: socket.userId });
      });
    }
  });

  // Handle message read receipt
  socket.on('message:read', (data) => {
    const { messageId, senderId } = data;
    const senderSockets = onlineUsers.get(senderId);
    if (senderSockets) {
      senderSockets.forEach(sid => {
        io.to(sid).emit('message:read', {
          messageId,
          readAt: new Date()
        });
      });
    }
  });

  // Handle private message deletion
  socket.on('message:deleted', (data) => {
    const { messageId, chatId } = data;
    const recipientSockets = onlineUsers.get(chatId);
    if (recipientSockets) {
      recipientSockets.forEach(sid => {
        io.to(sid).emit('message:deleted', { messageId, chatId: socket.userId });
      });
    }
    // Sync deletion status back to sender's other devices
    const senderSockets = onlineUsers.get(socket.userId);
    if (senderSockets) {
      senderSockets.forEach(sid => {
        if (sid !== socket.id) {
          io.to(sid).emit('message:deleted', { messageId, chatId });
        }
      });
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
    const recipientSockets = onlineUsers.get(chatId);
    if (recipientSockets) {
      recipientSockets.forEach(sid => {
        io.to(sid).emit('message:pinned', { messageId, chatId: socket.userId, pinned });
      });
    }
    // Sync pinned status to sender's other devices
    const senderSockets = onlineUsers.get(socket.userId);
    if (senderSockets) {
      senderSockets.forEach(sid => {
        if (sid !== socket.id) {
          io.to(sid).emit('message:pinned', { messageId, chatId, pinned });
        }
      });
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
    const recipientSockets = onlineUsers.get(chatId);
    if (recipientSockets) {
      recipientSockets.forEach(sid => {
        io.to(sid).emit('message:reaction', { messageId, chatId: socket.userId, reactions });
      });
    }
    // Sync reaction status to sender's other devices
    const senderSockets = onlineUsers.get(socket.userId);
    if (senderSockets) {
      senderSockets.forEach(sid => {
        if (sid !== socket.id) {
          io.to(sid).emit('message:reaction', { messageId, chatId, reactions });
        }
      });
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

  // ---- FRIEND REQUEST NOTIFICATIONS ----
  // Notify recipient when a friend request is sent
  socket.on('friend:request:send', (data) => {
    const { recipientId, request } = data;
    const recipientSockets = onlineUsers.get(recipientId);
    if (recipientSockets) {
      recipientSockets.forEach(sid => {
        io.to(sid).emit('friend:request:received', { request });
      });
    }
  });

  // Notify sender when their request is accepted
  socket.on('friend:request:accepted', (data) => {
    const { senderId, newFriend } = data;
    const senderSockets = onlineUsers.get(senderId);
    if (senderSockets) {
      senderSockets.forEach(sid => {
        io.to(sid).emit('friend:request:was_accepted', { newFriend });
      });
    }
  });

  // ---- GROUP INVITE NOTIFICATIONS ----
  // Notify recipient when they are invited to a group
  socket.on('group:invite:send', (data) => {
    const { recipientId, invite } = data;
    const recipientSockets = onlineUsers.get(recipientId);
    if (recipientSockets) {
      recipientSockets.forEach(sid => {
        io.to(sid).emit('group:invite:received', { invite });
      });
    }
  });

  // Notify group members when someone accepts a group invite
  socket.on('group:invite:accepted', (data) => {
    const { memberIds, newMember, groupId } = data;
    memberIds.forEach(memberId => {
      const memberSockets = onlineUsers.get(memberId);
      if (memberSockets) {
        memberSockets.forEach(sid => {
          io.to(sid).emit('group:member:joined', { newMember, groupId });
        });
      }
    });
  });

  // ---- CONVERSATION THEME CHANGES ----
  // Broadcast to the other user in a private chat
  socket.on('conversation:theme:changed', (data) => {
    const { recipientId, theme, conversationKey, changedByName } = data;
    console.log('Server received conversation:theme:changed:', { recipientId, theme, conversationKey, changedByName });
    const recipientSockets = onlineUsers.get(recipientId);
    if (recipientSockets) {
      recipientSockets.forEach(sid => {
        io.to(sid).emit('conversation:theme:changed', {
          theme,
          conversationKey,
          changedByName
        });
      });
      console.log('Broadcasted conversation theme change to recipient');
    }
    // Sync theme change to sender's other devices
    const senderSockets = onlineUsers.get(socket.userId);
    if (senderSockets) {
      senderSockets.forEach(sid => {
        if (sid !== socket.id) {
          io.to(sid).emit('conversation:theme:changed', {
            theme,
            conversationKey,
            changedByName
          });
        }
      });
    }
  });

  // Broadcast theme change to all group members
  socket.on('group:theme:changed', (data) => {
    const { memberIds, theme, groupId, changedByName } = data;
    console.log('Server received group:theme:changed:', { memberIds, theme, groupId, changedByName });
    memberIds.forEach(memberId => {
      const memberSockets = onlineUsers.get(memberId);
      if (memberSockets) {
        memberSockets.forEach(sid => {
          if (sid === socket.id) return; // skip sender
          io.to(sid).emit('conversation:theme:changed', {
            theme,
            conversationKey: `conv-theme:group:${groupId}`,
            changedByName
          });
        });
      }
    });
  });

  // ---- TASK PERMISSION EVENTS (DM only) ----
  // User A requests permission from User B to extract AI tasks
  socket.on('task:permission:request', ({ recipientId, conversationId }) => {
    const recipientSockets = onlineUsers.get(recipientId);
    if (recipientSockets) {
      recipientSockets.forEach(sid => {
        io.to(sid).emit('task:permission:request', {
          fromUserId: socket.userId,
          conversationId
        });
      });
    }
  });

  // User B grants permission → notify User A
  socket.on('task:permission:granted', ({ recipientId, conversationId }) => {
    const recipientSockets = onlineUsers.get(recipientId);
    if (recipientSockets) {
      recipientSockets.forEach(sid => {
        io.to(sid).emit('task:permission:granted', { conversationId });
      });
    }
  });

  // User B denies permission → notify User A
  socket.on('task:permission:denied', ({ recipientId, conversationId }) => {
    const recipientSockets = onlineUsers.get(recipientId);
    if (recipientSockets) {
      recipientSockets.forEach(sid => {
        io.to(sid).emit('task:permission:denied', { conversationId });
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      const userSockets = onlineUsers.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(socket.userId);
          io.emit('user:offline', { userId: socket.userId });
        }
      }
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
