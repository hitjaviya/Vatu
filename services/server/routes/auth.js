const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const config = require('../config/config');
const User = require('../models/User');
const { sendOtpEmail } = require('../utils/mailer');

const router = express.Router();

// Generate a 6-digit OTP
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Register new user
router.post('/register',
    [
        body('username').trim().isLength({ min: 3, max: 30 }),
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 6 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { username, email, password } = req.body;

            // Check if user already exists
            const existingUser = await User.findOne({
                $or: [{ email }, { username }]
            });
            if (existingUser) {
                return res.status(400).json({
                    error: 'User with this email or username already exists'
                });
            }

            // Generate OTP
            const otp = generateOtp();
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            // Create new user (unverified)
            const user = new User({
                username,
                email,
                password,
                otp,
                otpExpiry,
                isEmailVerified: false
            });
            await user.save();

            // Send OTP email
            await sendOtpEmail(email, otp);

            res.status(201).json({
                message: 'Registration successful. Please check your email for the OTP to verify your account.',
                userId: user._id
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    }
);

// Resend OTP
router.post('/send-otp',
    [body('email').isEmail().normalizeEmail()],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { email } = req.body;
            const user = await User.findOne({ email });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (user.isEmailVerified) {
                return res.status(400).json({ error: 'Email is already verified' });
            }

            // Generate new OTP
            const otp = generateOtp();
            user.otp = otp;
            user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
            await user.save();

            await sendOtpEmail(email, otp);

            res.json({ message: 'OTP resent successfully. Please check your email.' });
        } catch (error) {
            console.error('Send OTP error:', error);
            res.status(500).json({ error: 'Failed to send OTP' });
        }
    }
);

// Verify OTP and issue JWT
router.post('/verify-otp',
    [
        body('userId').notEmpty(),
        body('otp').isLength({ min: 6, max: 6 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { userId, otp } = req.body;
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (user.isEmailVerified) {
                return res.status(400).json({ error: 'Email is already verified' });
            }

            // Check OTP expiry
            if (!user.otpExpiry || new Date() > user.otpExpiry) {
                return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
            }

            // Check OTP value
            if (user.otp !== otp) {
                return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
            }

            // Mark email as verified and clear OTP
            user.isEmailVerified = true;
            user.otp = null;
            user.otpExpiry = null;
            user.status = 'online';
            user.lastSeen = new Date();
            await user.save();

            // Issue JWT
            const token = jwt.sign(
                { userId: user._id },
                config.jwtSecret,
                { expiresIn: config.jwtExpire }
            );

            // Issue Refresh Token
            const refreshToken = jwt.sign(
                { userId: user._id },
                config.jwtSecret,
                { expiresIn: '30d' }
            );

            res.json({
                message: 'Email verified successfully',
                token,
                refreshToken,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    avatar: user.avatar,
                    status: user.status
                }
            });
        } catch (error) {
            console.error('Verify OTP error:', error);
            res.status(500).json({ error: 'OTP verification failed' });
        }
    }
);

// Login user
router.post('/login',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').notEmpty()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { email, password } = req.body;

            // Find user
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Check password
            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Block login if email not verified
            if (!user.isEmailVerified) {
                return res.status(403).json({
                    error: 'Please verify your email before logging in.',
                    userId: user._id
                });
            }

            // Update user status
            user.status = 'online';
            user.lastSeen = new Date();
            await user.save();

            // Generate JWT token
            const token = jwt.sign(
                { userId: user._id },
                config.jwtSecret,
                { expiresIn: config.jwtExpire }
            );

            // Generate Refresh Token
            const refreshToken = jwt.sign(
                { userId: user._id },
                config.jwtSecret,
                { expiresIn: '30d' }
            );

            res.json({
                message: 'Login successful',
                token,
                refreshToken,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    avatar: user.avatar,
                    status: user.status
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    }
);

// Exchange Refresh Token for a new Access Token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, config.jwtSecret);
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Generate a new access token
        const newAccessToken = jwt.sign(
            { userId: user._id },
            config.jwtSecret,
            { expiresIn: config.jwtExpire }
        );

        // Generate a new refresh token (for refresh token rotation)
        const newRefreshToken = jwt.sign(
            { userId: user._id },
            config.jwtSecret,
            { expiresIn: '30d' }
        );

        res.json({
            token: newAccessToken,
            refreshToken: newRefreshToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

module.exports = router;
