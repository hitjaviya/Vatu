import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Image, Alert, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { usersAPI } from '../api';
import { Colors, Spacing, Radius, FontSize, getInitials } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen({ navigation, currentUser, logout, updateUser, socket }) {
    const [uploading, setUploading] = useState(false);

    const handlePickAvatar = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.8,
        });
        if (result.canceled) return;
        setUploading(true);
        try {
            const uri = result.assets[0].uri;
            const name = uri.split('/').pop();
            const ext = name.split('.').pop();
            const formData = new FormData();
            formData.append('avatar', { uri, name, type: `image/${ext}` });
            const res = await usersAPI.uploadAvatar(formData);
            if (res.data?.avatarUrl && updateUser) {
                await updateUser({ ...currentUser, avatar: res.data.avatarUrl });
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to upload avatar');
        } finally { setUploading(false); }
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: () => {
                socket?.disconnect();
                logout();
            }},
        ]);
    };

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            <ScrollView contentContainerStyle={s.scroll}>
                <View style={s.header}>
                    <Text style={s.headerTitle}>Profile</Text>
                </View>

                <View style={s.profileCard}>
                    <TouchableOpacity style={s.avatarWrap} onPress={handlePickAvatar} disabled={uploading}>
                        {currentUser?.avatar ? (
                            <Image source={{ uri: currentUser.avatar }} style={s.avatar} />
                        ) : (
                            <View style={s.avatarPlaceholder}>
                                <Text style={s.avatarText}>{getInitials(currentUser?.username)}</Text>
                            </View>
                        )}
                        <View style={s.editBadge}>
                            <Text style={s.editIcon}>{uploading ? '⏳' : '📷'}</Text>
                        </View>
                    </TouchableOpacity>
                    <Text style={s.username}>{currentUser?.username || 'User'}</Text>
                    <Text style={s.email}>{currentUser?.email || ''}</Text>
                </View>

                <View style={s.menuSection}>
                    <TouchableOpacity style={s.menuItem} onPress={() => navigation.navigate('Settings')}>
                        <Text style={s.menuIcon}>⚙️</Text>
                        <Text style={s.menuText}>Settings</Text>
                        <Text style={s.chevron}>›</Text>
                    </TouchableOpacity>
                    <View style={s.divider} />
                    <TouchableOpacity style={s.menuItem} onPress={handleLogout}>
                        <Text style={s.menuIcon}>🚪</Text>
                        <Text style={[s.menuText, { color: Colors.error }]}>Logout</Text>
                        <Text style={[s.chevron, { color: Colors.error }]}>›</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bgPrimary },
    scroll: { padding: Spacing.md },
    header: { marginBottom: Spacing.lg },
    headerTitle: { color: Colors.textPrimary, fontSize: FontSize.title, fontWeight: '700' },
    profileCard: { alignItems: 'center', backgroundColor: Colors.bgSecondary, borderRadius: Radius.xl,
        padding: Spacing.xl, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.borderPrimary },
    avatarWrap: { marginBottom: Spacing.md, position: 'relative' },
    avatar: { width: 96, height: 96, borderRadius: 48 },
    avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.accentPrimary,
        justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontSize: FontSize.title, fontWeight: '700' },
    editBadge: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16,
        backgroundColor: Colors.bgTertiary, justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: Colors.bgSecondary },
    editIcon: { fontSize: 14 },
    username: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '700' },
    email: { color: Colors.textTertiary, fontSize: FontSize.sm, marginTop: 4 },
    menuSection: { backgroundColor: Colors.bgSecondary, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Colors.borderPrimary, overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
    menuIcon: { fontSize: 20, marginRight: Spacing.md },
    menuText: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '500' },
    chevron: { color: Colors.textTertiary, fontSize: 24 },
    divider: { height: 1, backgroundColor: Colors.borderPrimary, marginHorizontal: Spacing.md },
});
