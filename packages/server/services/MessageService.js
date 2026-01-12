const ConversationBucket = require('../models/ConversationBucket');
const Message = require('../models/Message');
const Group = require('../models/Group');
const {
    generateConversationId,
    generateGroupConversationId,
    validateMessageData,
    extractParticipants,
    formatMessage,
    monitorPerformance
} = require('../utils/bucketUtils');

/**
 * Service layer for message operations
 * Handles both bucket-based and legacy message storage
 */
class MessageService {
    /**
     * Send a message (text or file)
     * @param {Object} messageData - Message data
     * @param {String} messageData.sender - Sender user ID
     * @param {String} messageData.recipient - Recipient user ID (for DM)
     * @param {String} messageData.group - Group ID (for group messages)
     * @param {String} messageData.content - Message content
     * @param {String} messageData.type - Message type (text, file, image, etc.)
     * @param {String} messageData.fileUrl - File URL (if applicable)
     * @param {String} messageData.fileName - File name (if applicable)
     * @param {Number} messageData.fileSize - File size (if applicable)
     * @param {String} messageData.replyTo - Message ID being replied to (if applicable)
     * @returns {Promise<Object>} Saved message
     */
    static async sendMessage(messageData) {
        return monitorPerformance('sendMessage', async () => {
            // Validate message data
            const validation = validateMessageData(messageData);
            if (!validation.valid) {
                throw new Error(`Invalid message data: ${validation.errors.join(', ')}`);
            }

            // Generate conversation ID
            const conversationId = messageData.group
                ? generateGroupConversationId(messageData.group)
                : generateConversationId(messageData.sender, messageData.recipient);

            // Get group participants if it's a group message
            let groupParticipants = [];
            if (messageData.group) {
                const group = await Group.findById(messageData.group);
                if (group) {
                    groupParticipants = group.members.map(m => m.user);
                }
            }

            // Add message to bucket
            const message = await ConversationBucket.addMessage(
                conversationId,
                messageData,
                !!messageData.group,
                groupParticipants
            );

            return formatMessage(message);
        });
    }

    /**
     * Get messages for a conversation with pagination
     * @param {String} user1Id - First user ID
     * @param {String} user2Id - Second user ID (null for group)
     * @param {String} groupId - Group ID (null for DM)
     * @param {Object} options - Query options
     * @param {Number} options.limit - Number of messages to return
     * @param {Number} options.skip - Number of messages to skip
     * @returns {Promise<Array>} Array of messages
     */
    static async getConversationMessages(user1Id, user2Id = null, groupId = null, options = {}) {
        return monitorPerformance('getConversationMessages', async () => {
            const { limit = 50, skip = 0 } = options;

            // Generate conversation ID
            const conversationId = groupId
                ? generateGroupConversationId(groupId)
                : generateConversationId(user1Id, user2Id);

            // Get messages from buckets
            const messages = await ConversationBucket.getMessages(conversationId, { limit, skip });

            // Format messages for response
            return messages.map(msg => formatMessage(msg));
        });
    }

    /**
     * Mark a message as read
     * @param {String} conversationId - Conversation ID
     * @param {String} messageId - Message ID
     * @returns {Promise<Object>} Updated message
     */
    static async markAsRead(conversationId, messageId) {
        return monitorPerformance('markAsRead', async () => {
            const message = await ConversationBucket.markAsRead(conversationId, messageId);
            return formatMessage(message);
        });
    }

    /**
     * Mark all messages in a conversation as read
     * @param {String} userId - Current user ID
     * @param {String} otherUserId - Other user ID (for direct messages)
     * @param {String} groupId - Group ID (for group messages)
     * @returns {Promise<Number>} Number of messages marked as read
     */
    static async markConversationAsRead(userId, otherUserId = null, groupId = null) {
        return monitorPerformance('markConversationAsRead', async () => {
            const query = { participants: userId };

            if (groupId) {
                query.group = groupId;
            } else if (otherUserId) {
                query.participants = { $all: [userId, otherUserId] };
                query.group = null;
            }

            const buckets = await ConversationBucket.find(query);
            let markedCount = 0;

            for (const bucket of buckets) {
                let modified = false;
                for (const message of bucket.messages) {
                    // Mark messages sent by others as read
                    if (message.sender.toString() !== userId.toString() && !message.read) {
                        message.read = true;
                        markedCount++;
                        modified = true;
                    }
                }
                if (modified) {
                    await bucket.save();
                }
            }

            return markedCount;
        });
    }

    /**
     * Mark a message as read (by user IDs)
     * @param {String} user1Id - First user ID
     * @param {String} user2Id - Second user ID
     * @param {String} messageId - Message ID
     * @returns {Promise<Object>} Updated message
     */
    static async markAsReadByUsers(user1Id, user2Id, messageId) {
        const conversationId = generateConversationId(user1Id, user2Id);
        return this.markAsRead(conversationId, messageId);
    }

    /**
     * Get unread message count for a user
     * @param {String} userId - User ID
     * @returns {Promise<Number>} Unread message count
     */
    static async getUnreadCount(userId) {
        return monitorPerformance('getUnreadCount', async () => {
            // Find all buckets where user is a participant
            const buckets = await ConversationBucket.find({
                participants: userId
            });

            let unreadCount = 0;

            // Count unread messages across all buckets
            for (const bucket of buckets) {
                for (const message of bucket.messages) {
                    // Count messages sent to this user that are unread
                    if (message.sender.toString() !== userId.toString() && !message.read) {
                        unreadCount++;
                    }
                }
            }

            return unreadCount;
        });
    }

    /**
     * Get unread message counts grouped by conversation
     * @param {String} userId - User ID
     * @returns {Promise<Object>} Object with conversationId as key and unread count as value
     */
    static async getUnreadCountsByConversation(userId) {
        return monitorPerformance('getUnreadCountsByConversation', async () => {
            // Find all buckets where user is a participant
            const buckets = await ConversationBucket.find({
                participants: userId
            });

            const unreadCounts = {};

            // Count unread messages per conversation
            for (const bucket of buckets) {
                let conversationUnread = 0;
                let otherParticipantId = null;

                // Find the other participant (for direct messages)
                if (bucket.participants.length === 2) {
                    otherParticipantId = bucket.participants.find(
                        p => p.toString() !== userId.toString()
                    );
                }

                // Count unread messages in this bucket
                for (const message of bucket.messages) {
                    if (message.sender.toString() !== userId.toString() && !message.read) {
                        conversationUnread++;
                    }
                }

                // Store count by conversation ID
                if (bucket.group) {
                    // Group conversation
                    unreadCounts[bucket.group.toString()] = conversationUnread;
                } else if (otherParticipantId) {
                    // Direct message conversation
                    unreadCounts[otherParticipantId.toString()] = conversationUnread;
                }
            }

            return unreadCounts;
        });
    }

    /**
     * Get recent conversations for a user
     * @param {String} userId - User ID
     * @param {Number} limit - Number of conversations to return
     * @returns {Promise<Array>} Array of recent conversations
     */
    static async getRecentConversations(userId, limit = 20) {
        return monitorPerformance('getRecentConversations', async () => {
            // Find all buckets where user is a participant
            const buckets = await ConversationBucket.find({
                participants: userId
            })
                .sort({ updatedAt: -1 })
                .limit(limit)
                .populate('participants', 'username avatar status');

            // Extract conversation info
            const conversations = buckets.map(bucket => {
                const lastMessage = bucket.messages[bucket.messages.length - 1];
                const otherParticipant = bucket.participants.find(
                    p => p._id.toString() !== userId.toString()
                );

                return {
                    conversationId: bucket.conversationId,
                    participant: otherParticipant,
                    lastMessage: lastMessage ? formatMessage(lastMessage) : null,
                    updatedAt: bucket.updatedAt,
                    unreadCount: bucket.messages.filter(
                        msg => msg.sender.toString() !== userId.toString() && !msg.read
                    ).length
                };
            });

            return conversations;
        });
    }

    /**
     * Delete a message (soft delete - marks as deleted)
     * @param {String} conversationId - Conversation ID
     * @param {String} messageId - Message ID
     * @returns {Promise<Boolean>} Success status
     */
    static async deleteMessage(conversationId, messageId) {
        return monitorPerformance('deleteMessage', async () => {
            const bucket = await ConversationBucket.findOne({
                conversationId,
                'messages._id': messageId
            });

            if (!bucket) {
                throw new Error('Message not found');
            }

            const message = bucket.messages.id(messageId);
            message.content = '[Message deleted]';
            message.type = 'deleted';
            message.fileUrl = null;
            message.fileName = null;
            message.fileSize = null;

            await bucket.save();
            return true;
        });
    }

    /**
     * Search messages in a conversation
     * @param {String} conversationId - Conversation ID
     * @param {String} searchQuery - Search query
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Matching messages
     */
    static async searchMessages(conversationId, searchQuery, options = {}) {
        return monitorPerformance('searchMessages', async () => {
            const { limit = 50 } = options;

            // Get all buckets for this conversation
            const buckets = await ConversationBucket.find({ conversationId })
                .sort({ bucketNumber: -1 });

            const matchingMessages = [];

            // Search through messages
            for (const bucket of buckets) {
                for (const message of bucket.messages) {
                    if (message.content.toLowerCase().includes(searchQuery.toLowerCase())) {
                        matchingMessages.push(formatMessage(message));

                        if (matchingMessages.length >= limit) {
                            return matchingMessages;
                        }
                    }
                }
            }

            return matchingMessages;
        });
    }

    /**
     * Get conversation statistics
     * @param {String} conversationId - Conversation ID
     * @returns {Promise<Object>} Conversation statistics
     */
    static async getConversationStats(conversationId) {
        return monitorPerformance('getConversationStats', async () => {
            const buckets = await ConversationBucket.find({ conversationId });

            let totalMessages = 0;
            let totalBuckets = buckets.length;
            let messagesByType = {
                text: 0,
                file: 0,
                image: 0,
                video: 0,
                audio: 0
            };

            for (const bucket of buckets) {
                totalMessages += bucket.messageCount;

                for (const message of bucket.messages) {
                    if (messagesByType[message.type] !== undefined) {
                        messagesByType[message.type]++;
                    }
                }
            }

            return {
                conversationId,
                totalMessages,
                totalBuckets,
                messagesByType,
                averageMessagesPerBucket: totalBuckets > 0 ? (totalMessages / totalBuckets).toFixed(2) : 0
            };
        });
    }
}

module.exports = MessageService;
