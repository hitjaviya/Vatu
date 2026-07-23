import React, { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList,
    StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { usersAPI, friendsAPI } from '../api';
import { Colors, Spacing, Radius, FontSize, getInitials } from '../theme';

export default function ChatsScreen({ navigation, friends, onlineUsers, unreadCounts, onRefreshFriends, socket }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchStatuses, setSearchStatuses] = useState({});
    const [searchLoading, setSearchLoading] = useState(false);
    const [pendingActions, setPendingActions] = useState(new Set());
    const searchTimer = useRef(null);
    const isSearching = searchQuery.trim().length > 0;

    const handleSearchChange = (q) => {
        setSearchQuery(q);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (!q.trim()) { setSearchResults([]); setSearchStatuses({}); return; }
        searchTimer.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const res = await usersAPI.search(q.trim());
                const users = res.data.users || [];
                setSearchResults(users);
                const statuses = {};
                await Promise.all(users.map(async (u) => {
                    try { statuses[u._id] = (await friendsAPI.getStatus(u._id)).data; }
                    catch { statuses[u._id] = { status: 'none' }; }
                }));
                setSearchStatuses(statuses);
            } catch {} finally { setSearchLoading(false); }
        }, 350);
    };

    const getUserStatus = (id) => onlineUsers.has(id) ? 'online' : 'offline';

    const handleSendRequest = async (user) => {
        setPendingActions(p => new Set(p).add(user._id));
        try {
            const res = await friendsAPI.sendRequest(user._id);
            setSearchStatuses(p => ({ ...p, [user._id]: { status: 'pending_sent' } }));
            socket?.emit('friend:request:send', { recipientId: user._id, request: res.data.request });
        } catch {} finally { setPendingActions(p => { const s = new Set(p); s.delete(user._id); return s; }); }
    };

    const renderActionBtn = (user) => {
        const info = searchStatuses[user._id] || { status: 'none' };
        if (info.status === 'friends') return (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: Colors.accentPrimary }]}
                onPress={() => { setSearchQuery(''); navigation.navigate('Chat', { chat: { id: user._id, type: 'user', data: user } }); }}>
                <Text style={s.actionText}>💬</Text>
            </TouchableOpacity>
        );
        if (info.status === 'pending_sent') return <View style={s.pill}><Text style={s.pillText}>Sent</Text></View>;
        return (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: Colors.accentSecondary }]}
                onPress={() => handleSendRequest(user)} disabled={pendingActions.has(user._id)}>
                <Text style={s.actionText}>＋</Text>
            </TouchableOpacity>
        );
    };

    const renderItem = ({ item }) => {
        const unread = unreadCounts[item._id] || 0;
        return (
            <TouchableOpacity style={s.item}
                onPress={() => navigation.navigate('Chat', { chat: { id: item._id, type: 'user', data: item } })}>
                <View style={s.avatar}>
                    {item.avatar ? <Image source={{ uri: item.avatar }} style={s.avatarImg} />
                        : <Text style={s.avatarText}>{getInitials(item.username)}</Text>}
                    <View style={[s.dot, getUserStatus(item._id) === 'online' && s.dotOn]} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={s.name}>{item.username}</Text>
                    <Text style={s.sub}>{getUserStatus(item._id)}</Text>
                </View>
                {unread > 0 && <View style={s.badge}><Text style={s.badgeT}>{unread > 9 ? '9+' : unread}</Text></View>}
            </TouchableOpacity>
        );
    };

    const renderSearchItem = ({ item }) => (
        <View style={s.item}>
            <View style={s.avatar}>
                {item.avatar ? <Image source={{ uri: item.avatar }} style={s.avatarImg} />
                    : <Text style={s.avatarText}>{getInitials(item.username)}</Text>}
            </View>
            <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.username}</Text>
                <Text style={s.sub}>{getUserStatus(item._id)}</Text>
            </View>
            {renderActionBtn(item)}
        </View>
    );

    return (
        <View style={s.container}>
            <View style={s.searchWrap}>
                <Text style={{ fontSize: 14, marginRight: 8 }}>🔍</Text>
                <TextInput style={s.searchInput} placeholder="Search by username…"
                    placeholderTextColor={Colors.textTertiary} value={searchQuery}
                    onChangeText={handleSearchChange} autoCapitalize="none" />
                {isSearching && <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <Text style={{ color: Colors.textTertiary, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>}
            </View>
            {isSearching ? (
                searchLoading ? <View style={s.empty}><ActivityIndicator color={Colors.accentPrimary} /></View> :
                searchResults.length === 0 ? <View style={s.empty}><Text style={s.emptyIcon}>🔍</Text><Text style={s.emptyT}>No users found</Text></View> :
                <FlatList data={searchResults} keyExtractor={i => i._id} renderItem={renderSearchItem} contentContainerStyle={{ padding: Spacing.md }} />
            ) : friends.length === 0 ? (
                <View style={s.empty}><Text style={s.emptyIcon}>👥</Text><Text style={s.emptyT}>No friends yet</Text><Text style={s.emptySub}>Search above to add friends</Text></View>
            ) : (
                <FlatList data={friends} keyExtractor={i => i._id} renderItem={renderItem} contentContainerStyle={{ padding: Spacing.md }} />
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bgPrimary },
    searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgTertiary, borderRadius: Radius.lg, margin: Spacing.md, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.borderPrimary },
    searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.md, paddingVertical: 12 },
    item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: Spacing.md, marginBottom: 2 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.bgTertiary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    avatarImg: { width: 48, height: 48, borderRadius: 24 },
    avatarText: { color: Colors.textPrimary, fontWeight: '600', fontSize: FontSize.md },
    dot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.statusOffline, borderWidth: 2, borderColor: Colors.bgPrimary },
    dotOn: { backgroundColor: Colors.statusOnline },
    name: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600' },
    sub: { color: Colors.textTertiary, fontSize: FontSize.sm, marginTop: 2 },
    badge: { backgroundColor: Colors.accentPrimary, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
    badgeT: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
    actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md },
    actionText: { color: '#fff', fontWeight: '600', fontSize: FontSize.sm },
    pill: { backgroundColor: Colors.bgTertiary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full },
    pillText: { color: Colors.textTertiary, fontSize: FontSize.xs, fontWeight: '600' },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
    emptyT: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '600', marginBottom: 4 },
    emptySub: { color: Colors.textTertiary, fontSize: FontSize.sm, textAlign: 'center' },
});
