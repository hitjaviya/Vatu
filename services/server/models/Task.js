const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    conversationId: { type: String, required: true, index: true },
    conversationType: { type: String, enum: ['dm', 'group'], required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // AI extracted fields
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    tags: [{ type: String }],

    // Source messages AI used
    sourceMessages: [{
        senderName: String,
        content: String,
        createdAt: Date
    }],

    // Assignment
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedToName: { type: String, default: null }, // raw name if user not resolved

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Task state
    status: { type: String, enum: ['pending', 'in_progress', 'done', 'cancelled'], default: 'pending' },
    confirmed: { type: Boolean, default: false }, // user accepted AI suggestion?
    dueDate: { type: Date, default: null }

}, { timestamps: true });

taskSchema.index({ conversationId: 1, createdAt: -1 });
taskSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);
