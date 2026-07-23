import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize, getInitials } from '../theme';

export default function ChatHeader({ chat, onlineUsers, onBack }) {
    const isGroup = chat?.type === 'group';
    const name = isGroup ? chat.data?.name : chat.data?.username;
    const avatar = isGroup ? chat.data?.avatar : chat.data?.avatar;
    const isOnline = !isGroup && onlineUsers?.has(chat?.id);
    const subtitle = isGroup
        ? `${chat.data?.members?.length || 0} members`
        : (isOnline ? 'Online' : 'Offline');

    return (
        <View style={s.header}>
            <TouchableOpacity onPress={onBack} style={s.backBtn}>
                <Text style={s.backIcon}>‹</Text>
            </TouchableOpacity>
            <View style={s.avatar}>
                {avatar
                    ? <Image source={{ uri: avatar }} style={s.avatarImg} />
                    : <Text style={s.avatarText}>{getInitials(name)}</Text>}
                {!isGroup && <View style={[s.dot, isOnline && s.dotOn]} />}
            </View>
            <View style={s.info}>
                <Text style={s.name} numberOfLines={1}>{name || 'Chat'}</Text>
                <Text style={[s.status, isOnline && { color: Colors.statusOnline }]}>{subtitle}</Text>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    header: {
        flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
        backgroundColor: Colors.bgSecondary, borderBottomWidth: 1,
        borderBottomColor: Colors.borderPrimary,
    },
    backBtn: { marginRight: Spacing.sm, padding: 4 },
    backIcon: { color: Colors.accentPrimary, fontSize: 32, fontWeight: '300', lineHeight: 32 },
    avatar: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bgTertiary,
        justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm,
    },
    avatarImg: { width: 40, height: 40, borderRadius: 20 },
    avatarText: { color: Colors.textPrimary, fontWeight: '600', fontSize: FontSize.sm },
    dot: {
        position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
        borderRadius: 6, backgroundColor: Colors.statusOffline,
        borderWidth: 2, borderColor: Colors.bgSecondary,
    },
    dotOn: { backgroundColor: Colors.statusOnline },
    info: { flex: 1 },
    name: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '600' },
    status: { color: Colors.textTertiary, fontSize: FontSize.xs, marginTop: 1 },
});
