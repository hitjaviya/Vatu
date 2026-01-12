import React, { useState, useEffect, useRef } from 'react';
import { messagesAPI, groupsAPI } from '@chat-app/shared/api';
import './ChatWindow.css';

function ChatWindow({ selectedChat, currentUser, socket, onRefreshGroups }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [typing, setTyping] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Fetch messages when chat changes
    useEffect(() => {
        if (selectedChat) {
            fetchMessages();
        } else {
            setMessages([]);
        }
    }, [selectedChat]);

    // Socket listeners
    useEffect(() => {
        if (!socket) return;

        const handleMessageReceive = (message) => {
            if (selectedChat?.type === 'user' && message.senderId === selectedChat.id) {
                setMessages((prev) => [...prev, message]);
                scrollToBottom();
            }
        };

        const handleMessageSent = (message) => {
            if (selectedChat?.type === 'user' && message.recipientId === selectedChat.id) {
                setMessages((prev) => [...prev, message]);
                scrollToBottom();
            }
        };

        const handleGroupMessageReceive = (message) => {
            if (selectedChat?.type === 'group' && message.groupId === selectedChat.id) {
                setMessages((prev) => [...prev, message]);
                scrollToBottom();
            }
        };

        const handleTypingStart = ({ userId }) => {
            if (selectedChat?.type === 'user' && userId === selectedChat.id) {
                setTyping(true);
            }
        };

        const handleTypingStop = ({ userId }) => {
            if (selectedChat?.type === 'user' && userId === selectedChat.id) {
                setTyping(false);
            }
        };

        socket.on('message:receive', handleMessageReceive);
        socket.on('message:sent', handleMessageSent);
        socket.on('group:message:receive', handleGroupMessageReceive);
        socket.on('typing:start', handleTypingStart);
        socket.on('typing:stop', handleTypingStop);

        return () => {
            socket.off('message:receive', handleMessageReceive);
            socket.off('message:sent', handleMessageSent);
            socket.off('group:message:receive', handleGroupMessageReceive);
            socket.off('typing:start', handleTypingStart);
            socket.off('typing:stop', handleTypingStop);
        };
    }, [socket, selectedChat]);

    const fetchMessages = async () => {
        if (!selectedChat) return;
        setLoading(true);
        try {
            let response;
            if (selectedChat.type === 'user') {
                response = await messagesAPI.getConversation(selectedChat.id);
            } else {
                response = await groupsAPI.getMessages(selectedChat.id);
            }
            setMessages(response.data.messages);
            scrollToBottom();
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleDownload = async (fileUrl, fileName) => {
        try {
            const response = await fetch(`http://localhost:5000${fileUrl}`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName || 'download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading file:', error);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat) return;
        const content = newMessage.trim();
        setNewMessage('');
        try {
            const messageData = {
                content,
                type: 'text',
                ...(replyingTo && { replyTo: replyingTo._id || replyingTo.id })
            };

            console.log('Sending message with replyTo:', messageData);

            if (selectedChat.type === 'user') {
                socket && socket.emit('message:send', { recipientId: selectedChat.id, ...messageData });
            } else {
                socket && socket.emit('group:message', { groupId: selectedChat.id, ...messageData });
            }
            setReplyingTo(null);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleTyping = (e) => {
        setNewMessage(e.target.value);
        if (selectedChat?.type === 'user' && socket) {
            socket.emit('typing:start', { recipientId: selectedChat.id });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit('typing:stop', { recipientId: selectedChat.id });
            }, 2000);
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedChat) return;
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await messagesAPI.uploadFile(formData);
            const { fileUrl, fileName, fileSize, type } = response.data;

            const messageData = {
                content: fileName,
                type: type || 'file',
                fileUrl,
                fileName,
                fileSize,
                ...(replyingTo && { replyTo: replyingTo._id || replyingTo.id })
            };

            console.log('Sending file with replyTo:', messageData);

            if (selectedChat.type === 'user') {
                socket && socket.emit('message:send', {
                    recipientId: selectedChat.id,
                    ...messageData
                });
            } else {
                socket && socket.emit('group:message', {
                    groupId: selectedChat.id,
                    ...messageData
                });
            }
            setReplyingTo(null);
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    };
    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return 'Unknown size';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getFileIcon = (fileName) => {
        if (!fileName) return '📎';
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            pdf: '📄',
            doc: '📝',
            docx: '📝',
            txt: '📝',
            xls: '📊',
            xlsx: '📊',
            ppt: '📊',
            pptx: '📊',
            zip: '📦',
            rar: '📦',
            jpg: '🖼️',
            jpeg: '🖼️',
            png: '🖼️',
            gif: '🖼️',
            mp4: '🎥',
            mp3: '🎵',
            wav: '🎵'
        };
        return iconMap[ext] || '📎';
    };

    const getInitials = (name) => {
        return (
            name
                ?.split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || '?'
        );
    };

    const getSenderDisplayName = (msg, isOwn) => {
        if (isOwn) {
            return 'You';
        }

        // For group chats or direct messages, show the sender's username
        if (msg.sender && typeof msg.sender === 'object') {
            return msg.sender.username || msg.sender.name || 'Unknown User';
        }

        // Fallback for direct chats where sender might not be populated
        if (selectedChat.type === 'user') {
            return selectedChat.data.username || selectedChat.data.name || 'Unknown User';
        }

        // For group chats, try to find the sender in the members list
        if (selectedChat.type === 'group' && selectedChat.data.members) {
            const senderId = msg.senderId || msg.sender;
            const member = selectedChat.data.members.find(m =>
                (typeof m === 'object' ? m._id : m) === senderId
            );
            if (member && typeof member === 'object') {
                return member.username || member.name || 'Unknown User';
            }
        }

        return 'Unknown User';
    };

    const findRepliedMessage = (messageId) => {
        if (!messageId) return null;
        // Handle both string and ObjectId comparison
        return messages.find(m => {
            const mId = m._id || m.id;
            return mId && (mId.toString() === messageId.toString() || mId === messageId);
        });
    };

    const handleReply = (msg) => {
        setReplyingTo(msg);
        // Auto-focus input when replying
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
    };

    const handleScrollToMessage = (messageId) => {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight the message briefly
            messageElement.classList.add('highlight-message');
            setTimeout(() => {
                messageElement.classList.remove('highlight-message');
            }, 2000);
        }
    };

    if (!selectedChat) {
        return (
            <div className="chat-window empty">
                <div className="empty-chat-state">
                    <div className="empty-icon">💬</div>
                    <h2>Select a chat to start messaging</h2>
                    <p>Choose a conversation from the sidebar to begin</p>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-window">
            {/* Header */}
            <div className="chat-header">
                <div className="chat-header-info">
                    <div className="chat-header-avatar">
                        {selectedChat.data.avatar ? (
                            <img src={selectedChat.data.avatar} alt={selectedChat.data.username || selectedChat.data.name} />
                        ) : (
                            <span>{getInitials(selectedChat.data.username || selectedChat.data.name)}</span>
                        )}
                    </div>
                    <div>
                        <h2>{selectedChat.data.username || selectedChat.data.name}</h2>
                        {selectedChat.type === 'group' && (
                            <p>{selectedChat.data.members?.length || 0} members</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="messages-container">
                {loading ? (
                    <div className="loading-messages"><div className="loading-spinner" /></div>
                ) : messages.length === 0 ? (
                    <div className="no-messages"><p>No messages yet. Start the conversation!</p></div>
                ) : (
                    <div className="messages-list">
                        {messages.map((msg, idx) => {
                            // Fix: Handle both object and string ID for sender
                            const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
                            const isOwn = msg.senderId === currentUser.id || senderId === currentUser.id;

                            // Check if we should show sender info (first message or sender changed)
                            const prevSenderId = idx > 0 ? (typeof messages[idx - 1].sender === 'object' ? messages[idx - 1].sender._id : messages[idx - 1].sender) : null;
                            const nextSenderId = idx < messages.length - 1 ? (typeof messages[idx + 1].sender === 'object' ? messages[idx + 1].sender._id : messages[idx + 1].sender) : null;

                            const isFirstInGroup = prevSenderId !== senderId;
                            const isLastInGroup = nextSenderId !== senderId;
                            const isMiddleInGroup = !isFirstInGroup && !isLastInGroup;
                            const isSingleMessage = isFirstInGroup && isLastInGroup;

                            const showSenderName = isFirstInGroup;
                            const showAvatar = !isOwn && isFirstInGroup;

                            let groupClass = 'msg-single';
                            if (isSingleMessage) groupClass = 'msg-single';
                            else if (isFirstInGroup) groupClass = 'msg-start';
                            else if (isMiddleInGroup) groupClass = 'msg-middle';
                            else if (isLastInGroup) groupClass = 'msg-end';

                            return (
                                <div 
                                    key={idx} 
                                    className={`message ${isOwn ? 'own' : 'other'} ${groupClass}`}
                                    data-message-id={msg._id || msg.id}
                                >
                                    {showAvatar && (
                                        <div className="message-avatar">
                                            <span>{getInitials(getSenderDisplayName(msg, false))}</span>
                                        </div>
                                    )}
                                    <div className="message-content">
                                        {showSenderName && (
                                            <div className="message-sender" style={{ textAlign: isOwn ? 'right' : 'left' }}>
                                                {getSenderDisplayName(msg, isOwn)}
                                            </div>
                                        )}
                                        {msg.type === 'text' ? (
                                            <div className="message-bubble">
                                                {msg.replyTo && (() => {
                                                    const repliedMsg = findRepliedMessage(msg.replyTo);
                                                    if (repliedMsg) {
                                                        const repliedSenderId = typeof repliedMsg.sender === 'object' ? repliedMsg.sender._id : repliedMsg.sender;
                                                        const repliedIsOwn = repliedMsg.senderId === currentUser.id || repliedSenderId === currentUser.id;
                                                        return (
                                                            <div 
                                                                className="replied-message" 
                                                                onClick={() => handleScrollToMessage(msg.replyTo)}
                                                                title="Click to jump to original message"
                                                            >
                                                                <div className="replied-message-header">
                                                                    {getSenderDisplayName(repliedMsg, repliedIsOwn)}
                                                                </div>
                                                                <div className="replied-message-content">
                                                                    {repliedMsg.type === 'text' ? repliedMsg.content : `📎 ${repliedMsg.fileName || 'File'}`}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                })()}
                                                <p>{msg.content}</p>
                                                <div className="message-actions">
                                                    <button className="reply-button" onClick={() => handleReply(msg)} title="Reply">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <polyline points="9 14 4 9 9 4"></polyline>
                                                            <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                                                        </svg>
                                                    </button>
                                                    <span className="message-time">{formatTime(msg.timestamp || msg.createdAt)}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="message-file">
                                                {msg.type === 'image' ? (
                                                    <div className="image-container" onClick={() => setPreviewImage(`http://localhost:5000${msg.fileUrl}`)}>
                                                        <img src={`http://localhost:5000${msg.fileUrl}`} alt={msg.fileName} />
                                                        <div className="image-overlay">
                                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                                                <circle cx="11" cy="11" r="8" />
                                                                <path d="m21 21-4.35-4.35" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="file-attachment">
                                                        <div className="file-icon-wrapper">
                                                            <div className="file-icon">
                                                                {getFileIcon(msg.fileName)}
                                                            </div>
                                                        </div>
                                                        <div className="file-details">
                                                            <div className="file-name" title={msg.fileName}>
                                                                {msg.fileName}
                                                            </div>
                                                            <div className="file-size">
                                                                {formatFileSize(msg.fileSize)}
                                                            </div>
                                                        </div>
                                                        <div className="file-actions">
                                                            <button
                                                                className="file-action-btn download-btn"
                                                                onClick={() => handleDownload(msg.fileUrl, msg.fileName)}
                                                                title="Download file"
                                                            >
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                    <polyline points="7 10 12 15 17 10" />
                                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                                </svg>
                                                                Download
                                                            </button>
                                                            <a
                                                                href={`http://localhost:5000${msg.fileUrl}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="file-action-btn view-btn"
                                                                onClick={(e) => e.stopPropagation()}
                                                                title="Open in new tab"
                                                            >
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                                                    <polyline points="15 3 21 3 21 9" />
                                                                    <line x1="10" y1="14" x2="21" y2="3" />
                                                                </svg>
                                                                Open
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                                <span className="message-time">{formatTime(msg.timestamp || msg.createdAt)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {typing && (
                            <div className="typing-indicator">
                                <div className="typing-dots"><span></span><span></span><span></span></div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="message-input-container">
                {replyingTo && (
                    <div className="reply-preview">
                        <div className="reply-preview-header">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9 14 4 9 9 4"></polyline>
                                <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                            </svg>
                            <span>Replying to {(() => {
                                const repliedSenderId = typeof replyingTo.sender === 'object' ? replyingTo.sender._id : replyingTo.sender;
                                const repliedIsOwn = replyingTo.senderId === currentUser.id || repliedSenderId === currentUser.id;
                                return getSenderDisplayName(replyingTo, repliedIsOwn);
                            })()}</span>
                            <button className="cancel-reply" onClick={() => setReplyingTo(null)} title="Cancel reply">
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
                <form className="message-input-form" onSubmit={handleSendMessage}>
                    <button type="button" className="attach-button" onClick={() => fileInputRef.current?.click()}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                    </button>
                    <input
                        ref={inputRef}
                        type="text"
                        className="message-input"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={handleTyping}
                    />
                    <button type="submit" className="send-button" disabled={!newMessage.trim()}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                        accept="image/*,.pdf,.doc,.docx,.txt"
                    />
                </form>
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="image-preview-modal" onClick={() => setPreviewImage(null)}>
                    <div className="image-preview-content" onClick={e => e.stopPropagation()}>
                        <img src={previewImage} alt="Preview" />
                        <button className="close-preview" onClick={() => setPreviewImage(null)}>×</button>
                        <button
                            className="download-preview-btn"
                            onClick={() => {
                                const fileName = previewImage.split('/').pop();
                                handleDownload(previewImage.replace('http://localhost:5000', ''), fileName);
                            }}
                        >
                            Download
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatWindow;
