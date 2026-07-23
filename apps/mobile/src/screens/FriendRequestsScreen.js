import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, StyleSheet,
    ActivityIndicator, Image, RefreshControl,
} from 'react-native';
import { friendsAPI } from '../api';
import { Colors, Spacing, Radius, FontSize, getInitials } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FriendRequestsScreen({ socket, currentUser, onFriendAdded }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actionIds, setActionIds] = useState(new Set());

    useEffect(() => { fetchRequests(); }, []);

    useEffect(() => {
        if (!socket) return;
        const handler = ({ request }) => {
            if (request) setRequests(prev => [request, ...prev]);
        };
        socket.on('friend:request:received', handler);
        return () => socket.off('friend:request:received', handler);
    }, [socket]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await friendsAPI.getRequests();
            setRequests(res.data.requests || []);
        } catch { setRequests([]); }
        finally { setLoading(false); }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchRequests();
        setRefreshing(false);
    }, []);

    const setAction = (id, val) => setActionIds(prev => {
        const s = new Set(prev); val ? s.add(id) : s.delete(id); return s;
    });

    const handleAccept = async (req) => {
        setAction(req._id, true);
        try {
            const res = await friendsAPI.acceptRequest(req._id);
            setRequests(prev => prev.filter(r => r._id !== req._id));
            socket?.emit('friend:request:accepted', {
                senderId: req.sender._id,
                newFriend: res.data.request?.recipient,
            });
            onFriendAdded?.();
        } catch {} finally { setAction(req._id, false); }
    };

    const handleDecline = async (req) => {
        setAction(req._id, true);
        try {
            await friendsAPI.declineRequest(req._id);
            setRequests(prev => prev.filter(r => r._id !== req._id));
        } catch {} finally { setAction(req._id, false); }
    };

    const renderItem = ({ item }) => (
        <View style={s.item}>
            <View style={s.avatar}>
                {item.sender?.avatar
                    ? <Image source={{ uri: item.sender.avatar }} style={s.avatarImg} />
                    : <Text style={s.avatarText}>{getInitials(item.sender?.username)}</Text>}
            </View>
            <View style={s.info}>
                <Text style={s.name}>{item.sender?.username}</Text>
                <Text style={s.sub}>wants to be your friend</Text>
            </View>
            <View style={s.btns}>
                <TouchableOpacity style={s.acceptBtn} onPress={() => handleAccept(item)}
                    disabled={actionIds.has(item._id)}>
                    <Text style={s.btnIcon}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.declineBtn} onPress={() => handleDecline(item)}
                    disabled={actionIds.has(item._id)}>
                    <Text style={s.btnIcon}>✕</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            <View style={s.header}>
                <Text style={s.title}>Friend Requests</Text>
                <View style={s.badge}><Text style={s.badgeT}>{requests.length}</Text></View>
            </View>
            {loading ? (
                <View style={s.empty}><ActivityIndicator color={Colors.accentPrimary} /></View>
            ) : requests.length === 0 ? (
                <View style={s.empty}>
                    <Text style={s.emptyIcon}>👋</Text>
                    <Text style={s.emptyT}>No pending requests</Text>
                    <Text style={s.emptySub}>New friend requests will appear here</Text>
                </View>
            ) : (
                <FlatList
                    data={requests}
                    keyExtractor={i => i._id}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: Spacing.md }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}
                        tintColor={Colors.accentPrimary} />}
                />
            )}
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bgPrimary },
    header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, paddingBottom: Spacing.sm,
        borderBottomWidth: 1, borderBottomColor: Colors.borderPrimary },
    title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '700', flex: 1 },
    badge: { backgroundColor: Colors.accentPrimary, borderRadius: 12, minWidth: 24, height: 24,
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
    badgeT: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
    item: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.bgSecondary,
        borderRadius: Radius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.borderPrimary },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.bgTertiary,
        justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    avatarImg: { width: 48, height: 48, borderRadius: 24 },
    avatarText: { color: Colors.textPrimary, fontWeight: '600', fontSize: FontSize.md },
    info: { flex: 1 },
    name: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600' },
    sub: { color: Colors.textTertiary, fontSize: FontSize.sm, marginTop: 2 },
    btns: { flexDirection: 'row', gap: 8 },
    acceptBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.success,
        justifyContent: 'center', alignItems: 'center' },
    declineBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.error + '30',
        justifyContent: 'center', alignItems: 'center' },
    btnIcon: { color: '#fff', fontSize: 16, fontWeight: '700' },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
    emptyT: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '600', marginBottom: 4 },
    emptySub: { color: Colors.textTertiary, fontSize: FontSize.sm, textAlign: 'center' },
});
