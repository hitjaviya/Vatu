import { useEffect, useRef } from 'react';
import { normalizeMessage } from '../utils/messageHelpers';

/**
 * Registers all socket event listeners for the chat window.
 * Returns nothing; all state updates are done via the provided callbacks.
 */
export function useSocketEvents({
    socket,
    selectedChatRef,
    currentUserRef,
    setMessages,
    setTyping,
    setFileDetailMsg,
    onUnreadMessageRead,
    onPinnedUpdate,
}) {
    // Stable ref so the pinned-update handler always calls the latest version
    const onPinnedUpdateRef = useRef(onPinnedUpdate);
    useEffect(() => { onPinnedUpdateRef.current = onPinnedUpdate; });

    useEffect(() => {
        if (!socket) return;

        const handleMessageReceive = (message) => {
            const chat = selectedChatRef.current;
            if (chat?.type === 'user' && message.senderId === chat.id) {
                setMessages(prev => [...prev, normalizeMessage(message)]);
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
                setMessages(prev => {
                    if (message.tempId) {
                        return prev.map(msg =>
                            msg._id === message.tempId || msg.id === message.tempId
                                ? { ...normalizeMessage(message), optimistic: false }
                                : msg
                        );
                    }
                    return [...prev, normalizeMessage(message)];
                });
            }
        };

        const handleGroupMessageReceive = (message) => {
            const chat = selectedChatRef.current;
            if (chat?.type === 'group' && message.groupId === chat.id) {
                setMessages(prev => {
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
            if (chat?.type === 'user' && userId === chat.id) setTyping(true);
        };

        const handleTypingStop = ({ userId }) => {
            const chat = selectedChatRef.current;
            if (chat?.type === 'user' && userId === chat.id) setTyping(false);
        };

        const handleMessageDelivered = ({ messageId, deliveredAt }) => {
            setMessages(prev => prev.map(msg =>
                (msg._id === messageId || msg.id === messageId)
                    ? { ...msg, delivered: true, deliveredAt }
                    : msg
            ));
        };

        const handleMessageRead = ({ messageId, readAt }) => {
            setMessages(prev => prev.map(msg =>
                (msg._id === messageId || msg.id === messageId)
                    ? { ...msg, read: true, readAt }
                    : msg
            ));
        };

        const handleMessageDeleted = ({ messageId }) => {
            setMessages(prev => prev.map(msg =>
                (msg._id === messageId || msg.id === messageId)
                    ? { ...msg, type: 'deleted', content: null, deleted: true }
                    : msg
            ));
            setFileDetailMsg(prev =>
                prev && (prev._id === messageId || prev.id === messageId) ? null : prev
            );
        };

        const handleGroupMessageDeleted = ({ messageId, groupId }) => {
            const chat = selectedChatRef.current;
            if (chat?.type === 'group' && groupId === chat.id) {
                setMessages(prev => prev.map(msg =>
                    (msg._id === messageId || msg.id === messageId)
                        ? { ...msg, type: 'deleted', content: null, deleted: true }
                        : msg
                ));
                setFileDetailMsg(prev =>
                    prev && (prev._id === messageId || prev.id === messageId) ? null : prev
                );
            }
        };

        const handlePinnedUpdate = ({ messageId, pinned }) => {
            onPinnedUpdateRef.current?.();
            if (messageId) {
                setMessages(prev => prev.map(msg =>
                    (msg._id === messageId || msg.id === messageId)
                        ? { ...msg, pinned }
                        : msg
                ));
            }
        };

        const handleReactionUpdate = ({ messageId, reactions }) => {
            if (messageId) {
                setMessages(prev => prev.map(msg =>
                    (msg._id === messageId || msg.id === messageId)
                        ? { ...msg, reactions }
                        : msg
                ));
            }
        };

        socket.on('message:receive', handleMessageReceive);
        socket.on('message:sent', handleMessageSent);
        socket.on('group:message:receive', handleGroupMessageReceive);
        socket.on('typing:start', handleTypingStart);
        socket.on('typing:stop', handleTypingStop);
        socket.on('message:delivered', handleMessageDelivered);
        socket.on('message:read', handleMessageRead);
        socket.on('message:deleted', handleMessageDeleted);
        socket.on('group:message:deleted', handleGroupMessageDeleted);
        socket.on('message:pinned', handlePinnedUpdate);
        socket.on('group:message:pinned', handlePinnedUpdate);
        socket.on('message:reaction', handleReactionUpdate);
        socket.on('group:message:reaction', handleReactionUpdate);

        return () => {
            socket.off('message:receive', handleMessageReceive);
            socket.off('message:sent', handleMessageSent);
            socket.off('group:message:receive', handleGroupMessageReceive);
            socket.off('typing:start', handleTypingStart);
            socket.off('typing:stop', handleTypingStop);
            socket.off('message:delivered', handleMessageDelivered);
            socket.off('message:read', handleMessageRead);
            socket.off('message:deleted', handleMessageDeleted);
            socket.off('group:message:deleted', handleGroupMessageDeleted);
            socket.off('message:pinned', handlePinnedUpdate);
            socket.off('group:message:pinned', handlePinnedUpdate);
            socket.off('message:reaction', handleReactionUpdate);
            socket.off('group:message:reaction', handleReactionUpdate);
        };
    }, [socket]);
}
