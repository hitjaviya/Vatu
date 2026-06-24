import React, { useState, useEffect, useRef } from 'react';
import { messagesAPI, groupsAPI } from '@chat-app/shared/api';
import './ChatWindow.css';

function ChatWindow({ selectedChat, currentUser, socket, onRefreshGroups, isWindowFocused }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [typing, setTyping] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [showNewMessagesBanner, setShowNewMessagesBanner] = useState(false);
    const [newMessageMarkerIndex, setNewMessageMarkerIndex] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [showSearch, setShowSearch] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const lastSeenMessageCountRef = useRef(0);
    const bannerRef = useRef(null);

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    /**
     * Normalize message to have consistent senderId field
     */
    const normalizeMessage = (msg) => {
        const senderId = msg.senderId || (typeof msg.sender === 'object' ? msg.sender._id : msg.sender);
        return {
            ...msg,
            senderId,
            senderData: typeof msg.sender === 'object' ? msg.sender : null
        };
    };

    /**
     * Check if message belongs to current user
     */
    const isOwnMessage = (msg) => {
        return msg.senderId === currentUser.id;
    };

    /**
     * Get display name for message sender
     */
    const getSenderDisplayName = (msg) => {
        if (isOwnMessage(msg)) return 'You';

        if (msg.senderData) {
            return msg.senderData.username || msg.senderData.name || 'Unknown User';
        }

        if (selectedChat.type === 'user') {
            return selectedChat.data.username || selectedChat.data.name || 'Unknown User';
        }

        if (selectedChat.type === 'group' && selectedChat.data.members) {
            const member = selectedChat.data.members.find(m =>
                (typeof m === 'object' ? m._id : m) === msg.senderId
            );
            if (member && typeof member === 'object') {
                return member.username || member.name || 'Unknown User';
            }
        }

        return 'Unknown User';
    };

    /**
     * Get initials from name
     */
    const getInitials = (name) => {
        return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
    };

    /**
     * Format timestamp
     */
    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    /**
     * Format file size
     */
    const formatFileSize = (bytes) => {
        if (!bytes) return 'Unknown size';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    /**
     * Get file icon emoji
     */
    const getFileIcon = (fileName) => {
        if (!fileName) return '📎';
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            pdf: '📄', doc: '📝', docx: '📝', txt: '📝',
            xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊',
            zip: '📦', rar: '📦',
            jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
            mp4: '🎥', mp3: '🎵', wav: '🎵'
        };
        return iconMap[ext] || '📎';
    };

    /**
     * Get fully qualified URL (handles both relative local and absolute S3 URLs)
     */
    const getFullFileUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        // Use environment variable if available, otherwise fallback
        const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';
        return `${baseUrl}${url}`;
    };

    /**
     * Scroll to bottom of messages
     */
    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    /**
     * Search messages
     */
    const handleSearch = (query) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            setCurrentSearchIndex(0);
            return;
        }

        const results = messages
            .map((msg, idx) => ({ msg, idx }))
            .filter(({ msg }) =>
                msg.type === 'text' &&
                msg.content.toLowerCase().includes(query.toLowerCase())
            );

        setSearchResults(results);
        setCurrentSearchIndex(0);

        if (results.length > 0) {
            scrollToSearchResult(results[0].idx);
        }
    };

    const scrollToSearchResult = (messageIndex) => {
        const messageId = messages[messageIndex]?._id || messages[messageIndex]?.id;
        if (messageId) {
            handleScrollToMessage(messageId);
        }
    };

    const handleNextSearchResult = () => {
        if (searchResults.length === 0) return;
        const nextIndex = (currentSearchIndex + 1) % searchResults.length;
        setCurrentSearchIndex(nextIndex);
        scrollToSearchResult(searchResults[nextIndex].idx);
    };

    const handlePrevSearchResult = () => {
        if (searchResults.length === 0) return;
        const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
        setCurrentSearchIndex(prevIndex);
        scrollToSearchResult(searchResults[prevIndex].idx);
    };

    // ============================================================================
    // DATA FETCHING
    // ============================================================================

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
            // Normalize all messages
            const normalizedMessages = response.data.messages.map(normalizeMessage);
            setMessages(normalizedMessages);
            scrollToBottom();
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    };

    // ============================================================================
    // EFFECTS
    // ============================================================================

    // Mark messages as read
    const markMessagesAsRead = () => {
        if (!selectedChat || !socket) return;

        // Find unread messages from the other person
        const unreadMessages = messages.filter(msg =>
            !isOwnMessage(msg) && !msg.read && !msg.readAt
        );

        unreadMessages.forEach(msg => {
            const messageId = msg._id || msg.id;
            if (messageId) {
                if (selectedChat.type === 'user') {
                    socket.emit('message:read', {
                        messageId,
                        senderId: msg.senderId,
                        recipientId: currentUser.id
                    });
                } else if (selectedChat.type === 'group') {
                    socket.emit('group:message:read', {
                        messageId,
                        groupId: selectedChat.id,
                        userId: currentUser.id
                    });
                }
            }
        });
    };

    // Fetch messages when chat changes
    useEffect(() => {
        if (selectedChat) {
            fetchMessages();
        } else {
            setMessages([]);
        }
        setTyping(false);
    }, [selectedChat]);

    // Mark messages as read when they're loaded
    useEffect(() => {
        if (messages.length > 0 && selectedChat) {
            // Small delay to ensure messages are rendered
            setTimeout(() => {
                markMessagesAsRead();
            }, 500);
        }
    }, [messages.length, selectedChat]);

    // Cleanup typing timeout
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [selectedChat]);

    // Handle window focus changes
    useEffect(() => {
        if (isWindowFocused === undefined) return;

        if (!isWindowFocused) {
            lastSeenMessageCountRef.current = messages.length;
        } else {
            // Refresh messages when window regains focus
            if (selectedChat) {
                fetchMessages();
                // Mark messages as read when window regains focus
                setTimeout(() => {
                    markMessagesAsRead();
                }, 600);
            }

            // Check for new messages after fetch completes
            setTimeout(() => {
                if (messages.length > lastSeenMessageCountRef.current && lastSeenMessageCountRef.current > 0) {
                    setNewMessageMarkerIndex(lastSeenMessageCountRef.current);
                    setShowNewMessagesBanner(true);

                    setTimeout(() => {
                        bannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 300);
                }
                lastSeenMessageCountRef.current = messages.length;
            }, 500);
        }
    }, [isWindowFocused]);

    // Dismiss banner when scrolled past
    useEffect(() => {
        if (!bannerRef.current || !showNewMessagesBanner) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
                        setShowNewMessagesBanner(false);
                        setNewMessageMarkerIndex(null);
                    }
                });
            },
            { threshold: 0, rootMargin: '-50px 0px 0px 0px' }
        );

        observer.observe(bannerRef.current);

        return () => {
            if (bannerRef.current) {
                observer.unobserve(bannerRef.current);
            }
        };
    }, [showNewMessagesBanner]);

    // Socket listeners
    useEffect(() => {
        if (!socket) return;

        const handleMessageReceive = (message) => {
            if (selectedChat?.type === 'user' && message.senderId === selectedChat.id) {
                const normalized = normalizeMessage(message);
                setMessages((prev) => [...prev, normalized]);
                scrollToBottom();

                // Mark as read immediately since chat is open
                if (socket) {
                    setTimeout(() => {
                        socket.emit('message:read', {
                            messageId: message._id || message.id,
                            senderId: message.senderId,
                            recipientId: currentUser.id
                        });
                    }, 300);
                }
            }
        };

        const handleMessageSent = (message) => {
            if (selectedChat?.type === 'user' && message.recipientId === selectedChat.id) {
                setMessages((prev) => {
                    if (message.tempId) {
                        return prev.map(msg =>
                            msg._id === message.tempId || msg.id === message.tempId
                                ? { ...normalizeMessage(message), optimistic: false }
                                : msg
                        );
                    }
                    return [...prev, normalizeMessage(message)];
                });
                scrollToBottom();
            }
        };

        const handleGroupMessageReceive = (message) => {
            if (selectedChat?.type === 'group' && message.groupId === selectedChat.id) {
                setMessages((prev) => {
                    if (message.tempId && message.senderId === currentUser.id) {
                        return prev.map(msg =>
                            msg._id === message.tempId || msg.id === message.tempId
                                ? { ...normalizeMessage(message), optimistic: false }
                                : msg
                        );
                    }
                    const exists = prev.some(msg =>
                        (msg._id && msg._id === message._id) || (msg.id && msg.id === message.id)
                    );
                    if (exists) return prev;
                    return [...prev, normalizeMessage(message)];
                });
                scrollToBottom();

                // Mark group message as read if from someone else
                if (message.senderId !== currentUser.id && socket) {
                    setTimeout(() => {
                        socket.emit('group:message:read', {
                            messageId: message._id || message.id,
                            groupId: selectedChat.id,
                            userId: currentUser.id
                        });
                    }, 300);
                }
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

        const handleMessageDelivered = ({ messageId, deliveredAt }) => {
            setMessages((prev) =>
                prev.map((msg) =>
                    (msg._id === messageId || msg.id === messageId)
                        ? { ...msg, delivered: true, deliveredAt }
                        : msg
                )
            );
        };

        const handleMessageRead = ({ messageId, readAt }) => {
            setMessages((prev) =>
                prev.map((msg) =>
                    (msg._id === messageId || msg.id === messageId)
                        ? { ...msg, read: true, readAt }
                        : msg
                )
            );
        };

        socket.on('message:receive', handleMessageReceive);
        socket.on('message:sent', handleMessageSent);
        socket.on('group:message:receive', handleGroupMessageReceive);
        socket.on('typing:start', handleTypingStart);
        socket.on('typing:stop', handleTypingStop);
        socket.on('message:delivered', handleMessageDelivered);
        socket.on('message:read', handleMessageRead);

        return () => {
            socket.off('message:receive', handleMessageReceive);
            socket.off('message:sent', handleMessageSent);
            socket.off('group:message:receive', handleGroupMessageReceive);
            socket.off('typing:start', handleTypingStart);
            socket.off('typing:stop', handleTypingStop);
            socket.off('message:delivered', handleMessageDelivered);
            socket.off('message:read', handleMessageRead);
        };
    }, [socket, selectedChat, currentUser]);

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat) return;

        const content = newMessage.trim();
        setNewMessage('');

        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = normalizeMessage({
            _id: tempId,
            id: tempId,
            content,
            type: 'text',
            sender: currentUser.id,
            senderId: currentUser.id,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            ...(replyingTo && { replyTo: replyingTo._id || replyingTo.id }),
            ...(selectedChat.type === 'user' ? { recipientId: selectedChat.id } : { groupId: selectedChat.id }),
            optimistic: true
        });

        setMessages((prev) => [...prev, optimisticMessage]);
        scrollToBottom();

        try {
            const messageData = {
                content,
                type: 'text',
                ...(replyingTo && { replyTo: replyingTo._id || replyingTo.id })
            };

            if (selectedChat.type === 'user') {
                socket && socket.emit('message:send', {
                    recipientId: selectedChat.id,
                    ...messageData,
                    tempId
                });
            } else {
                socket && socket.emit('group:message', {
                    groupId: selectedChat.id,
                    ...messageData,
                    tempId
                });
            }

            setReplyingTo(null);
            setShowNewMessagesBanner(false);
            setNewMessageMarkerIndex(null);
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages((prev) => prev.filter(msg => msg._id !== tempId));
        }
    };

    const handleTyping = (e) => {
        setNewMessage(e.target.value);

        if (selectedChat?.type === 'user' && socket) {
            if (!typingTimeoutRef.current) {
                socket.emit('typing:start', { recipientId: selectedChat.id });
            }

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit('typing:stop', { recipientId: selectedChat.id });
                typingTimeoutRef.current = null;
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
            const arrayBuffer = await file.arrayBuffer();

            await window.electron.saveFile(arrayBuffer, file.name);
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

    const handleDownload = async (fileUrl, fileName) => {
        try {
            const fullUrl = getFullFileUrl(fileUrl);
            
            try {
                // Try fetching first (works for same-origin or if CORS is configured on S3)
                const response = await fetch(fullUrl);
                if (!response.ok) throw new Error('Network response not ok');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName || 'download';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            } catch (fetchError) {
                // Fallback for CORS blocks: just open the URL in a new tab
                window.open(fullUrl, '_blank');
            }
        } catch (error) {
            console.error('Error downloading file:', error);
        }
    };

    const handleReply = (msg) => {
        setReplyingTo(msg);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleScrollToMessage = (messageId) => {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageElement.classList.add('highlight-message');
            setTimeout(() => {
                messageElement.classList.remove('highlight-message');
            }, 2000);
        }
    };

    const findRepliedMessage = (messageId) => {
        if (!messageId) return null;
        return messages.find(m => {
            const mId = m._id || m.id;
            return mId && (mId.toString() === messageId.toString() || mId === messageId);
        });
    };

    const getMessageStatus = (msg) => {
        if (!isOwnMessage(msg)) return null;

        if (msg.optimistic) {
            return <span className="message-status sending" title="Sending">🕐</span>;
        }

        if (msg.read || msg.readAt) {
            return (
                <span className="message-status read" title="Read">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="20 6 9 17 4 12" transform="translate(4, 0)" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </span>
            );
        }

        if (msg.delivered || msg.deliveredAt) {
            return (
                <span className="message-status delivered" title="Delivered">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="20 6 9 17 4 12" transform="translate(4, 0)" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </span>
            );
        }

        return (
            <span className="message-status sent" title="Sent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        );
    };

    // ============================================================================
    // RENDER HELPERS
    // ============================================================================

    const renderMessage = (msg, idx) => {
        const isOwn = isOwnMessage(msg);

        // Determine message grouping
        const prevMsg = messages[idx - 1];
        const nextMsg = messages[idx + 1];

        const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;
        const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;
        const isSingleMessage = isFirstInGroup && isLastInGroup;

        let groupClass = 'msg-single';
        if (isSingleMessage) groupClass = 'msg-single';
        else if (isFirstInGroup) groupClass = 'msg-start';
        else if (!isFirstInGroup && !isLastInGroup) groupClass = 'msg-middle';
        else if (isLastInGroup) groupClass = 'msg-end';

        const showSenderName = isFirstInGroup;
        const showAvatar = !isOwn && isFirstInGroup;

        return (
            <React.Fragment key={msg._id || msg.id || idx}>
                {showNewMessagesBanner && newMessageMarkerIndex === idx && (
                    <div className="new-messages-banner" ref={bannerRef}>
                        <div className="new-messages-line"></div>
                        <span className="new-messages-text">New Messages</span>
                        <div className="new-messages-line"></div>
                    </div>
                )}

                <div
                    className={`message ${isOwn ? 'own' : 'other'} ${groupClass}`}
                    data-message-id={msg._id || msg.id}
                >
                    {showAvatar && (
                        <div className="message-avatar">
                            <span>{getInitials(getSenderDisplayName(msg))}</span>
                        </div>
                    )}

                    <div className="message-content">
                        {showSenderName && (
                            <div className="message-sender" style={{ textAlign: isOwn ? 'right' : 'left' }}>
                                {getSenderDisplayName(msg)}
                            </div>
                        )}

                        {msg.type === 'text' ? (
                            <div className="message-bubble">
                                {msg.replyTo && (() => {
                                    const repliedMsg = findRepliedMessage(msg.replyTo);
                                    if (repliedMsg) {
                                        return (
                                            <div
                                                className="replied-message"
                                                onClick={() => handleScrollToMessage(msg.replyTo)}
                                                title="Click to jump to original message"
                                            >
                                                <div className="replied-message-header">
                                                    {getSenderDisplayName(repliedMsg)}
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
                                    <span className="message-time">
                                        {formatTime(msg.timestamp || msg.createdAt)}
                                        {getMessageStatus(msg)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="message-file">
                                {msg.type === 'image' ? (
                                    <div className="image-wrapper">
                                        <div className="image-container" onClick={() => setPreviewImage(getFullFileUrl(msg.fileUrl))}>
                                            <img src={getFullFileUrl(msg.fileUrl)} alt={msg.fileName} />
                                            <div className="image-overlay">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                                    <circle cx="11" cy="11" r="8" />
                                                    <path d="m21 21-4.35-4.35" />
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="file-actions" style={{ marginTop: '8px', padding: '0 4px' }}>
                                            <button
                                                className="file-action-btn download-btn"
                                                onClick={(e) => { e.stopPropagation(); handleDownload(msg.fileUrl, msg.fileName); }}
                                                title="Download image"
                                                style={{ width: '100%', justifyContent: 'center' }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="7 10 12 15 17 10" />
                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                                Download
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="file-attachment">
                                        <div className="file-icon-wrapper">
                                            <div className="file-icon">{getFileIcon(msg.fileName)}</div>
                                        </div>
                                        <div className="file-details">
                                            <div className="file-name" title={msg.fileName}>{msg.fileName}</div>
                                            <div className="file-size">{formatFileSize(msg.fileSize)}</div>
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
                                                href={getFullFileUrl(msg.fileUrl)}
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
            </React.Fragment>
        );
    };

    // ============================================================================
    // MAIN RENDER
    // ============================================================================

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
                <div className="chat-header-actions">
                    <button
                        className="header-action-btn"
                        onClick={() => setShowSearch(!showSearch)}
                        title="Search messages"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            {showSearch && (
                <div className="search-bar">
                    <div className="search-input-container">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search messages..."
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            autoFocus
                        />
                        {searchQuery && (
                            <button className="clear-search-btn" onClick={() => handleSearch('')}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        )}
                    </div>
                    {searchResults.length > 0 && (
                        <div className="search-results-info">
                            <span>{currentSearchIndex + 1} of {searchResults.length}</span>
                            <div className="search-navigation">
                                <button onClick={handlePrevSearchResult} title="Previous result">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="15 18 9 12 15 6"></polyline>
                                    </svg>
                                </button>
                                <button onClick={handleNextSearchResult} title="Next result">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                    {searchQuery && searchResults.length === 0 && (
                        <div className="search-no-results">
                            No messages found
                        </div>
                    )}
                </div>
            )}

            {/* Messages */}
            <div className="messages-container">
                {loading ? (
                    <div className="loading-messages"><div className="loading-spinner" /></div>
                ) : messages.length === 0 ? (
                    <div className="no-messages"><p>No messages yet. Start the conversation!</p></div>
                ) : (
                    <div className="messages-list">
                        {messages.map((msg, idx) => renderMessage(msg, idx))}
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
                            <span>Replying to {getSenderDisplayName(replyingTo)}</span>
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
