import React from 'react';
import './AppSidebar.css';

function AppSidebar({
    currentUser,
    connected,
    friendRequestCount = 0,
    activePanel = null,
    onOpenSettings,
    onOpenFriendRequests,
    onOpenTasks,
    onAvatarClick,
    onLogout
}) {
    const getInitials = (name = '') =>
        name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

    return (
        <div className="app-sidebar">
            <div className="app-sidebar-top">
                <div className="app-sidebar-avatar-container" title={currentUser?.username} onClick={onAvatarClick}>
                    <div className="app-sidebar-avatar">
                        {currentUser?.avatar ? (
                            <img src={currentUser.avatar} alt={currentUser.username} />
                        ) : (
                            <span>{getInitials(currentUser?.username)}</span>
                        )}
                        <div className={`status-indicator ${connected ? 'online' : 'offline'}`} />
                    </div>
                </div>
            </div>

            <div className="app-sidebar-middle">
                {/* Tasks */}
                <button
                    className={`app-sidebar-btn ${activePanel === 'tasks' ? 'active' : ''}`}
                    onClick={onOpenTasks}
                    title="Tasks"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11l3 3L22 4"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                </button>
            </div>

            <div className="app-sidebar-bottom">
                <button
                    className="app-sidebar-btn"
                    onClick={onOpenFriendRequests}
                    title="Friend Requests"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="8.5" cy="7" r="4"/>
                        <line x1="20" y1="8" x2="20" y2="14"/>
                        <line x1="23" y1="11" x2="17" y2="11"/>
                    </svg>
                    {friendRequestCount > 0 && (
                        <span className="app-sidebar-badge">
                            {friendRequestCount > 9 ? '9+' : friendRequestCount}
                        </span>
                    )}
                </button>

                <button className="app-sidebar-btn" onClick={onOpenSettings} title="Settings">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 1v6m0 6v6m8.5-11.3l-5.2 3M8.7 15.7l-5.2 3m0-13.4l5.2 3M15.3 15.7l-5.2 3"/>
                    </svg>
                </button>

                <button className="app-sidebar-btn logout" onClick={onLogout} title="Logout">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                </button>
            </div>
        </div>
    );
}

export default AppSidebar;
