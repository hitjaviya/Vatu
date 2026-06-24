# Unused Backend APIs Report

This document outlines all backend API routes defined in the Express server (`server/routes/`) that are **not currently utilized** by the React frontend (`desktop/src/` and `shared/api.js`). 

These unused APIs can be categorized into two groups:
1. **Abandoned by UI**: Present in the frontend's API utility folder (`shared/api.js`), but completely bypassed by the React components (often in favor of WebSocket events).
2. **Missing Entirely**: Fully implemented on the backend server, but never declared or requested anywhere in the frontend codebase.

---

## 1. Messages API (`/api/messages`)

The messaging layer handles the bulk of realtime interactions. Because of the heavy reliance on `socket.io` for realtime features, several HTTP routes have become redundant or abandoned.

### Abandoned HTTP Routes (Replaced by WebSockets)
> [!TIP]
> **Why are these unused?** 
> The ChatWindow UI completely bypasses these endpoints because it relies on emitting `socket.emit('message:send')` and `socket.emit('group:message')` to broadcast new messages and real-time events. 

*   **`POST /api/messages/send`**
    *   **Frontend Mapping:** `messagesAPI.send`
    *   **Original Purpose:** Send a text message via REST.

*   **`POST /api/messages/send-file`**
    *   **Frontend Mapping:** `messagesAPI.sendFile`
    *   **Original Purpose:** Upload a file and simultaneously publish a new message containing the file link.
    *   **Current Reality:** The frontend instead manually utilizes the two-step process: Hitting `POST /api/messages/upload` (via `messagesAPI.uploadFile`), grabbing the returned URL, and broadcasting the message directly over WebSockets.

*   **`PATCH /api/messages/:messageId/read`**
    *   **Frontend Mapping:** `messagesAPI.markAsRead`
    *   **Original Purpose:** Flag a single, specific message as "read".
    *   **Current Reality:** The frontend avoids singular updates and prefers `messagesAPI.markConversationAsRead` alongside `socket.emit('message:read')` broadcasts to clear read statuses across whole interactions.

### Completely Missing from Frontend
These endpoints are entirely orphaned and have no frontend equivalent structure.

*   **`GET /api/messages/unread-count`**
    *   Used to globally fetch all unread counts, but the frontend only leverages the grouped `unread-counts-by-conversation` endpoint.
*   **`GET /api/messages/conversations`**
    *   Used to fetch a list of recent active conversations. The frontend UI circumvents this by strictly fetching full lists of Users (`GET /api/users`) and Groups (`GET /api/groups`) directly into the sidebar.
*   **`GET /api/messages/search/:conversationId`**
    *   Designed for server-side message fuzzy searching. The ChatWindow component uses a Javascript-based local array filtering approach to achieve this instead.
*   **`DELETE /api/messages/:messageId`**
    *   Message deletion is fully functional on the backend, but the frontend UI currently lacks the "Delete Message" button.
*   **`GET /api/messages/stats/:conversationId`**
    *   Used to return total messages and timeline metrics. The UI doesn't render any statistics.

---

## 2. Groups API (`/api/groups`)

The Groups API is primarily used right now to `GET` all groups, `CREATE` groups, and `GET` messages for a group. Management routes are mostly abandoned.

### Mapped but Abandoned
*   **`GET /api/groups/:groupId`**
    *   **Frontend Mapping:** `groupsAPI.getById` 
    *   **Original Purpose:** Fetch details regarding a single group. No dedicated "Group Profile" screen exists in the dashboard.
*   **`PATCH /api/groups/:groupId`**
    *   **Frontend Mapping:** `groupsAPI.update`
    *   **Original Purpose:** Allows group admins to change the avatar or name of a group.
*   **`POST /api/groups/:groupId/members`**
    *   **Frontend Mapping:** `groupsAPI.addMember`
    *   **Original Purpose:** Allows the group admin to dynamically add players directly post-creation. 
*   **`DELETE /api/groups/:groupId/members/:userId`**
    *   **Frontend Mapping:** `groupsAPI.removeMember`
    *   **Original Purpose:** Eject members from an existing group workspace.

---

## 3. Users API (`/api/users`)

The Settings layer focuses primarily on core credential interactions (passwords and emails). Several robust profile-management features sit unused.

### Mapped but Abandoned
*   **`GET /api/users/:userId`**
    *   **Frontend Mapping:** `usersAPI.getById`
    *   **Original Purpose:** Fetch the isolated public data of a specific user profile. The UI skips this because `usersAPI.getAll` already buffers all profiles directly into memory.
*   **`PATCH /api/users/profile`**
    *   **Frontend Mapping:** `usersAPI.updateProfile`
    *   **Original Purpose:** Used to edit the general `username` handle. The Settings screen strictly restricts users to modifying their associated `email` and `password`.
*   **`PATCH /api/users/status`**
    *   **Frontend Mapping:** `usersAPI.updateStatus`
    *   **Original Purpose:** Manually set a persistent user state (e.g., `online`, `away`). The socket engine independently drives presence updates based on connection lifecycles.

### Completely Missing from Frontend
*   **`POST /api/users/avatar`**
    *   The `Settings.jsx` modal is missing an image upload wrapper for this route. It is impossible to successfully upload custom avatar profile pictures.

---

> [!NOTE]
> **Action Matrix**
> * Are you cleaning house? These endpoints could be safely deleted to reduce server footprint and testing overhead.
> * Are you expanding features? These unused APIs can act as a built-in roadmap for expanding moderation, profiles, and analytics UI features.
