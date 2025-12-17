const express = require('express');
const { authenticate } = require('../middleware/auth');
const MessageService = require('../services/MessageService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 }, // 10MB default
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp4|mp3/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type'));
    }
});

// Get conversation messages between two users
router.get('/conversation/:userId', authenticate, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, skip = 0 } = req.query;

        // Use MessageService to get messages from buckets
        const messages = await MessageService.getConversationMessages(
            req.user._id,
            userId,
            null,
            { limit: parseInt(limit), skip: parseInt(skip) }
        );

        res.json({ messages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Send a text message
router.post('/send', authenticate, async (req, res) => {
    try {
        const { recipientId, content, groupId } = req.body;

        if (!content || (!recipientId && !groupId)) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const messageData = {
            sender: req.user._id,
            content,
            type: 'text'
        };

        if (groupId) {
            messageData.group = groupId;
        } else {
            messageData.recipient = recipientId;
        }

        // Use MessageService to save message to bucket
        const message = await MessageService.sendMessage(messageData);

        res.status(201).json({ message });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Upload and send file
router.post('/send-file', authenticate, upload.single('file'), async (req, res) => {
    try {
        const { recipientId, groupId } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (!recipientId && !groupId) {
            return res.status(400).json({ error: 'Recipient or group required' });
        }

        // Determine file type
        let fileType = 'file';
        if (req.file.mimetype.startsWith('image/')) {
            fileType = 'image';
        } else if (req.file.mimetype.startsWith('video/')) {
            fileType = 'video';
        } else if (req.file.mimetype.startsWith('audio/')) {
            fileType = 'audio';
        }

        const messageData = {
            sender: req.user._id,
            content: req.file.originalname,
            type: fileType,
            fileUrl: `/uploads/${req.file.filename}`,
            fileName: req.file.originalname,
            fileSize: req.file.size
        };

        if (groupId) {
            messageData.group = groupId;
        } else {
            messageData.recipient = recipientId;
        }

        // Use MessageService to save message to bucket
        const message = await MessageService.sendMessage(messageData);

        res.status(201).json({ message });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Pure upload route (does not create a message in DB)
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Determine file type
        let fileType = 'file';
        if (req.file.mimetype.startsWith('image/')) {
            fileType = 'image';
        } else if (req.file.mimetype.startsWith('video/')) {
            fileType = 'video';
        } else if (req.file.mimetype.startsWith('audio/')) {
            fileType = 'audio';
        }

        res.status(201).json({
            fileUrl: `/uploads/${req.file.filename}`,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            type: fileType
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Mark all messages in a conversation as read
router.post('/mark-conversation-read', authenticate, async (req, res) => {
    try {
        const { userId, groupId } = req.body;

        if (!userId && !groupId) {
            return res.status(400).json({ error: 'User ID or Group ID required' });
        }

        const markedCount = await MessageService.markConversationAsRead(
            req.user._id,
            userId,
            groupId
        );

        res.json({ success: true, markedCount });
    } catch (error) {
        console.error('Error marking conversation as read:', error);
        res.status(500).json({ error: 'Failed to mark conversation as read' });
    }
});

// Mark message as read
router.patch('/:messageId/read', authenticate, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { conversationId } = req.body;

        if (!conversationId) {
            return res.status(400).json({ error: 'Conversation ID required' });
        }

        // Use MessageService to mark message as read
        const message = await MessageService.markAsRead(conversationId, messageId);

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        res.json({ message });
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({ error: 'Failed to mark message as read' });
    }
});

// Get unread message count
router.get('/unread-count', authenticate, async (req, res) => {
    try {
        const unreadCount = await MessageService.getUnreadCount(req.user._id);
        res.json({ unreadCount });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});

// Get unread counts by conversation
router.get('/unread-counts-by-conversation', authenticate, async (req, res) => {
    try {
        const unreadCounts = await MessageService.getUnreadCountsByConversation(req.user._id);
        res.json({ unreadCounts });
    } catch (error) {
        console.error('Error getting unread counts by conversation:', error);
        res.status(500).json({ error: 'Failed to get unread counts' });
    }
});

// Get recent conversations
router.get('/conversations', authenticate, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const conversations = await MessageService.getRecentConversations(
            req.user._id,
            parseInt(limit)
        );
        res.json({ conversations });
    } catch (error) {
        console.error('Error getting conversations:', error);
        res.status(500).json({ error: 'Failed to get conversations' });
    }
});

// Search messages in a conversation
router.get('/search/:conversationId', authenticate, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { query, limit = 50 } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'Search query required' });
        }

        const messages = await MessageService.searchMessages(
            conversationId,
            query,
            { limit: parseInt(limit) }
        );

        res.json({ messages });
    } catch (error) {
        console.error('Error searching messages:', error);
        res.status(500).json({ error: 'Failed to search messages' });
    }
});

// Delete a message
router.delete('/:messageId', authenticate, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { conversationId } = req.body;

        if (!conversationId) {
            return res.status(400).json({ error: 'Conversation ID required' });
        }

        await MessageService.deleteMessage(conversationId, messageId);
        res.json({ success: true, message: 'Message deleted' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// Get conversation statistics
router.get('/stats/:conversationId', authenticate, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const stats = await MessageService.getConversationStats(conversationId);
        res.json(stats);
    } catch (error) {
        console.error('Error getting conversation stats:', error);
        res.status(500).json({ error: 'Failed to get conversation stats' });
    }
});

module.exports = router;

