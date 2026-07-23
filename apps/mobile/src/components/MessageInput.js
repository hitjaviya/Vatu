import React, { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../theme';

export default function MessageInput({ value, onChangeText, onSend, onFilePick, replyingTo, onCancelReply, typing }) {
    const inputRef = useRef(null);

    const handleSend = () => {
        if (!value?.trim()) return;
        onSend?.();
    };

    return (
        <View style={s.wrapper}>
            {typing && (
                <View style={s.typingBar}>
                    <Text style={s.typingText}>typing…</Text>
                </View>
            )}
            {replyingTo && (
                <View style={s.replyBar}>
                    <View style={s.replyLine} />
                    <Text style={s.replyText} numberOfLines={1}>
                        Replying: {replyingTo.content || 'message'}
                    </Text>
                    <TouchableOpacity onPress={onCancelReply}>
                        <Text style={s.replyClose}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}
            <View style={s.row}>
                <TouchableOpacity style={s.attachBtn} onPress={onFilePick}>
                    <Text style={s.attachIcon}>📎</Text>
                </TouchableOpacity>
                <TextInput
                    ref={inputRef}
                    style={s.input}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder="Type a message…"
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    maxLength={4000}
                />
                <TouchableOpacity
                    style={[s.sendBtn, !value?.trim() && s.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!value?.trim()}
                >
                    <Text style={s.sendIcon}>➤</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    wrapper: { backgroundColor: Colors.bgSecondary, borderTopWidth: 1, borderTopColor: Colors.borderPrimary },
    row: {
        flexDirection: 'row', alignItems: 'flex-end', padding: Spacing.sm,
        paddingBottom: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
    },
    attachBtn: { padding: 8, marginRight: 4 },
    attachIcon: { fontSize: 22 },
    input: {
        flex: 1, backgroundColor: Colors.bgTertiary, borderRadius: Radius.lg,
        paddingHorizontal: Spacing.md, paddingVertical: 10, color: Colors.textPrimary,
        fontSize: FontSize.md, maxHeight: 100, minHeight: 40,
        borderWidth: 1, borderColor: Colors.borderPrimary,
    },
    sendBtn: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentPrimary,
        justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.sm,
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendIcon: { color: '#fff', fontSize: 18 },
    typingBar: { paddingHorizontal: Spacing.md, paddingTop: 4 },
    typingText: { color: Colors.accentPrimary, fontSize: FontSize.xs, fontStyle: 'italic' },
    replyBar: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm, paddingBottom: 4,
    },
    replyLine: { width: 3, height: 20, backgroundColor: Colors.accentPrimary, borderRadius: 2, marginRight: 8 },
    replyText: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.sm },
    replyClose: { color: Colors.textTertiary, fontSize: 16, padding: 4 },
});
