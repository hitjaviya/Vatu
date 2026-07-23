import React, { useState, useEffect } from 'react';
import { friendsAPI } from '@chat-app/shared/api';
import './FriendRequestsPanel.css';

/**
 * FriendRequestsPanel — slide-in panel showing incoming friend requests.
 * Shown when user clicks the "Friend Requests" bell/badge in the sidebar.
 */
function FriendRequestsPanel({ socket, currentUser, onClose, onFriendAdded }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionIds, setActionIds] = useState(new Set());

    useEffect(() => {
        fetchRequests();
    }, []);

    // Listen for real-time incoming requests
    useEffect(() => {
        if (!socket) return;
        const handleNewRequest = ({ request }) => {
            if (request) setRequests(prev => [request, ...prev]);
        };
        socket.on('friend:request:received', handleNewRequest);
        return () => socket.off('friend:request:received', handleNewRequest);
    }, [socket]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await friendsAPI.getRequests();
            setRequests(res.data.requests || []);
        } catch {
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    const setAction = (id, val) => setActionIds(prev => {
        const s = new Set(prev);
        val ? s.add(id) : s.delete(id);
        return s;
    });

    const handleAccept = async (req) => {
        setAction(req._id, true);
        try {
            const res = await friendsAPI.acceptRequest(req._id);
            setRequests(prev => prev.filter(r => r._id !== req._id));
            if (socket) {
                socket.emit('friend:request:accepted', {
                    senderId: req.sender._id,
                    newFriend: res.data.request?.recipient
                });
            }
            onFriendAdded && onFriendAdded();
        } catch (err) {
            console.error('Failed to accept:', err);
        } finally {
            setAction(req._id, false);
        }
    };

    const handleDecline = async (req) => {
        setAction(req._id, true);
        try {
            await friendsAPI.declineRequest(req._id);
            setRequests(prev => prev.filter(r => r._id !== req._id));
        } catch (err) {
            console.error('Failed to decline:', err);
        } finally {
            setAction(req._id, false);
        }
    };

    const getInitials = (name) =>
        name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

    return (
        <div className="frp-overlay" onClick={onClose}>
            <div className="frp-panel" onClick={e => e.stopPropagation()}>
                <div className="frp-header">
                    <h3>Friend Requests</h3>
                    <span className="frp-count">{requests.length}</span>
                    <button className="frp-close" onClick={onClose}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <div className="frp-list">
                    {loading && (
                        <div className="frp-empty">
                            <div className="frp-spinner" />
                        </div>
                    )}

                    {!loading && requests.length === 0 && (
                        <div className="frp-empty">
                            <div className="frp-empty-icon">👋</div>
                            <p>No pending requests</p>
                            <span>New friend requests will appear here</span>
                        </div>
                    )}

                    {!loading && requests.map(req => (
                        <div key={req._id} className="frp-item">
                            <div className="frp-avatar">
                                {req.sender?.avatar ? (
                                    <img src={req.sender.avatar} alt={req.sender.username} />
                                ) : (
                                    <span>{getInitials(req.sender?.username)}</span>
                                )}
                            </div>
                            <div className="frp-info">
                                <strong>{req.sender?.username}</strong>
                                <span>wants to be your friend</span>
                            </div>
                            <div className="frp-btns">
                                <button
                                    className="frp-btn frp-accept"
                                    onClick={() => handleAccept(req)}
                                    disabled={actionIds.has(req._id)}
                                    title="Accept"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                </button>
                                <button
                                    className="frp-btn frp-decline"
                                    onClick={() => handleDecline(req)}
                                    disabled={actionIds.has(req._id)}
                                    title="Decline"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default FriendRequestsPanel;
