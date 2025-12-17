const mongoose = require('mongoose');

// Message Bucket Pattern - stores multiple messages in one document
// This reduces database overhead while avoiding 16MB document limit

const conversationBucketSchema = new mongoose.Schema({
    // Conversation participants (sorted for consistent lookup)
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],

    // For group conversations
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null
    },

    // Unique conversation identifier (for quick lookups)
    conversationId: {
        type: String,
        required: true,
        index: true
    },

    // Bucket number (0, 1, 2, etc.) - allows multiple buckets per conversation
    bucketNumber: {
        type: Number,
        required: true,
        default: 0
    },

    // Array of messages (max 100-1000 messages per bucket)
    messages: [{
        _id: {
            type: mongoose.Schema.Types.ObjectId,
            default: () => new mongoose.Types.ObjectId()
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        content: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['text', 'file', 'image', 'video', 'audio'],
            default: 'text'
        },
        fileUrl: String,
        fileName: String,
        fileSize: Number,
        read: {
            type: Boolean,
            default: false
        },
        readAt: Date,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Metadata
    messageCount: {
        type: Number,
        default: 0
    },

    // Is this bucket full? (prevents further writes)
    isFull: {
        type: Boolean,
        default: false
    },

    // Max messages per bucket (configurable)
    maxMessages: {
        type: Number,
        default: 500
    },

    createdAt: {
        type: Date,
        default: Date.now
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
conversationBucketSchema.index({ conversationId: 1, bucketNumber: -1 });
conversationBucketSchema.index({ participants: 1, bucketNumber: -1 });
conversationBucketSchema.index({ group: 1, bucketNumber: -1 });

// Static method to generate conversation ID from participants
conversationBucketSchema.statics.generateConversationId = function (user1Id, user2Id) {
    // Sort IDs to ensure consistent conversation ID regardless of order
    const ids = [user1Id.toString(), user2Id.toString()].sort();
    return `dm_${ids[0]}_${ids[1]}`;
};

// Static method to add message to conversation
conversationBucketSchema.statics.addMessage = async function (conversationId, messageData, isGroup = false, groupParticipants = []) {
    // Find the latest non-full bucket
    let bucket = await this.findOne({
        conversationId,
        isFull: false
    }).sort({ bucketNumber: -1 });

    // If no bucket exists or current bucket is full, create new one
    if (!bucket) {
        const latestBucket = await this.findOne({ conversationId })
            .sort({ bucketNumber: -1 })
            .select('bucketNumber');

        const newBucketNumber = latestBucket ? latestBucket.bucketNumber + 1 : 0;

        bucket = new this({
            conversationId,
            bucketNumber: newBucketNumber,
            participants: isGroup ? groupParticipants : [messageData.sender, messageData.recipient],
            group: isGroup ? messageData.group : null,
            messages: []
        });
    }

    // Check if bucket is full
    if (bucket.messageCount >= bucket.maxMessages) {
        bucket.isFull = true;
        await bucket.save();

        // Create new bucket
        bucket = new this({
            conversationId,
            bucketNumber: bucket.bucketNumber + 1,
            participants: isGroup ? groupParticipants : [messageData.sender, messageData.recipient],
            group: isGroup ? messageData.group : null,
            messages: []
        });
    }

    // Add message to bucket
    bucket.messages.push({
        sender: messageData.sender,
        content: messageData.content,
        type: messageData.type || 'text',
        fileUrl: messageData.fileUrl,
        fileName: messageData.fileName,
        fileSize: messageData.fileSize,
        createdAt: new Date()
    });

    bucket.messageCount = bucket.messages.length;
    await bucket.save();

    // Return the newly added message
    return bucket.messages[bucket.messages.length - 1];
};

// Static method to get conversation messages with pagination
conversationBucketSchema.statics.getMessages = async function (conversationId, options = {}) {
    const { limit = 50, skip = 0 } = options;

    // Get buckets in reverse order (newest first)
    const buckets = await this.find({ conversationId })
        .sort({ bucketNumber: -1 })
        .populate('messages.sender', 'username avatar');

    // Flatten all messages
    const allMessages = [];
    for (const bucket of buckets) {
        allMessages.push(...bucket.messages);
    }

    // Sort by creation time (newest first) and apply pagination
    const sortedMessages = allMessages
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(skip, skip + limit);

    return sortedMessages.reverse(); // Return oldest first for chat display
};

// Method to mark message as read
conversationBucketSchema.statics.markAsRead = async function (conversationId, messageId) {
    const bucket = await this.findOne({
        conversationId,
        'messages._id': messageId
    });

    if (!bucket) {
        throw new Error('Message not found');
    }

    const message = bucket.messages.id(messageId);
    message.read = true;
    message.readAt = new Date();

    await bucket.save();
    return message;
};

const ConversationBucket = mongoose.model('ConversationBucket', conversationBucketSchema);

module.exports = ConversationBucket;
