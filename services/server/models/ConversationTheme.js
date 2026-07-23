const mongoose = require('mongoose');

/**
 * ConversationTheme
 * -----------------
 * Stores the agreed-upon theme for each conversation.
 *
 * For private chats: `participants` = [smallerUserId, largerUserId] (sorted)
 * For groups:        `groupId` is populated, `participants` is empty
 */
const conversationThemeSchema = new mongoose.Schema({
    // For private chats — sorted pair of user IDs
    participants: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        default: []
    },
    // For group chats
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null
    },
    // The chosen theme key (e.g. 'dark', 'chill', 'valentine' …)
    theme: {
        type: String,
        default: 'dark'
    },
    // Who changed it last (for display purposes)
    changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, { timestamps: true });

// Index on participants for fast private-chat lookups
conversationThemeSchema.index({ participants: 1 });

// Unique index on groupId — only indexes real ObjectId values, NOT null.
// This prevents the E11000 duplicate key error when multiple private conversations
// all have groupId: null (sparse/unique would still clash on explicit nulls).
conversationThemeSchema.index(
    { groupId: 1 },
    {
        unique: true,
        partialFilterExpression: { groupId: { $type: 'objectId' } },
        name: 'groupId_1_partial'
    }
);

module.exports = mongoose.model('ConversationTheme', conversationThemeSchema);
