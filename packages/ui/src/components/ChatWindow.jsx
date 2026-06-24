import React, { useState, useEffect, useRef } from 'react';
import { messagesAPI, groupsAPI, filesAPI } from '@chat-app/shared/api';
import './ChatWindow.css';

function ChatWindow({ selectedChat, currentUser, socket, onRefreshGroups, isWindowFocused, onUnreadMessageRead }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [typing, setTyping] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [showNewMessagesBanner, setShowNewMessagesBanner] = useState(false);
    const [newMessageMarkerIndex, setNewMessageMarkerIndex] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [showSearch, setShowSearch] = useState(false);
    const [fileDetailMsg, setFileDetailMsg] = useState(null);
    const [fileDetailMeta, setFileDetailMeta] = useState(null);
    const [fileDetailLoading, setFileDetailLoading] = useState(false);

    // Context menu state
    const [contextMenu, setContextMenu] = useState(null); // { x, y, message }
    // Message info modal state
    const [msgInfoModal, setMsgInfoModal] = useState(null); // { message, info }
    const [msgInfoLoading, setMsgInfoLoading] = useState(false);
    // Pinned message banner
    const [pinnedMessage, setPinnedMessage] = useState(null);

    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const lastSeenMessageCountRef = useRef(0);
    const bannerRef = useRef(null);
    const isWindowFocusedRef = useRef(isWindowFocused);
    const observedMessageIdsRef = useRef(new Set());
    const selectedChatRef = useRef(selectedChat);
    const currentUserRef = useRef(currentUser);
    const skipRef = useRef(0);
    const currentBucketRef = useRef(-1);

    // Keep refs in sync with current props
    useEffect(() => { isWindowFocusedRef.current = isWindowFocused; }, [isWindowFocused]);
    useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);
    useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    const normalizeMessage = (msg) => {
        const senderId = msg.senderId || (typeof msg.sender === 'object' ? msg.sender._id : msg.sender);
        return {
            ...msg,
            senderId,
            senderData: typeof msg.sender === 'object' ? msg.sender : null
        };
    };

    const isOwnMessage = (msg) => {
        return msg.senderId === currentUser.id;
    };

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

    const getInitials = (name) => {
        return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
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
            pdf: '📄', doc: '📝', docx: '📝', txt: '📝',
            xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊',
            zip: '📦', rar: '📦',
            jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
            mp4: '🎥', mp3: '🎵', wav: '🎵'
        };
        return iconMap[ext] || '📎';
    };

    const getFullFileUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';
        const formattedUrl = url.startsWith('/') ? url : `/${url}`;
        return `${baseUrl}${formattedUrl}`;
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

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

    const fetchMessages = async (showLoading = true) => {
        if (!selectedChat) return;
        if (showLoading) setLoading(true);
        try {
            let latestBucketNum;
            let result;

            if (selectedChat.type === 'user') {
                const bucketRes = await messagesAPI.getLatestBucket(selectedChat.id);
                latestBucketNum = bucketRes.data.bucketNumber;

                if (latestBucketNum < 0) {
                    setMessages([]);
                    setHasMoreMessages(false);
                    return;
                }

                const msgRes = await messagesAPI.getMessagesByBucket(selectedChat.id, latestBucketNum);
                result = msgRes.data;
            } else {
                const bucketRes = await groupsAPI.getLatestBucket(selectedChat.id);
                latestBucketNum = bucketRes.data.bucketNumber;

                if (latestBucketNum < 0) {
                    setMessages([]);
                    setHasMoreMessages(false);
                    return;
                }

                const msgRes = await groupsAPI.getMessagesByBucket(selectedChat.id, latestBucketNum);
                result = msgRes.data;
            }

            const normalizedMessages = result.messages.map(normalizeMessage);
            setMessages(normalizedMessages);

            currentBucketRef.current = latestBucketNum;
            setHasMoreMessages(latestBucketNum > 0);

            if (showLoading) scrollToBottom();
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const loadOlderMessages = async () => {
        if (!selectedChat || loadingOlder || !hasMoreMessages) return;
        if (currentBucketRef.current <= 0) {
            setHasMoreMessages(false);
            return;
        }
        setLoadingOlder(true);

        const container = messagesContainerRef.current;
        const scrollHeightBefore = container ? container.scrollHeight : 0;
        const scrollTopBefore = container ? container.scrollTop : 0;

        const olderBucketNum = currentBucketRef.current - 1;

        try {
            let result;
            if (selectedChat.type === 'user') {
                const res = await messagesAPI.getMessagesByBucket(selectedChat.id, olderBucketNum);
                result = res.data;
            } else {
                const res = await groupsAPI.getMessagesByBucket(selectedChat.id, olderBucketNum);
                result = res.data;
            }

            const olderMessages = result.messages.map(normalizeMessage);
            currentBucketRef.current = olderBucketNum;
            setHasMoreMessages(olderBucketNum > 0);

            if (olderMessages.length > 0) {
                setMessages(prev => [...olderMessages, ...prev]);

                requestAnimationFrame(() => {
                    if (container) {
                        container.scrollTop = scrollTopBefore + (container.scrollHeight - scrollHeightBefore);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading older bucket:', error);
        } finally {
            setLoadingOlder(false);
        }
    };

    // ============================================================================
    // EFFECTS
    // ============================================================================

    const markMessagesAsRead = () => {
        if (!selectedChat || !socket) return;

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

    useEffect(() => {
        if (selectedChat) {
            setHasMoreMessages(true);
            currentBucketRef.current = -1;
            fetchMessages();
        } else {
            setMessages([]);
        }
        setTyping(false);
        observedMessageIdsRef.current.clear();
    }, [selectedChat]);

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (container.scrollTop < 80 && !loadingOlder && hasMoreMessages) {
                loadOlderMessages();
            }
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [loadingOlder, hasMoreMessages, selectedChat]);

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [selectedChat]);

    useEffect(() => {
        if (isWindowFocused === undefined) return;

        if (!isWindowFocused) {
            lastSeenMessageCountRef.current = messages.length;
        } else {
            if (selectedChat) {
                fetchMessages(false);
            }

            if (messages.length > lastSeenMessageCountRef.current && lastSeenMessageCountRef.current > 0) {
                setNewMessageMarkerIndex(lastSeenMessageCountRef.current);
                setShowNewMessagesBanner(true);

                setTimeout(() => {
                    bannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 300);
            }
            lastSeenMessageCountRef.current = messages.length;
        }
    }, [isWindowFocused]);

    useEffect(() => {
        if (!selectedChat || !socket || !isWindowFocusedRef.current) return;

        const unreadElements = Array.from(document.querySelectorAll('.message-container-unread'))
            .filter(el => {
                const messageId = el.getAttribute('data-message-id');
                return messageId && !observedMessageIdsRef.current.has(messageId);
            });

        if (unreadElements.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(async (entry) => {
                    if (entry.isIntersecting) {
                        const messageId = entry.target.getAttribute('data-message-id');
                        const senderId = entry.target.getAttribute('data-sender-id');
                        if (!messageId || observedMessageIdsRef.current.has(messageId)) return;

                        observedMessageIdsRef.current.add(messageId);
                        observer.unobserve(entry.target);

                        try {
                            const conversationId = selectedChat.type === 'user' ? selectedChat.id : null;
                            await messagesAPI.markAsRead(messageId, conversationId || selectedChat.id);
                        } catch (err) {
                            console.error('Failed to mark message as read on backend:', err);
                        }

                        if (selectedChat.type === 'user') {
                            socket.emit('message:read', {
                                messageId,
                                senderId,
                                recipientId: currentUser.id
                            });
                        } else if (selectedChat.type === 'group') {
                            socket.emit('group:message:read', {
                                messageId,
                                groupId: selectedChat.id,
                                userId: currentUser.id
                            });
                        }

                        if (onUnreadMessageRead) {
                            onUnreadMessageRead(selectedChat.id);
                        }

                        setMessages(prev =>
                            prev.map(m =>
                                (m._id === messageId || m.id === messageId)
                                    ? { ...m, read: true, readAt: new Date() }
                                    : m
                            )
                        );
                    }
                });
            },
            {
                threshold: 0.15,
                root: messagesContainerRef.current
            }
        );

        unreadElements.forEach(el => observer.observe(el));

        return () => {
            observer.disconnect();
        };
    }, [messages, selectedChat, socket, isWindowFocused, onUnreadMessageRead]);

    useEffect(() => {
        if (!bannerRef.current || !showNewMessagesBanner) return;

        let observer;
        const timer = setTimeout(() => {
            if (!bannerRef.current) return;

            observer = new IntersectionObserver(
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
        }, 1500);

        return () => {
            clearTimeout(timer);
            if (observer && bannerRef.current) {
                observer.unobserve(bannerRef.current);
            }
        };
    }, [showNewMessagesBanner]);

    useEffect(() => {
        if (!socket) return;

        const handleMessageReceive = (message) => {
            const chat = selectedChatRef.current;
            if (chat?.type === 'user' && message.senderId === chat.id) {
                const normalized = normalizeMessage(message);
                setMessages((prev) => [...prev, normalized]);
                scrollToBottom();
                socket.emit('message:read', {
                    messageId: message._id || message.id,
                    senderId: message.senderId,
                    recipientId: currentUserRef.current.id
                });
            }
        };

        const handleMessageSent = (message) => {
            const chat = selectedChatRef.current;
            if (chat?.type === 'user' && message.recipientId === chat.id) {
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
            const chat = selectedChatRef.current;
            if (chat?.type === 'group' && message.groupId === chat.id) {
                setMessages((prev) => {
                    if (message.tempId && message.senderId === currentUserRef.current.id) {
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
                if (message.senderId !== currentUserRef.current.id) {
                    socket.emit('group:message:read', {
                        messageId: message._id || message.id,
                        groupId: chat.id,
                        userId: currentUserRef.current.id
                    });
                }
            }
        };

        const handleTypingStart = ({ userId }) => {
            const chat = selectedChatRef.current;
            if (chat?.type === 'user' && userId === chat.id) {
                setTyping(true);
            }
        };

        const handleTypingStop = ({ userId }) => {
            const chat = selectedChatRef.current;
            if (chat?.type === 'user' && userId === chat.id) {
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
    }, [socket]);

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
            const { fileUrl, fileName, fileSize, type, sharedFileId } = response.data;

            const messageData = {
                content: fileName,
                type: type || 'file',
                fileUrl,
                fileName,
                fileSize,
                sharedFileId,
                ...(replyingTo && { replyTo: replyingTo._id || replyingTo.id })
            };
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

    const handleDownload = async (fileUrl, fileName, sharedFileId) => {
        try {
            let fullUrl = getFullFileUrl(fileUrl);

            if (sharedFileId && fullUrl.includes('X-Amz-Signature')) {
                try {
                    const id = typeof sharedFileId === 'object' ? sharedFileId._id || sharedFileId.id : sharedFileId;
                    const response = await filesAPI.getDownloadUrl(id);
                    if (response.data && response.data.downloadUrl) {
                        fullUrl = response.data.downloadUrl;
                    }
                } catch (err) {
                    console.error('Failed to get fresh download URL:', err);
                }
            }

            try {
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
                window.open(fullUrl, '_blank');
            }
        } catch (error) {
            console.error('Error downloading file:', error);
        }
    };

    const handleOpenFile = async (fileUrl, sharedFileId) => {
        try {
            let fullUrl = getFullFileUrl(fileUrl);

            if (sharedFileId && fullUrl.includes('X-Amz-Signature')) {
                try {
                    const id = typeof sharedFileId === 'object' ? sharedFileId._id || sharedFileId.id : sharedFileId;
                    const response = await filesAPI.getDownloadUrl(id);
                    if (response.data && response.data.downloadUrl) {
                        fullUrl = response.data.downloadUrl;
                    }
                } catch (err) {
                    console.error('Failed to get fresh URL for open:', err);
                }
            }

            window.open(fullUrl, '_blank');
        } catch (error) {
            console.error('Error opening file:', error);
        }
    };

    const handleShowFileDetails = async (msg) => {
        setFileDetailMsg(msg);
        setFileDetailMeta(null);
        setFileDetailLoading(true);

        if (msg.sharedFile) {
            try {
                const id = typeof msg.sharedFile === 'object' ? msg.sharedFile._id || msg.sharedFile.id : msg.sharedFile;
                const response = await filesAPI.getFile(id);
                if (response.data) {
                    setFileDetailMeta(response.data);
                }
            } catch (err) {
                console.error('Failed to fetch file details:', err);
            }
        }
        setFileDetailLoading(false);
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

    // ============================================================================
    // CONTEXT MENU HANDLERS
    // ============================================================================

    const handleContextMenu = (e, msg) => {
        e.preventDefault();
        e.stopPropagation();
        const x = Math.min(e.clientX, window.innerWidth - 200);
        const y = Math.min(e.clientY, window.innerHeight - 280);
        setContextMenu({ x, y, message: msg });
    };

    const handleCloseContextMenu = () => setContextMenu(null);

    const handleCopyMessage = (msg) => {
        if (msg.content) {
            navigator.clipboard.writeText(msg.content).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = msg.content;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            });
        }
        handleCloseContextMenu();
    };

    const getConversationId = () => {
        if (!selectedChat) return null;
        return selectedChat.id;
    };

    const handleDeleteMessage = async (msg) => {
        const messageId = msg._id || msg.id;
        handleCloseContextMenu();
        try {
            const conversationId = getConversationId();
            await messagesAPI.deleteMessage(messageId, conversationId);
            setMessages(prev => prev.map(m =>
                (m._id === messageId || m.id === messageId)
                    ? { ...m, type: 'deleted', content: null, deleted: true }
                    : m
            ));
            if (socket) {
                const event = selectedChat.type === 'group' ? 'group:message:deleted' : 'message:deleted';
                socket.emit(event, { messageId, chatId: selectedChat.id });
            }
        } catch (err) {
            console.error('Failed to delete message:', err);
        }
    };

    const handleShowMessageInfo = async (msg) => {
        const messageId = msg._id || msg.id;
        handleCloseContextMenu();
        setMsgInfoLoading(true);
        setMsgInfoModal({ message: msg, info: null });
        try {
            const conversationId = getConversationId();
            const res = await messagesAPI.getMessageInfo(messageId, conversationId);
            setMsgInfoModal({ message: msg, info: res.data });
        } catch (err) {
            console.error('Failed to get message info:', err);
        } finally {
            setMsgInfoLoading(false);
        }
    };

    const handlePinMessage = async (msg) => {
        const messageId = msg._id || msg.id;
        handleCloseContextMenu();
        try {
            const conversationId = getConversationId();
            const res = await messagesAPI.pinMessage(messageId, conversationId);
            const nowPinned = res.data.pinned;
            setMessages(prev => prev.map(m =>
                (m._id === messageId || m.id === messageId)
                    ? { ...m, pinned: nowPinned }
                    : m
            ));
            if (nowPinned) {
                setPinnedMessage({ ...msg, pinned: true });
            } else if (pinnedMessage && (pinnedMessage._id === messageId || pinnedMessage.id === messageId)) {
                setPinnedMessage(null);
            }
            if (socket) {
                socket.emit('message:pinned', { messageId, chatId: selectedChat.id, pinned: nowPinned });
            }
        } catch (err) {
            console.error('Failed to pin message:', err);
        }
    };

    const handleForwardMessage = (msg) => {
        handleCopyMessage(msg);
    };

    useEffect(() => {
        const pinned = messages.find(m => m.pinned);
        setPinnedMessage(pinned || null);
    }, [messages]);

    useEffect(() => {
        if (!contextMenu) return;
        const close = () => setContextMenu(null);
        document.addEventListener('click', close);
        document.addEventListener('scroll', close, true);
        return () => {
            document.removeEventListener('click', close);
            document.removeEventListener('scroll', close, true);
        };
    }, [contextMenu]);

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
                    className={`message ${isOwn ? 'own' : 'other'} ${groupClass} ${(!isOwn && !msg.read && !msg.readAt) ? 'message-container-unread' : ''} ${msg.pinned ? 'message-pinned' : ''}`}
                    data-message-id={msg._id || msg.id}
                    data-sender-id={msg.senderId}
                    onContextMenu={(e) => handleContextMenu(e, msg)}
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

                        {msg.type === 'deleted' || msg.deleted ? (
                            <div className="message-bubble message-deleted">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', opacity: 0.6 }}>
                                    <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                </svg>
                                This message was deleted
                            </div>
                        ) : msg.type === 'text' ? (
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
                                        <div className="image-container" onClick={(e) => setPreviewImage(e.currentTarget.querySelector('img').src)}>
                                            <img
                                                src={getFullFileUrl(msg.fileUrl)}
                                                alt={msg.fileName}
                                                onError={(e) => {
                                                    if (msg.sharedFile && !e.target.dataset.retried) {
                                                        e.target.dataset.retried = 'true';
                                                        const id = typeof msg.sharedFile === 'object' ? msg.sharedFile._id || msg.sharedFile.id : msg.sharedFile;
                                                        filesAPI.getDownloadUrl(id).then(res => {
                                                            if (res.data && res.data.downloadUrl) {
                                                                e.target.src = res.data.downloadUrl;
                                                            }
                                                        }).catch(err => console.error('Failed to refresh image URL', err));
                                                    }
                                                }}
                                            />
                                            <div className="image-overlay">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                                    <circle cx="11" cy="11" r="8" />
                                                    <path d="m21 21-4.35-4.35" />
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="file-actions" style={{ marginTop: '8px', padding: '0 4px', flexDirection: 'row' }}>
                                            <button
                                                className="file-action-btn download-btn"
                                                onClick={(e) => { e.stopPropagation(); handleDownload(msg.fileUrl, msg.fileName, msg.sharedFile); }}
                                                title="Download image"
                                                style={{ flex: 1, justifyContent: 'center' }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="7 10 12 15 17 10" />
                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                                Download
                                            </button>
                                            <button
                                                className="file-action-btn view-btn"
                                                onClick={(e) => { e.stopPropagation(); handleShowFileDetails(msg); }}
                                                title="File details"
                                                style={{ flex: 1, justifyContent: 'center' }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="16" x2="12" y2="12" />
                                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                                </svg>
                                                Info
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="file-attachment" onClick={() => handleShowFileDetails(msg)} style={{ cursor: 'pointer' }}>
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
                                                onClick={(e) => { e.stopPropagation(); handleDownload(msg.fileUrl, msg.fileName, msg.sharedFile); }}
                                                title="Download file"
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="7 10 12 15 17 10" />
                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                                Download
                                            </button>
                                            <button
                                                className="file-action-btn view-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleShowFileDetails(msg);
                                                }}
                                                title="File details"
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="16" x2="12" y2="12" />
                                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                                </svg>
                                                Info
                                            </button>
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
            <div className="messages-container" ref={messagesContainerRef}>
                {loading ? (
                    <div className="loading-messages"><div className="loading-spinner" /></div>
                ) : messages.length === 0 ? (
                    <div className="no-messages"><p>No messages yet. Start the conversation!</p></div>
                ) : (
                    <div className="messages-list">
                        {loadingOlder && (
                            <div className="load-older-indicator">
                                <div className="load-older-spinner" />
                                <span>Loading older messages...</span>
                            </div>
                        )}
                        {!loadingOlder && !hasMoreMessages && messages.length > 0 && (
                            <div className="no-more-messages">
                                <span>— Beginning of conversation —</span>
                            </div>
                        )}
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
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.mp4,.mkv,.avi,.mp3,.wav,.ogg,.aac,.flac"
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
                                const imgMsg = messages.find(m =>
                                    m.type === 'image' && getFullFileUrl(m.fileUrl) === previewImage
                                );
                                const dlFileName = imgMsg?.fileName || previewImage.split('/').pop() || 'image.png';
                                const dlSharedFile = imgMsg?.sharedFile || null;
                                handleDownload(previewImage, dlFileName, dlSharedFile);
                            }}
                        >
                            Download
                        </button>
                    </div>
                </div>
            )}

            {/* File Details Modal */}
            {fileDetailMsg && (
                <div className="file-detail-modal-overlay" onClick={() => { setFileDetailMsg(null); setFileDetailMeta(null); }}>
                    <div className="file-detail-modal" onClick={e => e.stopPropagation()}>
                        <div className="file-detail-header">
                            <h3>File Details</h3>
                            <button className="file-detail-close" onClick={() => { setFileDetailMsg(null); setFileDetailMeta(null); }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="file-detail-preview">
                            {fileDetailMsg.type === 'image' ? (
                                <img src={getFullFileUrl(fileDetailMsg.fileUrl)} alt={fileDetailMsg.fileName} />
                            ) : (
                                <div className="file-detail-icon">{getFileIcon(fileDetailMsg.fileName)}</div>
                            )}
                        </div>

                        <div className="file-detail-info">
                            <div className="file-detail-row">
                                <span className="file-detail-label">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                    File Name
                                </span>
                                <span className="file-detail-value">{fileDetailMsg.fileName || 'Unknown'}</span>
                            </div>

                            <div className="file-detail-row">
                                <span className="file-detail-label">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" /></svg>
                                    Type
                                </span>
                                <span className="file-detail-value file-detail-badge">
                                    {fileDetailMsg.fileName?.split('.').pop().toUpperCase() || fileDetailMsg.type}
                                </span>
                            </div>

                            <div className="file-detail-row">
                                <span className="file-detail-label">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                    Size
                                </span>
                                <span className="file-detail-value">{formatFileSize(fileDetailMsg.fileSize)}</span>
                            </div>

                            <div className="file-detail-row">
                                <span className="file-detail-label">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                    Sent By
                                </span>
                                <span className="file-detail-value">
                                    {fileDetailMeta?.uploadedBy?.username || getSenderDisplayName(fileDetailMsg)}
                                </span>
                            </div>

                            <div className="file-detail-row">
                                <span className="file-detail-label">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                    Date
                                </span>
                                <span className="file-detail-value">
                                    {new Date(fileDetailMeta?.createdAt || fileDetailMsg.timestamp || fileDetailMsg.createdAt).toLocaleString('en-US', {
                                        year: 'numeric', month: 'short', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                            </div>
                        </div>

                        <div className="file-detail-actions">
                            <button
                                className="file-detail-action-btn file-detail-download"
                                onClick={() => handleDownload(fileDetailMsg.fileUrl, fileDetailMsg.fileName, fileDetailMsg.sharedFile)}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Download
                            </button>
                            <button
                                className="file-detail-action-btn file-detail-open"
                                onClick={() => handleOpenFile(fileDetailMsg.fileUrl, fileDetailMsg.sharedFile)}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                                Open
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pinned Message Banner */}
            {pinnedMessage && (
                <div className="pinned-message-banner" onClick={() => handleScrollToMessage(pinnedMessage._id || pinnedMessage.id)}>
                    <div className="pinned-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                        </svg>
                    </div>
                    <div className="pinned-content">
                        <span className="pinned-label">Pinned Message</span>
                        <span className="pinned-text">{pinnedMessage.content || pinnedMessage.fileName || 'File'}</span>
                    </div>
                    <button className="pinned-close" onClick={(e) => { e.stopPropagation(); setPinnedMessage(null); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="msg-context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.message.type !== 'deleted' && !contextMenu.message.deleted && (
                        <button className="ctx-item" onClick={() => handleCopyMessage(contextMenu.message)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copy
                        </button>
                    )}
                    {contextMenu.message.type !== 'deleted' && !contextMenu.message.deleted && (
                        <button className="ctx-item" onClick={() => { handleReply(contextMenu.message); handleCloseContextMenu(); }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                            </svg>
                            Reply
                        </button>
                    )}
                    {contextMenu.message.type !== 'deleted' && !contextMenu.message.deleted && (
                        <button className="ctx-item" onClick={() => handleForwardMessage(contextMenu.message)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" />
                            </svg>
                            Forward
                        </button>
                    )}
                    <button className="ctx-item" onClick={() => handlePinMessage(contextMenu.message)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                        </svg>
                        {contextMenu.message.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    {isOwnMessage(contextMenu.message) && (
                        <button className="ctx-item ctx-item-info" onClick={() => handleShowMessageInfo(contextMenu.message)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            Info
                        </button>
                    )}
                    {isOwnMessage(contextMenu.message) && contextMenu.message.type !== 'deleted' && !contextMenu.message.deleted && (
                        <button className="ctx-item ctx-item-danger" onClick={() => handleDeleteMessage(contextMenu.message)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                            </svg>
                            Delete
                        </button>
                    )}
                </div>
            )}

            {/* Message Info Modal */}
            {msgInfoModal && (
                <div className="msg-info-overlay" onClick={() => setMsgInfoModal(null)}>
                    <div className="msg-info-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="msg-info-header">
                            <h3>Message Info</h3>
                            <button className="msg-info-close" onClick={() => setMsgInfoModal(null)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="msg-info-preview">
                            <div className="msg-info-bubble">
                                {msgInfoModal.message.content || msgInfoModal.message.fileName || 'File message'}
                            </div>
                        </div>

                        {msgInfoLoading ? (
                            <div className="msg-info-loading"><div className="load-older-spinner" /></div>
                        ) : msgInfoModal.info ? (
                            <div className="msg-info-body">
                                <div className="msg-info-row">
                                    <div className="msg-info-icon msg-info-sent">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="msg-info-title">Sent</div>
                                        <div className="msg-info-time">{new Date(msgInfoModal.info.sentAt).toLocaleString()}</div>
                                    </div>
                                </div>

                                <div className="msg-info-row">
                                    <div className={`msg-info-icon ${msgInfoModal.info.deliveredAt ? 'msg-info-delivered' : 'msg-info-pending'}`}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                            <polyline points="20 6 9 17 4 12" transform="translate(4,0)" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="msg-info-title">Delivered</div>
                                        <div className="msg-info-time">
                                            {msgInfoModal.info.deliveredAt
                                                ? new Date(msgInfoModal.info.deliveredAt).toLocaleString()
                                                : '—'}
                                        </div>
                                    </div>
                                </div>

                                <div className="msg-info-row">
                                    <div className={`msg-info-icon ${msgInfoModal.info.readAt || msgInfoModal.info.readBy?.length > 0 ? 'msg-info-read' : 'msg-info-pending'}`}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                            <polyline points="20 6 9 17 4 12" transform="translate(4,0)" />
                                        </svg>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="msg-info-title">Read</div>
                                        {selectedChat?.type === 'group' && msgInfoModal.info.readBy?.length > 0 ? (
                                            <div className="msg-info-group-list">
                                                {msgInfoModal.info.readBy.map((r, i) => (
                                                    <div key={i} className="msg-info-group-item">
                                                        <div className="msg-info-user-avatar">
                                                            {(r.user?.username || r.user?.name || '?')[0].toUpperCase()}
                                                        </div>
                                                        <span>{r.user?.username || r.user?.name || 'User'}</span>
                                                        <span className="msg-info-group-time">{new Date(r.readAt).toLocaleTimeString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="msg-info-time">
                                                {msgInfoModal.info.readAt
                                                    ? new Date(msgInfoModal.info.readAt).toLocaleString()
                                                    : '—'}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {selectedChat?.type === 'group' && msgInfoModal.info.deliveredTo?.length > 0 && (
                                    <div className="msg-info-row" style={{ alignItems: 'flex-start' }}>
                                        <div className="msg-info-icon msg-info-delivered">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                            </svg>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div className="msg-info-title">Delivered To</div>
                                            <div className="msg-info-group-list">
                                                {msgInfoModal.info.deliveredTo.map((d, i) => (
                                                    <div key={i} className="msg-info-group-item">
                                                        <div className="msg-info-user-avatar">
                                                            {(d.user?.username || d.user?.name || '?')[0].toUpperCase()}
                                                        </div>
                                                        <span>{d.user?.username || d.user?.name || 'User'}</span>
                                                        <span className="msg-info-group-time">{new Date(d.deliveredAt).toLocaleTimeString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatWindow;