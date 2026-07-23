/**
 * GroupInvite model
 * Tracks pending invites for users being added to groups.
 * A user must accept before they appear in group.members.
 */
const mongoose = require('mongoose');

const groupInviteSchema = new mongoose.Schema({
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined'],
        default: 'pending'
    }
}, {
    timestamps: true
});

// Unique invite per group/user pair
groupInviteSchema.index({ group: 1, recipient: 1 }, { unique: true });

const GroupInvite = mongoose.model('GroupInvite', groupInviteSchema);

module.exports = GroupInvite;
