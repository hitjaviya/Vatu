import axios from 'axios';

// Environment-based API URL using Vite environment variables
// Vite automatically loads .env.development or .env.production based on the build mode
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Keep track of any ongoing auto-login promise to avoid duplicate simultaneous requests
let autoLoginPromise = null;

// Handle 401 Unauthorized errors dynamically to prevent getting stuck with expired or invalid tokens
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Determine if the failed request itself is an auth endpoint to prevent infinite loops
        const isAuthRequest = originalRequest.url && (
            originalRequest.url.includes('/auth/login') ||
            originalRequest.url.includes('/auth/verify-otp') ||
            originalRequest.url.includes('/auth/refresh')
        );

        if (error.response && error.response.status === 401 && !originalRequest._retry && !isAuthRequest) {
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem('refreshToken');

            // If we have a saved refresh token, try to perform a silent token exchange
            if (refreshToken) {
                try {
                    console.log('Access token expired/invalid. Attempting dynamic silent refresh...');

                    if (!autoLoginPromise) {
                        autoLoginPromise = api.post('/auth/refresh', { refreshToken })
                            .then((response) => {
                                const { token, refreshToken: newRefreshToken, user } = response.data;
                                localStorage.setItem('token', token);
                                if (newRefreshToken) {
                                    localStorage.setItem('refreshToken', newRefreshToken);
                                }
                                localStorage.setItem('user', JSON.stringify(user));
                                window.dispatchEvent(new Event('authChange'));
                                return token;
                            })
                            .finally(() => {
                                autoLoginPromise = null;
                            });
                    }

                    const newToken = await autoLoginPromise;

                    // Update the failed request's auth header and retry
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    console.error('Silent refresh token exchange failed. Wiping auth state...', refreshError);

                    // Since the refresh token itself is dead or rejected, clear everything
                    const status = refreshError.response?.status;
                    if (status === 401 || status === 403) {
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        localStorage.removeItem('refreshToken');
                        // Legacy cleanup
                        localStorage.removeItem('email');
                        localStorage.removeItem('password');
                        window.dispatchEvent(new Event('authChange'));
                    }
                    return Promise.reject(error);
                }
            } else {
                // No refresh token, clear old/expired session and redirect to login
                console.warn('Unauthorized API request (401) with no stored refresh token. Clearing invalid session...');
                const hasToken = !!localStorage.getItem('token');
                if (hasToken) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.dispatchEvent(new Event('authChange'));
                }
            }
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    register: (userData) => api.post('/auth/register', userData),
    login: (credentials) => api.post('/auth/login', credentials),
    sendOtp: (email) => api.post('/auth/send-otp', { email }),
    verifyOtp: ({ userId, otp }) => api.post('/auth/verify-otp', { userId, otp }),
    refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
};

// Users API
export const usersAPI = {
    getAll: () => api.get('/users'),
    getById: (userId) => api.get(`/users/${userId}`),
    updateProfile: (data) => api.patch('/users/profile', data),
    updateStatus: (status) => api.patch('/users/status', { status }),
    changeEmail: (email) => api.patch('/users/change-email', { email }),
    changePassword: (currentPassword, newPassword) => api.patch('/users/change-password', { currentPassword, newPassword }),
};

// Messages API
export const messagesAPI = {
    getConversation: (userId, params) => api.get(`/messages/conversation/${userId}`, { params }),
    getLatestBucket: (userId) => api.get(`/messages/conversation/${userId}/latest-bucket`),
    getMessagesByBucket: (userId, bucketNumber) => api.get(`/messages/conversation/${userId}/bucket/${bucketNumber}`),
    send: (messageData) => api.post('/messages/send', messageData),
    sendFile: (formData) => api.post('/messages/send-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    uploadFile: (formData) => api.post('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    markAsRead: (messageId, conversationId) => api.patch(`/messages/${messageId}/read`, { conversationId }),
    markConversationAsRead: (userId, groupId) => api.post('/messages/mark-conversation-read', { userId, groupId }),
    getUnreadCountsByConversation: () => api.get('/messages/unread-counts-by-conversation'),
    deleteMessage: (messageId, conversationId, scope = 'everyone') =>
        api.delete(`/messages/${messageId}`, { data: { conversationId, scope } }),
    getMessageInfo: (messageId, conversationId) => api.get(`/messages/${messageId}/info`, { params: { conversationId } }),
    pinMessage: (messageId, conversationId) => api.patch(`/messages/${messageId}/pin`, { conversationId }),
    getPinnedMessages: (params) => api.get('/messages/pinned', { params }),
    reactToMessage: (messageId, conversationId, emoji) => api.patch(`/messages/${messageId}/react`, { conversationId, emoji }),
};

// Files API (AWS S3 file sharing)
export const filesAPI = {
    // Upload a file to S3 — returns { fileId, fileUrl, fileName, fileSize, type, sharedFileId }
    upload: (formData) => api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    // Get file metadata (who uploaded, name, size, type, download URL)
    getFile: (fileId) => api.get(`/files/${fileId}`),
    // Get a fresh presigned download URL (increments download count)
    getDownloadUrl: (fileId) => api.get(`/files/${fileId}/download`),
    // Forward a file to another user (increments share count, returns fresh URL)
    forward: (fileId) => api.post(`/files/${fileId}/forward`),
    // Delete a file from S3 (only original uploader can delete)
    delete: (fileId) => api.delete(`/files/${fileId}`),
};

// Groups API
export const groupsAPI = {
    getAll: () => api.get('/groups'),
    getById: (groupId) => api.get(`/groups/${groupId}`),
    create: (groupData) => api.post('/groups', groupData),
    update: (groupId, data) => api.patch(`/groups/${groupId}`, data),
    getMessages: (groupId, params) => api.get(`/groups/${groupId}/messages`, { params }),
    getLatestBucket: (groupId) => api.get(`/groups/${groupId}/latest-bucket`),
    getMessagesByBucket: (groupId, bucketNumber) => api.get(`/groups/${groupId}/bucket/${bucketNumber}`),
    addMember: (groupId, userId) => api.post(`/groups/${groupId}/members`, { userId }),
    removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`),
};

export default api;

