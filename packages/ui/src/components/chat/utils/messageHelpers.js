// ============================================================
// messageHelpers.js — pure utility functions (no React)
// ============================================================

export const normalizeMessage = (msg) => {
    const senderId = msg.senderId || (typeof msg.sender === 'object' ? msg.sender._id : msg.sender);
    return {
        ...msg,
        senderId,
        senderData: typeof msg.sender === 'object' ? msg.sender : null
    };
};

export const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const getFileIcon = (fileName) => {
    if (!fileName) return '📎';
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
        pdf: '📄', doc: '📝', docx: '📝', txt: '📝', csv: '📝',
        xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊',
        zip: '📦', rar: '📦', '7z': '📦',
        jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
        mp4: '🎥', mkv: '🎥', avi: '🎥',
        mp3: '🎵', wav: '🎵', ogg: '🎵', aac: '🎵', flac: '🎵'
    };
    return iconMap[ext] || '📎';
};

export const getInitials = (name) =>
    name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

export const getFullFileUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const baseUrl = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace('/api', '')
        : 'http://localhost:5000';
    const formattedUrl = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${formattedUrl}`;
};

export const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const ALL_EMOJIS = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
    '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
    '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵',
    '🥶', '😱', '🤫', '😐', '😑', '😬', '🙄', '💀', '💩', '👍',
    '👎', '👊', '👋', '👏', '🙌', '🙏', '❤️', '🔥', '✨'
];
