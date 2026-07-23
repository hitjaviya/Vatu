import React, { useState, useEffect, useCallback, useRef } from 'react';
import { tasksAPI } from '@chat-app/shared/api';
import './TasksPanel.css';

// ─── helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
const STATUS_OPTIONS  = [
    { value: 'pending',     label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'done',        label: 'Done' },
    { value: 'cancelled',   label: 'Cancelled' },
];

function getInitials(name = '') {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function buildConversationId(currentUser, selectedChat) {
    if (!selectedChat) return null;
    if (selectedChat.type === 'group') return `group_${selectedChat.id}`;
    const ids = [currentUser._id, selectedChat.id].sort();
    return `dm_${ids[0]}_${ids[1]}`;
}

// ─── Empty form defaults ───────────────────────────────────────────────────────
const EMPTY_FORM = { title: '', description: '', priority: 'medium', assignedTo: '', dueDate: '' };

// ─── TasksPanel ───────────────────────────────────────────────────────────────

export default function TasksPanel({ currentUser, selectedChat, socket, onClose }) {
    const [tasks,          setTasks]          = useState([]);
    const [loading,        setLoading]        = useState(false);
    const [extracting,     setExtracting]     = useState(false);
    const [extractError,   setExtractError]   = useState('');
    const [filterStatus,   setFilterStatus]   = useState('all');
    const [showForm,       setShowForm]       = useState(false);
    const [editingTask,    setEditingTask]     = useState(null);   // task object being edited
    const [form,           setForm]           = useState(EMPTY_FORM);
    const [saving,         setSaving]         = useState(false);

    // Permission states (DM only)
    const [permStatus,     setPermStatus]     = useState('idle'); // idle | waiting | granted | denied
    const [incomingPerm,   setIncomingPerm]   = useState(null);  // { fromUserId, fromUsername, conversationId }

    const conversationId  = buildConversationId(currentUser, selectedChat);
    const isGroup         = selectedChat?.type === 'group';
    const isAdmin         = isGroup && selectedChat?.data?.admin === currentUser._id;
    const participants    = isGroup
        ? (selectedChat?.data?.members || [])
        : [currentUser, selectedChat?.data].filter(Boolean);

    // reset permission state when conversation changes
    useEffect(() => {
        setPermStatus('idle');
        setIncomingPerm(null);
        setExtractError('');
    }, [conversationId]);

    // ── Fetch tasks ───────────────────────────────────────────────────────────

    const fetchTasks = useCallback(async () => {
        if (!conversationId) return;
        setLoading(true);
        try {
            const res = await tasksAPI.getByConversation(conversationId);
            setTasks(res.data.tasks || []);
        } catch (err) {
            console.error('Failed to fetch tasks', err);
        } finally {
            setLoading(false);
        }
    }, [conversationId]);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    // ── Socket listeners ──────────────────────────────────────────────────────

    useEffect(() => {
        if (!socket) return;

        // Someone requests permission to extract tasks from our conversation
        socket.on('task:permission:request', ({ fromUserId, conversationId: cid }) => {
            if (cid !== conversationId) return;
            const fromUser = selectedChat?.data;
            setIncomingPerm({ fromUserId, fromUsername: fromUser?.username || 'User', conversationId: cid });
        });

        socket.on('task:permission:granted', ({ conversationId: cid }) => {
            if (cid !== conversationId) return;
            setPermStatus('granted');
            // auto-trigger extraction now that permission is granted
            runExtraction();
        });

        socket.on('task:permission:denied', ({ conversationId: cid }) => {
            if (cid !== conversationId) return;
            setPermStatus('denied');
        });

        return () => {
            socket.off('task:permission:request');
            socket.off('task:permission:granted');
            socket.off('task:permission:denied');
        };
    }, [socket, conversationId]);

    // ── AI Extraction ─────────────────────────────────────────────────────────

    const runExtraction = async () => {
        setExtracting(true);
        setExtractError('');
        try {
            const type = isGroup ? 'group' : 'dm';
            const res  = await tasksAPI.extractFromConversation(conversationId, type);
            const extracted = res.data.tasks || [];
            if (extracted.length === 0) {
                setExtractError('No actionable tasks found in this conversation.');
            } else {
                setTasks(prev => [...extracted, ...prev]);
            }
        } catch (err) {
            setExtractError(err.response?.data?.error || 'AI extraction failed. Try again.');
        } finally {
            setExtracting(false);
            setPermStatus('idle');
        }
    };

    const handleExtractClick = () => {
        if (isGroup) {
            if (!isAdmin) return; // guarded by UI but double-check
            runExtraction();
        } else {
            // DM: request permission first
            socket.emit('task:permission:request', {
                recipientId: selectedChat.id,
                conversationId
            });
            setPermStatus('waiting');
        }
    };

    const handleGrantPermission = () => {
        socket.emit('task:permission:granted', {
            recipientId: incomingPerm.fromUserId,
            conversationId: incomingPerm.conversationId
        });
        setIncomingPerm(null);
    };

    const handleDenyPermission = () => {
        socket.emit('task:permission:denied', {
            recipientId: incomingPerm.fromUserId,
            conversationId: incomingPerm.conversationId
        });
        setIncomingPerm(null);
    };

    // ── CRUD ──────────────────────────────────────────────────────────────────

    const openCreate = () => {
        setEditingTask(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    };

    const openEdit = (task) => {
        setEditingTask(task);
        setForm({
            title:       task.title,
            description: task.description,
            priority:    task.priority,
            assignedTo:  task.assignedTo?._id || '',
            dueDate:     task.dueDate ? task.dueDate.slice(0, 10) : ''
        });
        setShowForm(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        setSaving(true);
        try {
            if (editingTask) {
                const res = await tasksAPI.update(editingTask._id, {
                    title:       form.title,
                    description: form.description,
                    priority:    form.priority,
                    assignedTo:  form.assignedTo || null,
                    dueDate:     form.dueDate    || null,
                });
                setTasks(prev => prev.map(t => t._id === editingTask._id ? res.data.task : t));
            } else {
                const res = await tasksAPI.create({
                    conversationId,
                    conversationType: isGroup ? 'group' : 'dm',
                    title:       form.title,
                    description: form.description,
                    priority:    form.priority,
                    assignedTo:  form.assignedTo || null,
                    dueDate:     form.dueDate    || null,
                });
                setTasks(prev => [res.data.task, ...prev]);
            }
            setShowForm(false);
            setEditingTask(null);
            setForm(EMPTY_FORM);
        } catch (err) {
            console.error('Save task failed', err);
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (taskId, newStatus) => {
        try {
            const res = await tasksAPI.update(taskId, { status: newStatus });
            setTasks(prev => prev.map(t => t._id === taskId ? res.data.task : t));
        } catch (err) {
            console.error('Status update failed', err);
        }
    };

    const handleConfirm = async (task) => {
        try {
            const res = await tasksAPI.update(task._id, { confirmed: true });
            setTasks(prev => prev.map(t => t._id === task._id ? res.data.task : t));
        } catch (err) {
            console.error('Confirm failed', err);
        }
    };

    const handleDelete = async (task) => {
        const userId    = currentUser._id;
        const isCreator = task.createdBy?._id === userId || task.createdBy === userId;
        if (!isCreator && !isAdmin) return;

        if (!window.confirm(`Delete task "${task.title}"?`)) return;
        try {
            await tasksAPI.remove(task._id, isAdmin);
            setTasks(prev => prev.filter(t => t._id !== task._id));
        } catch (err) {
            console.error('Delete failed', err);
        }
    };

    // ── Derived ───────────────────────────────────────────────────────────────

    const filteredTasks = filterStatus === 'all'
        ? tasks
        : tasks.filter(t => t.status === filterStatus);

    const canExtract = isGroup ? isAdmin : true;
    const canCreate  = isGroup ? isAdmin : true;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="tasks-panel">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="tasks-panel-header">
                <div className="tasks-panel-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11l3 3L22 4"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    <span>Tasks</span>
                    {selectedChat && (
                        <span className="tasks-panel-context">
                            {isGroup ? selectedChat.data?.name : selectedChat.data?.username}
                        </span>
                    )}
                </div>
                <button className="tasks-panel-close" onClick={onClose} title="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            {/* ── No conversation selected ────────────────────────────────── */}
            {!selectedChat ? (
                <div className="tasks-empty-state">
                    <div className="tasks-empty-icon">💬</div>
                    <p>Open a chat first</p>
                    <span>Select a conversation to see or create tasks</span>
                </div>
            ) : (
                <>
                    {/* ── Incoming permission request banner ─────────────────── */}
                    {incomingPerm && (
                        <div className="tasks-perm-banner">
                            <p>
                                <strong>{incomingPerm.fromUsername}</strong> wants to extract tasks from this conversation using AI.
                            </p>
                            <div className="tasks-perm-actions">
                                <button className="tasks-btn-allow" onClick={handleGrantPermission}>Allow</button>
                                <button className="tasks-btn-deny"  onClick={handleDenyPermission}>Deny</button>
                            </div>
                        </div>
                    )}

                    {/* ── Action bar ─────────────────────────────────────────── */}
                    <div className="tasks-actions-bar">
                        {canCreate && (
                            <button className="tasks-btn-create" onClick={openCreate}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                                New Task
                            </button>
                        )}

                        {canExtract && (
                            <button
                                className="tasks-btn-extract"
                                onClick={handleExtractClick}
                                disabled={extracting || permStatus === 'waiting'}
                                title={isGroup && !isAdmin ? 'Only admins can extract tasks' : ''}
                            >
                                {extracting ? (
                                    <span className="tasks-spin" />
                                ) : (
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M12 8v4l3 3"/>
                                    </svg>
                                )}
                                {permStatus === 'waiting' ? 'Waiting for permission…' : extracting ? 'Extracting…' : 'AI Extract'}
                            </button>
                        )}
                    </div>

                    {/* Permission status pills */}
                    {permStatus === 'denied' && (
                        <div className="tasks-perm-pill denied">
                            Permission denied by {selectedChat.data?.username}
                            <button onClick={() => setPermStatus('idle')}>✕</button>
                        </div>
                    )}
                    {extractError && (
                        <div className="tasks-perm-pill error">
                            {extractError}
                            <button onClick={() => setExtractError('')}>✕</button>
                        </div>
                    )}

                    {/* ── Filter tabs ────────────────────────────────────────── */}
                    <div className="tasks-filter-tabs">
                        {['all', 'pending', 'in_progress', 'done'].map(s => (
                            <button
                                key={s}
                                className={`tasks-filter-tab ${filterStatus === s ? 'active' : ''}`}
                                onClick={() => setFilterStatus(s)}
                            >
                                {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* ── Task list ──────────────────────────────────────────── */}
                    <div className="tasks-list">
                        {loading ? (
                            <div className="tasks-loading">
                                <span className="tasks-spin large" />
                                <p>Loading tasks…</p>
                            </div>
                        ) : filteredTasks.length === 0 ? (
                            <div className="tasks-empty-state small">
                                <div className="tasks-empty-icon">✅</div>
                                <p>No tasks here</p>
                                <span>{canCreate ? 'Create one or use AI Extract' : 'No tasks yet'}</span>
                            </div>
                        ) : (
                            filteredTasks.map(task => {
                                const userId    = currentUser._id;
                                const isCreator = task.createdBy?._id === userId || task.createdBy === userId;
                                const isAssignee = task.assignedTo?._id === userId || task.assignedTo === userId;
                                const canEdit   = isCreator || isAssignee || isAdmin;
                                const canDelete = isCreator || isAdmin;

                                return (
                                    <div
                                        key={task._id}
                                        className={`task-card ${task.status} ${!task.confirmed ? 'unconfirmed' : ''}`}
                                    >
                                        {/* Unconfirmed AI badge */}
                                        {!task.confirmed && (
                                            <div className="task-ai-badge">
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                                                </svg>
                                                AI Suggestion
                                                <button className="task-confirm-btn" onClick={() => handleConfirm(task)}>
                                                    Confirm
                                                </button>
                                            </div>
                                        )}

                                        <div className="task-card-top">
                                            <span
                                                className="task-priority-dot"
                                                style={{ background: PRIORITY_COLOR[task.priority] }}
                                                title={task.priority}
                                            />
                                            <h4 className="task-title">{task.title}</h4>
                                            <div className="task-card-actions">
                                                {canEdit && (
                                                    <button
                                                        className="task-icon-btn"
                                                        onClick={() => openEdit(task)}
                                                        title="Edit"
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                        </svg>
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        className="task-icon-btn danger"
                                                        onClick={() => handleDelete(task)}
                                                        title="Delete"
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <polyline points="3 6 5 6 21 6"/>
                                                            <path d="M19 6l-1 14H6L5 6"/>
                                                            <path d="M10 11v6M14 11v6"/>
                                                            <path d="M9 6V4h6v2"/>
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <p className="task-description">{task.description}</p>

                                        <div className="task-card-meta">
                                            {/* Assignee */}
                                            {task.assignedTo ? (
                                                <div className="task-assignee">
                                                    <div className="task-assignee-avatar">
                                                        {task.assignedTo.avatar
                                                            ? <img src={task.assignedTo.avatar} alt={task.assignedTo.username}/>
                                                            : <span>{getInitials(task.assignedTo.username)}</span>
                                                        }
                                                    </div>
                                                    <span>{task.assignedTo.username}</span>
                                                </div>
                                            ) : (
                                                <span className="task-unassigned">Unassigned</span>
                                            )}

                                            {/* Due date */}
                                            {task.dueDate && (
                                                <span className="task-due-date">
                                                    📅 {new Date(task.dueDate).toLocaleDateString()}
                                                </span>
                                            )}

                                            {/* Status selector */}
                                            {canEdit ? (
                                                <select
                                                    className={`task-status-select ${task.status}`}
                                                    value={task.status}
                                                    onChange={e => handleStatusChange(task._id, e.target.value)}
                                                >
                                                    {STATUS_OPTIONS.map(o => (
                                                        <option key={o.value} value={o.value}>{o.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className={`task-status-badge ${task.status}`}>
                                                    {STATUS_OPTIONS.find(o => o.value === task.status)?.label}
                                                </span>
                                            )}
                                        </div>

                                        {/* Tags */}
                                        {task.tags?.length > 0 && (
                                            <div className="task-tags">
                                                {task.tags.map(tag => (
                                                    <span key={tag} className="task-tag">#{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* ── Create / Edit Form Modal ────────────────────────────── */}
                    {showForm && (
                        <div className="tasks-form-overlay" onClick={() => setShowForm(false)}>
                            <div className="tasks-form-modal" onClick={e => e.stopPropagation()}>
                                <div className="tasks-form-header">
                                    <h3>{editingTask ? 'Edit Task' : 'New Task'}</h3>
                                    <button onClick={() => setShowForm(false)}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                        </svg>
                                    </button>
                                </div>
                                <form onSubmit={handleSave} className="tasks-form">
                                    <div className="tasks-form-field">
                                        <label>Title *</label>
                                        <input
                                            type="text"
                                            placeholder="What needs to be done?"
                                            value={form.title}
                                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="tasks-form-field">
                                        <label>Description</label>
                                        <textarea
                                            placeholder="Add more details…"
                                            rows={3}
                                            value={form.description}
                                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                        />
                                    </div>
                                    <div className="tasks-form-row">
                                        <div className="tasks-form-field">
                                            <label>Priority</label>
                                            <select
                                                value={form.priority}
                                                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                                            >
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                            </select>
                                        </div>
                                        <div className="tasks-form-field">
                                            <label>Due Date</label>
                                            <input
                                                type="date"
                                                value={form.dueDate}
                                                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="tasks-form-field">
                                        <label>Assign To</label>
                                        <select
                                            value={form.assignedTo}
                                            onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                                        >
                                            <option value="">Unassigned</option>
                                            {participants.map(p => p && (
                                                <option key={p._id} value={p._id}>{p.username}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="tasks-form-footer">
                                        <button type="button" className="tasks-btn-cancel" onClick={() => setShowForm(false)}>
                                            Cancel
                                        </button>
                                        <button type="submit" className="tasks-btn-save" disabled={saving}>
                                            {saving ? <span className="tasks-spin small white" /> : null}
                                            {editingTask ? 'Save Changes' : 'Create Task'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
