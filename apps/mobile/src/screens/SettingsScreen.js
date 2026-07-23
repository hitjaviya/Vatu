import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { usersAPI } from '../api';
import { Colors, Spacing, Radius, FontSize } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen({ navigation, currentUser }) {
    const [activeTab, setActiveTab] = useState('account');
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const maskEmail = (em) => {
        if (!em) return '';
        const [local, domain] = em.split('@');
        if (!local || !domain) return em;
        if (local.length <= 4) return `${local[0]}***@${domain}`;
        return `${local.slice(0, 2)}${'*'.repeat(Math.min(local.length - 4, 4))}${local.slice(-2)}@${domain}`;
    };

    const handleEmailChange = async () => {
        if (!email.trim()) return;
        try {
            await usersAPI.changeEmail(email);
            Alert.alert('Success', 'Email updated successfully!');
            setEmail('');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to update email');
        }
    };

    const handlePasswordChange = async () => {
        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'New passwords do not match'); return;
        }
        if (newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters'); return;
        }
        try {
            await usersAPI.changePassword(currentPassword, newPassword);
            Alert.alert('Success', 'Password updated!');
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to update password');
        }
    };

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={s.back}>← Back</Text>
                </TouchableOpacity>
                <Text style={s.headerTitle}>⚙️ Settings</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={s.scroll}>
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Change Email</Text>
                    <TextInput style={s.input} value={email} onChangeText={setEmail}
                        placeholder={currentUser?.email ? maskEmail(currentUser.email) : 'New email'}
                        placeholderTextColor={Colors.textTertiary}
                        keyboardType="email-address" autoCapitalize="none" />
                    <TouchableOpacity style={s.btn} onPress={handleEmailChange}>
                        <Text style={s.btnText}>Update Email</Text>
                    </TouchableOpacity>
                </View>

                <View style={s.section}>
                    <Text style={s.sectionTitle}>Change Password</Text>
                    <TextInput style={s.input} value={currentPassword} onChangeText={setCurrentPassword}
                        placeholder="Current password" placeholderTextColor={Colors.textTertiary}
                        secureTextEntry autoCapitalize="none" />
                    <TextInput style={s.input} value={newPassword} onChangeText={setNewPassword}
                        placeholder="New password" placeholderTextColor={Colors.textTertiary}
                        secureTextEntry={!showPassword} autoCapitalize="none" />
                    <TextInput style={s.input} value={confirmPassword} onChangeText={setConfirmPassword}
                        placeholder="Confirm new password" placeholderTextColor={Colors.textTertiary}
                        secureTextEntry={!showPassword} autoCapitalize="none" />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Text style={s.toggle}>{showPassword ? '🙈 Hide' : '👁️ Show'} passwords</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.btn} onPress={handlePasswordChange}>
                        <Text style={s.btnText}>Update Password</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bgPrimary },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderPrimary },
    back: { color: Colors.accentPrimary, fontSize: FontSize.md },
    headerTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700' },
    scroll: { padding: Spacing.md },
    section: { backgroundColor: Colors.bgSecondary, borderRadius: Radius.xl, padding: Spacing.lg,
        marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.borderPrimary },
    sectionTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
    input: { backgroundColor: Colors.bgTertiary, borderRadius: Radius.md, padding: Spacing.md,
        color: Colors.textPrimary, fontSize: FontSize.md, borderWidth: 1,
        borderColor: Colors.borderPrimary, marginBottom: Spacing.sm },
    toggle: { color: Colors.accentPrimary, fontSize: FontSize.sm, textAlign: 'right', marginBottom: Spacing.md },
    btn: { backgroundColor: Colors.accentPrimary, borderRadius: Radius.md, padding: Spacing.md,
        alignItems: 'center', marginTop: Spacing.xs },
    btnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
});
