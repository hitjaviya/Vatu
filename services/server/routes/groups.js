const express = require('express');
const { authenticate } = require('../middleware/auth');
const Group = require('../models/Group');
const MessageService = require('../services/MessageService');

const router = express.Router();

// Create a new group
router.post('/', authenticate, async (req, res) => {
    try {
        const { name, description, memberIds = [] } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        const group = new Group({
            name,
            description,
            creator: req.user._id,
            members: [
                {
                    user: req.user._id,
                    role: 'admin'
                },
                ...memberIds.map(userId => ({
                    user: userId,
                    role: 'member'
                }))
            ]
        });

        await group.save();
        await group.populate('members.user', 'username avatar');
        await group.populate('creator', 'username avatar');

        res.status(201).json({ group });
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

// Get all groups for current user
router.get('/', authenticate, async (req, res) => {
    try {
        const groups = await Group.find({
            'members.user': req.user._id
        })
            .populate('members.user', 'username avatar')
            .populate('creator', 'username avatar')
            .sort({ createdAt: -1 });

        res.json({ groups });
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});

// Get group by ID
router.get('/:groupId', authenticate, async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId)
            .populate('members.user', 'username avatar status')
            .populate('creator', 'username avatar');

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Check if user is a member
        const isMember = group.members.some(
            member => member.user._id.toString() === req.user._id.toString()
        );

        if (!isMember) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ group });
    } catch (error) {
        console.error('Error fetching group:', error);
        res.status(500).json({ error: 'Failed to fetch group' });
    }
});

// Get group messages
router.get('/:groupId/messages', authenticate, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { limit = 50, skip = 0 } = req.query;

        // Verify user is a member
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const isMember = group.members.some(
            member => member.user.toString() === req.user._id.toString()
        );

        if (!isMember) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const messages = await MessageService.getConversationMessages(
            null,
            null,
            groupId,
            { limit: parseInt(limit), skip: parseInt(skip) }
        );

        res.json({ messages });
    } catch (error) {
        console.error('Error fetching group messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Get latest bucket number for a group conversation
router.get('/:groupId/latest-bucket', authenticate, async (req, res) => {
    try {
        const { groupId } = req.params;
        const bucketNumber = await MessageService.getLatestBucketNumber(null, null, groupId);
        res.json({ bucketNumber });
    } catch (error) {
        console.error('Error fetching latest bucket:', error);
        res.status(500).json({ error: 'Failed to fetch latest bucket' });
    }
});

// Get messages from a specific bucket for a group
router.get('/:groupId/bucket/:bucketNumber', authenticate, async (req, res) => {
    try {
        const { groupId, bucketNumber } = req.params;
        const result = await MessageService.getMessagesByBucket(
            null, null, groupId, parseInt(bucketNumber)
        );
        res.json(result);
    } catch (error) {
        console.error('Error fetching group bucket messages:', error);
        res.status(500).json({ error: 'Failed to fetch bucket messages' });
    }
});

// Add member to group
router.post('/:groupId/members', authenticate, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Check if requester is admin
        const requesterMember = group.members.find(
            member => member.user.toString() === req.user._id.toString()
        );

        if (!requesterMember || requesterMember.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can add members' });
        }

        // Check if user is already a member
        const existingMember = group.members.find(
            member => member.user.toString() === userId
        );

        if (existingMember) {
            return res.status(400).json({ error: 'User is already a member' });
        }

        group.members.push({
            user: userId,
            role: 'member'
        });

        await group.save();
        await group.populate('members.user', 'username avatar');

        res.json({ group });
    } catch (error) {
        console.error('Error adding member:', error);
        res.status(500).json({ error: 'Failed to add member' });
    }
});

// Remove member from group
router.delete('/:groupId/members/:userId', authenticate, async (req, res) => {
    try {
        const { groupId, userId } = req.params;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Check if requester is admin
        const requesterMember = group.members.find(
            member => member.user.toString() === req.user._id.toString()
        );

        if (!requesterMember || requesterMember.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can remove members' });
        }

        group.members = group.members.filter(
            member => member.user.toString() !== userId
        );

        await group.save();
        await group.populate('members.user', 'username avatar');

        res.json({ group });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

// Update group details
router.patch('/:groupId', authenticate, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, description, avatar } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Check if requester is admin
        const requesterMember = group.members.find(
            member => member.user.toString() === req.user._id.toString()
        );

        if (!requesterMember || requesterMember.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can update group' });
        }

        if (name) group.name = name;
        if (description !== undefined) group.description = description;
        if (avatar !== undefined) group.avatar = avatar;

        await group.save();
        await group.populate('members.user', 'username avatar');
        await group.populate('creator', 'username avatar');

        res.json({ group });
    } catch (error) {
        console.error('Error updating group:', error);
        res.status(500).json({ error: 'Failed to update group' });
    }
});

module.exports = router;
