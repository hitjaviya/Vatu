import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

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

// Auth API
export const authAPI = {
    register: (userData) => api.post('/auth/register', userData),
    login: (credentials) => api.post('/auth/login', credentials),
};

// Users API
export const usersAPI = {
    getAll: () => api.get('/users'),
    getById: (userId) => api.get(`/users/${userId}`),
    updateProfile: (data) => api.patch('/users/profile', data),
    updateStatus: (status) => api.patch('/users/status', { status }),
};

// Messages API
export const messagesAPI = {
    getConversation: (userId, params) => api.get(`/messages/conversation/${userId}`, { params }),
    send: (messageData) => api.post('/messages/send', messageData),
    sendFile: (formData) => api.post('/messages/send-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    uploadFile: (formData) => api.post('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    markAsRead: (messageId) => api.patch(`/messages/${messageId}/read`),
    markConversationAsRead: (userId, groupId) => api.post('/messages/mark-conversation-read', { userId, groupId }),
    getUnreadCountsByConversation: () => api.get('/messages/unread-counts-by-conversation'),
};

// Groups API
export const groupsAPI = {
    getAll: () => api.get('/groups'),
    getById: (groupId) => api.get(`/groups/${groupId}`),
    create: (groupData) => api.post('/groups', groupData),
    update: (groupId, data) => api.patch(`/groups/${groupId}`, data),
    getMessages: (groupId, params) => api.get(`/groups/${groupId}/messages`, { params }),
    addMember: (groupId, userId) => api.post(`/groups/${groupId}/members`, { userId }),
    removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`),
};

export default api;
