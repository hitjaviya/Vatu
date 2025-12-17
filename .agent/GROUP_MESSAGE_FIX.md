# Group Message Sending Fix

## Problem
Users reported inability to send messages in group chats. Upon investigation, a critical issue was found in how group messages were being stored in the database.

## Root Cause
When a group message was sent, it was being saved to a `ConversationBucket` with an **empty participants array** (`[]`).

This caused multiple issues:
1.  **Unread Counts Broken**: The system queries for unread messages by checking buckets where the user is a participant. Since the array was empty, it found nothing.
2.  **Recent Conversations Broken**: Similarly, the "Recent Chats" list queries by participation. Groups were invisible to this query.
3.  **Potential Validation/Indexing Issues**: While Mongoose allows empty arrays by default, the logic relying on `participants` being populated was fundamentally broken for groups.

## Solution
Updated the `MessageService` and `ConversationBucket` model to correctly populate the `participants` array for group messages.

### Changes Made

1.  **`packages/server/services/MessageService.js`**:
    - Imported the `Group` model.
    - In `sendMessage`, added logic to fetch the group and extract its member IDs.
    - Passed these `groupParticipants` to the `addMessage` method.

2.  **`packages/server/models/ConversationBucket.js`**:
    - Updated `addMessage` signature to accept `groupParticipants`.
    - Used `groupParticipants` instead of `[]` when creating new buckets for group conversations.

### Result
- Group messages are now correctly associated with all group members.
- Unread counts for groups will now work correctly.
- Groups will appear in the "Recent Conversations" list.
- Message sending reliability is improved.

## Verification
1.  Send a message in a group chat.
2.  Verify it appears in the chat window.
3.  Verify other members receive it.
4.  Verify unread counts update for other members.
