import React from 'react';
import { ALL_EMOJIS } from './utils/messageHelpers';

/**
 * MessageInput — form with file attach, emoji picker, text input, send button.
 * All state is lifted up except showEmojiPicker (internal to this component).
 */
function MessageInput({
    newMessage,
    setNewMessage,
    replyingTo,
    onCancelReply,
    onSend,
    onTyping,
    onFileSelect,
    inputRef,
    fileInputRef,
    getSenderDisplayName,
}) {
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);

    React.useEffect(() => {
        if (!showEmojiPicker) return;
        const close = (e) => {
            if (!e.target.closest('.emoji-picker-container')) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [showEmojiPicker]);

    return (
        <div className="message-input-container">
            {replyingTo && (
                <div className="reply-preview">
                    <div className="reply-preview-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 14 4 9 9 4"></polyline>
                            <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                        </svg>
                        <span>Replying to {getSenderDisplayName(replyingTo)}</span>
                        <button className="cancel-reply" onClick={onCancelReply} title="Cancel reply">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div className="reply-preview-content">
                        {replyingTo.type === 'text' ? replyingTo.content : `📎 ${replyingTo.fileName || 'File'}`}
                    </div>
                </div>
            )}

            <form className="message-input-form" onSubmit={onSend}>
                {/* File attach */}
                <button type="button" className="attach-button" onClick={() => fileInputRef.current?.click()}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                </button>

                {/* Emoji picker */}
                <div className="emoji-picker-container">
                    <button
                        type="button"
                        className="emoji-trigger-btn"
                        onClick={() => setShowEmojiPicker(v => !v)}
                        title="Add emoji"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                            <line x1="9" y1="9" x2="9.01" y2="9" />
                            <line x1="15" y1="9" x2="15.01" y2="9" />
                        </svg>
                    </button>
                    {showEmojiPicker && (
                        <div className="emoji-picker-popover">
                            <div className="emoji-picker-grid">
                                {ALL_EMOJIS.map(emoji => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        className="emoji-item-btn"
                                        onClick={() => {
                                            setNewMessage(prev => prev + emoji);
                                            setShowEmojiPicker(false);
                                            inputRef.current?.focus();
                                        }}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Text input */}
                <input
                    ref={inputRef}
                    type="text"
                    className="message-input"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={onTyping}
                />

                {/* Send */}
                <button type="submit" className="send-button" disabled={!newMessage.trim()}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={onFileSelect}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.mp4,.mkv,.avi,.mp3,.wav,.ogg,.aac,.flac"
                />
            </form>
        </div>
    );
}

export default MessageInput;
