import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList,
    StyleSheet, Image, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { groupsAPI } from '../api';
import { Colors, Spacing, Radius, FontSize, getInitials } from '../theme';

function CreateGroupModal({ visible, friends, currentUser, onClose, onGroupCreated }) {
    const [groupName, setGroupName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const available = friends.filter(u => {
        const currentUserId = currentUser?.id || currentUser?._id;
        if (u._id === currentUserId) return false;
        if (search) return u.username.toLowerCase().includes(search.toLowerCase());
        return true;
    });

    const toggle = (id) => setSelectedMembers(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

    const handleCreate = async () => {
        if (!groupName.trim() || selectedMembers.length === 0) return;
        setLoading(true);
        try {
            const res = await groupsAPI.create({ name: groupName.trim(), description: description.trim(), memberIds: selectedMembers });
            onGroupCreated?.(res.data.group);
            onClose();
            setGroupName(''); setDescription(''); setSelectedMembers([]);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to create group');
        } finally { setLoading(false); }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={cs.overlay}>
                <View style={cs.modal}>
                    <View style={cs.header}>
                        <Text style={cs.title}>Create New Group</Text>
                        <TouchableOpacity onPress={onClose}><Text style={cs.close}>✕</Text></TouchableOpacity>
                    </View>
                    <TextInput style={cs.input} value={groupName} onChangeText={setGroupName} placeholder="Group name *" placeholderTextColor={Colors.textTertiary} maxLength={50} />
                    <TextInput style={cs.input} value={description} onChangeText={setDescription} placeholder="Description (optional)" placeholderTextColor={Colors.textTertiary} maxLength={200} />
                    <Text style={cs.label}>Members ({selectedMembers.length} selected)</Text>
                    <TextInput style={cs.input} value={search} onChangeText={setSearch} placeholder="Search friends…" placeholderTextColor={Colors.textTertiary} />
                    <FlatList data={available} keyExtractor={i => i._id} style={{ maxHeight: 200 }} renderItem={({ item }) => (
                        <TouchableOpacity style={[cs.memberItem, selectedMembers.includes(item._id) && cs.memberSelected]} onPress={() => toggle(item._id)}>
                            <View style={cs.memberAvatar}>
                                {item.avatar ? <Image source={{ uri: item.avatar }} style={cs.memberAvatarImg} /> : <Text style={cs.memberAvatarText}>{getInitials(item.username)}</Text>}
                            </View>
                            <Text style={cs.memberName}>{item.username}</Text>
                            {selectedMembers.includes(item._id) && <Text style={{ color: Colors.accentPrimary }}>✓</Text>}
                        </TouchableOpacity>
                    )} />
                    <View style={cs.footer}>
                        <TouchableOpacity style={cs.cancelBtn} onPress={onClose}><Text style={cs.cancelText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[cs.createBtn, (!groupName.trim() || selectedMembers.length === 0) && { opacity: 0.5 }]} onPress={handleCreate} disabled={loading || !groupName.trim() || selectedMembers.length === 0}>
                            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={cs.createText}>Create</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const cs = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: Spacing.lg },
    modal: { backgroundColor: Colors.bgSecondary, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.borderPrimary },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '700' },
    close: { color: Colors.textTertiary, fontSize: 20 },
    input: { backgroundColor: Colors.bgTertiary, borderRadius: Radius.md, padding: 12, color: Colors.textPrimary, fontSize: FontSize.md, borderWidth: 1, borderColor: Colors.borderPrimary, marginBottom: Spacing.sm },
    label: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.xs, marginTop: Spacing.sm },
    memberItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: Radius.md, marginBottom: 2 },
    memberSelected: { backgroundColor: Colors.bgTertiary },
    memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bgTertiary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    memberAvatarImg: { width: 36, height: 36, borderRadius: 18 },
    memberAvatarText: { color: Colors.textPrimary, fontWeight: '600', fontSize: FontSize.sm },
    memberName: { color: Colors.textPrimary, fontSize: FontSize.md, flex: 1 },
    footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.md, gap: Spacing.sm },
    cancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.bgTertiary },
    cancelText: { color: Colors.textSecondary, fontWeight: '600' },
    createBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.accentPrimary },
    createText: { color: '#fff', fontWeight: '600' },
});

export default function GroupsScreen({ navigation, groups, unreadCounts, friends, currentUser, onRefreshGroups }) {
    const [showCreate, setShowCreate] = useState(false);

    return (
        <View style={s.container}>
            <TouchableOpacity style={s.createBtn} onPress={() => setShowCreate(true)}>
                <Text style={s.createIcon}>＋</Text>
                <Text style={s.createText}>Create Group</Text>
            </TouchableOpacity>
            {groups.length === 0 ? (
                <View style={s.empty}><Text style={s.emptyIcon}>💬</Text><Text style={s.emptyT}>No groups yet</Text><Text style={s.emptySub}>Create a group to get started</Text></View>
            ) : (
                <FlatList data={groups} keyExtractor={i => i._id} contentContainerStyle={{ padding: Spacing.md }} renderItem={({ item }) => {
                    const unread = unreadCounts[item._id] || 0;
                    return (
                        <TouchableOpacity style={s.item} onPress={() => navigation.navigate('Chat', { chat: { id: item._id, type: 'group', data: item } })}>
                            <View style={s.avatar}>
                                {item.avatar ? <Image source={{ uri: item.avatar }} style={s.avatarImg} /> : <Text style={s.avatarText}>{getInitials(item.name)}</Text>}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.name}>{item.name}</Text>
                                <Text style={s.sub}>{item.members?.length || 0} members</Text>
                            </View>
                            {unread > 0 && <View style={s.badge}><Text style={s.badgeT}>{unread > 9 ? '9+' : unread}</Text></View>}
                        </TouchableOpacity>
                    );
                }} />
            )}
            <CreateGroupModal visible={showCreate} friends={friends} currentUser={currentUser} onClose={() => setShowCreate(false)} onGroupCreated={() => { setShowCreate(false); onRefreshGroups?.(); }} />
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bgPrimary },
    createBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.accentPrimary, margin: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, justifyContent: 'center' },
    createIcon: { color: '#fff', fontSize: 20, marginRight: Spacing.sm, fontWeight: '700' },
    createText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
    item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: Spacing.md, marginBottom: 2 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accentSecondary + '30', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    avatarImg: { width: 48, height: 48, borderRadius: 24 },
    avatarText: { color: Colors.accentPrimary, fontWeight: '600', fontSize: FontSize.md },
    name: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600' },
    sub: { color: Colors.textTertiary, fontSize: FontSize.sm, marginTop: 2 },
    badge: { backgroundColor: Colors.accentPrimary, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
    badgeT: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
    emptyT: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '600', marginBottom: 4 },
    emptySub: { color: Colors.textTertiary, fontSize: FontSize.sm, textAlign: 'center' },
});
