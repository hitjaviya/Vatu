import React, { useState, useEffect } from 'react';
import { groupsAPI } from '@chat-app/shared/api';
import './GroupInviteModal.css';

/**
 * GroupInviteModal — shown when a user receives a group invite.
 * Allows accepting or declining before being added to the group.
 */
function GroupInviteModal({ invite, onAccept, onDecline, onClose }) {
    const [loading, setLoading] = useState(false);

    if (!invite) return null;

    const getInitials = (name) =>
        name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

    const handleAccept = async () => {
        setLoading(true);
        try {
            const res = await groupsAPI.acceptInvite(invite._id);
            onAccept && onAccept(res.data.group);
        } catch (err) {
            console.error('Failed to accept group invite:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDecline = async () => {
        setLoading(true);
        try {
            await groupsAPI.declineInvite(invite._id);
            onDecline && onDecline(invite._id);
        } catch (err) {
            console.error('Failed to decline group invite:', err);
        } finally {
            setLoading(false);
        }
    };

    const group = invite.group;
    const invitedBy = invite.invitedBy;

    return (
        <div className="gim-overlay" onClick={!loading ? onClose : undefined}>
            <div className="gim-modal" onClick={e => e.stopPropagation()}>
                {/* Group avatar */}
                <div className="gim-group-avatar">
                    {group?.avatar ? (
                        <img src={group.avatar} alt={group.name} />
                    ) : (
                        <span>{getInitials(group?.name || 'G')}</span>
                    )}
                </div>

                {/* Invite icon badge */}
                <div className="gim-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                </div>

                <div className="gim-content">
                    <h2 className="gim-title">Group Invitation</h2>

                    <p className="gim-desc">
                        <strong>{invitedBy?.username || 'Someone'}</strong> invited you to join
                    </p>

                    <div className="gim-group-name">
                        <span>{group?.name || 'a group'}</span>
                    </div>

                    {group?.description && (
                        <p className="gim-group-desc">{group.description}</p>
                    )}

                    <p className="gim-question">Would you like to join?</p>
                </div>

                <div className="gim-actions">
                    <button
                        className="gim-btn gim-btn-accept"
                        onClick={handleAccept}
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="gim-spinner" />
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Join Group
                            </>
                        )}
                    </button>
                    <button
                        className="gim-btn gim-btn-decline"
                        onClick={handleDecline}
                        disabled={loading}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        Decline
                    </button>
                </div>
            </div>
        </div>
    );
}

export default GroupInviteModal;
