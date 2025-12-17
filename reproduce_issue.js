const mongoose = require('mongoose');
const MessageService = require('./packages/server/services/MessageService');
const User = require('./packages/server/models/User');
const Group = require('./packages/server/models/Group');
const ConversationBucket = require('./packages/server/models/ConversationBucket');
const dotenv = require('dotenv');

dotenv.config({ path: './packages/server/.env' });

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app');
        console.log('Connected.');

        // Create test users
        console.log('Creating users...');
        const user1 = await User.create({
            username: 'user1_' + Date.now(),
            email: 'user1_' + Date.now() + '@test.com',
            password: 'password123'
        });
        const user2 = await User.create({
            username: 'user2_' + Date.now(),
            email: 'user2_' + Date.now() + '@test.com',
            password: 'password123'
        });
        console.log('Users created:', user1._id, user2._id);

        // Create test group
        console.log('Creating group...');
        const group = await Group.create({
            name: 'Test Group ' + Date.now(),
            creator: user1._id,
            members: [
                { user: user1._id, role: 'admin' },
                { user: user2._id, role: 'member' }
            ]
        });
        console.log('Group created:', group._id);

        // Send group message
        console.log('Sending group message...');
        const messageData = {
            sender: user1._id.toString(),
            group: group._id.toString(),
            content: 'Hello Group!',
            type: 'text'
        };

        const message = await MessageService.sendMessage(messageData);
        console.log('Message sent successfully:', message);

        // Verify bucket participants
        const bucket = await ConversationBucket.findOne({ 'messages._id': message.id });
        console.log('Bucket participants:', bucket.participants);

        if (bucket.participants.length === 0) {
            console.error('FAIL: Bucket participants are empty!');
        } else {
            console.log('SUCCESS: Bucket participants are populated.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

run();
