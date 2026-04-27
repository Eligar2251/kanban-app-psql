import React, { memo, useMemo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X, Clock, AlertTriangle, Flag, Calendar,
  Tag as TagIcon, UserCheck, MessageSquare,
  ExternalLink, Hand,
} from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import { useAuthStore } from '../../store/authStore';
import { cardsService } from '../../services/cards.service';
import Avatar from '../Avatar/Avatar';
import Badge from '../Badge/Badge';
import Button from '../Button/Button';
import type { CardWithTags } from '../../types';
import { canManage, canEdit } from '../../types';
import CommentSection from '../CommentSection/CommentSection';
import './CardDrawer.css';

const PRIORITY_COLORS: Record<string, string> = {
  none: '#5A5A72',
  low: '#00E676',
  medium: '#FF9500',
  high: '#FF6B00',
  urgent: '#FF3B3B',
};

const PRIORITY_LABELS: Record<string, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

interface CardDrawerProps {
  card: CardWithTags | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (card: CardWithTags) => void;
}

const CardDrawer = memo(function CardDrawer({
  card,
  isOpen,
  onClose,
  onEdit,
}: CardDrawerProps) {
  const { user } = useAuthStore();
  const members = useBoardStore((s) => s.members);
  const myRole = useBoardStore((s) => s.myRole);
  const updateCard = useBoardStore((s) => s.updateCard);
  const columns = useBoardStore((s) => s.columns);

  const [assigning, setAssigning] = useState(false);

  const assignee = useMemo(() => {
    if (!card?.assignee_id) return null;
    return members.find((m) => m.user_id === card.assignee_id) || null;
  }, [card?.assignee_id, members]);

  const column = useMemo(() => {
    if (!card) return null;
    return columns.find((c) => c.id === card.column_id) || null;
  }, [card, columns]);

  const creator = useMemo(() => {
    if (!card) return null;
    return members.find((m) => m.user_id === card.user_id) || null;
  }, [card, members]);

  const deadlineInfo = useMemo(() => {
    if (!card?.deadline) return null;
    const d = new Date(card.deadline);
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const isOverdue = d < now;
    const isToday = d <= todayEnd && !isOverdue;
    const formatted = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return { formatted, isOverdue, isToday };
  }, [card?.deadline]);

  const iAmAssignee = card?.assignee_id === user?.id;
  const canSelfAssign = myRole ? canEdit(myRole) : false;
  const canEditCard = myRole ? canManage(myRole) : false;

  // Self-assign / unassign
  const handleSelfAssign = useCallback(async () => {
    if (!card || !user || assigning) return;
    setAssigning(true);
    try {
      const newAssigneeId = iAmAssignee ? null : user.id;
      await cardsService.updateCard(card.id, { assignee_id: newAssigneeId });
      updateCard(card.id, { assignee_id: newAssigneeId });
    } catch (err) {
      console.error('Self-assign failed:', err);
    } finally {
      setAssigning(false);
    }
  }, [card, user, iAmAssignee, assigning, updateCard]);

  const handleEditClick = useCallback(() => {
    if (card) onEdit(card);
  }, [card, onEdit]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const createdDate = useMemo(() => {
    if (!card) return '';
    return new Date(card.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [card]);

  const updatedDate = useMemo(() => {
    if (!card) return '';
    return new Date(card.updated_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [card]);

  return (
    <AnimatePresence>
      {isOpen && card && (
        <motion.div
          className="card-drawer-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleOverlayClick}
        >
          <motion.aside
            className="card-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="card-drawer-header">
              <div className="card-drawer-header-left">
                {column && (
                  <span
                    className="card-drawer-column-badge"
                    style={{ '--col-badge-color': column.color } as React.CSSProperties}
                  >
                    {column.name}
                  </span>
                )}
              </div>
              <div className="card-drawer-header-right">
                {canEditCard && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ExternalLink size={12} />}
                    onClick={handleEditClick}
                  >
                    Edit
                  </Button>
                )}
                <button className="card-drawer-close" onClick={onClose}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body — scrollable */}
            <div className="card-drawer-body">
              {/* Title */}
              <h1 className="card-drawer-title">{card.title}</h1>

              {/* Meta row */}
              <div className="card-drawer-meta-row">
                {/* Priority */}
                <div className="card-drawer-meta-item">
                  <Flag size={11} style={{ color: PRIORITY_COLORS[card.priority] }} />
                  <span
                    className="card-drawer-meta-value"
                    style={{ color: PRIORITY_COLORS[card.priority] }}
                  >
                    {PRIORITY_LABELS[card.priority]}
                  </span>
                </div>

                {/* Deadline */}
                {deadlineInfo && (
                  <div
                    className={`card-drawer-meta-item ${
                      deadlineInfo.isOverdue
                        ? 'card-drawer-meta-item--danger'
                        : deadlineInfo.isToday
                        ? 'card-drawer-meta-item--warning'
                        : ''
                    }`}
                  >
                    {deadlineInfo.isOverdue && <AlertTriangle size={11} />}
                    <Calendar size={11} />
                    <span className="card-drawer-meta-value">
                      {deadlineInfo.formatted}
                    </span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {card.tags && card.tags.length > 0 && (
                <div className="card-drawer-tags">
                  <span className="card-drawer-section-label">
                    <TagIcon size={11} /> LABELS
                  </span>
                  <div className="card-drawer-tags-list">
                    {card.tags.map((tag) => (
                      <Badge key={tag.id} color={tag.color} variant="outline">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignee section */}
              <div className="card-drawer-assignee-section">
                <span className="card-drawer-section-label">
                  <UserCheck size={11} /> ASSIGNEE
                </span>

                {assignee ? (
                  <div className="card-drawer-assignee-card">
                    <Avatar
                      name={assignee.profile?.full_name || assignee.profile?.email || '?'}
                      userId={assignee.user_id}
                      size="md"
                    />
                    <div className="card-drawer-assignee-info">
                      <span className="card-drawer-assignee-name">
                        {assignee.profile?.full_name || 'Unknown'}
                      </span>
                      <span className="card-drawer-assignee-email">
                        {assignee.profile?.email}
                      </span>
                    </div>
                    {iAmAssignee && canSelfAssign && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelfAssign}
                        loading={assigning}
                      >
                        Unassign me
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="card-drawer-no-assignee">
                    <span>No one assigned</span>
                    {canSelfAssign && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Hand size={12} />}
                        onClick={handleSelfAssign}
                        loading={assigning}
                      >
                        Take this task
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Description — main content */}
              <div className="card-drawer-description">
                <span className="card-drawer-section-label">
                  <MessageSquare size={11} /> DESCRIPTION
                </span>
                <div className="card-drawer-desc-content markdown-body">
                  {card.description ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {card.description}
                    </ReactMarkdown>
                  ) : (
                    <p className="card-drawer-no-desc">
                      No description provided.
                    </p>
                  )}
                </div>
              </div>

              {/* Comments */}
              <div className="card-drawer-comments">
                <span className="card-drawer-section-label">
                  <MessageSquare size={11} /> COMMENTS
                </span>
                <CommentSection cardId={card.id} projectId={card.project_id} />
              </div>

              {/* Activity / metadata footer */}
              <div className="card-drawer-activity">
                <span className="card-drawer-section-label">
                  <Clock size={11} /> ACTIVITY
                </span>
                <div className="card-drawer-activity-list">
                  {creator && (
                    <div className="card-drawer-activity-item">
                      <Avatar
                        name={creator.profile?.full_name || '?'}
                        userId={creator.user_id}
                        size="sm"
                      />
                      <span className="card-drawer-activity-text">
                        <strong>{creator.profile?.full_name || 'Unknown'}</strong>
                        {' created this task'}
                      </span>
                      <span className="card-drawer-activity-time">{createdDate}</span>
                    </div>
                  )}
                  <div className="card-drawer-activity-item">
                    <div className="card-drawer-activity-dot" />
                    <span className="card-drawer-activity-text">Last updated</span>
                    <span className="card-drawer-activity-time">{updatedDate}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default CardDrawer;