import React, { useState } from 'react';
import { groupsAPI } from '@chat-app/shared/api';
import './CreateGroupModal.css';

function CreateGroupModal({ users, currentUser, onClose, onGroupCreated }) {
    const [groupName, setGroupName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Filter out current user and filter by search query
    const availableUsers = users.filter(user => {
        if (user._id === currentUser.id) return false;
        if (searchQuery) {
            return user.username.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
    });

    const toggleMember = (userId) => {
        setSelectedMembers(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!groupName.trim()) {
            setError('Group name is required');
            return;
        }

        if (selectedMembers.length === 0) {
            setError('Please select at least one member');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await groupsAPI.create({
                name: groupName.trim(),
                description: description.trim(),
                memberIds: selectedMembers
            });

            onGroupCreated(response.data.group);
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create group');
        } finally {
            setLoading(false);
        }
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
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content create-group-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create New Group</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="create-group-form">
                    <div className="form-section">
                        <div className="form-group">
                            <label htmlFor="groupName">Group Name *</label>
                            <input
                                type="text"
                                id="groupName"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                placeholder="Enter group name"
                                maxLength={50}
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">Description (Optional)</label>
                            <textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What's this group about?"
                                maxLength={200}
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <div className="members-header">
                            <label>Add Members *</label>
                            <span className="member-count">
                                {selectedMembers.length} selected
                            </span>
                        </div>

                        <div className="search-box">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.35-4.35" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="members-list">
                            {availableUsers.length === 0 ? (
                                <div className="empty-members">
                                    {searchQuery ? 'No users found' : 'No users available'}
                                </div>
                            ) : (
                                availableUsers.map(user => (
                                    <div
                                        key={user._id}
                                        className={`member-item ${selectedMembers.includes(user._id) ? 'selected' : ''}`}
                                        onClick={() => toggleMember(user._id)}
                                    >
                                        <div className="member-avatar">
                                            {user.avatar ? (
                                                <img src={user.avatar} alt={user.username} />
                                            ) : (
                                                <span>{getInitials(user.username)}</span>
                                            )}
                                        </div>
                                        <div className="member-info">
                                            <div className="member-name">{user.username}</div>
                                        </div>
                                        <div className="member-checkbox">
                                            {selectedMembers.includes(user._id) && (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <div className="modal-footer">
                        <button
                            type="button"
                            className="cancel-button"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="create-button"
                            disabled={loading || !groupName.trim() || selectedMembers.length === 0}
                        >
                            {loading ? (
                                <>
                                    <span className="button-loader"></span>
                                    Creating...
                                </>
                            ) : (
                                'Create Group'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateGroupModal;
