import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@chat-app/shared/hooks/useAuth';
import { usersAPI, groupsAPI, messagesAPI, friendsAPI } from '@chat-app/shared/api';
import Sidebar from './Sidebar';
import AppSidebar from './AppSidebar';
import ChatWindow from './ChatWindow';
import TasksPanel from './TasksPanel';
import Settings from './Settings';
import FriendRequestsPanel from './FriendRequestsPanel';
import GroupInviteModal from './chat/modals/GroupInviteModal';
import UserInfoModal from './chat/modals/UserInfoModal';
import './ChatLayout.css';

function ChatLayout({ socket, connected }) {
    const { user, logout } = useAuth();
    const [friends, setFriends] = useState([]);
    const [groups, setGroups] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [unreadCounts, setUnreadCounts] = useState({});
    const [showSettings, setShowSettings] = useState(false);
    const [showMyProfile, setShowMyProfile] = useState(false);
    const [showTasksPanel, setShowTasksPanel] = useState(false);
    const [isWindowFocused, setIsWindowFocused] = useState(true);

    // Friend requests panel
    const [showFriendRequests, setShowFriendRequests] = useState(false);
    const [friendRequestCount, setFriendRequestCount] = useState(0);

    // Group invite queue (FIFO — show one at a time)
    const [pendingGroupInvites, setPendingGroupInvites] = useState([]);

    // Refs to avoid stale closures in socket handlers
    const selectedChatRef = useRef(null);
    const isWindowFocusedRef = useRef(true);

    // Keep refs in sync with state
    useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);
    useEffect(() => { isWindowFocusedRef.current = isWindowFocused; }, [isWindowFocused]);

    // Fetch friends and groups
    useEffect(() => {
        fetchFriends();
        fetchGroups();
        fetchUnreadCounts();
        fetchFriendRequestCount();
        fetchPendingGroupInvites();
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

        // Listen for new messages
        socket.on('message:receive', (message) => {
            const currentChat = selectedChatRef.current;
            const focused = isWindowFocusedRef.current;
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
            const isActiveChat = focused && currentChat && currentChat.type === 'group' && currentChat.id === message.groupId;
            if (!isActiveChat) {
                setUnreadCounts(prev => ({
                    ...prev,
                    [message.groupId]: (prev[message.groupId] || 0) + 1
                }));
            }
        });

        // Real-time friend request notification
        socket.on('friend:request:received', () => {
            setFriendRequestCount(prev => prev + 1);
        });

        // Refresh friends list when our sent request gets accepted
        socket.on('friend:request:was_accepted', () => {
            fetchFriends();
        });

        // Real-time group invite
        socket.on('group:invite:received', ({ invite }) => {
            if (invite) {
                setPendingGroupInvites(prev => [...prev, invite]);
            }
        });

        // When someone accepts our invite — refresh groups
        socket.on('group:member:joined', () => {
            fetchGroups();
        });

        return () => {
            socket.off('users:online:list');
            socket.off('user:online');
            socket.off('user:offline');
            socket.off('message:receive');
            socket.off('group:message:receive');
            socket.off('friend:request:received');
            socket.off('friend:request:was_accepted');
            socket.off('group:invite:received');
            socket.off('group:member:joined');
        };
    }, [socket]);

    const fetchFriends = async () => {
        try {
            const res = await friendsAPI.getAll();
            setFriends(res.data.friends || []);
        } catch (error) {
            console.error('Error fetching friends:', error);
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

    const fetchFriendRequestCount = async () => {
        try {
            const res = await friendsAPI.getRequests();
            setFriendRequestCount((res.data.requests || []).length);
        } catch {
            setFriendRequestCount(0);
        }
    };

    const fetchPendingGroupInvites = async () => {
        try {
            const res = await groupsAPI.getInvites();
            setPendingGroupInvites(res.data.invites || []);
        } catch {
            // ignore
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

    // When user accepts a group invite — refresh group list, dismiss modal
    const handleGroupInviteAccept = (newGroup) => {
        setPendingGroupInvites(prev => prev.slice(1));
        fetchGroups();
    };

    const handleGroupInviteDecline = () => {
        setPendingGroupInvites(prev => prev.slice(1));
    };

    return (
        <div className="chat-layout">
            <AppSidebar
                currentUser={user}
                connected={connected}
                friendRequestCount={friendRequestCount}
                activePanel={showTasksPanel ? 'tasks' : null}
                onOpenSettings={() => setShowSettings(true)}
                onOpenFriendRequests={() => setShowFriendRequests(true)}
                onOpenTasks={() => setShowTasksPanel(prev => !prev)}
                onAvatarClick={() => setShowMyProfile(true)}
                onLogout={handleLogout}
            />
            <Sidebar
                currentUser={user}
                friends={friends}
                groups={groups}
                selectedChat={selectedChat}
                onSelectChat={handleSelectChat}
                onlineUsers={onlineUsers}
                connected={connected}
                unreadCounts={unreadCounts}
                onRefreshGroups={fetchGroups}
                onRefreshFriends={fetchFriends}
                socket={socket}
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
                            return { ...prev, [chatId]: prev[chatId] - 1 };
                        }
                        return prev;
                    });
                }}
            />

            {showTasksPanel && (
                <TasksPanel
                    currentUser={user}
                    selectedChat={selectedChat}
                    socket={socket}
                    onClose={() => setShowTasksPanel(false)}
                />
            )}

            <Settings
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                currentUser={user}
            />

            {/* Friend Requests Panel */}
            {showFriendRequests && (
                <FriendRequestsPanel
                    socket={socket}
                    currentUser={user}
                    onClose={() => {
                        setShowFriendRequests(false);
                        setFriendRequestCount(0);
                    }}
                    onFriendAdded={() => {
                        fetchFriends();
                        setFriendRequestCount(prev => Math.max(0, prev - 1));
                    }}
                />
            )}

            {/* Group Invite Modal — show one invite at a time */}
            {pendingGroupInvites.length > 0 && (
                <GroupInviteModal
                    invite={pendingGroupInvites[0]}
                    onAccept={handleGroupInviteAccept}
                    onDecline={handleGroupInviteDecline}
                    onClose={handleGroupInviteDecline}
                />
            )}

            {/* Current User Profile Modal */}
            {showMyProfile && (
                <UserInfoModal
                    user={user}
                    currentUser={user}
                    socket={socket}
                    onClose={() => setShowMyProfile(false)}
                />
            )}
        </div>
    );
}

export default ChatLayout;
