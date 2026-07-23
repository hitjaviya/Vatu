import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, FlatList, StyleSheet, ActivityIndicator, Alert, Text,
    KeyboardAvoidingView, Platform, Clipboard,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { messagesAPI, groupsAPI, filesAPI } from '../api';
import { Colors, Spacing } from '../theme';
import ChatHeader from '../components/ChatHeader';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import MessageActions from '../components/MessageActions';

export default function ChatScreen({ route, navigation, currentUser, socket, onlineUsers, onSelectChat }) {
    const { chat } = route.params;
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [typing, setTyping] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);
    const [actionMsg, setActionMsg] = useState(null);

    const flatListRef = useRef(null);
    const typingTimeout = useRef(null);
    const currentBucket = useRef(-1);

    const currentUserId = currentUser?.id || currentUser?._id;

    const isOwn = (msg) => msg.senderId === currentUserId;

    const normalize = (msg) => ({
        ...msg,
        senderId: msg.senderId || (typeof msg.sender === 'object' ? msg.sender?._id : msg.sender),
        senderData: typeof msg.sender === 'object' ? msg.sender : null,
    });

    const getSenderName = (msg) => {
        if (isOwn(msg)) return 'You';
        if (msg.senderData) return msg.senderData.username || 'Unknown';
        if (chat.type === 'user') return chat.data?.username || 'Unknown';
        const member = chat.data?.members?.find(m =>
            (typeof m === 'object' ? m._id : m) === msg.senderId
        );
        return (member && typeof member === 'object') ? member.username : 'Unknown';
    };

    // Notify parent about selected chat
    useEffect(() => { onSelectChat?.(chat); return () => onSelectChat?.(null); }, [chat]);

    // Fetch messages
    useEffect(() => {
        fetchMessages();
    }, [chat.id]);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            let bucketNum, result;
            if (chat.type === 'user') {
                const br = await messagesAPI.getLatestBucket(chat.id);
                bucketNum = br.data.bucketNumber;
                if (bucketNum < 0) { setMessages([]); setHasMore(false); setLoading(false); return; }
                const mr = await messagesAPI.getMessagesByBucket(chat.id, bucketNum);
                result = mr.data;
            } else {
                const br = await groupsAPI.getLatestBucket(chat.id);
                bucketNum = br.data.bucketNumber;
                if (bucketNum < 0) { setMessages([]); setHasMore(false); setLoading(false); return; }
                const mr = await groupsAPI.getMessagesByBucket(chat.id, bucketNum);
                result = mr.data;
            }
            setMessages(result.messages.map(normalize));
            currentBucket.current = bucketNum;
            setHasMore(bucketNum > 0);
        } catch (e) { console.error('Fetch messages error:', e); }
        finally { setLoading(false); }
    };

    const loadOlder = async () => {
        if (loadingOlder || !hasMore || currentBucket.current <= 0) return;
        setLoadingOlder(true);
        const older = currentBucket.current - 1;
        try {
            const res = chat.type === 'user'
                ? await messagesAPI.getMessagesByBucket(chat.id, older)
                : await groupsAPI.getMessagesByBucket(chat.id, older);
            const msgs = res.data.messages.map(normalize);
            currentBucket.current = older;
            setHasMore(older > 0);
            if (msgs.length > 0) setMessages(prev => [...msgs, ...prev]);
        } catch {} finally { setLoadingOlder(false); }
    };

    // Socket events
    useEffect(() => {
        if (!socket) return;

        const onMsg = (msg) => {
            const n = normalize(msg);
            if (chat.type === 'user' && (n.senderId === chat.id || n.senderId === currentUserId)) {
                setMessages(prev => {
                    const filtered = prev.filter(m => m._id !== msg.tempId && m.id !== msg.tempId);
                    return [...filtered, n];
                });
            }
        };
        const onGroupMsg = (msg) => {
            const n = normalize(msg);
            if (chat.type === 'group' && msg.groupId === chat.id) {
                setMessages(prev => {
                    const filtered = prev.filter(m => m._id !== msg.tempId && m.id !== msg.tempId);
                    return [...filtered, n];
                });
            }
        };
        const onTyping = ({ senderId }) => {
            if (chat.type === 'user' && senderId === chat.id) {
                setTyping(true);
                setTimeout(() => setTyping(false), 3000);
            }
        };
        const onStopTyping = ({ senderId }) => {
            if (senderId === chat.id) setTyping(false);
        };
        const onDeleted = ({ messageId }) => {
            setMessages(prev => prev.map(m =>
                (m._id === messageId || m.id === messageId)
                    ? { ...m, type: 'deleted', content: null, deleted: true } : m
            ));
        };
        const onReaction = ({ messageId, reactions }) => {
            setMessages(prev => prev.map(m =>
                (m._id === messageId || m.id === messageId) ? { ...m, reactions } : m
            ));
        };
        const onRead = ({ messageId }) => {
            setMessages(prev => prev.map(m =>
                (m._id === messageId || m.id === messageId) ? { ...m, read: true, readAt: new Date() } : m
            ));
        };

        socket.on('message:receive', onMsg);
        socket.on('message:sent', onMsg);
        socket.on('group:message:receive', onGroupMsg);
        socket.on('group:message:sent', onGroupMsg);
        socket.on('typing:start', onTyping);
        socket.on('typing:stop', onStopTyping);
        socket.on('message:deleted', onDeleted);
        socket.on('group:message:deleted', onDeleted);
        socket.on('message:reaction', onReaction);
        socket.on('group:message:reaction', onReaction);
        socket.on('message:read:ack', onRead);

        return () => {
            socket.off('message:receive', onMsg);
            socket.off('message:sent', onMsg);
            socket.off('group:message:receive', onGroupMsg);
            socket.off('group:message:sent', onGroupMsg);
            socket.off('typing:start', onTyping);
            socket.off('typing:stop', onStopTyping);
            socket.off('message:deleted', onDeleted);
            socket.off('group:message:deleted', onDeleted);
            socket.off('message:reaction', onReaction);
            socket.off('group:message:reaction', onReaction);
            socket.off('message:read:ack', onRead);
        };
    }, [socket, chat.id]);

    // Handlers
    const handleSend = () => {
        const content = newMessage.trim();
        if (!content) return;
        setNewMessage('');

        const tempId = `temp-${Date.now()}`;
        const optimistic = normalize({
            _id: tempId, id: tempId, content, type: 'text',
            sender: currentUserId, senderId: currentUserId,
            timestamp: new Date().toISOString(), optimistic: true,
            ...(replyingTo && { replyTo: replyingTo._id || replyingTo.id }),
            ...(chat.type === 'user' ? { recipientId: chat.id } : { groupId: chat.id }),
        });
        setMessages(prev => [...prev, optimistic]);

        const data = { content, type: 'text', tempId,
            ...(replyingTo && { replyTo: replyingTo._id || replyingTo.id }) };

        if (chat.type === 'user') {
            socket?.emit('message:send', { recipientId: chat.id, ...data });
        } else {
            socket?.emit('group:message', { groupId: chat.id, ...data });
        }
        setReplyingTo(null);
    };

    const handleTyping = (text) => {
        setNewMessage(text);
        if (chat.type === 'user' && socket) {
            if (!typingTimeout.current) socket.emit('typing:start', { recipientId: chat.id });
            if (typingTimeout.current) clearTimeout(typingTimeout.current);
            typingTimeout.current = setTimeout(() => {
                socket.emit('typing:stop', { recipientId: chat.id });
                typingTimeout.current = null;
            }, 2000);
        }
    };

    const handleFilePick = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
            if (result.canceled) return;
            const file = result.assets[0];
            const formData = new FormData();
            formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
            const res = await messagesAPI.uploadFile(formData);
            const { fileUrl, fileName, fileSize, type, sharedFileId } = res.data;
            const data = { content: fileName, type: type || 'file', fileUrl, fileName, fileSize, sharedFileId };
            if (chat.type === 'user') socket?.emit('message:send', { recipientId: chat.id, ...data });
            else socket?.emit('group:message', { groupId: chat.id, ...data });
        } catch (e) { Alert.alert('Error', 'Failed to upload file'); }
    };

    const handleReact = async (emoji) => {
        if (!actionMsg) return;
        const messageId = actionMsg._id || actionMsg.id;
        try {
            const res = await messagesAPI.reactToMessage(messageId, chat.id, emoji);
            setMessages(prev => prev.map(m =>
                (m._id === messageId || m.id === messageId) ? { ...m, reactions: res.data.reactions } : m
            ));
            const event = chat.type === 'group' ? 'group:message:reaction' : 'message:reaction';
            socket?.emit(event, { messageId, chatId: chat.id, reactions: res.data.reactions });
        } catch {}
    };

    const handleCopy = () => {
        if (actionMsg?.content) Clipboard.setString(actionMsg.content);
    };

    const handlePin = async () => {
        if (!actionMsg) return;
        const messageId = actionMsg._id || actionMsg.id;
        try {
            const res = await messagesAPI.pinMessage(messageId, chat.id);
            setMessages(prev => prev.map(m =>
                (m._id === messageId || m.id === messageId) ? { ...m, pinned: res.data.pinned } : m
            ));
        } catch {}
    };

    const handleDelete = () => {
        if (!actionMsg) return;
        const messageId = actionMsg._id || actionMsg.id;
        Alert.alert('Delete Message', 'Choose delete scope:', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete for me', onPress: async () => {
                try {
                    await messagesAPI.deleteMessage(messageId, chat.id, 'me');
                    setMessages(prev => prev.map(m =>
                        (m._id === messageId || m.id === messageId)
                            ? { ...m, deletedFor: [...(m.deletedFor || []), currentUserId] } : m
                    ));
                } catch {}
            }},
            { text: 'Delete for everyone', style: 'destructive', onPress: async () => {
                try {
                    await messagesAPI.deleteMessage(messageId, chat.id, 'everyone');
                    setMessages(prev => prev.map(m =>
                        (m._id === messageId || m.id === messageId)
                            ? { ...m, type: 'deleted', content: null, deleted: true } : m
                    ));
                    const event = chat.type === 'group' ? 'group:message:deleted' : 'message:deleted';
                    socket?.emit(event, { messageId, chatId: chat.id });
                } catch {}
            }},
        ]);
    };

    const handleInfo = async () => {
        if (!actionMsg) return;
        const messageId = actionMsg._id || actionMsg.id;
        try {
            const res = await messagesAPI.getMessageInfo(messageId, chat.id);
            const info = res.data;
            const readBy = info.readBy?.map(r => r.username || r.user?.username).join(', ') || 'None';
            Alert.alert('Message Info',
                `Sent: ${new Date(info.sentAt || actionMsg.timestamp).toLocaleString()}\n` +
                `Read by: ${readBy}\n` +
                `Delivered: ${info.delivered ? 'Yes' : 'No'}`
            );
        } catch { Alert.alert('Error', 'Could not fetch info'); }
    };

    const visibleMessages = messages.filter(m => !(m.deletedFor?.includes(currentUserId)));

    const renderItem = useCallback(({ item }) => (
        <MessageBubble
            msg={item}
            isOwn={isOwn(item)}
            isGroup={chat.type === 'group'}
            senderName={getSenderName(item)}
            onLongPress={(msg) => setActionMsg(msg)}
        />
    ), [chat, currentUser]);

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            <ChatHeader chat={chat} onlineUsers={onlineUsers} onBack={() => navigation.goBack()} />
            <KeyboardAvoidingView style={s.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
                {loading ? (
                    <View style={s.center}><ActivityIndicator size="large" color={Colors.accentPrimary} /></View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={visibleMessages}
                        keyExtractor={(item, i) => item._id || item.id || String(i)}
                        renderItem={renderItem}
                        contentContainerStyle={s.list}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                        onStartReached={loadOlder}
                        onStartReachedThreshold={0.1}
                        inverted={false}
                        ListHeaderComponent={loadingOlder ?
                            <ActivityIndicator color={Colors.accentPrimary} style={{ padding: 10 }} /> : null}
                        ListEmptyComponent={
                            <View style={s.center}>
                                <Text style={s.emptyIcon}>💬</Text>
                                <Text style={s.emptyText}>No messages yet. Say hello!</Text>
                            </View>
                        }
                    />
                )}
                <MessageInput
                    value={newMessage}
                    onChangeText={handleTyping}
                    onSend={handleSend}
                    onFilePick={handleFilePick}
                    replyingTo={replyingTo}
                    onCancelReply={() => setReplyingTo(null)}
                    typing={typing}
                />
            </KeyboardAvoidingView>
            <MessageActions
                visible={!!actionMsg}
                message={actionMsg}
                isOwn={actionMsg ? isOwn(actionMsg) : false}
                onClose={() => setActionMsg(null)}
                onReply={() => setReplyingTo(actionMsg)}
                onCopy={handleCopy}
                onDelete={handleDelete}
                onPin={handlePin}
                onReact={handleReact}
                onInfo={handleInfo}
            />
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bgPrimary },
    flex: { flex: 1 },
    list: { paddingVertical: Spacing.sm },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { color: Colors.textTertiary, fontSize: 15, textAlign: 'center' },
});
