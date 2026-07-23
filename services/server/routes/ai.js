const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { extractTasksFromConversation } = require('../services/AIServices');
const Task = require('../models/Task');

// POST /api/ai/extract-tasks
// Reads a conversation from DB and extracts tasks via Groq
router.post('/extract-tasks', authenticate, async (req, res) => {
    try {
        const { conversationId, conversationType } = req.body;

        if (!conversationId || !conversationType) {
            return res.status(400).json({ error: 'conversationId and conversationType are required' });
        }

        const tasks = await extractTasksFromConversation(
            conversationId,
            conversationType,
            req.user
        );

        res.json({
            success: true,
            count: tasks.length,
            tasks
        });

    } catch (err) {
        console.error('[AI] extract-tasks error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ai/tasks/:conversationId
// Get all extracted tasks for a conversation
router.get('/tasks/:conversationId', authenticate, async (req, res) => {
    try {
        const tasks = await Task.find({ conversationId: req.params.conversationId })
            .populate('assignedTo', 'username avatar')
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 });

        res.json({ success: true, tasks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/ai/tasks/:taskId
// Update task status or confirm an AI suggestion
router.patch('/tasks/:taskId', authenticate, async (req, res) => {
    try {
        const { status, confirmed, priority } = req.body;
        const update = {};

        if (status) update.status = status;
        if (confirmed !== undefined) update.confirmed = confirmed;
        if (priority) update.priority = priority;

        const task = await Task.findByIdAndUpdate(
            req.params.taskId,
            update,
            { new: true }
        ).populate('assignedTo', 'username avatar');

        if (!task) return res.status(404).json({ error: 'Task not found' });

        res.json({ success: true, task });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/ai/tasks — create a task manually (no AI)
router.post('/tasks', authenticate, async (req, res) => {
    try {
        const { conversationId, conversationType, title, description, assignedTo, priority, dueDate, tags } = req.body;
        if (!conversationId || !conversationType || !title) {
            return res.status(400).json({ error: 'conversationId, conversationType and title are required' });
        }
        const task = new Task({
            conversationId,
            conversationType,
            title,
            description: description || title,
            assignedTo:  assignedTo  || null,
            priority:    priority    || 'medium',
            dueDate:     dueDate     || null,
            tags:        tags        || [],
            createdBy:   req.user._id,
            confirmed:   true
        });
        await task.save();
        await task.populate('assignedTo', 'username avatar');
        await task.populate('createdBy',  'username avatar');
        res.json({ success: true, task });
    } catch (err) {
        console.error('[AI] create-task error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/ai/tasks/:taskId
router.delete('/tasks/:taskId', authenticate, async (req, res) => {
    try {
        const task = await Task.findById(req.params.taskId);
        if (!task) return res.status(404).json({ error: 'Task not found' });

        const userId     = req.user._id.toString();
        const isCreator  = task.createdBy.toString() === userId;
        const isAssignee = task.assignedTo?.toString() === userId;
        // For group context the frontend sends isAdmin
        const { isAdmin } = req.body;

        if (!isCreator && !isAssignee && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to delete this task' });
        }

        await Task.findByIdAndDelete(req.params.taskId);
        res.json({ success: true });
    } catch (err) {
        console.error('[AI] delete-task error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

