const express = require('express');
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Get all users (excluding current user)
router.get('/', authenticate, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user._id } })
            .select('-password')
            .sort({ username: 1 });

        res.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get user by ID
router.get('/:userId', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Update user profile
router.patch('/profile', authenticate, async (req, res) => {
    try {
        const { username, avatar } = req.body;
        const updates = {};

        if (username) updates.username = username;
        if (avatar !== undefined) updates.avatar = avatar;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true, runValidators: true }
        ).select('-password');

        res.json({ user });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Upload profile picture
router.post('/avatar', authenticate, async (req, res) => {
    const { uploadAvatar } = require('../middleware/upload');
    const config = require('../config/config');
    
    uploadAvatar(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || 'Failed to upload avatar' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
            // Delete old avatar file if it exists and is a local file
            if (req.user.avatar && req.user.avatar.startsWith('/uploads')) {
                const fs = require('fs');
                const path = require('path');
                const oldPath = path.join(__dirname, '..', req.user.avatar);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }

            // Update user with new avatar URL
            const avatarUrl = `${config.serverUrl}/uploads/avatars/${req.file.filename}`;
            req.user.avatar = avatarUrl;
            await req.user.save();

            res.json({ 
                message: 'Avatar uploaded successfully',
                avatar: avatarUrl,
                user: req.user
            });
        } catch (error) {
            console.error('Error updating avatar:', error);
            res.status(500).json({ error: 'Failed to update avatar' });
        }
    });
});

// Update user status
router.patch('/status', authenticate, async (req, res) => {
    try {
        const { status } = req.body;

        if (!['online', 'offline', 'away'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        req.user.status = status;
        req.user.lastSeen = new Date();
        await req.user.save();

        res.json({ status: req.user.status });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Change email
router.patch('/change-email', authenticate, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
            return res.status(400).json({ error: 'Email already in use' });
        }

        req.user.email = email;
        await req.user.save();

        res.json({ 
            message: 'Email updated successfully',
            user: { email: req.user.email }
        });
    } catch (error) {
        console.error('Error changing email:', error);
        res.status(500).json({ error: 'Failed to change email' });
    }
});

// Change password
router.patch('/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Verify current password
        const isMatch = await req.user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Update password
        req.user.password = newPassword;
        await req.user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;
