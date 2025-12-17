# Sender Name Display Feature

## Problem
Users couldn't easily distinguish who sent which message, especially in group chats. The user specifically requested:
- Show "You" for their own messages
- Show the username for other users' messages

## Solution
Updated the `ChatWindow` component to display sender names for all messages.

### Changes Made

1.  **Added `getSenderDisplayName` Helper Function**:
    - Returns "You" if the message is from the current user.
    - Returns the sender's username if available.
    - Fallback to chat name for direct messages.

2.  **Updated Message Rendering Logic**:
    - Calculated `showSenderName` to determine when to show the name (first message of a block).
    - Replaced the group-only condition with a universal condition.
    - Added inline style `textAlign: isOwn ? 'right' : 'left'` to align the name correctly.

### Visual Result
- **Own Messages**: "You" appears above the message bubble, aligned to the right.
- **Other Messages**: Username appears above the message bubble, aligned to the left.
- **Avatars**: Now appear for other users in **both** group and direct chats.
- **Grouping**: Names and avatars only appear at the start of a group of consecutive messages from the same user.

## Files Modified
- `d:\Application\packages\desktop\src\components\ChatWindow.jsx`
