import React, { useState } from 'react';
import { useAuth } from '@chat-app/shared/hooks/useAuth';
import { authAPI } from '@chat-app/shared/api';
import './AuthScreen.css';

function AuthScreen() {
    const [isLogin, setIsLogin] = useState(true);
    const [step, setStep] = useState('form'); // 'form' | 'otp'
    const [pendingUserId, setPendingUserId] = useState(null);
    const [pendingEmail, setPendingEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
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
                login(user, token, refreshToken);
            } else {
                // Register → server sends OTP email, returns userId
                const response = await authAPI.register(formData);
                setPendingUserId(response.data.userId);
                setPendingEmail(formData.email);
                setInfo('A 6-digit OTP has been sent to your email.');
                setStep('otp');
            }
        } catch (err) {
            const errData = err.response?.data;
            // If login blocked due to unverified email, go to OTP step
            if (err.response?.status === 403 && errData?.userId) {
                setPendingUserId(errData.userId);
                setPendingEmail(formData.email);
                setInfo('Your email is not verified. A new OTP has been sent.');
                // Resend OTP automatically
                try { await authAPI.sendOtp(formData.email); } catch (_) { }
                setStep('otp');
            } else {
                setError(errData?.error || 'An error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authAPI.verifyOtp({ userId: pendingUserId, otp });
            const { token, refreshToken, user } = response.data;
            login(user, token, refreshToken);
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
            setInfo('OTP resent. Please check your email.');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to resend OTP.');
        } finally {
            setLoading(false);
        }
    };

    // ── OTP verification screen ──────────────────────────────────
    if (step === 'otp') {
        return (
            <div className="auth-screen">
                <div className="auth-background">
                    <div className="auth-gradient"></div>
                    <div className="auth-pattern"></div>
                </div>
                <div className="auth-container">
                    <div className="auth-card">
                        <div className="auth-header">
                            <div className="auth-logo">
                                <div className="logo-icon">✉️</div>
                                <h1>Verify Email</h1>
                            </div>
                            <p className="auth-subtitle">
                                Enter the 6-digit code sent to<br />
                                <strong>{pendingEmail}</strong>
                            </p>
                        </div>

                        <form className="auth-form" onSubmit={handleVerifyOtp}>
                            <div className="form-group">
                                <label htmlFor="otp">OTP Code</label>
                                <input
                                    type="text"
                                    id="otp"
                                    value={otp}
                                    onChange={(e) => { setOtp(e.target.value); setError(''); }}
                                    placeholder="Enter 6-digit OTP"
                                    maxLength={6}
                                    required
                                    autoFocus
                                    style={{ letterSpacing: '0.3em', fontSize: '1.2rem', textAlign: 'center' }}
                                />
                            </div>

                            {info && <div className="info-message">{info}</div>}
                            {error && <div className="error-message">{error}</div>}

                            <button type="submit" className="auth-button" disabled={loading || otp.length !== 6}>
                                {loading ? <span className="button-loader"></span> : 'Verify'}
                            </button>
                        </form>

                        <div className="auth-footer">
                            <p>
                                Didn't receive the code?{' '}
                                <button type="button" className="toggle-button" onClick={handleResendOtp} disabled={loading}>
                                    Resend OTP
                                </button>
                            </p>
                            <p>
                                <button type="button" className="toggle-button" onClick={() => { setStep('form'); setError(''); setInfo(''); setOtp(''); }}>
                                    ← Back
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Login / Register screen ──────────────────────────────────
    return (
        <div className="auth-screen">
            <div className="auth-background">
                <div className="auth-gradient"></div>
                <div className="auth-pattern"></div>
            </div>

            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <div className="auth-logo">
                            <div className="logo-icon">💬</div>
                            <h1>ChatApp</h1>
                        </div>
                        <p className="auth-subtitle">
                            {isLogin ? 'Welcome back!' : 'Create your account'}
                        </p>
                    </div>

                    <form className="auth-form" onSubmit={handleSubmit}>
                        {!isLogin && (
                            <div className="form-group">
                                <label htmlFor="username">Username</label>
                                <input
                                    type="text"
                                    id="username"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    placeholder="Enter your username"
                                    required={!isLogin}
                                    autoComplete="username"
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Enter your email"
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Enter your password"
                                    required
                                    minLength="6"
                                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                                    style={{ paddingRight: '2.5rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '0.75rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '1.1rem',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: '#666',
                                        outline: 'none'
                                    }}
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    <i className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <button type="submit" className="auth-button" disabled={loading}>
                            {loading ? (
                                <span className="button-loader"></span>
                            ) : (
                                isLogin ? 'Sign In' : 'Sign Up'
                            )}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <p>
                            {isLogin ? "Don't have an account?" : 'Already have an account?'}
                            <button
                                type="button"
                                className="toggle-button"
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setError('');
                                }}
                            >
                                {isLogin ? 'Sign Up' : 'Sign In'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AuthScreen;
