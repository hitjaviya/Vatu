import React, { useState, useEffect } from 'react';
import { usersAPI } from '@chat-app/shared/api';
import './Settings.css';

const THEMES = {
    valentine: {
        name: '💕 Valentine',
        background: 'url(/assets/backgrounds/valentine.png)',
        accent: '#ec4899',
        sent: '#ec4899',
        received: '#2d2d2d',
        mood: 'Romantic & Loving'
    },
    school: {
        name: '📚 School',
        background: 'url(/assets/backgrounds/school.png)',
        accent: '#3b82f6',
        sent: '#3b82f6',
        received: '#2d2d2d',
        mood: 'Clean & Studious'
    },
    chill: {
        name: '🌊 Chill',
        background: 'url(/assets/backgrounds/chill.png)',
        accent: '#06b6d4',
        sent: '#06b6d4',
        received: '#2d2d2d',
        mood: 'Calm & Peaceful'
    },
    dark: {
        name: '🌙 Dark',
        background: 'url(/assets/backgrounds/dark.png)',
        accent: '#8b5cf6',
        sent: '#6366f1',
        received: '#27272a',
        mood: 'Professional'
    },
    nature: {
        name: '🌿 Nature',
        background: 'url(/assets/backgrounds/nature.png)',
        accent: '#10b981',
        sent: '#10b981',
        received: '#2d2d2d',
        mood: 'Fresh & Natural'
    },
    sunset: {
        name: '🌅 Sunset',
        background: 'url(/assets/backgrounds/sunset.png)',
        accent: '#f97316',
        sent: '#f97316',
        received: '#2d2d2d',
        mood: 'Warm & Cozy'
    }
};

function Settings({ isOpen, onClose, currentUser }) {
    const [selectedTheme, setSelectedTheme] = useState('dark');
    const [activeTab, setActiveTab] = useState('theme');
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('chatTheme');
        if (saved) {
            const theme = JSON.parse(saved);
            setSelectedTheme(theme.name);
            applyTheme(theme.name);
        }
        if (currentUser?.email) {
            setEmail('');  // Clear to show masked placeholder
        }
    }, [currentUser]);

    const maskEmail = (email) => {
        if (!email) return '';
        const [localPart, domain] = email.split('@');
        if (!localPart || !domain) return email;
        
        // Show first 2 and last 2 characters, mask middle
        if (localPart.length <= 4) {
            return `${localPart[0]}***@${domain}`;
        }
        
        const start = localPart.slice(0, 2);
        const end = localPart.slice(-2);
        const masked = '*'.repeat(Math.min(localPart.length - 4, 4));
        return `${start}${masked}${end}@${domain}`;
    };

    const applyTheme = (themeName) => {
        const theme = THEMES[themeName];
        if (!theme) return;

        const root = document.documentElement;
        root.style.setProperty('--accent-primary', theme.accent);
        root.style.setProperty('--message-sent', theme.sent);
        root.style.setProperty('--message-received', theme.received);
        root.style.setProperty('--chat-background', theme.background);

        localStorage.setItem('chatTheme', JSON.stringify({
            name: themeName,
            ...theme
        }));
    };

    const handleThemeSelect = (themeName) => {
        setSelectedTheme(themeName);
        applyTheme(themeName);
    };

    const handleEmailChange = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });
        try {
            await usersAPI.changeEmail(email);
            setMessage({ type: 'success', text: '✓ Email updated successfully!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: '✗ ' + (error.response?.data?.error || 'Failed to update email') });
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });
        
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: '✗ New passwords do not match' });
            return;
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: '✗ Password must be at least 6 characters' });
            return;
        }

        try {
            await usersAPI.changePassword(currentPassword, newPassword);
            setMessage({ type: 'success', text: '✓ Password updated successfully!' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: '✗ ' + (error.response?.data?.error || 'Failed to update password') });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="settings-header">
                    <h2>⚙️ Settings</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="settings-tabs">
                    <button
                        className={`settings-tab ${activeTab === 'theme' ? 'active' : ''}`}
                        onClick={() => setActiveTab('theme')}
                    >
                        🎨 Theme
                    </button>
                    <button
                        className={`settings-tab ${activeTab === 'account' ? 'active' : ''}`}
                        onClick={() => setActiveTab('account')}
                    >
                        👤 Account
                    </button>
                </div>

                {message.text && (
                    <div className={`message ${message.type}`}>
                        {message.text}
                    </div>
                )}

                {activeTab === 'theme' ? (
                <div className="themes-grid">
                    {Object.entries(THEMES).map(([key, theme]) => (
                        <div
                            key={key}
                            className={`theme-card ${selectedTheme === key ? 'selected' : ''}`}
                            onClick={() => handleThemeSelect(key)}
                        >
                            <div
                                className="theme-preview"
                                style={{
                                    backgroundImage: theme.background,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center'
                                }}
                            >
                                <div className="theme-preview-overlay">
                                    <div
                                        className="preview-message sent"
                                        style={{ backgroundColor: theme.sent }}
                                    >
                                        <span style={{ color: '#fff' }}>Hello! 👋</span>
                                    </div>
                                    <div
                                        className="preview-message received"
                                        style={{ backgroundColor: theme.received }}
                                    >
                                        <span style={{ color: '#fff' }}>Hi there!</span>
                                    </div>
                                </div>
                            </div>
                            <div className="theme-info">
                                <h3>{theme.name}</h3>
                                <p>{theme.mood}</p>
                            </div>
                            {selectedTheme === key && (
                                <div className="selected-badge">✓</div>
                            )}
                        </div>
                    ))}
                </div>
                ) : (
                    <div className="account-settings">
                        <div className="account-section">
                            <h3>Change Email</h3>
                            <form onSubmit={handleEmailChange} className="settings-form">
                                <div className="form-group">
                                    <label>New Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder={currentUser?.email ? maskEmail(currentUser.email) : 'Enter new email'}
                                        required
                                    />
                                </div>
                                <button type="submit" className="settings-btn primary">
                                    Update Email
                                </button>
                            </form>
                        </div>

                        <div className="account-section">
                            <h3>Change Password</h3>
                            <form onSubmit={handlePasswordChange} className="settings-form">
                                <div className="form-group">
                                    <label>Current Password</label>
                                    <input
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder="Enter current password"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>New Password</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Enter new password"
                                            required
                                            minLength="6"
                                        />
                                        <button
                                            type="button"
                                            className="toggle-password"
                                            onClick={() => setShowPassword(!showPassword)}
                                            title={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                    <line x1="1" y1="1" x2="23" y2="23" />
                                                </svg>
                                            ) : (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Confirm New Password</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Confirm new password"
                                            required
                                            minLength="6"
                                        />
                                        <button
                                            type="button"
                                            className="toggle-password"
                                            onClick={() => setShowPassword(!showPassword)}
                                            title={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                    <line x1="1" y1="1" x2="23" y2="23" />
                                                </svg>
                                            ) : (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <button type="submit" className="settings-btn primary">
                                    Update Password
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Settings;
