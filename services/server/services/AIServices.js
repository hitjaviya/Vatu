const Groq = require('groq-sdk');
const ConversationBucket = require('../models/ConversationBucket');
const User = require('../models/User');
const Task = require('../models/Task');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Builds a readable transcript from raw messages
 * e.g.  "UserA: I'll look into WebRTC integration\nUserB: I'll handle load balancing"
 */
function buildTranscript(messages) {
    return messages
        .filter(m => m.type === 'text' && !m.deleted)   // text only, skip deleted
        .slice(-80)                                       // last 80 msgs → stay within token limit
        .map(m => {
            const name = m.sender?.username || 'Unknown';
            return `${name}: ${m.content}`;
        })
        .join('\n');
}

/**
 * The core prompt — tells Groq exactly what to return
 */
function buildPrompt(transcript) {
    return `
You are a task extraction assistant for a team chat application.

Read the conversation below and extract every task, commitment, or action item mentioned.
For each task return a JSON object inside a "tasks" array with these fields:
- "title"          : short task name (max 10 words)
- "description"    : one clear, meaningful sentence describing what needs to be done
- "assignedToName" : the username of whoever said they will do it (or null if unclear)
- "priority"       : "low" | "medium" | "high"  (judge from urgency/importance)
- "tags"           : array of relevant keywords (e.g. ["webrtc", "backend", "design"])
- "sourceMessages" : array of the exact message strings you based this task on

Conversation:
${transcript}

Rules:
- Only extract REAL tasks/commitments, not general discussion.
- If nobody is clearly assigned, set assignedToName to null.
- Return ONLY valid JSON. No markdown, no explanation.

Example output:
{
  "tasks": [
    {
      "title": "Research WebRTC integration",
      "description": "Investigate how WebRTC works and how it can be integrated into the application for video calling.",
      "assignedToName": "userA",
      "priority": "high",
      "tags": ["webrtc", "video-call", "research"],
      "sourceMessages": ["userA: ill look for webrtc socket how its work and how we integrate in our application"]
    }
  ]
}
`;
}

/**
 * Main function — called by the route handler
 * @param {string} conversationId  - e.g. "dm_abc_xyz" or group conversationId
 * @param {string} conversationType - "dm" | "group"
 * @param {object} requestingUser   - req.user from auth middleware
 */
async function extractTasksFromConversation(conversationId, conversationType, requestingUser) {

    // 1. Fetch messages from DB
    const messages = await ConversationBucket.getMessages(conversationId, { limit: 80 });

    if (!messages || messages.length === 0) {
        throw new Error('No messages found in this conversation');
    }

    // 2. Build transcript
    const transcript = buildTranscript(messages);

    if (!transcript.trim()) {
        throw new Error('No readable text messages found to analyze');
    }

    // 3. Call Groq
    const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: buildPrompt(transcript) }],
        response_format: { type: 'json_object' }, // ← forces clean JSON, no markdown wrapping
        temperature: 0.3  // lower = more focused, less creative
    });

    // 4. Parse response
    const raw = completion.choices[0]?.message?.content;
    const parsed = JSON.parse(raw); // safe because response_format: json_object
    const aiTasks = parsed.tasks || [];

    if (aiTasks.length === 0) {
        return []; // no tasks found in conversation
    }

    // 5. Get all participants to resolve names → User IDs
    const bucket = await ConversationBucket.findOne({ conversationId })
        .populate('participants', 'username _id');

    const participantMap = {}; // username (lowercase) → userId
    if (bucket?.participants) {
        bucket.participants.forEach(p => {
            participantMap[p.username.toLowerCase()] = p._id;
        });
    }

    // 6. Save each extracted task to DB
    const savedTasks = [];

    for (const aiTask of aiTasks) {
        const assignedToName = aiTask.assignedToName?.toLowerCase() || null;
        const assignedUserId = assignedToName ? (participantMap[assignedToName] || null) : null;

        // Map sourceMessages strings → objects
        const sourceMessages = (aiTask.sourceMessages || []).map(content => {
            const colonIdx = content.indexOf(':');
            if (colonIdx === -1) return { senderName: 'Unknown', content, createdAt: new Date() };
            return {
                senderName: content.substring(0, colonIdx).trim(),
                content: content.substring(colonIdx + 1).trim(),
                createdAt: new Date()
            };
        });

        const task = new Task({
            conversationId,
            conversationType,
            participants: bucket?.participants?.map(p => p._id) || [],
            title: aiTask.title,
            description: aiTask.description,
            priority: aiTask.priority || 'medium',
            tags: aiTask.tags || [],
            sourceMessages,
            assignedTo: assignedUserId,
            assignedToName: aiTask.assignedToName || null,
            createdBy: requestingUser._id,
            confirmed: false
        });

        await task.save();
        savedTasks.push(task);
    }

    return savedTasks;
}

module.exports = { extractTasksFromConversation };
