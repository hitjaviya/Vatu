import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { authAPI } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Colors, Spacing, Radius, FontSize } from '../theme';
import { StatusBar } from 'expo-status-bar';

export default function AuthScreen() {
    const [isLogin, setIsLogin] = useState(true);
    const [step, setStep] = useState('form');
    const [pendingUserId, setPendingUserId] = useState(null);
    const [pendingEmail, setPendingEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [formData, setFormData] = useState({ username: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async () => {
        setError('');
        setInfo('');
        setLoading(true);
        try {
            if (isLogin) {
                const response = await authAPI.login({
                    email: formData.email,
                    password: formData.password
                });
                const { token, refreshToken, user } = response.data;
                await login(user, token, refreshToken);
            } else {
                const response = await authAPI.register(formData);
                setPendingUserId(response.data.userId);
                setPendingEmail(formData.email);
                setInfo('A 6-digit OTP has been sent to your email.');
                setStep('otp');
            }
        } catch (err) {
            const errData = err.response?.data;
            if (err.response?.status === 403 && errData?.userId) {
                setPendingUserId(errData.userId);
                setPendingEmail(formData.email);
                setInfo('Your email is not verified. A new OTP has been sent.');
                try { await authAPI.sendOtp(formData.email); } catch (_) {}
                setStep('otp');
            } else {
                setError(errData?.error || 'An error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        setError('');
        setLoading(true);
        try {
            const response = await authAPI.verifyOtp({ userId: pendingUserId, otp });
            const { token, refreshToken, user } = response.data;
            await login(user, token, refreshToken);
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setError('');
        setInfo('');
        setLoading(true);
        try {
            await authAPI.sendOtp(pendingEmail);
            setInfo('OTP resent. Check your email.');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to resend OTP.');
        } finally {
            setLoading(false);
        }
    };

    if (step === 'otp') {
        return (
            <View style={s.container}>
                <StatusBar style="light" />
                <View style={s.gradientBg}>
                    <View style={s.gradientOverlay} />
                </View>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={s.keyboardView}
                >
                    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
                        <View style={s.card}>
                            <Text style={s.logoIcon}>✉️</Text>
                            <Text style={s.title}>Verify Email</Text>
                            <Text style={s.subtitle}>
                                Enter the 6-digit code sent to{'\n'}
                                <Text style={s.bold}>{pendingEmail}</Text>
                            </Text>

                            <TextInput
                                style={[s.input, s.otpInput]}
                                value={otp}
                                onChangeText={(t) => { setOtp(t); setError(''); }}
                                placeholder="Enter 6-digit OTP"
                                placeholderTextColor={Colors.textTertiary}
                                maxLength={6}
                                keyboardType="number-pad"
                                autoFocus
                                textAlign="center"
                            />

                            {info ? <Text style={s.infoText}>{info}</Text> : null}
                            {error ? <Text style={s.errorText}>{error}</Text> : null}

                            <TouchableOpacity
                                style={[s.btn, (loading || otp.length !== 6) && s.btnDisabled]}
                                onPress={handleVerifyOtp}
                                disabled={loading || otp.length !== 6}
                            >
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                                <Text style={s.link}>Didn't receive the code? Resend OTP</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setStep('form'); setError(''); setInfo(''); setOtp(''); }}>
                                <Text style={s.link}>← Back</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        );
    }

    return (
        <View style={s.container}>
            <StatusBar style="light" />
            <View style={s.gradientBg}>
                <View style={s.gradientOverlay} />
            </View>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={s.keyboardView}
            >
                <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
                    <View style={s.card}>
                        <Text style={s.logoIcon}>💬</Text>
                        <Text style={s.title}>Vatu</Text>
                        <Text style={s.subtitle}>
                            {isLogin ? 'Welcome back!' : 'Create your account'}
                        </Text>

                        {!isLogin && (
                            <>
                                <Text style={s.label}>Username</Text>
                                <TextInput
                                    style={s.input}
                                    value={formData.username}
                                    onChangeText={(t) => { setFormData({ ...formData, username: t }); setError(''); }}
                                    placeholder="Enter your username"
                                    placeholderTextColor={Colors.textTertiary}
                                    autoCapitalize="none"
                                />
                            </>
                        )}

                        <Text style={s.label}>Email</Text>
                        <TextInput
                            style={s.input}
                            value={formData.email}
                            onChangeText={(t) => { setFormData({ ...formData, email: t }); setError(''); }}
                            placeholder="Enter your email"
                            placeholderTextColor={Colors.textTertiary}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <Text style={s.label}>Password</Text>
                        <View style={s.passwordWrap}>
                            <TextInput
                                style={[s.input, { flex: 1, marginBottom: 0 }]}
                                value={formData.password}
                                onChangeText={(t) => { setFormData({ ...formData, password: t }); setError(''); }}
                                placeholder="Enter your password"
                                placeholderTextColor={Colors.textTertiary}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                                <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                            </TouchableOpacity>
                        </View>

                        {error ? <Text style={s.errorText}>{error}</Text> : null}

                        <TouchableOpacity
                            style={[s.btn, loading && s.btnDisabled]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={s.btnText}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => { setIsLogin(!isLogin); setError(''); }}>
                            <Text style={s.link}>
                                {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bgPrimary },
    gradientBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.bgPrimary,
    },
    gradientOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.accentPrimary,
        opacity: 0.06,
    },
    keyboardView: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
    card: {
        backgroundColor: Colors.bgSecondary,
        borderRadius: Radius.xl,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.borderPrimary,
    },
    logoIcon: { fontSize: 48, textAlign: 'center', marginBottom: Spacing.sm },
    title: {
        fontSize: FontSize.title,
        fontWeight: '700',
        color: Colors.textPrimary,
        textAlign: 'center',
        marginBottom: Spacing.xs,
    },
    subtitle: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    bold: { fontWeight: '700', color: Colors.textPrimary },
    label: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
        marginLeft: 2,
    },
    input: {
        backgroundColor: Colors.bgTertiary,
        borderRadius: Radius.md,
        padding: Spacing.md,
        color: Colors.textPrimary,
        fontSize: FontSize.md,
        borderWidth: 1,
        borderColor: Colors.borderPrimary,
        marginBottom: Spacing.md,
    },
    otpInput: {
        fontSize: FontSize.xl,
        letterSpacing: 8,
    },
    passwordWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    eyeBtn: {
        position: 'absolute',
        right: Spacing.md,
        padding: Spacing.xs,
    },
    eyeIcon: { fontSize: 20 },
    btn: {
        backgroundColor: Colors.accentPrimary,
        borderRadius: Radius.md,
        padding: Spacing.md,
        alignItems: 'center',
        marginTop: Spacing.sm,
        marginBottom: Spacing.md,
    },
    btnDisabled: { opacity: 0.5 },
    btnText: {
        color: '#fff',
        fontSize: FontSize.lg,
        fontWeight: '600',
    },
    link: {
        color: Colors.accentPrimary,
        fontSize: FontSize.sm,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },
    errorText: {
        color: Colors.error,
        fontSize: FontSize.sm,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    infoText: {
        color: Colors.accentPrimary,
        fontSize: FontSize.sm,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
});
