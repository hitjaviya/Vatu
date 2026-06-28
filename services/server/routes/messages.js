const express = require('express');
const { authenticate } = require('../middleware/auth');
const MessageService = require('../services/MessageService');
const ConversationBucket = require('../models/ConversationBucket');
const { formatMessage } = require('../utils/bucketUtils');
const S3Service = require('../services/S3Service');
const SharedFile = require('../models/SharedFile');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer with memory storage for S3 uploads
const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 }, // 10MB default
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|csv|mp4|mkv|avi|mp3|wav|ogg|aac|flac|zip|rar|7z|ppt|pptx|xls|xlsx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

        if (extname) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type'));
    }
});

const handleMemoryUpload = (req, res, next) => {
    memoryUpload.single('file')(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large. Maximum size allowed is ' + (parseInt(process.env.MAX_FILE_SIZE) / (1024 * 1024)) + 'MB' });
            }
            return res.status(400).json({ error: err.message });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};


// Get conversation messages between two users (legacy offset-based)
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

// Get latest bucket number for a DM conversation
router.get('/conversation/:userId/latest-bucket', authenticate, async (req, res) => {
    try {
        const { userId } = req.params;
        const bucketNumber = await MessageService.getLatestBucketNumber(req.user._id, userId, null);
        res.json({ bucketNumber });
    } catch (error) {
        console.error('Error fetching latest bucket:', error);
        res.status(500).json({ error: 'Failed to fetch latest bucket' });
    }
});

// Get messages from a specific bucket for a DM conversation
router.get('/conversation/:userId/bucket/:bucketNumber', authenticate, async (req, res) => {
    try {
        const { userId, bucketNumber } = req.params;
        const result = await MessageService.getMessagesByBucket(
            req.user._id, userId, null, parseInt(bucketNumber)
        );
        res.json(result);
    } catch (error) {
        console.error('Error fetching bucket messages:', error);
        res.status(500).json({ error: 'Failed to fetch bucket messages' });
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

// Upload and send file (uploads to S3, creates SharedFile + message)
router.post('/send-file', authenticate, handleMemoryUpload, async (req, res) => {
    try {
        const { recipientId, groupId } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (!recipientId && !groupId) {
            return res.status(400).json({ error: 'Recipient or group required' });
        }

        // Upload to S3
        const { s3Key } = await S3Service.upload(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        // Determine file type
        const fileType = SharedFile.getFileType(req.file.mimetype);

        // Create SharedFile record
        const sharedFile = await SharedFile.create({
            uploader: req.user._id,
            s3Key,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            fileType
        });

        // Generate presigned download URL
        const downloadUrl = await S3Service.getDownloadUrl(s3Key);

        const messageData = {
            sender: req.user._id,
            content: req.file.originalname,
            type: fileType,
            fileUrl: downloadUrl,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            sharedFile: sharedFile._id
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

// Pure upload route — uploads to S3, creates SharedFile, returns file info
// (does not create a message in DB — use this when sending files via socket)
router.post('/upload', authenticate, handleMemoryUpload, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Upload to S3
        const { s3Key } = await S3Service.upload(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        // Determine file type
        const fileType = SharedFile.getFileType(req.file.mimetype);

        // Create SharedFile record
        const sharedFile = await SharedFile.create({
            uploader: req.user._id,
            s3Key,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            fileType
        });

        // Generate presigned download URL
        const downloadUrl = await S3Service.getDownloadUrl(s3Key);

        res.status(201).json({
            fileId: sharedFile._id,
            fileUrl: downloadUrl,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            type: fileType,
            sharedFileId: sharedFile._id
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

        // Find the bucket containing this message where the user is a participant
        const bucket = await ConversationBucket.findOne({
            'messages._id': messageId,
            participants: req.user._id
        });

        if (!bucket) {
            return res.status(404).json({ error: 'Message not found or access denied' });
        }

        // Use MessageService to mark message as read
        const message = await MessageService.markAsRead(bucket.conversationId, messageId);

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

// Delete a message — supports "delete for me" and "delete for everyone"
router.delete('/:messageId', authenticate, async (req, res) => {
    try {
        const { messageId } = req.params;
        // scope: 'me' | 'everyone' (default 'everyone' for backward-compat)
        const scope = req.body?.scope || req.query?.scope || 'everyone';

        const bucket = await ConversationBucket.findOne({
            'messages._id': messageId,
            participants: req.user._id
        });

        if (!bucket) return res.status(404).json({ error: 'Message not found or access denied' });

        const message = bucket.messages.id(messageId);
        if (!message) return res.status(404).json({ error: 'Message not found' });

        if (scope === 'me') {
            // "Delete for me" — mark message hidden for this user only
            const alreadyDeleted = message.deletedFor.some(
                (id) => id.toString() === req.user._id.toString()
            );
            if (!alreadyDeleted) {
                message.deletedFor.push(req.user._id);
                await bucket.save();
            }
            return res.json({ success: true, messageId, scope: 'me' });
        }

        // "Delete for everyone" — only the sender may do this
        if (message.sender.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You can only delete your own messages' });
        }

        // Cleanup S3 file if attached
        if (message.sharedFile) {
            try {
                const sharedFile = await SharedFile.findById(message.sharedFile);
                if (sharedFile) {
                    sharedFile.shareCount -= 1;
                    if (sharedFile.shareCount <= 0) {
                        await S3Service.delete(sharedFile.s3Key);
                        await SharedFile.findByIdAndDelete(sharedFile._id);
                    } else {
                        await sharedFile.save();
                    }
                }
            } catch (err) {
                console.error('Error cleaning up shared file on message deletion:', err);
            }
            message.sharedFile = null;
        }

        message.deleted = true;
        message.deletedAt = new Date();
        message.content = 'This message was deleted';
        message.type = 'deleted';
        message.fileUrl = null;
        message.fileName = null;
        message.fileSize = null;

        await bucket.save();

        res.json({ success: true, messageId, scope: 'everyone' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// Get message info (delivery + read receipts)
router.get('/:messageId/info', authenticate, async (req, res) => {
    try {
        const { messageId } = req.params;

        const bucket = await ConversationBucket.findOne({
            'messages._id': messageId,
            participants: req.user._id
        }).populate('messages.readBy.user', 'username avatar')
          .populate('messages.deliveredTo.user', 'username avatar');

        if (!bucket) return res.status(404).json({ error: 'Message not found or access denied' });

        const message = bucket.messages.id(messageId);
        if (!message) return res.status(404).json({ error: 'Message not found' });

        res.json({
            messageId,
            sentAt: message.createdAt,
            deliveredAt: message.deliveredAt || null,
            readAt: message.readAt || null,
            readBy: message.readBy || [],
            deliveredTo: message.deliveredTo || [],
            pinned: message.pinned,
            pinnedAt: message.pinnedAt || null
        });
    } catch (error) {
        console.error('Error fetching message info:', error);
        res.status(500).json({ error: 'Failed to fetch message info' });
    }
});

// Pin / unpin a message
router.patch('/:messageId/pin', authenticate, async (req, res) => {
    try {
        const { messageId } = req.params;

        const bucket = await ConversationBucket.findOne({
            'messages._id': messageId,
            participants: req.user._id
        });

        if (!bucket) return res.status(404).json({ error: 'Message not found or access denied' });

        const message = bucket.messages.id(messageId);
        if (!message) return res.status(404).json({ error: 'Message not found' });

        message.pinned = !message.pinned;
        message.pinnedBy = message.pinned ? req.user._id : null;
        message.pinnedAt = message.pinned ? new Date() : null;
        await bucket.save();

        res.json({ success: true, messageId, pinned: message.pinned });
    } catch (error) {
        console.error('Error pinning message:', error);
        res.status(500).json({ error: 'Failed to pin message' });
    }
});

// Get all pinned messages for a conversation
router.get('/pinned', authenticate, async (req, res) => {
    try {
        const { userId, groupId } = req.query;
        let conversationId;

        if (groupId) {
            conversationId = `group_${groupId}`;
        } else if (userId) {
            const ids = [req.user._id.toString(), userId.toString()].sort();
            conversationId = `dm_${ids[0]}_${ids[1]}`;
        } else {
            return res.status(400).json({ error: 'Missing userId or groupId' });
        }

        const buckets = await ConversationBucket.find({
            conversationId,
            participants: req.user._id
        }).populate('messages.sender', 'username avatar');

        if (!buckets || buckets.length === 0) {
            return res.json({ pinnedMessages: [] });
        }

        const pinnedMessages = [];
        for (const bucket of buckets) {
            const pinned = bucket.messages.filter(msg => msg.pinned && !msg.deleted);
            pinnedMessages.push(...pinned.map(msg => formatMessage(msg)));
        }

        // Sort by creation/pin time: oldest pinned first
        pinnedMessages.sort((a, b) => new Date(a.pinnedAt || a.createdAt) - new Date(b.pinnedAt || b.createdAt));

        res.json({ pinnedMessages });
    } catch (error) {
        console.error('Error fetching pinned messages:', error);
        res.status(500).json({ error: 'Failed to fetch pinned messages' });
    }
});

// Add/remove emoji reaction on a message
router.patch('/:messageId/react', authenticate, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body;

        if (!emoji) {
            return res.status(400).json({ error: 'Emoji is required' });
        }

        const bucket = await ConversationBucket.findOne({
            'messages._id': messageId,
            participants: req.user._id
        });

        if (!bucket) return res.status(404).json({ error: 'Message not found or access denied' });

        const message = bucket.messages.id(messageId);
        if (!message) return res.status(404).json({ error: 'Message not found' });

        if (!message.reactions) message.reactions = [];

        // Check if user already reacted with this exact emoji
        const existingReactionIndex = message.reactions.findIndex(
            r => r.emoji === emoji && r.user.toString() === req.user._id.toString()
        );

        if (existingReactionIndex > -1) {
            // Remove the reaction (toggle off)
            message.reactions.splice(existingReactionIndex, 1);
        } else {
            // Add the reaction
            message.reactions.push({ emoji, user: req.user._id });
        }

        await bucket.save();

        res.json({ success: true, messageId, reactions: message.reactions });
    } catch (error) {
        console.error('Error toggling reaction:', error);
        res.status(500).json({ error: 'Failed to toggle reaction' });
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
