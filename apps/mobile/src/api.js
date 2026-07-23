import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from './EventEmitter';

// Toggle this variable to switch between Live (Production) and Dev environments
const IS_PROD = true;

const API_URL = IS_PROD
    ? 'http://13.60.38.177:5000/api'
    : 'http://localhost:5000/api';

const CDN_BASE = 'https://d1myo5rqh6nvkz.cloudfront.net/themes/backgrounds';

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Add token to requests
api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 with refresh token
let autoLoginPromise = null;
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const isAuthRequest = originalRequest.url && (
            originalRequest.url.includes('/auth/login') ||
            originalRequest.url.includes('/auth/verify-otp') ||
            originalRequest.url.includes('/auth/refresh')
        );

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
            originalRequest._retry = true;
            const refreshToken = await AsyncStorage.getItem('refreshToken');

            if (refreshToken) {
                try {
                    if (!autoLoginPromise) {
                        autoLoginPromise = api.post('/auth/refresh', { refreshToken })
                            .then(async (response) => {
                                const { token, refreshToken: newRefreshToken, user } = response.data;
                                await AsyncStorage.setItem('token', token);
                                if (newRefreshToken) await AsyncStorage.setItem('refreshToken', newRefreshToken);
                                await AsyncStorage.setItem('user', JSON.stringify(user));
                                EventEmitter.emit('authChange');
                                return token;
                            })
                            .finally(() => { autoLoginPromise = null; });
                    }
                    const newToken = await autoLoginPromise;
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    const status = refreshError.response?.status;
                    if (status === 401 || status === 403) {
                        await AsyncStorage.multiRemove(['token', 'user', 'refreshToken']);
                        EventEmitter.emit('authChange');
                    }
                    return Promise.reject(error);
                }
            } else {
                const hasToken = !!(await AsyncStorage.getItem('token'));
                if (hasToken) {
                    await AsyncStorage.multiRemove(['token', 'user']);
                    EventEmitter.emit('authChange');
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
    search: (q) => api.get('/users/search', { params: { q } }),
    getById: (userId) => api.get(`/users/${userId}`),
    updateProfile: (data) => api.patch('/users/profile', data),
    uploadAvatar: (formData) => api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
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
    uploadFile: (formData) => api.post('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    markAsRead: (messageId, conversationId) => api.patch(`/messages/${messageId}/read`, { conversationId }),
    getUnreadCountsByConversation: () => api.get('/messages/unread-counts-by-conversation'),
    deleteMessage: (messageId, conversationId, scope = 'everyone') =>
        api.delete(`/messages/${messageId}`, { data: { conversationId, scope } }),
    getMessageInfo: (messageId, conversationId) => api.get(`/messages/${messageId}/info`, { params: { conversationId } }),
    pinMessage: (messageId, conversationId) => api.patch(`/messages/${messageId}/pin`, { conversationId }),
    getPinnedMessages: (params) => api.get('/messages/pinned', { params }),
    reactToMessage: (messageId, conversationId, emoji) => api.patch(`/messages/${messageId}/react`, { conversationId, emoji }),
};

// Files API
export const filesAPI = {
    upload: (formData) => api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    getFile: (fileId) => api.get(`/files/${fileId}`),
    getDownloadUrl: (fileId) => api.get(`/files/${fileId}/download`),
    forward: (fileId) => api.post(`/files/${fileId}/forward`),
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
    getInvites: () => api.get('/groups/invites'),
    acceptInvite: (inviteId) => api.patch(`/groups/invites/${inviteId}/accept`),
    declineInvite: (inviteId) => api.patch(`/groups/invites/${inviteId}/decline`),
};

// Friends API
export const friendsAPI = {
    getAll: () => api.get('/friends'),
    getRequests: () => api.get('/friends/requests'),
    getSent: () => api.get('/friends/sent'),
    getStatus: (userId) => api.get(`/friends/status/${userId}`),
    sendRequest: (userId) => api.post(`/friends/request/${userId}`),
    acceptRequest: (requestId) => api.patch(`/friends/request/${requestId}/accept`),
    declineRequest: (requestId) => api.patch(`/friends/request/${requestId}/decline`),
    remove: (userId) => api.delete(`/friends/${userId}`),
};

// Themes API
export const themesAPI = {
    getConversationTheme: (otherId) => api.get(`/themes/conversation/${otherId}`),
    setConversationTheme: (otherId, theme) => api.put(`/themes/conversation/${otherId}`, { theme }),
    getGroupTheme: (groupId) => api.get(`/themes/group/${groupId}`),
    setGroupTheme: (groupId, theme) => api.put(`/themes/group/${groupId}`, { theme }),
};

// Tasks API — view tasks and respond to permission requests (mobile: read-only)
export const tasksAPI = {
    getByConversation: (conversationId) =>
        api.get(`/ai/tasks/${conversationId}`),
    update: (taskId, data) =>
        api.patch(`/ai/tasks/${taskId}`, data),
};

export { API_URL, CDN_BASE };
export default api;
