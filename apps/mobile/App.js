import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

import { useAuth } from './src/hooks/useAuth';
import { useSocket } from './src/hooks/useSocket';
import { friendsAPI, groupsAPI, messagesAPI } from './src/api';
import { Colors } from './src/theme';

import AuthScreen from './src/screens/AuthScreen';
import ChatsScreen from './src/screens/ChatsScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import ChatScreen from './src/screens/ChatScreen';
import FriendRequestsScreen from './src/screens/FriendRequestsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TasksScreen from './src/screens/TasksScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/* ─── Bottom Tab Navigator ─────────────────────────────────────── */
function HomeTabs({ friends, groups, onlineUsers, unreadCounts, socket,
    currentUser, friendRequestCount, onRefreshFriends, onRefreshGroups,
    onSelectChat, logout, updateUser, selectedChat }) {

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: Colors.bgSecondary,
                    borderTopColor: Colors.borderPrimary,
                    borderTopWidth: 1,
                    height: 60,
                    paddingBottom: 6,
                    paddingTop: 6,
                },
                tabBarActiveTintColor: Colors.accentPrimary,
                tabBarInactiveTintColor: Colors.textTertiary,
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            }}
        >
            <Tab.Screen
                name="Chats"
                options={{
                    tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💬</Text>,
                    tabBarBadge: Object.values(unreadCounts).reduce((a, b) => a + b, 0) || undefined,
                }}
            >
                {(props) => (
                    <ChatsScreen
                        {...props}
                        friends={friends}
                        onlineUsers={onlineUsers}
                        unreadCounts={unreadCounts}
                        onRefreshFriends={onRefreshFriends}
                        socket={socket}
                    />
                )}
            </Tab.Screen>
            <Tab.Screen
                name="Groups"
                options={{
                    tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👥</Text>,
                }}
            >
                {(props) => (
                    <GroupsScreen
                        {...props}
                        groups={groups}
                        unreadCounts={unreadCounts}
                        friends={friends}
                        currentUser={currentUser}
                        onRefreshGroups={onRefreshGroups}
                    />
                )}
            </Tab.Screen>
            <Tab.Screen
                name="Requests"
                options={{
                    tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔔</Text>,
                    tabBarBadge: friendRequestCount || undefined,
                }}
            >
                {(props) => (
                    <FriendRequestsScreen
                        {...props}
                        socket={socket}
                        currentUser={currentUser}
                        onFriendAdded={onRefreshFriends}
                    />
                )}
            </Tab.Screen>
            <Tab.Screen
                name="Tasks"
                options={{
                    tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>✅</Text>,
                }}
            >
                {() => (
                    <TasksScreen
                        currentUser={currentUser}
                        socket={socket}
                        selectedChat={selectedChat}
                    />
                )}
            </Tab.Screen>
            <Tab.Screen
                name="Profile"
                options={{
                    tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
                }}
            >
                {(props) => (
                    <ProfileScreen
                        {...props}
                        currentUser={currentUser}
                        logout={logout}
                        updateUser={updateUser}
                        socket={socket}
                    />
                )}
            </Tab.Screen>
        </Tab.Navigator>
    );
}

/* ─── Main App ─────────────────────────────────────────────────── */
export default function App() {
    const { user, token, loading, isAuthenticated, login, logout, updateUser } = useAuth();
    const { socket, connected } = useSocket();

    const [friends, setFriends] = useState([]);
    const [groups, setGroups] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [unreadCounts, setUnreadCounts] = useState({});
    const [friendRequestCount, setFriendRequestCount] = useState(0);
    const [selectedChat, setSelectedChat] = useState(null);
    const [appState, setAppState] = useState(AppState.currentState);

    const selectedChatRef = useRef(null);

    // Track app state
    useEffect(() => {
        const sub = AppState.addEventListener('change', (next) => setAppState(next));
        return () => sub.remove();
    }, []);

    // Fetch data when authenticated
    useEffect(() => {
        if (isAuthenticated) {
            fetchFriends();
            fetchGroups();
            fetchUnreadCounts();
            fetchFriendRequestCount();
        }
    }, [isAuthenticated]);

    // Socket events
    useEffect(() => {
        if (!socket) return;

        socket.on('users:online:list', ({ onlineUsers: list }) => {
            setOnlineUsers(new Set(list));
        });
        socket.on('user:online', ({ userId }) => {
            setOnlineUsers(prev => new Set(prev).add(userId));
        });
        socket.on('user:offline', ({ userId }) => {
            setOnlineUsers(prev => {
                const s = new Set(prev); s.delete(userId); return s;
            });
        });

        socket.on('message:receive', (message) => {
            const current = selectedChatRef.current;
            const isActive = appState === 'active' && current?.type === 'user' && current?.id === message.senderId;
            if (!isActive) {
                setUnreadCounts(prev => ({
                    ...prev,
                    [message.senderId]: (prev[message.senderId] || 0) + 1
                }));
            }
        });

        socket.on('group:message:receive', (message) => {
            const current = selectedChatRef.current;
            const isActive = appState === 'active' && current?.type === 'group' && current?.id === message.groupId;
            if (!isActive) {
                setUnreadCounts(prev => ({
                    ...prev,
                    [message.groupId]: (prev[message.groupId] || 0) + 1
                }));
            }
        });

        socket.on('friend:request:received', () => {
            setFriendRequestCount(prev => prev + 1);
        });

        socket.on('friend:request:was_accepted', () => {
            fetchFriends();
        });

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
            socket.off('group:member:joined');
        };
    }, [socket, appState]);

    const fetchFriends = async () => {
        try { const r = await friendsAPI.getAll(); setFriends(r.data.friends || []); } catch {}
    };
    const fetchGroups = async () => {
        try { const r = await groupsAPI.getAll(); setGroups(r.data.groups || []); } catch {}
    };
    const fetchUnreadCounts = async () => {
        try { const r = await messagesAPI.getUnreadCountsByConversation(); setUnreadCounts(r.data.unreadCounts || {}); } catch {}
    };
    const fetchFriendRequestCount = async () => {
        try { const r = await friendsAPI.getRequests(); setFriendRequestCount((r.data.requests || []).length); } catch {}
    };

    const handleSelectChat = (chat) => {
        selectedChatRef.current = chat;
        setSelectedChat(chat);
        setUnreadCounts(prev => {
            if (!prev[chat.id]) return prev;
            const updated = { ...prev };
            delete updated[chat.id];
            return updated;
        });
    };

    if (loading) {
        return (
            <View style={styles.loading}>
                <StatusBar style="light" />
                <ActivityIndicator size="large" color={Colors.accentPrimary} />
                <Text style={styles.loadingText}>Loading Vatu…</Text>
            </View>
        );
    }

    const navTheme = {
        ...DarkTheme,
        colors: {
            ...DarkTheme.colors,
            background: Colors.bgPrimary,
            card: Colors.bgSecondary,
            border: Colors.borderPrimary,
            primary: Colors.accentPrimary,
            text: Colors.textPrimary,
        },
    };

    return (
        <SafeAreaProvider>
            <StatusBar style="light" />
            <NavigationContainer theme={navTheme}>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    {!isAuthenticated ? (
                        <Stack.Screen name="Auth" component={AuthScreen} />
                    ) : (
                        <>
                            <Stack.Screen name="Home">
                                {(props) => (
                                    <HomeTabs
                                        {...props}
                                        friends={friends}
                                        groups={groups}
                                        onlineUsers={onlineUsers}
                                        unreadCounts={unreadCounts}
                                        socket={socket}
                                        currentUser={user}
                                        friendRequestCount={friendRequestCount}
                                        onRefreshFriends={fetchFriends}
                                        onRefreshGroups={fetchGroups}
                                        onSelectChat={handleSelectChat}
                                        logout={logout}
                                        updateUser={updateUser}
                                        selectedChat={selectedChat}
                                    />
                                )}
                            </Stack.Screen>
                            <Stack.Screen
                                name="Chat"
                                options={{
                                    animation: 'slide_from_right',
                                }}
                            >
                                {(props) => (
                                    <ChatScreen
                                        {...props}
                                        currentUser={user}
                                        socket={socket}
                                        onlineUsers={onlineUsers}
                                        onRefreshGroups={fetchGroups}
                                        onSelectChat={handleSelectChat}
                                    />
                                )}
                            </Stack.Screen>
                            <Stack.Screen
                                name="Settings"
                                options={{ animation: 'slide_from_right' }}
                            >
                                {(props) => (
                                    <SettingsScreen {...props} currentUser={user} />
                                )}
                            </Stack.Screen>
                        </>
                    )}
                </Stack.Navigator>
            </NavigationContainer>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        backgroundColor: Colors.bgPrimary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: Colors.textSecondary,
        marginTop: 16,
        fontSize: 16,
    },
});
