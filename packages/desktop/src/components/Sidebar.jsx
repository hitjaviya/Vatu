import React, { useState } from 'react';
import CreateGroupModal from './CreateGroupModal';
import './Sidebar.css';

function Sidebar({
    currentUser,
    users,
    groups,
    selectedChat,
    onSelectChat,
    onLogout,
    onlineUsers,
    connected,
    unreadCounts = {},
    onRefreshGroups
}) {
    const [activeTab, setActiveTab] = useState('chats');
    const [showCreateGroup, setShowCreateGroup] = useState(false);

    const getUserStatus = (userId) => {
        return onlineUsers.has(userId) ? 'online' : 'offline';
    };

    const getInitials = (name) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className="sidebar">
            {/* Sidebar Header */}
            <div className="sidebar-header">
                <div className="user-profile">
                    <div className="user-avatar">
                        {currentUser?.avatar ? (
                            <img src={currentUser.avatar} alt={currentUser.username} />
                        ) : (
                            <span>{getInitials(currentUser?.username || 'U')}</span>
                        )}
                        <div className={`status-indicator ${connected ? 'online' : 'offline'}`}></div>
                    </div>
                    <div className="user-info">
                        <h3>{currentUser?.username}</h3>
                        <span className="connection-status">
                            {connected ? '🟢 Connected' : '🔴 Disconnected'}
                        </span>
                    </div>
                </div>

                <button className="logout-button" onClick={onLogout} title="Logout">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                </button>
            </div>

            {/* Tabs */}
            <div className="sidebar-tabs">
                <button
                    className={`tab ${activeTab === 'chats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chats')}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Chats
                </button>
                <button
                    className={`tab ${activeTab === 'groups' ? 'active' : ''}`}
                    onClick={() => setActiveTab('groups')}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Groups
                </button>
            </div>

            {/* Chat List */}
            <div className="sidebar-content">
                {activeTab === 'chats' ? (
                    <div className="chat-list">
                        {users.length === 0 ? (
                            <div className="empty-state">
                                <p>No users found</p>
                            </div>
                        ) : (
                            users.map(user => {
                                const unreadCount = unreadCounts[user._id] || 0;
                                return (
                                    <div
                                        key={user._id}
                                        className={`chat-item ${selectedChat?.id === user._id ? 'active' : ''}`}
                                        onClick={() => onSelectChat({ id: user._id, type: 'user', data: user })}
                                    >
                                        <div className="chat-avatar">
                                            {user.avatar ? (
                                                <img src={user.avatar} alt={user.username} />
                                            ) : (
                                                <span>{getInitials(user.username)}</span>
                                            )}
                                            <div className={`status-dot ${getUserStatus(user._id)}`}></div>
                                        </div>
                                        <div className="chat-info">
                                            <h4>{user.username}</h4>
                                            <p className="chat-status">{getUserStatus(user._id)}</p>
                                        </div>
                                        {unreadCount > 0 && (
                                            <div className="unread-badge">{unreadCount}</div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div className="group-list">
                        <button
                            className="create-group-button"
                            onClick={() => setShowCreateGroup(true)}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Create Group
                        </button>

                        {groups.length === 0 ? (
                            <div className="empty-state">
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
                                            {group.avatar ? (
                                                <img src={group.avatar} alt={group.name} />
                                            ) : (
                                                <span>{getInitials(group.name)}</span>
                                            )}
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

            {/* Create Group Modal */}
            {showCreateGroup && (
                <CreateGroupModal
                    users={users}
                    currentUser={currentUser}
                    onClose={() => setShowCreateGroup(false)}
                    onGroupCreated={(group) => {
                        setShowCreateGroup(false);
                        if (onRefreshGroups) {
                            onRefreshGroups();
                        }
                    }}
                />
            )}
        </div>
    );
}

export default Sidebar;
