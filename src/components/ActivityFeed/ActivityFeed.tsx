import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, ArrowRight, Plus, Trash2, Pencil,
  UserCheck, UserMinus, MessageSquare, Move,
  RefreshCw, Filter, ChevronDown,
} from 'lucide-react';
import { activityService } from '../../services/activity.service';
import Avatar from '../Avatar/Avatar';
import Button from '../Button/Button';
import type { ActivityLogEntry } from '../../types';
import './ActivityFeed.css';

interface ActivityFeedProps {
  projectId: string;
}

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string; verb: string }> = {
  card_created: { icon: <Plus size={11} />, color: '#00E676', verb: 'created card' },
  card_updated: { icon: <Pencil size={11} />, color: '#FF9500', verb: 'updated card' },
  card_deleted: { icon: <Trash2 size={11} />, color: '#FF3B3B', verb: 'deleted card' },
  card_moved: { icon: <Move size={11} />, color: '#00B4D8', verb: 'moved card' },
  assigned_self: { icon: <UserCheck size={11} />, color: '#C8FF00', verb: 'took task' },
  unassigned_self: { icon: <UserMinus size={11} />, color: '#5A5A72', verb: 'left task' },
  comment_added: { icon: <MessageSquare size={11} />, color: '#7B61FF', verb: 'commented on' },
  column_created: { icon: <Plus size={11} />, color: '#4ECDC4', verb: 'created column' },
  column_deleted: { icon: <Trash2 size={11} />, color: '#FF3B3B', verb: 'deleted column' },
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'ALL' },
  { value: 'cards', label: 'CARDS' },
  { value: 'moves', label: 'MOVES' },
  { value: 'assign', label: 'ASSIGN' },
  { value: 'comments', label: 'COMMENTS' },
];

const ActivityFeed = memo(function ActivityFeed({ projectId }: ActivityFeedProps) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 30;

  const loadEntries = useCallback(async (offset: number, append: boolean = false) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const data = await activityService.getProjectActivity(projectId, PAGE_SIZE, offset);
      if (append) {
        setEntries((prev) => [...prev, ...data]);
      } else {
        setEntries(data);
      }
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error('Activity load failed:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [projectId]);

  useEffect(() => {
    setPage(0);
    loadEntries(0);
  }, [loadEntries]);

  const handleLoadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    loadEntries(next * PAGE_SIZE, true);
  }, [page, loadEntries]);

  const handleRefresh = useCallback(() => {
    setPage(0);
    loadEntries(0);
  }, [loadEntries]);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    if (filter === 'cards') return entries.filter((e) => ['card_created', 'card_updated', 'card_deleted'].includes(e.action));
    if (filter === 'moves') return entries.filter((e) => e.action === 'card_moved');
    if (filter === 'assign') return entries.filter((e) => ['assigned_self', 'unassigned_self'].includes(e.action));
    if (filter === 'comments') return entries.filter((e) => e.action === 'comment_added');
    return entries;
  }, [entries, filter]);

  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: ActivityLogEntry[] }[] = [];
    let currentDate = '';

    for (const entry of filtered) {
      const d = new Date(entry.created_at).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, items: [entry] });
      } else {
        groups[groups.length - 1].items.push(entry);
      }
    }

    return groups;
  }, [filtered]);

  const formatTime = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const renderDetails = useCallback((entry: ActivityLogEntry) => {
    const d = entry.details || {};

    if (entry.action === 'card_moved' && d.from_column && d.to_column) {
      return (
        <span className="activity-detail-move">
          <span className="activity-detail-col">{d.from_column}</span>
          <ArrowRight size={10} />
          <span className="activity-detail-col">{d.to_column}</span>
        </span>
      );
    }

    if (entry.action === 'comment_added' && d.preview) {
      return (
        <span className="activity-detail-preview">"{d.preview}"</span>
      );
    }

    if (d.title) {
      return (
        <span className="activity-detail-title">"{d.title}"</span>
      );
    }

    return null;
  }, []);

  return (
    <div className="activity-feed">
      {/* Header */}
      <div className="activity-feed-header">
        <div className="activity-feed-header-left">
          <Activity size={14} />
          <span className="activity-feed-title">Activity</span>
          <span className="activity-feed-count">{entries.length}</span>
        </div>
        <div className="activity-feed-header-right">
          <button className="activity-refresh-btn" onClick={handleRefresh} title="Refresh">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="activity-filters">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`activity-filter-btn ${filter === opt.value ? 'activity-filter-btn--active' : ''}`}
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="activity-timeline">
        {loading ? (
          <div className="activity-loading">
            <span>Loading activity...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="activity-empty">
            <span>No activity yet</span>
          </div>
        ) : (
          groupedByDate.map((group) => (
            <div key={group.date} className="activity-date-group">
              <div className="activity-date-label">{group.date}</div>
              <div className="activity-date-items">
                <AnimatePresence initial={false}>
                  {group.items.map((entry) => {
                    const config = ACTION_CONFIG[entry.action] || {
                      icon: <Activity size={11} />,
                      color: '#5A5A72',
                      verb: entry.action,
                    };

                    return (
                      <motion.div
                        key={entry.id}
                        className="activity-item"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <div className="activity-item-line" />
                        <div
                          className="activity-item-dot"
                          style={{ '--dot-color': config.color } as React.CSSProperties}
                        >
                          {config.icon}
                        </div>
                        <div className="activity-item-content">
                          <div className="activity-item-row">
                            <Avatar
                              name={entry.profile?.full_name || '?'}
                              userId={entry.user_id}
                              size="sm"
                            />
                            <span className="activity-item-text">
                              <strong>{entry.profile?.full_name || 'Unknown'}</strong>
                              {' '}
                              {config.verb}
                            </span>
                            <span className="activity-item-time">
                              {formatTime(entry.created_at)}
                            </span>
                          </div>
                          {renderDetails(entry) && (
                            <div className="activity-item-details">
                              {renderDetails(entry)}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))
        )}

        {hasMore && !loading && filtered.length > 0 && (
          <div className="activity-load-more">
            <Button
              variant="ghost"
              size="sm"
              icon={<ChevronDown size={12} />}
              onClick={handleLoadMore}
              loading={loadingMore}
            >
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});

export default ActivityFeed;