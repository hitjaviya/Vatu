import React, { useState, useEffect } from 'react';
import { useAuth } from '@chat-app/shared/hooks/useAuth';
import { usersAPI, groupsAPI, messagesAPI } from '@chat-app/shared/api';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import Settings from './Settings';
import './ChatLayout.css';

function ChatLayout({ socket, connected }) {
    const { user, logout } = useAuth();
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [unreadCounts, setUnreadCounts] = useState({});
    const [showSettings, setShowSettings] = useState(false);
    const [isWindowFocused, setIsWindowFocused] = useState(true);

    // Fetch users and groups
    useEffect(() => {
        fetchUsers();
        fetchGroups();
        fetchUnreadCounts();
    }, []);

    // Track window focus state
    useEffect(() => {
        const handleFocus = () => setIsWindowFocused(true);
        const handleBlur = () => setIsWindowFocused(false);

        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    // Socket event listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('users:online:list', ({ onlineUsers }) => {
            setOnlineUsers(new Set(onlineUsers));
        });

        socket.on('user:online', ({ userId }) => {
            setOnlineUsers(prev => new Set(prev).add(userId));
        });

        socket.on('user:offline', ({ userId }) => {
            setOnlineUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        });

        // Listen for new messages to update unread counts
        socket.on('message:receive', (message) => {
            // Increment unread count if window is not focused OR this conversation is not currently open
            if (!isWindowFocused || !selectedChat || selectedChat.id !== message.senderId || selectedChat.type !== 'user') {
                setUnreadCounts(prev => ({
                    ...prev,
                    [message.senderId]: (prev[message.senderId] || 0) + 1
                }));
            }
        });

        socket.on('group:message:receive', (message) => {
            // Increment unread count if window is not focused OR this group is not currently open
            if (!isWindowFocused || !selectedChat || selectedChat.id !== message.groupId || selectedChat.type !== 'group') {
                setUnreadCounts(prev => ({
                    ...prev,
                    [message.groupId]: (prev[message.groupId] || 0) + 1
                }));
            }
        });

        return () => {
            socket.off('users:online:list');
            socket.off('user:online');
            socket.off('user:offline');
            socket.off('message:receive');
            socket.off('group:message:receive');
        };
    }, [socket, selectedChat, isWindowFocused]);

    const fetchUsers = async () => {
        try {
            const response = await usersAPI.getAll();
            setUsers(response.data.users);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchGroups = async () => {
        try {
            const response = await groupsAPI.getAll();
            setGroups(response.data.groups);
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    };

    const fetchUnreadCounts = async () => {
        try {
            const response = await messagesAPI.getUnreadCountsByConversation();
            setUnreadCounts(response.data.unreadCounts || {});
        } catch (error) {
            console.error('Error fetching unread counts:', error);
        }
    };

    const handleSelectChat = async (chat) => {
        setSelectedChat(chat);

        // Clear unread count for this chat immediately (optimistic update)
        setUnreadCounts(prev => {
            const updated = { ...prev };
            delete updated[chat.id];
            return updated;
        });

        // Mark all messages in this conversation as read
        try {
            if (chat.type === 'user') {
                await messagesAPI.markConversationAsRead(chat.id, null);
            } else {
                await messagesAPI.markConversationAsRead(null, chat.id);
            }
        } catch (error) {
            console.error('Error marking conversation as read:', error);
        }
    };

    const handleLogout = () => {
        if (socket) {
            socket.disconnect();
        }
        logout();
    };

    return (
        <div className="chat-layout">
            <Sidebar
                currentUser={user}
                users={users}
                groups={groups}
                selectedChat={selectedChat}
                onSelectChat={handleSelectChat}
                onLogout={handleLogout}
                onlineUsers={onlineUsers}
                connected={connected}
                unreadCounts={unreadCounts}
                onRefreshGroups={fetchGroups}
                onOpenSettings={() => setShowSettings(true)}
            />

            <ChatWindow
                selectedChat={selectedChat}
                currentUser={user}
                socket={socket}
                onRefreshGroups={fetchGroups}
            />

            <Settings 
                isOpen={showSettings} 
                onClose={() => setShowSettings(false)}
                currentUser={user}
            />
        </div>
    );
}

export default ChatLayout;
