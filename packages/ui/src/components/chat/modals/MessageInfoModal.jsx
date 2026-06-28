import React from 'react';
import { formatTime } from '../utils/messageHelpers';

/**
 * MessageInfoModal — shows delivery/read receipts for own messages.
 */
function MessageInfoModal({ msgInfoModal, msgInfoLoading, onClose }) {
    if (!msgInfoModal) return null;
    const { info } = msgInfoModal;

    return (
        <div className="msg-info-overlay" onClick={onClose}>
            <div className="msg-info-panel" onClick={(e) => e.stopPropagation()}>
                <div className="msg-info-header">
                    <span>Message Info</span>
                    <button className="msg-info-close" onClick={onClose}>✕</button>
                </div>

                {msgInfoLoading ? (
                    <div className="msg-info-loading"><div className="loading-spinner" /></div>
                ) : info ? (
                    <div className="msg-info-body">
                        {info.deliveredAt && (
                            <div className="msg-info-section">
                                <div className="msg-info-section-label">Delivered</div>
                                <div className="msg-info-time">{formatTime(info.deliveredAt)}</div>
                            </div>
                        )}
                        {info.readAt && (
                            <div className="msg-info-section">
                                <div className="msg-info-section-label">Read</div>
                                <div className="msg-info-time">{formatTime(info.readAt)}</div>
                            </div>
                        )}
                        {info.readBy && info.readBy.length > 0 && (
                            <div className="msg-info-section">
                                <div className="msg-info-section-label">Read by</div>
                                <div className="msg-info-group-list">
                                    {info.readBy.map((r, i) => (
                                        <div key={i} className="msg-info-group-item">
                                            <div className="msg-info-user-avatar">
                                                {(r.username || r.name || '?')[0].toUpperCase()}
                                            </div>
                                            <span>{r.username || r.name || 'User'}</span>
                                            <span className="msg-info-group-time">{formatTime(r.readAt)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="msg-info-body">
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '16px' }}>
                            No delivery info available
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default MessageInfoModal;
