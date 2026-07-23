const express = require('express');
const { authenticate } = require('../middleware/auth');
const Group = require('../models/Group');
const GroupInvite = require('../models/GroupInvite');
const MessageService = require('../services/MessageService');

const router = express.Router();

// Create a new group — creator joins immediately, others get invites
router.post('/', authenticate, async (req, res) => {
    try {
        const { name, description, memberIds = [] } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        // Creator is the only real member at creation time
        const group = new Group({
            name,
            description,
            creator: req.user._id,
            members: [
                {
                    user: req.user._id,
                    role: 'admin'
                }
            ]
        });

        await group.save();

        // Send invites to each selected user instead of adding directly
        if (memberIds.length > 0) {
            const invites = memberIds.map(userId => ({
                group: group._id,
                invitedBy: req.user._id,
                recipient: userId,
                status: 'pending'
            }));

            await GroupInvite.insertMany(invites, { ordered: false }).catch(() => {});
        }

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

// Get pending group invites for current user
router.get('/invites', authenticate, async (req, res) => {
    try {
        const invites = await GroupInvite.find({
            recipient: req.user._id,
            status: 'pending'
        })
            .populate('group', 'name avatar description')
            .populate('invitedBy', 'username avatar');

        res.json({ invites });
    } catch (error) {
        console.error('Error fetching group invites:', error);
        res.status(500).json({ error: 'Failed to fetch group invites' });
    }
});

// Accept a group invite
router.patch('/invites/:inviteId/accept', authenticate, async (req, res) => {
    try {
        const invite = await GroupInvite.findById(req.params.inviteId)
            .populate('group')
            .populate('invitedBy', 'username avatar');

        if (!invite) return res.status(404).json({ error: 'Invite not found' });

        if (invite.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        if (invite.status !== 'pending') {
            return res.status(400).json({ error: 'Invite already responded to' });
        }

        invite.status = 'accepted';
        await invite.save();

        // Add user as member of the group
        const group = await Group.findById(invite.group._id);
        if (group) {
            const alreadyMember = group.members.some(
                m => m.user.toString() === req.user._id.toString()
            );
            if (!alreadyMember) {
                group.members.push({ user: req.user._id, role: 'member' });
                await group.save();
            }
        }

        await group.populate('members.user', 'username avatar');
        await group.populate('creator', 'username avatar');

        res.json({ group, message: 'Joined group successfully' });
    } catch (error) {
        console.error('Error accepting group invite:', error);
        res.status(500).json({ error: 'Failed to accept invite' });
    }
});

// Decline a group invite
router.patch('/invites/:inviteId/decline', authenticate, async (req, res) => {
    try {
        const invite = await GroupInvite.findById(req.params.inviteId);

        if (!invite) return res.status(404).json({ error: 'Invite not found' });

        if (invite.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        invite.status = 'declined';
        await invite.save();

        res.json({ message: 'Invite declined' });
    } catch (error) {
        console.error('Error declining group invite:', error);
        res.status(500).json({ error: 'Failed to decline invite' });
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

// Add member to group (sends an invite now instead of direct add)
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

        // Check if invite already exists
        const existingInvite = await GroupInvite.findOne({
            group: groupId,
            recipient: userId,
            status: 'pending'
        });

        if (existingInvite) {
            return res.status(400).json({ error: 'Invite already sent to this user' });
        }

        await GroupInvite.create({
            group: groupId,
            invitedBy: req.user._id,
            recipient: userId
        });

        res.json({ message: 'Group invite sent' });
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
