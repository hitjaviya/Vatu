import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize, ALL_EMOJIS } from '../theme';

export default function MessageActions({ visible, message, isOwn, onClose, onReply, onCopy,
    onDelete, onPin, onReact, onInfo }) {

    if (!visible || !message) return null;
    const isDeleted = message.type === 'deleted' || message.deleted;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
                <View style={s.sheet}>
                    {/* Quick reactions */}
                    {!isDeleted && (
                        <View style={s.emojiRow}>
                            {ALL_EMOJIS.slice(0, 8).map(emoji => (
                                <TouchableOpacity key={emoji} style={s.emojiBtn}
                                    onPress={() => { onReact?.(emoji); onClose(); }}>
                                    <Text style={s.emoji}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {!isDeleted && (
                        <TouchableOpacity style={s.action} onPress={() => { onReply?.(); onClose(); }}>
                            <Text style={s.actionIcon}>↩️</Text>
                            <Text style={s.actionText}>Reply</Text>
                        </TouchableOpacity>
                    )}

                    {message.type === 'text' && !isDeleted && (
                        <TouchableOpacity style={s.action} onPress={() => { onCopy?.(); onClose(); }}>
                            <Text style={s.actionIcon}>📋</Text>
                            <Text style={s.actionText}>Copy</Text>
                        </TouchableOpacity>
                    )}

                    {!isDeleted && (
                        <TouchableOpacity style={s.action} onPress={() => { onPin?.(); onClose(); }}>
                            <Text style={s.actionIcon}>{message.pinned ? '📌' : '📍'}</Text>
                            <Text style={s.actionText}>{message.pinned ? 'Unpin' : 'Pin'}</Text>
                        </TouchableOpacity>
                    )}

                    {isOwn && (
                        <TouchableOpacity style={s.action} onPress={() => { onInfo?.(); onClose(); }}>
                            <Text style={s.actionIcon}>ℹ️</Text>
                            <Text style={s.actionText}>Info</Text>
                        </TouchableOpacity>
                    )}

                    {isOwn && !isDeleted && (
                        <TouchableOpacity style={[s.action, s.dangerAction]}
                            onPress={() => { onDelete?.(); onClose(); }}>
                            <Text style={s.actionIcon}>🗑️</Text>
                            <Text style={[s.actionText, { color: Colors.error }]}>Delete</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                        <Text style={s.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: Colors.bgSecondary, borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl, padding: Spacing.md, paddingBottom: 34,
        borderWidth: 1, borderColor: Colors.borderPrimary },
    emojiRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.md,
        borderBottomWidth: 1, borderBottomColor: Colors.borderPrimary, marginBottom: Spacing.sm },
    emojiBtn: { padding: 6 },
    emoji: { fontSize: 26 },
    action: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: Spacing.md },
    actionIcon: { fontSize: 18, marginRight: Spacing.md, width: 24, textAlign: 'center' },
    actionText: { color: Colors.textPrimary, fontSize: FontSize.md },
    dangerAction: { borderTopWidth: 1, borderTopColor: Colors.borderPrimary, marginTop: 4 },
    cancelBtn: { backgroundColor: Colors.bgTertiary, borderRadius: Radius.md,
        padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
    cancelText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
});
