# Group Chat Retrieval Fix

## Problem
Users reported that group chat was not working ("user cant sent message"). While messages were being sent and saved correctly to `ConversationBucket` (via `MessageService`), they were not being retrieved correctly when the chat window loaded.

## Root Cause
The `GET /api/groups/:groupId/messages` endpoint in `packages/server/routes/groups.js` was querying the legacy `Message` model instead of using `MessageService.getConversationMessages`.

Since the application has migrated to a bucket-based storage system (`ConversationBucket`), the `Message` collection is no longer used for new messages. Therefore, the API was returning an empty list (or old messages), making it appear as if messages were not being sent or saved.

## Solution
Updated `packages/server/routes/groups.js` to use `MessageService.getConversationMessages`.

### Changes Made
1.  **`packages/server/routes/groups.js`**:
    -   Replaced `Message` model import with `MessageService`.
    -   Updated the `/:groupId/messages` route handler to call `MessageService.getConversationMessages(null, null, groupId, options)`.
    -   Removed the manual `reverse()` call on the response, as `MessageService` already returns messages in the correct order (oldest first).

## Verification
1.  Open a group chat.
2.  Send a message.
3.  Refresh the page.
4.  The message should still be visible in the chat history.
