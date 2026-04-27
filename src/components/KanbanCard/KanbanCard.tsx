import React, { memo, useMemo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, AlertTriangle } from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import Badge from '../Badge/Badge';
import Avatar from '../Avatar/Avatar';
import type { CardWithTags } from '../../types';
import './KanbanCard.css';

const PRIORITY_COLORS: Record<string, string> = {
  none: 'transparent',
  low: '#00E676',
  medium: '#FF9500',
  high: '#FF6B00',
  urgent: '#FF3B3B',
};

interface KanbanCardProps {
  card: CardWithTags;
  onClick: (card: CardWithTags) => void;
  isDragOverlay?: boolean;
}

const KanbanCard = memo(function KanbanCard({
  card,
  onClick,
  isDragOverlay = false,
}: KanbanCardProps) {
  const members = useBoardStore((s) => s.members);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: 'card',
      card,
    },
  });

  const style = useMemo(() => {
    const t = transform
      ? {
          transform: CSS.Transform.toString({
            ...transform,
            scaleX: 1,
            scaleY: 1,
          }),
          transition,
        }
      : {};

    return {
      ...t,
      opacity: isDragging ? 0.3 : 1,
    };
  }, [transform, transition, isDragging]);

  const priorityColor = PRIORITY_COLORS[card.priority] || 'transparent';

  const deadlineInfo = useMemo(() => {
    if (!card.deadline) return null;
    const d = new Date(card.deadline);
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const isOverdue = d < now;
    const isToday = d <= todayEnd && !isOverdue;

    const formatted = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    return { formatted, isOverdue, isToday };
  }, [card.deadline]);

  const truncatedDesc = useMemo(() => {
    if (!card.description) return '';
    const stripped = card.description.replace(/[#*`>\-\[\]()!]/g, '').trim();
    return stripped.length > 80 ? stripped.slice(0, 80) + '…' : stripped;
  }, [card.description]);

  const assignee = useMemo(() => {
    if (!card.assignee_id) return null;
    return members.find((m) => m.user_id === card.assignee_id) || null;
  }, [card.assignee_id, members]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) return;
      onClick(card);
    },
    [onClick, card, isDragging]
  );

  const cardClasses = [
    'kanban-card',
    isDragging ? 'kanban-card--dragging' : '',
    isDragOverlay ? 'kanban-card--overlay' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={setNodeRef}
      style={style as React.CSSProperties}
      className={cardClasses}
      onClick={handleClick}
      {...attributes}
      {...listeners}
    >
      {/* Priority indicator */}
      <div
        className="kanban-card-priority-bar"
        style={{ background: priorityColor }}
      />

      <div className="kanban-card-inner">
        {/* Title */}
        <h4 className="kanban-card-title">{card.title}</h4>

        {/* Description preview */}
        {truncatedDesc && (
          <p className="kanban-card-desc">{truncatedDesc}</p>
        )}

        {/* Tags */}
        {card.tags && card.tags.length > 0 && (
          <div className="kanban-card-tags">
            {card.tags.slice(0, 3).map((tag) => (
              <Badge key={tag.id} color={tag.color} variant="outline">
                {tag.name}
              </Badge>
            ))}
            {card.tags.length > 3 && (
              <span className="kanban-card-tags-more">
                +{card.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        {(deadlineInfo || card.priority !== 'none' || assignee) && (
          <div className="kanban-card-footer">
            <div className="kanban-card-footer-left">
              {deadlineInfo && (
                <span
                  className={`kanban-card-deadline ${
                    deadlineInfo.isOverdue
                      ? 'kanban-card-deadline--overdue'
                      : deadlineInfo.isToday
                      ? 'kanban-card-deadline--today'
                      : ''
                  }`}
                >
                  {deadlineInfo.isOverdue && <AlertTriangle size={10} />}
                  <Clock size={10} />
                  {deadlineInfo.formatted}
                </span>
              )}
              {card.priority !== 'none' && (
                <span
                  className="kanban-card-priority-label"
                  style={{ color: priorityColor }}
                >
                  {card.priority.toUpperCase()}
                </span>
              )}
            </div>
            {assignee && (
              <div className="kanban-card-footer-right">
                <Avatar
                  name={assignee.profile?.full_name || assignee.profile?.email || '?'}
                  userId={assignee.user_id}
                  size="sm"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default KanbanCard;