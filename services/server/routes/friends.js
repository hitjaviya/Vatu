const express = require('express');
const { authenticate } = require('../middleware/auth');
const FriendRequest = require('../models/FriendRequest');
const User = require('../models/User');

const router = express.Router();

/**
 * GET /api/friends
 * Returns all accepted friends of the current user.
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;

        const accepted = await FriendRequest.find({
            status: 'accepted',
            $or: [{ sender: userId }, { recipient: userId }]
        })
            .populate('sender', 'username avatar status lastSeen')
            .populate('recipient', 'username avatar status lastSeen');

        const friends = accepted.map(fr => {
            return fr.sender._id.toString() === userId.toString()
                ? fr.recipient
                : fr.sender;
        });

        res.json({ friends });
    } catch (err) {
        console.error('Error fetching friends:', err);
        res.status(500).json({ error: 'Failed to fetch friends' });
    }
});

/**
 * GET /api/friends/requests
 * Returns pending incoming friend requests for the current user.
 */
router.get('/requests', authenticate, async (req, res) => {
    try {
        const requests = await FriendRequest.find({
            recipient: req.user._id,
            status: 'pending'
        }).populate('sender', 'username avatar status');

        res.json({ requests });
    } catch (err) {
        console.error('Error fetching friend requests:', err);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

/**
 * GET /api/friends/sent
 * Returns pending outgoing friend requests sent by the current user.
 */
router.get('/sent', authenticate, async (req, res) => {
    try {
        const requests = await FriendRequest.find({
            sender: req.user._id,
            status: 'pending'
        }).populate('recipient', 'username avatar status');

        res.json({ requests });
    } catch (err) {
        console.error('Error fetching sent requests:', err);
        res.status(500).json({ error: 'Failed to fetch sent requests' });
    }
});

/**
 * GET /api/friends/status/:userId
 * Returns the friend relationship status between current user and target user.
 * Possible: 'friends' | 'pending_sent' | 'pending_received' | 'none'
 */
router.get('/status/:userId', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;
        const targetId = req.params.userId;

        const request = await FriendRequest.findOne({
            $or: [
                { sender: userId, recipient: targetId },
                { sender: targetId, recipient: userId }
            ]
        });

        if (!request) return res.json({ status: 'none' });

        if (request.status === 'accepted') return res.json({ status: 'friends' });

        if (request.status === 'pending') {
            if (request.sender.toString() === userId.toString()) {
                return res.json({ status: 'pending_sent', requestId: request._id });
            } else {
                return res.json({ status: 'pending_received', requestId: request._id });
            }
        }

        return res.json({ status: 'none' });
    } catch (err) {
        console.error('Error fetching friend status:', err);
        res.status(500).json({ error: 'Failed to fetch friend status' });
    }
});

/**
 * POST /api/friends/request/:userId
 * Send a friend request to another user.
 */
router.post('/request/:userId', authenticate, async (req, res) => {
    try {
        const senderId = req.user._id;
        const recipientId = req.params.userId;

        if (senderId.toString() === recipientId) {
            return res.status(400).json({ error: 'Cannot send request to yourself' });
        }

        const recipient = await User.findById(recipientId);
        if (!recipient) return res.status(404).json({ error: 'User not found' });

        // Check existing request
        const existing = await FriendRequest.findOne({
            $or: [
                { sender: senderId, recipient: recipientId },
                { sender: recipientId, recipient: senderId }
            ]
        });

        if (existing) {
            if (existing.status === 'accepted') {
                return res.status(400).json({ error: 'Already friends' });
            }
            if (existing.status === 'pending') {
                return res.status(400).json({ error: 'Request already pending' });
            }
            // Declined — allow re-sending by updating
            existing.status = 'pending';
            existing.sender = senderId;
            existing.recipient = recipientId;
            await existing.save();
            await existing.populate('sender', 'username avatar');
            return res.status(200).json({ request: existing, message: 'Friend request re-sent' });
        }

        const request = await FriendRequest.create({
            sender: senderId,
            recipient: recipientId
        });
        await request.populate('sender', 'username avatar');

        res.status(201).json({ request, message: 'Friend request sent' });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Request already exists' });
        }
        console.error('Error sending friend request:', err);
        res.status(500).json({ error: 'Failed to send friend request' });
    }
});

/**
 * PATCH /api/friends/request/:requestId/accept
 * Accept a pending friend request.
 */
router.patch('/request/:requestId/accept', authenticate, async (req, res) => {
    try {
        const request = await FriendRequest.findById(req.params.requestId)
            .populate('sender', 'username avatar status')
            .populate('recipient', 'username avatar status');

        if (!request) return res.status(404).json({ error: 'Request not found' });

        if (request.recipient._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Request is no longer pending' });
        }

        request.status = 'accepted';
        await request.save();

        res.json({ request, message: 'Friend request accepted' });
    } catch (err) {
        console.error('Error accepting friend request:', err);
        res.status(500).json({ error: 'Failed to accept friend request' });
    }
});

/**
 * PATCH /api/friends/request/:requestId/decline
 * Decline a pending friend request.
 */
router.patch('/request/:requestId/decline', authenticate, async (req, res) => {
    try {
        const request = await FriendRequest.findById(req.params.requestId);

        if (!request) return res.status(404).json({ error: 'Request not found' });

        if (request.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        request.status = 'declined';
        await request.save();

        res.json({ message: 'Friend request declined' });
    } catch (err) {
        console.error('Error declining friend request:', err);
        res.status(500).json({ error: 'Failed to decline friend request' });
    }
});

/**
 * DELETE /api/friends/:userId
 * Remove a friend (delete the accepted FriendRequest).
 */
router.delete('/:userId', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;
        const targetId = req.params.userId;

        await FriendRequest.deleteOne({
            status: 'accepted',
            $or: [
                { sender: userId, recipient: targetId },
                { sender: targetId, recipient: userId }
            ]
        });

        res.json({ message: 'Friend removed' });
    } catch (err) {
        console.error('Error removing friend:', err);
        res.status(500).json({ error: 'Failed to remove friend' });
    }
});

module.exports = router;
