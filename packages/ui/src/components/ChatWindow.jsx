import React, { useState, useEffect, useRef } from 'react';
import { messagesAPI, groupsAPI, filesAPI } from '@chat-app/shared/api';
import './ChatWindow.css';
import ChatHeader from './chat/ChatHeader';
import MessageInput from './chat/MessageInput';
import PinnedMessagesBar from './chat/PinnedMessagesBar';
import MessageContextMenu from './chat/MessageContextMenu';
import DeleteConfirmModal from './chat/modals/DeleteConfirmModal';
import MessageInfoModal from './chat/modals/MessageInfoModal';
import { useSocketEvents } from './chat/hooks/useSocketEvents';
import {
    normalizeMessage as _normalizeMessage,
    formatTime,
    formatFileSize,
    getFileIcon,
    getInitials,
    getFullFileUrl
} from './chat/utils/messageHelpers';

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
    // Pinned messages list
    const [pinnedMessages, setPinnedMessages] = useState([]);
    const [currentPinnedIndex, setCurrentPinnedIndex] = useState(0);
    const [showAllPinned, setShowAllPinned] = useState(false);
    // Delete confirmation modal: { message, scope } | null
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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
    const isProgrammaticScrollRef = useRef(false);

    // Keep refs in sync with current props
    useEffect(() => { isWindowFocusedRef.current = isWindowFocused; }, [isWindowFocused]);
    useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);
    useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
    const fetchPinnedMessagesRef = useRef(null);
    useEffect(() => { fetchPinnedMessagesRef.current = fetchPinnedMessages; });

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

    const fetchPinnedMessages = async () => {
        if (!selectedChat) return;
        try {
            const params = {};
            if (selectedChat.type === 'group') {
                params.groupId = selectedChat.id;
            } else {
                params.userId = selectedChat.id;
            }
            const res = await messagesAPI.getPinnedMessages(params);
            setPinnedMessages(res.data.pinnedMessages || []);
            setCurrentPinnedIndex(0);
        } catch (err) {
            console.error('Error fetching pinned messages:', err);
        }
    };

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
            fetchPinnedMessages();
        } else {
            setMessages([]);
            setPinnedMessages([]);
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

    // Delegate all socket event registration to the extracted hook
    useSocketEvents({
        socket,
        selectedChatRef,
        currentUserRef,
        setMessages,
        setTyping,
        setFileDetailMsg,
        onUnreadMessageRead,
        onPinnedUpdate: fetchPinnedMessages,
    });

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
        const menuWidth = 220;
        const menuHeight = 320;

        const bubble = e.currentTarget.querySelector('.message-bubble, .message-file') || e.currentTarget;
        const bubbleRect = bubble.getBoundingClientRect();
        const isOwn = isOwnMessage(msg);
        let x;

        if (isOwn) {
            if (bubbleRect.left - menuWidth - 8 > 10) {
                x = bubbleRect.left - menuWidth - 8;
            } else {
                x = bubbleRect.right + 8;
            }
        } else {
            if (bubbleRect.right + menuWidth + 8 < window.innerWidth - 10) {
                x = bubbleRect.right + 8;
            } else {
                x = bubbleRect.left - menuWidth - 8;
            }
        }
        x = Math.max(10, Math.min(x, window.innerWidth - menuWidth - 10));

        const bubbleCenterY = bubbleRect.top + (bubbleRect.height / 2);
        let y = bubbleCenterY;
        let transformOriginY = '0%';

        const container = messagesContainerRef.current;
        if (container) {
            const containerRect = container.getBoundingClientRect();
            const menuBottomY = y + menuHeight;
            const spaceBelow = containerRect.bottom - menuBottomY;

            if (spaceBelow < 20) {
                const scrollNeeded = 20 - spaceBelow;
                const maxScroll = container.scrollHeight - container.clientHeight - container.scrollTop;
                const actualScroll = Math.max(0, Math.min(scrollNeeded, maxScroll));
                
                if (actualScroll > 0) {
                    isProgrammaticScrollRef.current = true;
                    container.scrollTop += actualScroll;
                    y -= actualScroll;
                    
                    setTimeout(() => {
                        isProgrammaticScrollRef.current = false;
                    }, 100);
                }
            }
        }

        if (y + menuHeight > window.innerHeight - 10) {
            y = y - menuHeight;
            transformOriginY = '100%';
        }
        if (y < 10) {
            y = 10;
        }

        const transformOriginX = x < bubbleRect.left ? '100%' : '0%';
        const transformOrigin = `${transformOriginX} ${transformOriginY}`;

        setContextMenu({ x, y, message: msg, transformOrigin });
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

    const handleDeleteMessage = (msg) => {
        handleCloseContextMenu();
        // Open choice modal — scope is chosen inside the modal
        setDeleteConfirm({ message: msg });
    };

    const confirmDeleteMessage = async (scope) => {
        if (!deleteConfirm) return;
        const { message: msg } = deleteConfirm;
        const messageId = msg._id || msg.id;
        setDeleteConfirm(null);
        try {
            const conversationId = getConversationId();
            await messagesAPI.deleteMessage(messageId, conversationId, scope);
            if (scope === 'me') {
                // Hide message only for current user locally
                setMessages(prev => prev.map(m =>
                    (m._id === messageId || m.id === messageId)
                        ? { ...m, deletedFor: [...(m.deletedFor || []), currentUser.id] }
                        : m
                ));
            } else {
                // Delete for everyone — update to deleted state
                setMessages(prev => prev.map(m =>
                    (m._id === messageId || m.id === messageId)
                        ? { ...m, type: 'deleted', content: null, deleted: true }
                        : m
                ));
                setFileDetailMsg(prev => (prev && (prev._id === messageId || prev.id === messageId)) ? null : prev);
                if (socket) {
                    const event = selectedChat.type === 'group' ? 'group:message:deleted' : 'message:deleted';
                    socket.emit(event, { messageId, chatId: selectedChat.id });
                }
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
            fetchPinnedMessages();
            if (socket) {
                const event = selectedChat.type === 'group' ? 'group:message:pinned' : 'message:pinned';
                socket.emit(event, { messageId, chatId: selectedChat.id, pinned: nowPinned });
            }
        } catch (err) {
            console.error('Failed to pin message:', err);
        }
    };

    const handleForwardMessage = (msg) => {
        handleCopyMessage(msg);
    };

    const handleReactMessage = async (msg, emoji) => {
        const messageId = msg._id || msg.id;
        handleCloseContextMenu();
        try {
            const conversationId = getConversationId();
            const res = await messagesAPI.reactToMessage(messageId, conversationId, emoji);
            const updatedReactions = res.data.reactions;
            setMessages(prev => prev.map(m =>
                (m._id === messageId || m.id === messageId)
                    ? { ...m, reactions: updatedReactions }
                    : m
            ));
            if (socket) {
                const event = selectedChat.type === 'group' ? 'group:message:reaction' : 'message:reaction';
                socket.emit(event, { messageId, chatId: selectedChat.id, reactions: updatedReactions });
            }
        } catch (err) {
            console.error('Failed to react to message:', err);
        }
    };

    const renderMessageReactions = (msg) => {
        if (!msg.reactions || msg.reactions.length === 0) return null;

        // Group reactions by emoji
        const grouped = msg.reactions.reduce((acc, current) => {
            acc[current.emoji] = (acc[current.emoji] || 0) + 1;
            return acc;
        }, {});

        const currentUserId = currentUser?.id || currentUser?._id;

        return (
            <div className="message-reactions-container">
                {Object.entries(grouped).map(([emoji, count]) => {
                    const userHasReacted = msg.reactions.some(
                        r => r.emoji === emoji && (
                            r.user === currentUserId || 
                            r.user?._id === currentUserId || 
                            r.user?.id === currentUserId
                        )
                    );
                    return (
                        <button
                            key={emoji}
                            className={`message-reaction-badge ${userHasReacted ? 'active' : ''}`}
                            onClick={() => handleReactMessage(msg, emoji)}
                            title={`${count} reaction(s)`}
                        >
                            <span className="reaction-emoji">{emoji}</span>
                            <span className="reaction-count">{count}</span>
                        </button>
                    );
                })}
            </div>
        );
    };

    useEffect(() => {
        if (!contextMenu) return;
        const close = (e) => {
            if (isProgrammaticScrollRef.current) return;
            setContextMenu(null);
        };
        document.addEventListener('click', close);
        document.addEventListener('scroll', close, true);
        return () => {
            document.removeEventListener('click', close);
            document.removeEventListener('scroll', close, true);
        };
    }, [contextMenu]);

    useEffect(() => {
        if (!showEmojiPicker) return;
        const close = (e) => {
            if (!e.target.closest('.emoji-picker-container')) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [showEmojiPicker]);

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
                        {renderMessageReactions(msg)}
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
                        {messages
                            .filter(msg => {
                                // Hide messages deleted for this user ("delete for me")
                                const df = msg.deletedFor || [];
                                return !df.some(id => id === currentUser.id || id?.toString?.() === currentUser.id);
                            })
                            .map((msg, idx) => renderMessage(msg, idx))}
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

                    <div className="emoji-picker-container">
                        <button type="button" className="emoji-trigger-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Add emoji">
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
                                    {['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', 
                                      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', 
                                      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', 
                                      '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', 
                                      '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', 
                                      '🥶', '😱', '🤫', '😐', '😑', '😬', '🙄', '💀', '💩', '👍', 
                                      '👎', '👊', '👋', '👏', '🙌', '🙏', '❤️', '🔥', '✨'].map(emoji => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            className="emoji-item-btn"
                                            onClick={() => {
                                                setNewMessage(prev => prev + emoji);
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

            {/* Pinned Messages Banner */}
            {pinnedMessages.length > 0 && (
                <div className="pinned-messages-wrapper">
                    <div className="pinned-message-banner">
                        <div className="pinned-icon" onClick={() => handleScrollToMessage(pinnedMessages[currentPinnedIndex]._id || pinnedMessages[currentPinnedIndex].id)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                            </svg>
                        </div>
                        <div className="pinned-content" onClick={() => handleScrollToMessage(pinnedMessages[currentPinnedIndex]._id || pinnedMessages[currentPinnedIndex].id)}>
                            <span className="pinned-label">
                                Pinned Message {pinnedMessages.length > 1 && `#${currentPinnedIndex + 1} of ${pinnedMessages.length}`}
                            </span>
                            <span className="pinned-text">
                                {pinnedMessages[currentPinnedIndex].content || pinnedMessages[currentPinnedIndex].fileName || 'File'}
                            </span>
                        </div>
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
                            <button 
                                className={`pinned-list-btn ${showAllPinned ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAllPinned(!showAllPinned);
                                }}
                                title="Show all pinned messages"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="8" y1="6" x2="21" y2="6"></line>
                                    <line x1="8" y1="12" x2="21" y2="12"></line>
                                    <line x1="8" y1="18" x2="21" y2="18"></line>
                                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                                </svg>
                            </button>
                            <button 
                                className="pinned-close" 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handlePinMessage(pinnedMessages[currentPinnedIndex]); 
                                }}
                                title="Unpin message"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    </div>

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
                                            handleScrollToMessage(msg._id || msg.id);
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
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="msg-context-menu"
                    style={{ 
                        top: contextMenu.y, 
                        left: contextMenu.x,
                        transformOrigin: contextMenu.transformOrigin
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.message.type !== 'deleted' && !contextMenu.message.deleted && (
                        <div className="ctx-reactions-bar">
                            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                <button
                                    key={emoji}
                                    className="ctx-reaction-btn"
                                    onClick={() => handleReactMessage(contextMenu.message, emoji)}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
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
                    {contextMenu.message.type !== 'deleted' && !contextMenu.message.deleted && (
                        <button className="ctx-item ctx-item-danger" onClick={() => handleDeleteMessage(contextMenu.message)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                            </svg>
                            Delete
                        </button>
                    )}
                </div>
            )}

            {/* Delete Choice Modal */}
            {deleteConfirm && (
                <div className="delete-confirm-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="delete-confirm-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                            </svg>
                        </div>
                        <h3 className="delete-confirm-title">Delete Message</h3>
                        <p className="delete-confirm-desc">Who do you want to delete this message for?</p>
                        <div className="delete-confirm-choices">
                            <button className="delete-choice-btn delete-choice-me" onClick={() => confirmDeleteMessage('me')}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                </svg>
                                Delete for Me
                                <span className="delete-choice-hint">Only you won't see this</span>
                            </button>
                            {isOwnMessage(deleteConfirm.message) && (
                                <button className="delete-choice-btn delete-choice-everyone" onClick={() => confirmDeleteMessage('everyone')}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                    </svg>
                                    Delete for Everyone
                                    <span className="delete-choice-hint">Removed for all participants</span>
                                </button>
                            )}
                            <button className="delete-choice-btn delete-choice-cancel" onClick={() => setDeleteConfirm(null)}>
                                Cancel
                            </button>
                        </div>
                    </div>
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