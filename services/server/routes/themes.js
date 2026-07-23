const express = require('express');
const mongoose = require('mongoose');
const { authenticate } = require('../middleware/auth');
const ConversationTheme = require('../models/ConversationTheme');

const router = express.Router();

// ─── GET theme for a private conversation ─────────────────────────────────────
router.get('/conversation/:otherId', authenticate, async (req, res) => {
    try {
        const sorted = [req.user._id.toString(), req.params.otherId].sort()
            .map(id => new mongoose.Types.ObjectId(id));
        const doc = await ConversationTheme.findOne({ participants: sorted, groupId: null });
        res.json({ theme: doc?.theme || 'dark' });
    } catch (err) {
        console.error('[GET /themes/conversation] Error:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
});

// ─── GET theme for a group ─────────────────────────────────────────────────────
router.get('/group/:groupId', authenticate, async (req, res) => {
    try {
        const gId = new mongoose.Types.ObjectId(req.params.groupId);
        const doc = await ConversationTheme.findOne({ groupId: gId });
        res.json({ theme: doc?.theme || 'dark' });
    } catch (err) {
        console.error('[GET /themes/group] Error:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
});

// ─── SET theme for a private conversation ─────────────────────────────────────
router.put('/conversation/:otherId', authenticate, async (req, res) => {
    try {
        console.log('[PUT /themes/conversation] user:', req.user._id, 'other:', req.params.otherId, 'theme:', req.body.theme);

        const { theme } = req.body;
        if (!theme) return res.status(400).json({ error: 'theme is required' });

        const sorted = [req.user._id.toString(), req.params.otherId].sort()
            .map(id => new mongoose.Types.ObjectId(id));

        console.log('[PUT /themes/conversation] sorted participants:', sorted);

        const doc = await ConversationTheme.findOneAndUpdate(
            { participants: sorted, groupId: null },
            { $set: { theme, changedBy: req.user._id, participants: sorted, groupId: null } },
            { upsert: true, new: true }
        );

        console.log('[PUT /themes/conversation] saved doc:', doc._id, doc.theme);
        res.json({ theme: doc.theme });
    } catch (err) {
        console.error('[PUT /themes/conversation] Error:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
});

// ─── SET theme for a group ─────────────────────────────────────────────────────
router.put('/group/:groupId', authenticate, async (req, res) => {
    try {
        console.log('[PUT /themes/group] groupId:', req.params.groupId, 'theme:', req.body.theme);

        const { theme } = req.body;
        if (!theme) return res.status(400).json({ error: 'theme is required' });

        const gId = new mongoose.Types.ObjectId(req.params.groupId);

        const doc = await ConversationTheme.findOneAndUpdate(
            { groupId: gId },
            { $set: { theme, changedBy: req.user._id, groupId: gId, participants: [] } },
            { upsert: true, new: true }
        );

        console.log('[PUT /themes/group] saved doc:', doc._id, doc.theme);
        res.json({ theme: doc.theme });
    } catch (err) {
        console.error('[PUT /themes/group] Error:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
