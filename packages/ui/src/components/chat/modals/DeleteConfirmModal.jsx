import React from 'react';

/**
 * DeleteConfirmModal — centred overlay with three choices:
 * "Delete for me", "Delete for everyone", "Cancel"
 */
function DeleteConfirmModal({ deleteConfirm, onConfirm, onCancel }) {
    if (!deleteConfirm) return null;

    return (
        <div className="delete-confirm-overlay" onClick={onCancel}>
            <div className="delete-confirm-box" onClick={(e) => e.stopPropagation()}>
                <h3 className="delete-confirm-title">Delete Message</h3>
                <p className="delete-confirm-subtitle">Who should this message be deleted for?</p>
                <div className="delete-confirm-actions">
                    <button className="delete-choice-btn delete-choice-me" onClick={() => onConfirm('me')}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                        <span>Delete for Me</span>
                    </button>
                    <button className="delete-choice-btn delete-choice-everyone" onClick={() => onConfirm('everyone')}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>Delete for Everyone</span>
                    </button>
                    <button className="delete-choice-btn delete-choice-cancel" onClick={onCancel}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DeleteConfirmModal;
