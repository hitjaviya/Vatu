/**
 * Utility functions for bucket-based message storage
 */

/**
 * Generate a unique conversation ID for direct messages
 * @param {String} user1Id - First user's ID
 * @param {String} user2Id - Second user's ID
 * @returns {String} Conversation ID
 */
const generateConversationId = (user1Id, user2Id) => {
    // Sort IDs to ensure consistent conversation ID regardless of order
    const ids = [user1Id.toString(), user2Id.toString()].sort();
    return `dm_${ids[0]}_${ids[1]}`;
};

/**
 * Generate a unique conversation ID for group messages
 * @param {String} groupId - Group's ID
 * @returns {String} Conversation ID
 */
const generateGroupConversationId = (groupId) => {
    return `group_${groupId.toString()}`;
};

/**
 * Calculate which bucket a message should be in
 * @param {Number} messageIndex - Index of the message (0-based)
 * @param {Number} bucketSize - Number of messages per bucket
 * @returns {Number} Bucket number
 */
const calculateBucketNumber = (messageIndex, bucketSize = 500) => {
    return Math.floor(messageIndex / bucketSize);
};

/**
 * Validate message data before storing
 * @param {Object} messageData - Message data to validate
 * @returns {Object} Validation result { valid: Boolean, errors: Array }
 */
const validateMessageData = (messageData) => {
    const errors = [];

    if (!messageData.sender) {
        errors.push('Sender is required');
    }

    if (!messageData.content) {
        errors.push('Content is required');
    }

    if (!messageData.recipient && !messageData.group) {
        errors.push('Either recipient or group is required');
    }

    const validTypes = ['text', 'file', 'image', 'video', 'audio'];
    if (messageData.type && !validTypes.includes(messageData.type)) {
        errors.push(`Invalid message type. Must be one of: ${validTypes.join(', ')}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Extract participants from message data
 * @param {Object} messageData - Message data
 * @returns {Array} Array of participant IDs
 */
const extractParticipants = (messageData) => {
    if (messageData.group) {
        return []; // Group messages don't need participants array
    }

    return [messageData.sender, messageData.recipient].sort();
};

/**
 * Format message for API response
 * @param {Object} message - Message object from bucket
 * @param {Object} options - Formatting options
 * @returns {Object} Formatted message
 */
const formatMessage = (message, options = {}) => {
    const formatted = {
        id: message._id,
        _id: message._id,
        sender: message.sender,
        senderId: typeof message.sender === 'object' ? message.sender._id : message.sender,
        content: message.deleted ? null : message.content,
        type: message.deleted ? 'deleted' : message.type,
        createdAt: message.createdAt,
        read: message.read || false,
        readAt: message.readAt || null,
        deliveredAt: message.deliveredAt || null,
        readBy: message.readBy || [],
        deliveredTo: message.deliveredTo || [],
        deleted: message.deleted || false,
        deletedAt: message.deletedAt || null,
        pinned: message.pinned || false,
        pinnedBy: message.pinnedBy || null,
        pinnedAt: message.pinnedAt || null,
        replyTo: message.replyTo || null,
        sharedFile: message.sharedFile || null
    };

    // Add file-related fields if present and not deleted
    if (message.fileUrl && !message.deleted) {
        formatted.fileUrl = message.fileUrl;
        formatted.fileName = message.fileName;
        formatted.fileSize = message.fileSize;
    }

    // Add recipient for direct messages
    if (message.recipient) {
        formatted.recipient = message.recipient;
    }

    return formatted;
};

/**
 * Performance monitoring helper
 * @param {String} operation - Operation name
 * @param {Function} fn - Function to execute
 * @returns {Promise} Result of the function
 */
const monitorPerformance = async (operation, fn) => {
    const startTime = Date.now();

    try {
        const result = await fn();
        const duration = Date.now() - startTime;

        if (duration > 1000) {
            console.warn(`[Performance] ${operation} took ${duration}ms`);
        } else {
            console.log(`[Performance] ${operation} completed in ${duration}ms`);
        }

        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[Performance] ${operation} failed after ${duration}ms:`, error.message);
        throw error;
    }
};

/**
 * Estimate bucket document size
 * @param {Number} messageCount - Number of messages in bucket
 * @param {Number} avgMessageSize - Average message size in bytes
 * @returns {Object} Size estimation
 */
const estimateBucketSize = (messageCount, avgMessageSize = 150) => {
    const messagesSize = messageCount * avgMessageSize;
    const metadataSize = 500; // Approximate overhead
    const totalSize = messagesSize + metadataSize;

    return {
        messagesSize,
        metadataSize,
        totalSize,
        totalSizeKB: (totalSize / 1024).toFixed(2),
        percentOfLimit: ((totalSize / (16 * 1024 * 1024)) * 100).toFixed(2) + '%'
    };
};

/**
 * Check if bucket is approaching size limit
 * @param {Number} messageCount - Current message count
 * @param {Number} maxMessages - Maximum messages per bucket
 * @returns {Boolean} True if bucket should be rotated
 */
const shouldRotateBucket = (messageCount, maxMessages = 500) => {
    return messageCount >= maxMessages;
};

module.exports = {
    generateConversationId,
    generateGroupConversationId,
    calculateBucketNumber,
    validateMessageData,
    extractParticipants,
    formatMessage,
    monitorPerformance,
    estimateBucketSize,
    shouldRotateBucket
};
