import React, { useState, useEffect, useRef } from 'react';
import { friendsAPI, usersAPI } from '@chat-app/shared/api';
import './UserInfoModal.css';

/**
 * UserInfoModal — shows a user's profile info and friend status.
 * Triggered by clicking avatar in ChatHeader or sidebar right-click → "User Info".
 */
function UserInfoModal({ user, currentUser, socket, onClose, onStartChat }) {
    const [friendStatus, setFriendStatus] = useState('loading'); // 'loading' | 'friends' | 'pending_sent' | 'pending_received' | 'none'
    const [requestId, setRequestId] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [toast, setToast] = useState('');

    const [uploading, setUploading] = useState(false);
    const [localUser, setLocalUser] = useState(user);
    const fileInputRef = useRef(null);

    const isOwnProfile = user?._id === currentUser?.id || user?._id === currentUser?._id;

    useEffect(() => {
        setLocalUser(user);
    }, [user]);

    useEffect(() => {
        if (!user || isOwnProfile) return;
        fetchFriendStatus();
    }, [user, isOwnProfile]);

    // Listen for real-time friend request acceptance
    useEffect(() => {
        if (!socket) return;
        const handleAccepted = ({ newFriend }) => {
            if (newFriend?._id === user?._id) {
                setFriendStatus('friends');
                showToast('You are now friends! 🎉');
            }
        };
        socket.on('friend:request:was_accepted', handleAccepted);
        return () => socket.off('friend:request:was_accepted', handleAccepted);
    }, [socket, user]);

    const fetchFriendStatus = async () => {
        try {
            const res = await friendsAPI.getStatus(user._id);
            setFriendStatus(res.data.status);
            if (res.data.requestId) setRequestId(res.data.requestId);
        } catch {
            setFriendStatus('none');
        }
    };

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const handleAvatarClick = () => {
        if (isOwnProfile && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image size must be less than 5MB');
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        setUploading(true);
        showToast('Uploading profile picture...');

        try {
            const res = await usersAPI.uploadAvatar(formData);
            console.log('Avatar upload response:', res.data);
            const updatedUser = res.data.user;
            setLocalUser(updatedUser);
            
            localStorage.setItem('user', JSON.stringify(updatedUser));
            window.dispatchEvent(new Event('authChange'));
            showToast('Avatar updated successfully! 🎉');
        } catch (err) {
            console.error('Avatar upload failed:', err);
            showToast(err.response?.data?.error || 'Failed to upload avatar');
        } finally {
            setUploading(false);
        }
    };

    const handleSendRequest = async () => {
        setActionLoading(true);
        try {
            const res = await friendsAPI.sendRequest(user._id);
            setFriendStatus('pending_sent');
            setRequestId(res.data.request?._id);
            showToast('Friend request sent!');
            // Notify via socket
            if (socket) {
                socket.emit('friend:request:send', {
                    recipientId: user._id,
                    request: res.data.request
                });
            }
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to send request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAcceptRequest = async () => {
        if (!requestId) return;
        setActionLoading(true);
        try {
            const res = await friendsAPI.acceptRequest(requestId);
            setFriendStatus('friends');
            showToast('You are now friends! 🎉');
            if (socket) {
                socket.emit('friend:request:accepted', {
                    senderId: user._id,
                    newFriend: res.data.request?.recipient
                });
            }
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to accept');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeclineRequest = async () => {
        if (!requestId) return;
        setActionLoading(true);
        try {
            await friendsAPI.declineRequest(requestId);
            setFriendStatus('none');
            showToast('Request declined');
        } catch {
            showToast('Failed to decline');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveFriend = async () => {
        setActionLoading(true);
        try {
            await friendsAPI.remove(user._id);
            setFriendStatus('none');
            showToast('Friend removed');
        } catch {
            showToast('Failed to remove friend');
        } finally {
            setActionLoading(false);
        }
    };

    const getInitials = (name) => {
        return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Unknown';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    if (!user) return null;

    return (
        <div className="uim-overlay" onClick={onClose}>
            <div className="uim-modal" onClick={e => e.stopPropagation()}>
                <button className="uim-close" onClick={onClose} aria-label="Close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                {/* Avatar */}
                <div className={`uim-avatar-wrap ${isOwnProfile ? 'uim-own-avatar-wrap' : ''}`} onClick={handleAvatarClick} title={isOwnProfile ? "Click to change profile picture" : ""}>
                    <div className="uim-avatar">
                        {uploading ? (
                            <div className="uim-avatar-loader">
                                <span className="spinner" />
                            </div>
                        ) : localUser.avatar ? (
                            <img src={localUser.avatar} alt={localUser.username} />
                        ) : (
                            <span>{getInitials(localUser.username)}</span>
                        )}
                        {isOwnProfile && (
                            <div className="uim-avatar-overlay">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                    <circle cx="12" cy="13" r="4" />
                                </svg>
                            </div>
                        )}
                    </div>
                    {!isOwnProfile && <div className={`uim-status-dot ${localUser.status || 'offline'}`} />}
                    {isOwnProfile && (
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            style={{ display: 'none' }}
                        />
                    )}
                </div>

                {/* User info */}
                <div className="uim-info">
                    <h2 className="uim-name">{localUser.username}</h2>
                    <span className={`uim-status-badge ${localUser.status || 'offline'}`}>
                        {localUser.status === 'online' ? '🟢 Online' : localUser.status === 'away' ? '🟡 Away' : '⚫ Offline'}
                    </span>
                    {localUser.email && (
                        <p className="uim-email">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                            {localUser.email}
                        </p>
                    )}
                    <p className="uim-joined">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        Joined {formatDate(localUser.createdAt)}
                    </p>
                </div>

                {/* Friend actions — only shown for other users */}
                {!isOwnProfile && (
                    <div className="uim-actions">
                        {friendStatus === 'loading' && (
                            <div className="uim-loading-dots"><span/><span/><span/></div>
                        )}

                        {friendStatus === 'friends' && (
                            <>
                                <button
                                    className="uim-btn uim-btn-primary"
                                    onClick={() => { onStartChat && onStartChat(user); onClose(); }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    Send Message
                                </button>
                                <button
                                    className="uim-btn uim-btn-danger"
                                    onClick={handleRemoveFriend}
                                    disabled={actionLoading}
                                >
                                    Remove Friend
                                </button>
                            </>
                        )}

                        {friendStatus === 'none' && (
                            <button
                                className="uim-btn uim-btn-primary"
                                onClick={handleSendRequest}
                                disabled={actionLoading}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" />
                                    <line x1="23" y1="11" x2="17" y2="11" />
                                </svg>
                                {actionLoading ? 'Sending…' : 'Add Friend'}
                            </button>
                        )}

                        {friendStatus === 'pending_sent' && (
                            <button className="uim-btn uim-btn-muted" disabled>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                Request Sent
                            </button>
                        )}

                        {friendStatus === 'pending_received' && (
                            <div className="uim-request-actions">
                                <p className="uim-request-label">Sent you a friend request</p>
                                <div className="uim-request-btns">
                                    <button
                                        className="uim-btn uim-btn-success"
                                        onClick={handleAcceptRequest}
                                        disabled={actionLoading}
                                    >Accept</button>
                                    <button
                                        className="uim-btn uim-btn-ghost"
                                        onClick={handleDeclineRequest}
                                        disabled={actionLoading}
                                    >Decline</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Toast */}
                {toast && <div className="uim-toast">{toast}</div>}
            </div>
        </div>
    );
}

export default UserInfoModal;
