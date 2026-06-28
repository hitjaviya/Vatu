import React from 'react';

/**
 * PinnedMessagesBar — the collapsible banner shown below the chat header.
 * Supports navigation between multiple pinned messages and an expand-all dropdown.
 */
function PinnedMessagesBar({
    pinnedMessages,
    currentPinnedIndex,
    setCurrentPinnedIndex,
    showAllPinned,
    setShowAllPinned,
    onScrollToMessage,
    onUnpin,
}) {
    if (!pinnedMessages || pinnedMessages.length === 0) return null;

    const current = pinnedMessages[currentPinnedIndex];

    return (
        <div className="pinned-messages-wrapper">
            <div className="pinned-message-banner">
                {/* Pin icon — clicks to jump */}
                <div className="pinned-icon" onClick={() => onScrollToMessage(current._id || current.id)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                    </svg>
                </div>

                {/* Content */}
                <div className="pinned-content" onClick={() => onScrollToMessage(current._id || current.id)}>
                    <span className="pinned-label">
                        Pinned Message{pinnedMessages.length > 1 && ` #${currentPinnedIndex + 1} of ${pinnedMessages.length}`}
                    </span>
                    <span className="pinned-text">
                        {current.content || current.fileName || 'File'}
                    </span>
                </div>

                {/* Action buttons */}
                <div className="pinned-actions">
                    {pinnedMessages.length > 1 && (
                        <div className="pinned-nav">
                            <button
                                className="pinned-nav-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentPinnedIndex(prev => (prev - 1 + pinnedMessages.length) % pinnedMessages.length);
                                }}
                                title="Previous pinned message"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                            </button>
                            <button
                                className="pinned-nav-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentPinnedIndex(prev => (prev + 1) % pinnedMessages.length);
                                }}
                                title="Next pinned message"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                        </div>
                    )}

                    {/* Show all list toggle */}
                    <button
                        className={`pinned-list-btn ${showAllPinned ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setShowAllPinned(v => !v); }}
                        title="Show all pinned messages"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="8" y1="6" x2="21" y2="6" />
                            <line x1="8" y1="12" x2="21" y2="12" />
                            <line x1="8" y1="18" x2="21" y2="18" />
                            <line x1="3" y1="6" x2="3.01" y2="6" />
                            <line x1="3" y1="12" x2="3.01" y2="12" />
                            <line x1="3" y1="18" x2="3.01" y2="18" />
                        </svg>
                    </button>

                    {/* Unpin current */}
                    <button
                        className="pinned-close"
                        onClick={(e) => { e.stopPropagation(); onUnpin(current); }}
                        title="Unpin message"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* All-pinned dropdown */}
            {showAllPinned && (
                <div className="pinned-all-dropdown">
                    <div className="pinned-all-header">
                        <span>Pinned Messages ({pinnedMessages.length})</span>
                        <button className="pinned-all-close" onClick={() => setShowAllPinned(false)}>✕</button>
                    </div>
                    <div className="pinned-all-list">
                        {pinnedMessages.map((msg, index) => (
                            <div
                                key={msg._id || msg.id}
                                className={`pinned-all-item ${index === currentPinnedIndex ? 'active' : ''}`}
                                onClick={() => {
                                    setCurrentPinnedIndex(index);
                                    onScrollToMessage(msg._id || msg.id);
                                    setShowAllPinned(false);
                                }}
                            >
                                <div className="pinned-all-item-sender">{msg.sender?.username || 'User'}</div>
                                <div className="pinned-all-item-text">{msg.content || msg.fileName || 'File'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default PinnedMessagesBar;
