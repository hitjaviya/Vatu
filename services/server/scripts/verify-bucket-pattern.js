/**
 * Verification Script: Bucket Pattern Implementation
 * 
 * This script verifies:
 * 1. Message sending via MessageService
 * 2. Automatic bucket creation and rotation
 * 3. Pagination
 * 4. Data integrity
 * 
 * Usage: node scripts/verify-bucket-pattern.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const MessageService = require('../services/MessageService');
const ConversationBucket = require('../models/ConversationBucket');
const User = require('../models/User');

// Load environment variables
dotenv.config();

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
}

async function createTestUsers() {
    const user1 = await User.create({
        username: `test_user_${Date.now()}_1`,
        email: `test${Date.now()}1@example.com`,
        password: 'password123'
    });

    const user2 = await User.create({
        username: `test_user_${Date.now()}_2`,
        email: `test${Date.now()}2@example.com`,
        password: 'password123'
    });

    return [user1, user2];
}

async function runVerification() {
    console.log('🚀 Starting Verification...\n');

    await connectDB();

    let user1, user2;

    try {
        // 1. Create Test Users
        console.log('1️⃣  Creating test users...');
        [user1, user2] = await createTestUsers();
        console.log(`   Created users: ${user1.username}, ${user2.username}`);

        // 2. Test Single Message
        console.log('\n2️⃣  Testing single message send...');
        const msg1 = await MessageService.sendMessage({
            sender: user1._id,
            recipient: user2._id,
            content: 'Hello World',
            type: 'text'
        });

        if (msg1 && msg1.content === 'Hello World') {
            console.log('   ✅ Single message sent successfully');
        } else {
            throw new Error('Failed to send single message');
        }

        // 3. Test Bucket Rotation (Send 505 messages)
        // We temporarily set bucket size to 50 for testing if possible, 
        // but since it's hardcoded/defaulted in model logic, we might need to send 500+ messages.
        // To be safe and fast, we'll check the logic by inspecting the bucket directly after a few messages
        // or we can simulate a full bucket by manually setting isFull=true on the first bucket.

        console.log('\n3️⃣  Testing bucket rotation logic...');

        // Manually find the bucket and set it to full to force a new one
        const conversationId = msg1.conversationId || `dm_${[user1._id, user2._id].sort().join('_')}`;

        let bucket = await ConversationBucket.findOne({ conversationId });
        bucket.isFull = true; // Artificially fill it
        await bucket.save();
        console.log('   Simulated full bucket');

        // Send another message
        const msg2 = await MessageService.sendMessage({
            sender: user2._id,
            recipient: user1._id,
            content: 'Message in new bucket',
            type: 'text'
        });

        // Verify we have 2 buckets
        const bucketCount = await ConversationBucket.countDocuments({ conversationId });
        if (bucketCount === 2) {
            console.log('   ✅ Bucket rotation working (2 buckets found)');
        } else {
            throw new Error(`Expected 2 buckets, found ${bucketCount}`);
        }

        // 4. Test Pagination
        console.log('\n4️⃣  Testing pagination...');
        // We have 2 messages in total across 2 buckets
        const messages = await MessageService.getConversationMessages(user1._id, user2._id, null, { limit: 10 });

        if (messages.length === 2) {
            console.log('   ✅ Pagination retrieved all messages across buckets');
            console.log(`   Latest message: "${messages[0].content}"`);
        } else {
            throw new Error(`Expected 2 messages, got ${messages.length}`);
        }

        // 5. Test Read Receipts
        console.log('\n5️⃣  Testing read receipts...');
        await MessageService.markAsRead(conversationId, msg2.id);

        const updatedMessages = await MessageService.getConversationMessages(user1._id, user2._id, null, { limit: 1 });
        if (updatedMessages[0].read === true) {
            console.log('   ✅ Read receipt updated successfully');
        } else {
            throw new Error('Read receipt failed');
        }

    } catch (error) {
        console.error('\n❌ Verification Failed:', error);
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        if (user1) await User.deleteMany({ _id: { $in: [user1._id, user2._id] } });
        if (user1 && user2) {
            const conversationId = `dm_${[user1._id, user2._id].sort().join('_')}`;
            await ConversationBucket.deleteMany({ conversationId });
        }

        await mongoose.connection.close();
        console.log('✅ Disconnected');
    }
}

runVerification();
