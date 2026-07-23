import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity,
    ActivityIndicator, Modal, Alert, RefreshControl, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tasksAPI } from '../api';
import { Colors, Spacing, Radius, FontSize, getInitials } from '../theme';

// ─── constants ────────────────────────────────────────────────────────────────

const PRIORITY_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
const STATUS_OPTIONS  = [
    { value: 'pending',     label: 'To Do',       color: '#94a3b8' },
    { value: 'in_progress', label: 'In Progress',  color: '#60a5fa' },
    { value: 'done',        label: 'Done',         color: '#34d399' },
    { value: 'cancelled',   label: 'Cancelled',    color: '#f87171' },
];
const FILTER_TABS = [
    { value: 'all',         label: 'All' },
    { value: 'pending',     label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'done',        label: 'Done' },
];

function buildConversationId(currentUser, chat) {
    if (!chat) return null;
    if (chat.type === 'group') return `group_${chat.id}`;
    const ids = [currentUser._id, chat.id].sort();
    return `dm_${ids[0]}_${ids[1]}`;
}

function getStatusMeta(status) {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
}

// ─── TasksScreen ─────────────────────────────────────────────────────────────

export default function TasksScreen({ currentUser, socket, selectedChat }) {
    const [tasks,          setTasks]          = useState([]);
    const [loading,        setLoading]        = useState(false);
    const [refreshing,     setRefreshing]     = useState(false);
    const [filterStatus,   setFilterStatus]   = useState('all');
    const [statusModal,    setStatusModal]    = useState(null); // { taskId, currentStatus }

    // Incoming permission request from another user (DM)
    const [incomingPerm,   setIncomingPerm]   = useState(null); // { fromUserId, fromUsername, conversationId }

    const conversationId = buildConversationId(currentUser, selectedChat);
    const isGroup        = selectedChat?.type === 'group';
    const isAdmin        = isGroup && selectedChat?.data?.admin === currentUser?._id;

    // ── fetch ─────────────────────────────────────────────────────────────────

    const fetchTasks = useCallback(async (silent = false) => {
        if (!conversationId) return;
        if (!silent) setLoading(true);
        try {
            const res = await tasksAPI.getByConversation(conversationId);
            setTasks(res.data.tasks || []);
        } catch (err) {
            console.error('TasksScreen: fetch failed', err?.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [conversationId]);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchTasks(true);
    };

    // ── socket listeners ─────────────────────────────────────────────────────

    useEffect(() => {
        if (!socket) return;

        // Someone requests permission to extract tasks from our DM
        socket.on('task:permission:request', ({ fromUserId, conversationId: cid }) => {
            if (cid !== conversationId) return;
            const fromUsername = selectedChat?.data?.username || 'User';
            setIncomingPerm({ fromUserId, fromUsername, conversationId: cid });
        });

        return () => {
            socket.off('task:permission:request');
        };
    }, [socket, conversationId, selectedChat]);

    // ── permission handlers ───────────────────────────────────────────────────

    const handleGrant = () => {
        if (!incomingPerm) return;
        socket.emit('task:permission:granted', {
            recipientId: incomingPerm.fromUserId,
            conversationId: incomingPerm.conversationId,
        });
        setIncomingPerm(null);
        // Refresh after a short delay — desktop will extract and save tasks
        setTimeout(() => fetchTasks(true), 3000);
    };

    const handleDeny = () => {
        if (!incomingPerm) return;
        socket.emit('task:permission:denied', {
            recipientId: incomingPerm.fromUserId,
            conversationId: incomingPerm.conversationId,
        });
        setIncomingPerm(null);
    };

    // ── status update ─────────────────────────────────────────────────────────

    const handleStatusChange = async (taskId, newStatus) => {
        try {
            const res = await tasksAPI.update(taskId, { status: newStatus });
            setTasks(prev => prev.map(t => t._id === taskId ? res.data.task : t));
        } catch (err) {
            Alert.alert('Error', 'Could not update task status');
        }
        setStatusModal(null);
    };

    // ── confirm AI task ───────────────────────────────────────────────────────

    const handleConfirm = async (taskId) => {
        try {
            const res = await tasksAPI.update(taskId, { confirmed: true });
            setTasks(prev => prev.map(t => t._id === taskId ? res.data.task : t));
        } catch (err) {
            Alert.alert('Error', 'Could not confirm task');
        }
    };

    // ── derived ───────────────────────────────────────────────────────────────

    const filteredTasks = filterStatus === 'all'
        ? tasks
        : tasks.filter(t => t.status === filterStatus);

    const canEditStatus = (task) => {
        const uid = currentUser?._id;
        return task.createdBy?._id === uid || task.createdBy === uid ||
               task.assignedTo?._id === uid || task.assignedTo === uid ||
               isAdmin;
    };

    // ── render task card ─────────────────────────────────────────────────────

    const renderTask = ({ item: task }) => {
        const statusMeta = getStatusMeta(task.status);
        const editable   = canEditStatus(task);

        return (
            <View style={[styles.card, !task.confirmed && styles.cardUnconfirmed]}>

                {/* AI suggestion badge */}
                {!task.confirmed && (
                    <View style={styles.aiBadge}>
                        <Text style={styles.aiBadgeText}>🤖 AI Suggestion</Text>
                        <TouchableOpacity
                            style={styles.confirmBtn}
                            onPress={() => handleConfirm(task._id)}
                        >
                            <Text style={styles.confirmBtnText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Title row */}
                <View style={styles.cardTop}>
                    <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLOR[task.priority] }]} />
                    <Text style={styles.cardTitle} numberOfLines={2}>{task.title}</Text>
                </View>

                {/* Description */}
                {task.description ? (
                    <Text style={styles.cardDesc} numberOfLines={3}>{task.description}</Text>
                ) : null}

                {/* Meta row */}
                <View style={styles.cardMeta}>
                    {/* Assignee */}
                    {task.assignedTo ? (
                        <View style={styles.assignee}>
                            {task.assignedTo.avatar ? (
                                <Image source={{ uri: task.assignedTo.avatar }} style={styles.assigneeAvatar} />
                            ) : (
                                <View style={styles.assigneeAvatar}>
                                    <Text style={styles.assigneeInitials}>
                                        {getInitials(task.assignedTo.username)}
                                    </Text>
                                </View>
                            )}
                            <Text style={styles.assigneeName}>{task.assignedTo.username}</Text>
                        </View>
                    ) : (
                        <Text style={styles.unassigned}>Unassigned</Text>
                    )}

                    {/* Due date */}
                    {task.dueDate ? (
                        <Text style={styles.dueDate}>
                            📅 {new Date(task.dueDate).toLocaleDateString()}
                        </Text>
                    ) : null}

                    {/* Status chip */}
                    <TouchableOpacity
                        style={[styles.statusChip, { borderColor: statusMeta.color }]}
                        onPress={() => editable && setStatusModal({ taskId: task._id, currentStatus: task.status })}
                        disabled={!editable}
                    >
                        <Text style={[styles.statusChipText, { color: statusMeta.color }]}>
                            {statusMeta.label}
                        </Text>
                        {editable && <Text style={[styles.statusChipCaret, { color: statusMeta.color }]}> ▾</Text>}
                    </TouchableOpacity>
                </View>

                {/* Tags */}
                {task.tags?.length > 0 && (
                    <View style={styles.tagRow}>
                        {task.tags.slice(0, 4).map(tag => (
                            <View key={tag} style={styles.tag}>
                                <Text style={styles.tagText}>#{tag}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    // ── main render ───────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.container} edges={['top']}>

            {/* ── Header ──────────────────────────────────────────────── */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>✅ Tasks</Text>
                {selectedChat && (
                    <Text style={styles.headerContext} numberOfLines={1}>
                        {isGroup ? selectedChat.data?.name : selectedChat.data?.username}
                    </Text>
                )}
            </View>

            {/* ── Incoming permission banner ───────────────────────────── */}
            {incomingPerm && (
                <View style={styles.permBanner}>
                    <Text style={styles.permBannerText}>
                        <Text style={{ fontWeight: '700' }}>{incomingPerm.fromUsername}</Text>
                        {' '}wants to use AI to extract tasks from this conversation.
                    </Text>
                    <View style={styles.permBannerActions}>
                        <TouchableOpacity style={styles.btnAllow} onPress={handleGrant}>
                            <Text style={styles.btnAllowText}>Allow</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnDeny} onPress={handleDeny}>
                            <Text style={styles.btnDenyText}>Deny</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* ── Filter tabs ──────────────────────────────────────────── */}
            <View style={styles.filterTabs}>
                {FILTER_TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.value}
                        style={[styles.filterTab, filterStatus === tab.value && styles.filterTabActive]}
                        onPress={() => setFilterStatus(tab.value)}
                    >
                        <Text style={[
                            styles.filterTabText,
                            filterStatus === tab.value && styles.filterTabTextActive
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── No conversation selected ─────────────────────────────── */}
            {!selectedChat ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>💬</Text>
                    <Text style={styles.emptyTitle}>No chat selected</Text>
                    <Text style={styles.emptySubtitle}>
                        Open a conversation from Chats or Groups to see its tasks here
                    </Text>
                </View>
            ) : loading ? (
                <View style={styles.emptyState}>
                    <ActivityIndicator size="large" color={Colors.accentPrimary} />
                    <Text style={styles.emptySubtitle}>Loading tasks…</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredTasks}
                    keyExtractor={item => item._id}
                    renderItem={renderTask}
                    contentContainerStyle={[
                        styles.list,
                        filteredTasks.length === 0 && styles.listEmpty
                    ]}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={Colors.accentPrimary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>📋</Text>
                            <Text style={styles.emptyTitle}>No tasks yet</Text>
                            <Text style={styles.emptySubtitle}>
                                Tasks created on desktop will appear here
                            </Text>
                        </View>
                    }
                />
            )}

            {/* ── Status picker modal ──────────────────────────────────── */}
            <Modal
                visible={!!statusModal}
                transparent
                animationType="slide"
                onRequestClose={() => setStatusModal(null)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setStatusModal(null)}
                >
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Change Status</Text>
                        {STATUS_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[
                                    styles.modalOption,
                                    statusModal?.currentStatus === opt.value && styles.modalOptionActive
                                ]}
                                onPress={() => handleStatusChange(statusModal.taskId, opt.value)}
                            >
                                <View style={[styles.modalOptionDot, { backgroundColor: opt.color }]} />
                                <Text style={[styles.modalOptionText, { color: opt.color }]}>
                                    {opt.label}
                                </Text>
                                {statusModal?.currentStatus === opt.value && (
                                    <Text style={[styles.modalOptionCheck, { color: opt.color }]}>✓</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.modalCancel} onPress={() => setStatusModal(null)}>
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

        </SafeAreaView>
    );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

    container: {
        flex: 1,
        backgroundColor: Colors.bgPrimary,
    },

    // Header
    header: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderPrimary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    headerContext: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        backgroundColor: Colors.bgTertiary,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: Radius.full,
        overflow: 'hidden',
        maxWidth: 140,
    },

    // Permission banner
    permBanner: {
        margin: Spacing.md,
        padding: Spacing.md,
        backgroundColor: 'rgba(99,102,241,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(99,102,241,0.3)',
        borderRadius: Radius.lg,
    },
    permBannerText: {
        color: Colors.textPrimary,
        fontSize: FontSize.sm,
        lineHeight: 20,
        marginBottom: Spacing.sm,
    },
    permBannerActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    btnAllow: {
        flex: 1,
        paddingVertical: 9,
        backgroundColor: Colors.accentPrimary,
        borderRadius: Radius.md,
        alignItems: 'center',
    },
    btnAllowText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: FontSize.sm,
    },
    btnDeny: {
        flex: 1,
        paddingVertical: 9,
        backgroundColor: 'rgba(239,68,68,0.15)',
        borderRadius: Radius.md,
        alignItems: 'center',
    },
    btnDenyText: {
        color: '#ef4444',
        fontWeight: '700',
        fontSize: FontSize.sm,
    },

    // Filter tabs
    filterTabs: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
        gap: 4,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderPrimary,
    },
    filterTab: {
        flex: 1,
        paddingVertical: 6,
        alignItems: 'center',
        borderRadius: Radius.sm,
    },
    filterTabActive: {
        backgroundColor: Colors.bgActive,
    },
    filterTabText: {
        fontSize: 11,
        fontWeight: '500',
        color: Colors.textTertiary,
    },
    filterTabTextActive: {
        color: Colors.textPrimary,
        fontWeight: '700',
    },

    // List
    list: {
        padding: Spacing.md,
        gap: 10,
    },
    listEmpty: {
        flex: 1,
        justifyContent: 'center',
    },

    // Task card
    card: {
        backgroundColor: Colors.bgSecondary,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.borderPrimary,
        marginBottom: 10,
    },
    cardUnconfirmed: {
        borderColor: 'rgba(139,92,246,0.35)',
        backgroundColor: 'rgba(139,92,246,0.05)',
    },

    // AI badge
    aiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 6,
    },
    aiBadgeText: {
        fontSize: 11,
        color: '#a78bfa',
        fontWeight: '600',
    },
    confirmBtn: {
        marginLeft: 'auto',
        paddingHorizontal: 10,
        paddingVertical: 3,
        backgroundColor: 'rgba(139,92,246,0.2)',
        borderRadius: Radius.sm,
    },
    confirmBtnText: {
        fontSize: 11,
        color: '#a78bfa',
        fontWeight: '700',
    },

    // Card content
    cardTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 6,
    },
    priorityDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 5,
    },
    cardTitle: {
        flex: 1,
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.textPrimary,
        lineHeight: 22,
    },
    cardDesc: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 19,
        marginBottom: 10,
        marginLeft: 16,
    },

    // Meta row
    cardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    assignee: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    assigneeAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.accentPrimary,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    assigneeInitials: {
        fontSize: 9,
        fontWeight: '800',
        color: '#fff',
    },
    assigneeName: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
    },
    unassigned: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },
    dueDate: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },
    statusChip: {
        marginLeft: 'auto',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Radius.full,
        borderWidth: 1,
    },
    statusChipText: {
        fontSize: 11,
        fontWeight: '700',
    },
    statusChipCaret: {
        fontSize: 10,
    },

    // Tags
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
        marginTop: 8,
    },
    tag: {
        backgroundColor: Colors.bgTertiary,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: Radius.full,
    },
    tagText: {
        fontSize: 10,
        color: Colors.textTertiary,
        fontWeight: '500',
    },

    // Empty / loading
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    emptyIcon: {
        fontSize: 44,
        marginBottom: Spacing.md,
    },
    emptyTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        textAlign: 'center',
        lineHeight: 20,
    },

    // Status modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: Colors.bgSecondary,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: Spacing.md,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderTopColor: Colors.borderSecondary,
    },
    modalHandle: {
        width: 36,
        height: 4,
        backgroundColor: Colors.borderSecondary,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 14,
    },
    modalTitle: {
        fontSize: FontSize.md,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
        textAlign: 'center',
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.md,
        marginBottom: 4,
    },
    modalOptionActive: {
        backgroundColor: Colors.bgTertiary,
    },
    modalOptionDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    modalOptionText: {
        fontSize: FontSize.md,
        fontWeight: '600',
        flex: 1,
    },
    modalOptionCheck: {
        fontSize: FontSize.md,
        fontWeight: '700',
    },
    modalCancel: {
        marginTop: 8,
        paddingVertical: 14,
        backgroundColor: Colors.bgTertiary,
        borderRadius: Radius.md,
        alignItems: 'center',
    },
    modalCancelText: {
        color: Colors.textSecondary,
        fontWeight: '600',
        fontSize: FontSize.md,
    },
});
