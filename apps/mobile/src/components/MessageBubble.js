import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Linking } from 'react-native';
import { Colors, Spacing, Radius, FontSize, formatTime, getFileIcon, formatFileSize, getFullFileUrl } from '../theme';

export default function MessageBubble({ msg, isOwn, isGroup, senderName, onLongPress, onImagePress }) {
    const isDeleted = msg.type === 'deleted' || msg.deleted;
    const isImage = msg.type === 'image' || (msg.fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.fileName || msg.fileUrl));
    const isFile = msg.type === 'file' || (msg.fileUrl && !isImage);
    const time = formatTime(msg.timestamp || msg.createdAt);

    if (isDeleted) {
        return (
            <View style={[s.row, isOwn && s.rowOwn]}>
                <View style={[s.bubble, s.deletedBubble]}>
                    <Text style={s.deletedText}>🚫 This message was deleted</Text>
                    <Text style={s.time}>{time}</Text>
                </View>
            </View>
        );
    }

    const renderReactions = () => {
        if (!msg.reactions?.length) return null;
        const grouped = msg.reactions.reduce((a, r) => { a[r.emoji] = (a[r.emoji] || 0) + 1; return a; }, {});
        return (
            <View style={s.reactions}>
                {Object.entries(grouped).map(([emoji, count]) => (
                    <View key={emoji} style={s.reactionBadge}>
                        <Text style={s.reactionEmoji}>{emoji}</Text>
                        {count > 1 && <Text style={s.reactionCount}>{count}</Text>}
                    </View>
                ))}
            </View>
        );
    };

    const renderStatus = () => {
        if (!isOwn) return null;
        if (msg.optimistic) return <Text style={s.statusIcon}>🕐</Text>;
        if (msg.read || msg.readAt) return <Text style={[s.statusIcon, { color: Colors.accentPrimary }]}>✓✓</Text>;
        return <Text style={s.statusIcon}>✓</Text>;
    };

    const renderContent = () => {
        if (isImage) {
            const uri = getFullFileUrl(msg.fileUrl);
            return (
                <TouchableOpacity onPress={() => onImagePress?.(uri)}>
                    <Image source={{ uri }} style={s.image} resizeMode="cover" />
                </TouchableOpacity>
            );
        }
        if (isFile) {
            return (
                <TouchableOpacity style={s.file} onPress={() => Linking.openURL(getFullFileUrl(msg.fileUrl))}>
                    <Text style={s.fileIcon}>{getFileIcon(msg.fileName)}</Text>
                    <View style={s.fileInfo}>
                        <Text style={s.fileName} numberOfLines={1}>{msg.fileName || 'File'}</Text>
                        <Text style={s.fileSize}>{formatFileSize(msg.fileSize)}</Text>
                    </View>
                    <Text style={s.downloadIcon}>⬇</Text>
                </TouchableOpacity>
            );
        }
        return <Text style={s.content}>{msg.content}</Text>;
    };

    const renderReply = () => {
        if (!msg.replyToData && !msg.replyTo) return null;
        const replyContent = msg.replyToData?.content || 'Original message';
        return (
            <View style={s.replyBar}>
                <View style={s.replyLine} />
                <Text style={s.replyText} numberOfLines={1}>{replyContent}</Text>
            </View>
        );
    };

    return (
        <TouchableOpacity
            style={[s.row, isOwn && s.rowOwn]}
            onLongPress={() => onLongPress?.(msg)}
            activeOpacity={0.7}
            delayLongPress={300}
        >
            <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
                {isGroup && !isOwn && <Text style={s.sender}>{senderName}</Text>}
                {renderReply()}
                {renderContent()}
                {msg.pinned && <Text style={s.pinIcon}>📌</Text>}
                <View style={s.meta}>
                    <Text style={s.time}>{time}</Text>
                    {renderStatus()}
                </View>
                {renderReactions()}
            </View>
        </TouchableOpacity>
    );
}

const s = StyleSheet.create({
    row: { flexDirection: 'row', marginBottom: 4, paddingHorizontal: Spacing.md },
    rowOwn: { justifyContent: 'flex-end' },
    bubble: { maxWidth: '78%', borderRadius: Radius.lg, padding: 10, minWidth: 80 },
    bubbleOwn: { backgroundColor: Colors.messageSent, borderBottomRightRadius: 4 },
    bubbleOther: { backgroundColor: Colors.messageReceived, borderBottomLeftRadius: 4 },
    deletedBubble: { backgroundColor: Colors.bgTertiary, opacity: 0.6 },
    deletedText: { color: Colors.textTertiary, fontSize: FontSize.sm, fontStyle: 'italic' },
    sender: { color: Colors.accentSecondary, fontSize: FontSize.xs, fontWeight: '600', marginBottom: 2 },
    content: { color: Colors.textPrimary, fontSize: FontSize.md, lineHeight: 20 },
    meta: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, gap: 4 },
    time: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
    statusIcon: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
    pinIcon: { position: 'absolute', top: 4, right: 4, fontSize: 10 },
    image: { width: 220, height: 180, borderRadius: Radius.md, marginBottom: 4 },
    file: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: Radius.md, padding: Spacing.sm },
    fileIcon: { fontSize: 28, marginRight: Spacing.sm },
    fileInfo: { flex: 1 },
    fileName: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '500' },
    fileSize: { color: 'rgba(255,255,255,0.5)', fontSize: FontSize.xs },
    downloadIcon: { color: Colors.textPrimary, fontSize: 18 },
    replyBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingVertical: 4 },
    replyLine: { width: 3, height: '100%', backgroundColor: Colors.accentPrimary,
        borderRadius: 2, marginRight: 8, minHeight: 16 },
    replyText: { color: 'rgba(255,255,255,0.6)', fontSize: FontSize.xs, flex: 1 },
    reactions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 4 },
    reactionBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 },
    reactionEmoji: { fontSize: 14 },
    reactionCount: { color: Colors.textSecondary, fontSize: 10, marginLeft: 2 },
});
