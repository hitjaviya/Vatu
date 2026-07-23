// Design tokens matching desktop index.css
export const Colors = {
    bgPrimary: '#0f0f0f',
    bgSecondary: '#1a1a1a',
    bgTertiary: '#242424',
    bgHover: '#2a2a2a',
    bgActive: '#323232',

    accentPrimary: '#6366f1',
    accentPrimaryHover: '#4f46e5',
    accentSecondary: '#8b5cf6',

    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textTertiary: '#71717a',

    borderPrimary: '#27272a',
    borderSecondary: '#3f3f46',

    statusOnline: '#10b981',
    statusAway: '#f59e0b',
    statusOffline: '#6b7280',

    messageSent: '#6366f1',
    messageReceived: '#27272a',

    error: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
};

export const Radius = {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
};

export const FontSize = {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    title: 28,
};

export const getInitials = (name = '') =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

export const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const getFileIcon = (fileName) => {
    if (!fileName) return '📎';
    const ext = fileName.split('.').pop().toLowerCase();
    const map = {
        pdf: '📄', doc: '📝', docx: '📝', txt: '📝',
        xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊',
        zip: '📦', rar: '📦',
        jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
        mp4: '🎥', mp3: '🎵', wav: '🎵'
    };
    return map[ext] || '📎';
};

import { API_URL } from './api';

export const getFullFileUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const baseUrl = API_URL.replace(/\/api$/, '');
    return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
};

export const ALL_EMOJIS = [
    '😀','😂','😍','🥰','😎','🤔','😢','😡','👍','👎',
    '❤️','🔥','🎉','👏','💪','🙏','😊','🤗','😘','🥳',
    '😱','💀','👀','✨','💯','🫡','🤝','💔','😤','🫶',
];
