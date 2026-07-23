import React, { useState, useEffect, useRef } from 'react';
import { themesAPI } from '@chat-app/shared/api';
import './ConversationThemePicker.css';

// CDN base URL — mirrors Settings.jsx
const CDN_BASE = import.meta.env.VITE_CDN_URL
    ? `https://${import.meta.env.VITE_CDN_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')}/themes/backgrounds`
    : '/assets/backgrounds';

export const THEMES = {
    dark: {
        name: '🌙 Dark',
        bgImage: `url(${CDN_BASE}/dark.png)`,
        bgColor: '#0f0c1a',
        accent: '#8b5cf6',
        sent: '#6366f1',
        received: '#27272a',
        preview: 'linear-gradient(135deg, #1a1a2e, #16213e)'
    },
    chill: {
        name: '🌊 Chill',
        bgImage: `url(${CDN_BASE}/chill.png)`,
        bgColor: '#0a1520',
        accent: '#06b6d4',
        sent: '#06b6d4',
        received: '#1e3a4a',
        preview: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)'
    },
    nature: {
        name: '🌿 Nature',
        bgImage: `url(${CDN_BASE}/nature.png)`,
        bgColor: '#0a150a',
        accent: '#10b981',
        sent: '#10b981',
        received: '#1a2f1e',
        preview: 'linear-gradient(135deg, #1a2a1a, #2d4a2d)'
    },
    sunset: {
        name: '🌅 Sunset',
        bgImage: `url(${CDN_BASE}/sunset.png)`,
        bgColor: '#1a0800',
        accent: '#f97316',
        sent: '#f97316',
        received: '#2d1a0f',
        preview: 'linear-gradient(135deg, #1a0a00, #3d1c02, #f97316)'
    },
    valentine: {
        name: '💕 Valentine',
        bgImage: `url(${CDN_BASE}/valentine.png)`,
        bgColor: '#1a0010',
        accent: '#ec4899',
        sent: '#ec4899',
        received: '#2d1020',
        preview: 'linear-gradient(135deg, #1a0010, #3d0020, #ec4899)'
    },
    school: {
        name: '📚 School',
        bgImage: `url(${CDN_BASE}/school.png)`,
        bgColor: '#0a1020',
        accent: '#3b82f6',
        sent: '#3b82f6',
        received: '#0f1e3a',
        preview: 'linear-gradient(135deg, #0f172a, #1e3a5f)'
    },
};

/**
 * Applies theme CSS variables directly to :root.
 * Uses --chat-bg-image and --chat-bg-color (separate props so browser
 * doesn't reset background-size/position via the background shorthand).
 */
export function applyConversationTheme(themeName) {
    const theme = THEMES[themeName];
    if (!theme) return;
    const root = document.documentElement;
    root.style.setProperty('--chat-bg-image', theme.bgImage);
    root.style.setProperty('--chat-bg-color', theme.bgColor);
    root.style.setProperty('--accent-primary', theme.accent);
    root.style.setProperty('--message-sent', theme.sent);
    root.style.setProperty('--message-received', theme.received);
}

/**
 * ConversationThemePicker
 * Props:
 *   selectedChat  – { id, type: 'user'|'group', data }
 *   currentUser   – current user object
 *   socket        – socket.io instance
 *   onThemeChange – optional callback(themeName)
 */
export default function ConversationThemePicker({ selectedChat, currentUser, socket, onThemeChange }) {
    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState('dark');
    const [applying, setApplying] = useState(null);
    const [notification, setNotification] = useState(null);
    const panelRef = useRef(null);
    const notifTimerRef = useRef(null);

    // Conversation key for localStorage
    const convKey = selectedChat
        ? selectedChat.type === 'user'
            ? `conv-theme:${[currentUser?.id || currentUser?._id, selectedChat.id].sort().join('-')}`
            : `conv-theme:group:${selectedChat.id}`
        : null;

    // Load theme from server when conversation changes
    useEffect(() => {
        if (!selectedChat) return;
        let cancelled = false;

        // Optimistic: restore from localStorage immediately (no flash)
        const saved = convKey && localStorage.getItem(convKey);
        if (saved) {
            setCurrent(saved);
            applyConversationTheme(saved);
        } else {
            // Reset to dark default while loading
            applyConversationTheme('dark');
        }

        const load = async () => {
            try {
                const res = selectedChat.type === 'user'
                    ? await themesAPI.getConversationTheme(selectedChat.id)
                    : await themesAPI.getGroupTheme(selectedChat.id);
                if (!cancelled) {
                    const t = res.data?.theme || 'dark';
                    setCurrent(t);
                    applyConversationTheme(t);
                    if (convKey) localStorage.setItem(convKey, t);
                }
            } catch (err) {
                // API failed — keep localStorage value or default
                console.error('Failed to load conversation theme:', err);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [selectedChat?.id, selectedChat?.type]);

    // Listen for real-time theme updates from socket
    useEffect(() => {
        if (!socket || !selectedChat) return;

        const handler = ({ theme, conversationKey, changedByName }) => {
            console.log('Theme socket event received in picker:', { theme, conversationKey, changedByName });
            
            if (conversationKey !== convKey) {
                console.log('Theme key mismatch in picker, ignoring event. Expected:', convKey, 'Received:', conversationKey);
                return;
            }

            console.log('Applying theme from socket event:', theme);
            setCurrent(theme);
            applyConversationTheme(theme);
            if (convKey) {
                localStorage.setItem(convKey, theme);
            }
            showNotif(`Theme changed to ${THEMES[theme]?.name || theme} by ${changedByName || 'someone'}`);
        };

        socket.on('conversation:theme:changed', handler);
        return () => {
            socket.off('conversation:theme:changed', handler);
        };
    }, [socket, selectedChat?.id, selectedChat?.type, convKey]);

    // Close panel on outside click
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const showNotif = (text) => {
        setNotification(text);
        if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
        notifTimerRef.current = setTimeout(() => setNotification(null), 2500);
    };

    const handleSelect = async (themeName) => {
        if (themeName === current) { setOpen(false); return; }

        console.log('ConversationThemePicker theme selected:', themeName, {
            chatId: selectedChat.id,
            chatType: selectedChat.type,
            convKey
        });

        // Apply immediately — optimistic update
        setCurrent(themeName);
        applyConversationTheme(themeName);
        if (convKey) localStorage.setItem(convKey, themeName);
        setApplying(themeName);
        setOpen(false);

        try {
            if (selectedChat.type === 'user') {
                await themesAPI.setConversationTheme(selectedChat.id, themeName);
                console.log('Emitting conversation:theme:changed via socket to recipient:', selectedChat.id);
                socket?.emit('conversation:theme:changed', {
                    recipientId: selectedChat.id,
                    theme: themeName,
                    conversationKey: convKey,
                    changedByName: currentUser?.username
                });
            } else {
                await themesAPI.setGroupTheme(selectedChat.id, themeName);
                
                // Map the members correctly extracting the user ID from each member object
                const memberIds = (selectedChat.data?.members || []).map(m => {
                    const u = m.user;
                    if (!u) return null;
                    return typeof u === 'object' 
                        ? (u._id?.toString() || u.id?.toString() || u.toString()) 
                        : u.toString();
                }).filter(Boolean);

                console.log('Emitting group:theme:changed to members:', memberIds);
                socket?.emit('group:theme:changed', {
                    memberIds,
                    theme: themeName,
                    groupId: selectedChat.id,
                    changedByName: currentUser?.username
                });
            }
            showNotif(`Theme → ${THEMES[themeName]?.name}`);
            onThemeChange?.(themeName);
        } catch (err) {
            console.error('Failed to save theme:', err);
            showNotif('Failed to save theme');
        } finally {
            setApplying(null);
        }
    };

    if (!selectedChat) return null;

    return (
        <div className="ctp-wrapper" ref={panelRef}>
            {/* Trigger */}
            <button
                className={`ctp-trigger header-action-btn ${open ? 'active' : ''}`}
                onClick={() => setOpen(o => !o)}
                title="Change conversation theme"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"/>
                    <circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
                    <circle cx="9.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/>
                    <circle cx="14.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/>
                    <circle cx="17.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
                </svg>
                <span
                    className="ctp-swatch"
                    style={{ background: THEMES[current]?.preview || '#6366f1' }}
                />
            </button>

            {/* Panel */}
            {open && (
                <div className="ctp-panel">
                    <div className="ctp-panel-header">
                        <span>🎨 Conversation Theme</span>
                        <p>Both users see the change instantly</p>
                    </div>
                    <div className="ctp-grid">
                        {Object.entries(THEMES).map(([key, theme]) => (
                            <button
                                key={key}
                                className={`ctp-card ${current === key ? 'selected' : ''} ${applying === key ? 'applying' : ''}`}
                                onClick={() => handleSelect(key)}
                                title={theme.name}
                            >
                                <div
                                    className="ctp-card-preview"
                                    style={{ background: theme.preview }}
                                >
                                    <div className="ctp-bubble ctp-bubble-r" style={{ background: theme.sent }} />
                                    <div className="ctp-bubble ctp-bubble-l" style={{ background: theme.received }} />
                                    {applying === key && <div className="ctp-card-spinner" />}
                                </div>
                                <span className="ctp-card-label">{theme.name}</span>
                                {current === key && (
                                    <span className="ctp-check">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <polyline points="20 6 9 17 4 12"/>
                                        </svg>
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Toast */}
            {notification && (
                <div className="ctp-toast">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {notification}
                </div>
            )}
        </div>
    );
}
