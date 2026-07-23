const io = require('socket.io-client');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SOCKET_URL = 'http://localhost:5000';

const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');

function connectClient(token, name) {
    return new Promise((resolve, reject) => {
        const socket = io(SOCKET_URL, {
            transports: ['websocket'],
            reconnection: false
        });

        socket.on('connect', () => {
            console.log(`${name} connected, authenticating...`);
            socket.emit('authenticate', token);
        });

        socket.on('authenticated', (data) => {
            console.log(`${name} authenticated:`, data);
            resolve(socket);
        });

        socket.on('auth:error', (err) => {
            console.error(`${name} auth error:`, err);
            reject(err);
        });

        socket.on('connect_error', (err) => {
            console.error(`${name} connection error:`, err);
            reject(err);
        });
    });
}

async function run() {
    let socketA, socketB;
    try {
        console.log('Connecting to database to fetch users...');
        const uri = process.env.MONGODB_URI_DEV;
        await mongoose.connect(uri);
        console.log('Connected to database.');

        const users = await User.find().limit(2);
        if (users.length < 2) {
             throw new Error('Need at least 2 users in the database to run this test');
        }
        const userA_id = users[0]._id.toString();
        const userB_id = users[1]._id.toString();
        console.log(`Using users: User A (${users[0].username} - ${userA_id}), User B (${users[1].username} - ${userB_id})`);

        // Close mongoose connection so we don't hold the process open
        await mongoose.disconnect();

        const tokenA = jwt.sign({ userId: userA_id }, config.jwtSecret);
        const tokenB = jwt.sign({ userId: userB_id }, config.jwtSecret);

        console.log('Starting socket test...');
        socketA = await connectClient(tokenA, 'User A');
        socketB = await connectClient(tokenB, 'User B');

        // Let's set up the listener on User B
        const convKey = `conv-theme:${[userA_id, userB_id].sort().join('-')}`;
        console.log('Expected Key for theme check:', convKey);

        socketB.on('conversation:theme:changed', (data) => {
            console.log('SUCCESS! User B received theme event:', data);
        });

        console.log('User A emitting theme change...');
        socketA.emit('conversation:theme:changed', {
            recipientId: userB_id,
            theme: 'sunset',
            conversationKey: convKey,
            changedByName: 'User A'
        });

        // Wait a few seconds to see if User B receives it
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('Test finished.');
    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        if (socketA) socketA.close();
        if (socketB) socketB.close();
    }
}

run();
