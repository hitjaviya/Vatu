import React from 'react';
import { getInitials } from './utils/messageHelpers';

/**
 * ChatHeader — top bar with avatar, name, member count, search button.
 * Clicking the avatar opens UserInfoModal.
 */
function ChatHeader({ selectedChat, showSearch, onToggleSearch, onAvatarClick }) {
    const { data, type } = selectedChat;
    const displayName = data.username || data.name || 'Unknown';

    return (
        <div className="chat-header">
            <div className="chat-header-info">
                <div
                    className="chat-header-avatar"
                    onClick={() => type === 'user' && onAvatarClick && onAvatarClick(data)}
                    style={type === 'user' ? { cursor: 'pointer' } : {}}
                    title={type === 'user' ? `View ${displayName}'s profile` : undefined}
                >
                    {data.avatar ? (
                        <img src={data.avatar} alt={displayName} />
                    ) : (
                        <span>{getInitials(displayName)}</span>
                    )}
                    {/* Online indicator for private chats */}
                    {type === 'user' && (
                        <div className="chat-header-status-dot" />
                    )}
                </div>
                <div>
                    <h2
                        className={type === 'user' ? 'chat-header-name-clickable' : ''}
                        onClick={() => type === 'user' && onAvatarClick && onAvatarClick(data)}
                    >
                        {displayName}
                    </h2>
                    {type === 'group' && (
                        <p>{data.members?.length || 0} members</p>
                    )}
                </div>
            </div>
            <div className="chat-header-actions">
                <button
                    className="header-action-btn"
                    onClick={() => onToggleSearch(!showSearch)}
                    title="Search messages"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export default ChatHeader;
