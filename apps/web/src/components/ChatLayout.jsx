import React, { useState, useEffect, useRef } from 'react';
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

    // Refs to avoid stale closures in socket handlers
    const selectedChatRef = useRef(null);
    const isWindowFocusedRef = useRef(true);

    // Keep refs in sync with state
    useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);
    useEffect(() => { isWindowFocusedRef.current = isWindowFocused; }, [isWindowFocused]);

    // Fetch users and groups
    useEffect(() => {
        fetchUsers();
        fetchGroups();
        fetchUnreadCounts();
    }, []);

    // Track window focus state
    useEffect(() => {
        let blurTimeout = null;

        const handleFocus = () => {
            if (blurTimeout) {
                clearTimeout(blurTimeout);
                blurTimeout = null;
            }
            setIsWindowFocused(true);
        };

        const handleBlur = () => {
            if (blurTimeout) clearTimeout(blurTimeout);
            
            // Wait 1 minute (60,000ms) before transitioning to away/unfocused state
            blurTimeout = setTimeout(() => {
                setIsWindowFocused(false);
            }, 60000);
        };

        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);

        return () => {
            if (blurTimeout) clearTimeout(blurTimeout);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    // Socket event listeners — use refs to avoid stale closures
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

        // Listen for new messages — read refs, NOT stale closure state
        socket.on('message:receive', (message) => {
            const currentChat = selectedChatRef.current;
            const focused = isWindowFocusedRef.current;
            // Only increment unread if the chat is NOT currently open and focused
            const isActiveChat = focused && currentChat && currentChat.type === 'user' && currentChat.id === message.senderId;
            if (!isActiveChat) {
                setUnreadCounts(prev => ({
                    ...prev,
                    [message.senderId]: (prev[message.senderId] || 0) + 1
                }));
            }
        });

        socket.on('group:message:receive', (message) => {
            const currentChat = selectedChatRef.current;
            const focused = isWindowFocusedRef.current;
            // Only increment unread if the group is NOT currently open and focused
            const isActiveChat = focused && currentChat && currentChat.type === 'group' && currentChat.id === message.groupId;
            if (!isActiveChat) {
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
    }, [socket]); // only depends on socket — refs handle the rest!

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

        // Clear unread count immediately when selecting a chat
        setUnreadCounts(prev => {
            if (!prev[chat.id]) return prev;
            const updated = { ...prev };
            delete updated[chat.id];
            return updated;
        });
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
                isWindowFocused={isWindowFocused}
                onUnreadMessageRead={(chatId) => {
                    setUnreadCounts(prev => {
                        if (prev[chatId] && prev[chatId] > 0) {
                            return {
                                ...prev,
                                [chatId]: prev[chatId] - 1
                            };
                        }
                        return prev;
                    });
                }}
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
