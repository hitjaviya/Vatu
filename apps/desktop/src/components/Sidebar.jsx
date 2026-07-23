import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usersAPI, friendsAPI } from '@chat-app/shared/api';
import CreateGroupModal from './CreateGroupModal';
import UserInfoModal from './chat/modals/UserInfoModal';
import './Sidebar.css';

/**
 * Sidebar
 * -------
 * Chats tab  — shows accepted friends. Top of the list has a search bar.
 *   • While search is empty  → show friend list
 *   • While typing           → search all users by username, show results with friend status
 * Groups tab — same as before.
 */
function Sidebar({
    currentUser,
    friends = [],
    groups = [],
    selectedChat,
    onSelectChat,
    onLogout,
    onlineUsers,
    connected,
    unreadCounts = {},
    onRefreshGroups,
    onRefreshFriends,
    socket
}) {
    const [activeTab, setActiveTab] = useState('chats');
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [contextMenuUser, setContextMenuUser] = useState(null);
    const [userInfoTarget, setUserInfoTarget] = useState(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    // Map of userId -> friend status for search results
    const [searchStatuses, setSearchStatuses] = useState({});
    // Track in-progress send actions to show loading per user
    const [pendingActions, setPendingActions] = useState(new Set());

    const searchTimerRef = useRef(null);
    const searchInputRef = useRef(null);

    // ── Helpers ──────────────────────────────────────────────────────────────

    const getUserStatus = (userId) => onlineUsers.has(userId) ? 'online' : 'offline';

    const getInitials = (name = '') =>
        name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

    // ── Search ───────────────────────────────────────────────────────────────

    const handleSearchChange = (e) => {
        const q = e.target.value;
        setSearchQuery(q);

        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

        if (!q.trim()) {
            setSearchResults([]);
            setSearchStatuses({});
            return;
        }

        searchTimerRef.current = setTimeout(() => doSearch(q.trim()), 350);
    };

    const doSearch = async (q) => {
        setSearchLoading(true);
        try {
            const res = await usersAPI.search(q);
            const users = res.data.users || [];
            setSearchResults(users);

            // Fetch friend status for each result in parallel
            const statuses = {};
            await Promise.all(users.map(async (u) => {
                try {
                    const sr = await friendsAPI.getStatus(u._id);
                    statuses[u._id] = sr.data;
                } catch {
                    statuses[u._id] = { status: 'none' };
                }
            }));
            setSearchStatuses(statuses);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setSearchLoading(false);
        }
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setSearchStatuses({});
        if (searchInputRef.current) searchInputRef.current.focus();
    };

    // ── Friend actions from search results ───────────────────────────────────

    const setPending = (userId, val) => setPendingActions(prev => {
        const s = new Set(prev);
        val ? s.add(userId) : s.delete(userId);
        return s;
    });

    const handleSendRequest = async (user) => {
        setPending(user._id, true);
        try {
            const res = await friendsAPI.sendRequest(user._id);
            setSearchStatuses(prev => ({
                ...prev,
                [user._id]: { status: 'pending_sent', requestId: res.data.request?._id }
            }));
            if (socket) {
                socket.emit('friend:request:send', {
                    recipientId: user._id,
                    request: res.data.request
                });
            }
        } catch (err) {
            console.error('Send request failed:', err);
        } finally {
            setPending(user._id, false);
        }
    };

    const handleAcceptRequest = async (user, requestId) => {
        setPending(user._id, true);
        try {
            const res = await friendsAPI.acceptRequest(requestId);
            setSearchStatuses(prev => ({ ...prev, [user._id]: { status: 'friends' } }));
            if (socket) {
                socket.emit('friend:request:accepted', {
                    senderId: user._id,
                    newFriend: res.data.request?.recipient
                });
            }
            onRefreshFriends && onRefreshFriends();
        } catch (err) {
            console.error('Accept request failed:', err);
        } finally {
            setPending(user._id, false);
        }
    };

    const handleStartChat = (friend) => {
        onSelectChat({ id: friend._id, type: 'user', data: friend });
        clearSearch();
    };

    // ── Context menu ─────────────────────────────────────────────────────────

    const handleUserContextMenu = (e, user) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuUser({ user, x: e.clientX, y: e.clientY });
    };

    const handleWindowClick = () => setContextMenuUser(null);

    // ── Render helpers ───────────────────────────────────────────────────────

    const renderFriendActionButton = (user, statusInfo) => {
        const isLoading = pendingActions.has(user._id);
        const { status, requestId } = statusInfo || { status: 'none' };

        if (status === 'friends') {
            return (
                <button
                    className="sr-action-btn sr-chat-btn"
                    onClick={(e) => { e.stopPropagation(); handleStartChat(user); }}
                    title="Open chat"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                </button>
            );
        }

        if (status === 'pending_sent') {
            return (
                <span className="sr-status-pill sr-pending">Sent</span>
            );
        }

        if (status === 'pending_received') {
            return (
                <button
                    className="sr-action-btn sr-accept-btn"
                    onClick={(e) => { e.stopPropagation(); handleAcceptRequest(user, requestId); }}
                    disabled={isLoading}
                    title="Accept request"
                >
                    {isLoading ? '…' : 'Accept'}
                </button>
            );
        }

        // 'none'
        return (
            <button
                className="sr-action-btn sr-add-btn"
                onClick={(e) => { e.stopPropagation(); handleSendRequest(user); }}
                disabled={isLoading}
                title="Send friend request"
            >
                {isLoading ? (
                    <span className="sr-spin" />
                ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="8.5" cy="7" r="4"/>
                        <line x1="20" y1="8" x2="20" y2="14"/>
                        <line x1="23" y1="11" x2="17" y2="11"/>
                    </svg>
                )}
            </button>
        );
    };

    const isSearching = searchQuery.trim().length > 0;

    return (
        <div className="sidebar" onClick={handleWindowClick}>

            {/* ── Tabs ─────────────────────────────────────────────────── */}
            <div className="sidebar-tabs">
                <button
                    className={`tab ${activeTab === 'chats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chats')}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    Chats
                </button>
                <button
                    className={`tab ${activeTab === 'groups' ? 'active' : ''}`}
                    onClick={() => setActiveTab('groups')}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    Groups
                </button>
            </div>

            {/* ── Content ──────────────────────────────────────────────── */}
            <div className="sidebar-content">

                {activeTab === 'chats' ? (
                    <>
                        {/* Search bar */}
                        <div className="sidebar-search-wrap">
                            <div className={`sidebar-search ${isSearching ? 'active' : ''}`}>
                                <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="11" cy="11" r="8"/>
                                    <path d="m21 21-4.35-4.35"/>
                                </svg>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search by username…"
                                    value={searchQuery}
                                    onChange={handleSearchChange}
                                    className="sidebar-search-input"
                                />
                                {isSearching && (
                                    <button className="search-clear-btn" onClick={clearSearch} title="Clear">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Search results */}
                        {isSearching ? (
                            <div className="search-results">
                                {searchLoading ? (
                                    <div className="sr-loading">
                                        <div className="sr-spinner"/>
                                        <span>Searching…</span>
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="sr-empty">
                                        <div className="sr-empty-icon">🔍</div>
                                        <p>No users found</p>
                                        <span>Try a different username</span>
                                    </div>
                                ) : (
                                    searchResults.map(user => {
                                        const statusInfo = searchStatuses[user._id] || { status: 'none' };
                                        return (
                                            <div key={user._id} className="sr-item">
                                                <div className="sr-avatar">
                                                    {user.avatar
                                                        ? <img src={user.avatar} alt={user.username}/>
                                                        : <span>{getInitials(user.username)}</span>
                                                    }
                                                    <div className={`sr-dot ${getUserStatus(user._id)}`}/>
                                                </div>
                                                <div className="sr-info">
                                                    <strong>{user.username}</strong>
                                                    <span>{getUserStatus(user._id)}</span>
                                                </div>
                                                {renderFriendActionButton(user, statusInfo)}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        ) : (
                            /* Friends list */
                            <div className="chat-list">
                                {friends.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">👥</div>
                                        <p>No friends yet</p>
                                        <span>Search for a username above to add friends</span>
                                    </div>
                                ) : (
                                    friends.map(friend => {
                                        const unreadCount = unreadCounts[friend._id] || 0;
                                        return (
                                            <div
                                                key={friend._id}
                                                className={`chat-item ${selectedChat?.id === friend._id ? 'active' : ''}`}
                                                onClick={() => onSelectChat({ id: friend._id, type: 'user', data: friend })}
                                                onContextMenu={(e) => handleUserContextMenu(e, friend)}
                                            >
                                                <div className="chat-avatar">
                                                    {friend.avatar
                                                        ? <img src={friend.avatar} alt={friend.username}/>
                                                        : <span>{getInitials(friend.username)}</span>
                                                    }
                                                    <div className={`status-dot ${getUserStatus(friend._id)}`}/>
                                                </div>
                                                <div className="chat-info">
                                                    <h4>{friend.username}</h4>
                                                    <p className="chat-status">{getUserStatus(friend._id)}</p>
                                                </div>
                                                {unreadCount > 0 && (
                                                    <div className="unread-badge">{unreadCount}</div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    /* Groups tab */
                    <div className="group-list">
                        <button className="create-group-button" onClick={() => setShowCreateGroup(true)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Create Group
                        </button>

                        {groups.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">💬</div>
                                <p>No groups yet</p>
                                <span>Create a group to get started</span>
                            </div>
                        ) : (
                            groups.map(group => {
                                const unreadCount = unreadCounts[group._id] || 0;
                                return (
                                    <div
                                        key={group._id}
                                        className={`chat-item ${selectedChat?.id === group._id ? 'active' : ''}`}
                                        onClick={() => onSelectChat({ id: group._id, type: 'group', data: group })}
                                    >
                                        <div className="chat-avatar group-avatar">
                                            {group.avatar
                                                ? <img src={group.avatar} alt={group.name}/>
                                                : <span>{getInitials(group.name)}</span>
                                            }
                                        </div>
                                        <div className="chat-info">
                                            <h4>{group.name}</h4>
                                            <p className="chat-status">{group.members?.length || 0} members</p>
                                        </div>
                                        {unreadCount > 0 && (
                                            <div className="unread-badge">{unreadCount}</div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* ── Right-click context menu ──────────────────────────────── */}
            {contextMenuUser && (
                <div
                    className="sidebar-ctx-menu"
                    style={{ top: contextMenuUser.y, left: contextMenuUser.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="sidebar-ctx-item"
                        onClick={() => {
                            onSelectChat({ id: contextMenuUser.user._id, type: 'user', data: contextMenuUser.user });
                            setContextMenuUser(null);
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        Open Chat
                    </button>
                    <button
                        className="sidebar-ctx-item"
                        onClick={() => {
                            setUserInfoTarget(contextMenuUser.user);
                            setContextMenuUser(null);
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        User Info
                    </button>
                </div>
            )}

            {/* ── Create Group Modal ────────────────────────────────────── */}
            {showCreateGroup && (
                <CreateGroupModal
                    users={friends}
                    currentUser={currentUser}
                    onClose={() => setShowCreateGroup(false)}
                    onGroupCreated={() => {
                        setShowCreateGroup(false);
                        onRefreshGroups?.();
                    }}
                />
            )}

            {/* ── User Info Modal ───────────────────────────────────────── */}
            {userInfoTarget && (
                <UserInfoModal
                    user={userInfoTarget}
                    currentUser={currentUser}
                    socket={socket}
                    onClose={() => setUserInfoTarget(null)}
                    onStartChat={(u) => {
                        onSelectChat({ id: u._id, type: 'user', data: u });
                        setUserInfoTarget(null);
                    }}
                />
            )}
        </div>
    );
}

export default Sidebar;
