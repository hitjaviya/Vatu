// Shared API helpers and hooks
// Usage: import { authAPI } from '@chat-app/shared/api'
//        import { useAuth } from '@chat-app/shared/hooks/useAuth'

export * from './api.js';
export { useAuth }   from './hooks/useAuth.js';
export { useSocket } from './hooks/useSocket.js';
