/**
 * Migration Script: Convert Messages to Bucket Pattern
 * 
 * This script migrates existing messages from the one-document-per-message
 * pattern to the bucket-based pattern (500 messages per bucket).
 * 
 * Usage:
 *   node scripts/migrate-to-buckets.js --dry-run    # Preview changes
 *   node scripts/migrate-to-buckets.js --execute    # Run migration
 *   node scripts/migrate-to-buckets.js --rollback   # Revert migration
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Message = require('../models/Message');
const ConversationBucket = require('../models/ConversationBucket');
const { generateConversationId, generateGroupConversationId } = require('../utils/bucketUtils');

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');
const isRollback = args.includes('--rollback');

// Migration statistics
const stats = {
    totalMessages: 0,
    totalConversations: 0,
    totalBuckets: 0,
    errors: [],
    startTime: null,
    endTime: null
};

/**
 * Connect to MongoDB
 */
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
}

/**
 * Group messages by conversation
 */
async function groupMessagesByConversation() {
    console.log('\n📊 Analyzing existing messages...');

    const messages = await Message.find({})
        .sort({ createdAt: 1 })
        .lean();

    stats.totalMessages = messages.length;
    console.log(`Found ${stats.totalMessages} messages to migrate`);

    // Group messages by conversation
    const conversations = new Map();

    for (const message of messages) {
        let conversationId;

        if (message.group) {
            conversationId = generateGroupConversationId(message.group);
        } else {
            conversationId = generateConversationId(message.sender, message.recipient);
        }

        if (!conversations.has(conversationId)) {
            conversations.set(conversationId, {
                conversationId,
                isGroup: !!message.group,
                participants: message.group ? [] : [message.sender, message.recipient],
                group: message.group || null,
                messages: []
            });
        }

        conversations.get(conversationId).messages.push(message);
    }

    stats.totalConversations = conversations.size;
    console.log(`Found ${stats.totalConversations} unique conversations`);

    return conversations;
}

/**
 * Create buckets from messages
 */
function createBucketsFromMessages(conversation, bucketSize = 500) {
    const buckets = [];
    const messages = conversation.messages;

    for (let i = 0; i < messages.length; i += bucketSize) {
        const bucketMessages = messages.slice(i, i + bucketSize);
        const bucketNumber = Math.floor(i / bucketSize);

        buckets.push({
            conversationId: conversation.conversationId,
            bucketNumber,
            participants: conversation.participants,
            group: conversation.group,
            messages: bucketMessages.map(msg => ({
                sender: msg.sender,
                content: msg.content,
                type: msg.type,
                fileUrl: msg.fileUrl,
                fileName: msg.fileName,
                fileSize: msg.fileSize,
                read: msg.read,
                readAt: msg.readAt,
                createdAt: msg.createdAt
            })),
            messageCount: bucketMessages.length,
            isFull: bucketMessages.length >= bucketSize,
            maxMessages: bucketSize
        });
    }

    return buckets;
}

/**
 * Perform dry run (preview changes)
 */
async function performDryRun() {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');

    const conversations = await groupMessagesByConversation();

    let totalBuckets = 0;

    console.log('\n📋 Migration Preview:');
    console.log('─'.repeat(80));

    for (const [conversationId, conversation] of conversations) {
        const buckets = createBucketsFromMessages(conversation);
        totalBuckets += buckets.length;

        const type = conversation.isGroup ? 'Group' : 'DM';
        console.log(`\n${type}: ${conversationId}`);
        console.log(`  Messages: ${conversation.messages.length}`);
        console.log(`  Buckets to create: ${buckets.length}`);

        buckets.forEach((bucket, index) => {
            console.log(`    Bucket ${index}: ${bucket.messageCount} messages`);
        });
    }

    console.log('\n' + '─'.repeat(80));
    console.log('\n📊 Summary:');
    console.log(`  Total messages: ${stats.totalMessages}`);
    console.log(`  Total conversations: ${stats.totalConversations}`);
    console.log(`  Total buckets to create: ${totalBuckets}`);
    console.log(`  Storage reduction: ~${((1 - totalBuckets / stats.totalMessages) * 100).toFixed(2)}%`);

    console.log('\n✅ Dry run complete. Run with --execute to perform migration.');
}

/**
 * Execute migration
 */
async function executeMigration() {
    console.log('\n🚀 EXECUTING MIGRATION\n');

    stats.startTime = Date.now();

    const conversations = await groupMessagesByConversation();

    console.log('\n📦 Creating buckets...');

    for (const [conversationId, conversation] of conversations) {
        try {
            const buckets = createBucketsFromMessages(conversation);

            // Insert buckets
            for (const bucketData of buckets) {
                const bucket = new ConversationBucket(bucketData);
                await bucket.save();
                stats.totalBuckets++;
            }

            console.log(`✅ Migrated ${conversationId}: ${buckets.length} buckets`);
        } catch (error) {
            console.error(`❌ Error migrating ${conversationId}:`, error.message);
            stats.errors.push({
                conversationId,
                error: error.message
            });
        }
    }

    stats.endTime = Date.now();
    const duration = ((stats.endTime - stats.startTime) / 1000).toFixed(2);

    console.log('\n' + '─'.repeat(80));
    console.log('\n📊 Migration Complete:');
    console.log(`  Total messages migrated: ${stats.totalMessages}`);
    console.log(`  Total conversations: ${stats.totalConversations}`);
    console.log(`  Total buckets created: ${stats.totalBuckets}`);
    console.log(`  Errors: ${stats.errors.length}`);
    console.log(`  Duration: ${duration}s`);

    if (stats.errors.length > 0) {
        console.log('\n⚠️  Errors encountered:');
        stats.errors.forEach(err => {
            console.log(`  - ${err.conversationId}: ${err.error}`);
        });
    }

    console.log('\n✅ Migration successful!');
    console.log('\n⚠️  IMPORTANT: Old messages are still in the database.');
    console.log('   Verify the migration before removing old messages.');
    console.log('   To remove old messages: db.messages.drop()');
}

/**
 * Rollback migration
 */
async function performRollback() {
    console.log('\n⏮️  ROLLING BACK MIGRATION\n');

    try {
        const bucketCount = await ConversationBucket.countDocuments();
        console.log(`Found ${bucketCount} buckets to remove`);

        await ConversationBucket.deleteMany({});

        console.log('✅ Rollback complete. Bucket collection cleared.');
        console.log('   Old messages are still available in the messages collection.');
    } catch (error) {
        console.error('❌ Rollback failed:', error.message);
    }
}

/**
 * Verify migration integrity
 */
async function verifyMigration() {
    console.log('\n🔍 Verifying migration...');

    const oldMessageCount = await Message.countDocuments();

    const buckets = await ConversationBucket.find({});
    let newMessageCount = 0;

    for (const bucket of buckets) {
        newMessageCount += bucket.messageCount;
    }

    console.log(`\nOld messages: ${oldMessageCount}`);
    console.log(`New messages: ${newMessageCount}`);

    if (oldMessageCount === newMessageCount) {
        console.log('✅ Message count matches!');
    } else {
        console.log('❌ Message count mismatch!');
        console.log(`   Difference: ${Math.abs(oldMessageCount - newMessageCount)} messages`);
    }
}

/**
 * Main function
 */
async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║         Message Migration: Bucket Pattern                     ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    if (!isDryRun && !isExecute && !isRollback) {
        console.log('\n❌ Error: Please specify a mode:');
        console.log('   --dry-run    Preview changes without making them');
        console.log('   --execute    Perform the migration');
        console.log('   --rollback   Revert the migration');
        console.log('\nExample: node scripts/migrate-to-buckets.js --dry-run');
        process.exit(1);
    }

    await connectDB();

    if (isDryRun) {
        await performDryRun();
    } else if (isExecute) {
        await executeMigration();
        await verifyMigration();
    } else if (isRollback) {
        await performRollback();
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
}

// Run migration
main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
