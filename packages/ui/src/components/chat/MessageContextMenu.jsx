import React from 'react';
import { QUICK_EMOJIS } from './utils/messageHelpers';

/**
 * MessageContextMenu — right-click context menu with quick emoji reactions
 * and action items (copy, reply, forward, pin, info, delete).
 */
function MessageContextMenu({
    contextMenu,
    onClose,
    onCopy,
    onReply,
    onForward,
    onPin,
    onInfo,
    onDelete,
    onReact,
    isOwnMessage,
}) {
    if (!contextMenu) return null;
    const { x, y, message } = contextMenu;
    const isDeleted = message.type === 'deleted' || message.deleted;
    const isOwn = isOwnMessage(message);

    return (
        <div
            className="msg-context-menu"
            style={{ top: y, left: x }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Quick emoji reactions */}
            {!isDeleted && (
                <div className="ctx-reactions-bar">
                    {QUICK_EMOJIS.map(emoji => (
                        <button
                            key={emoji}
                            className="ctx-reaction-btn"
                            onClick={() => onReact(message, emoji)}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {!isDeleted && (
                <button className="ctx-item" onClick={() => onCopy(message)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                </button>
            )}

            {!isDeleted && (
                <button className="ctx-item" onClick={() => { onReply(message); onClose(); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                    </svg>
                    Reply
                </button>
            )}

            {!isDeleted && (
                <button className="ctx-item" onClick={() => onForward(message)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" />
                    </svg>
                    Forward
                </button>
            )}

            <button className="ctx-item" onClick={() => onPin(message)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                </svg>
                {message.pinned ? 'Unpin' : 'Pin'}
            </button>

            {isOwn && (
                <button className="ctx-item ctx-item-info" onClick={() => onInfo(message)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Info
                </button>
            )}

            {!isDeleted && (
                <button className="ctx-item ctx-item-danger" onClick={() => onDelete(message)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                    Delete
                </button>
            )}
        </div>
    );
}

export default MessageContextMenu;
