import React, {
  useState, useCallback, useEffect, useMemo, memo,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertTriangle, Calendar, Tag as TagIcon, Flag,
  Plus, X, Trash2, Clock, UserCheck, Eye, Pencil,
} from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import Input from '../Input/Input';
import Avatar from '../Avatar/Avatar';
import type { CardWithTags, Tag, Priority, CreateCardData } from '../../types';
import { canEdit } from '../../types';
import './CardModal.css';

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'none', label: 'NONE', color: '#5A5A72' },
  { value: 'low', label: 'LOW', color: '#00E676' },
  { value: 'medium', label: 'MEDIUM', color: '#FF9500' },
  { value: 'high', label: 'HIGH', color: '#FF6B00' },
  { value: 'urgent', label: 'URGENT', color: '#FF3B3B' },
];

const TAG_COLORS = [
  '#C8FF00', '#00E676', '#FF9500', '#00B4D8',
  '#7B61FF', '#FF6B6B', '#4ECDC4', '#FFE66D',
];

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateCardData) => Promise<void>;
  onDelete?: () => Promise<void>;
  card?: CardWithTags | null;
  tags: Tag[];
  onCreateTag: (name: string, color: string) => Promise<Tag | undefined>;
  isLoading?: boolean;
}

const CardModal = memo(function CardModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  card,
  tags,
  onCreateTag,
  isLoading = false,
}: CardModalProps) {
  const members = useBoardStore((s) => s.members);
  const myRole = useBoardStore((s) => s.myRole);
  const readOnly = myRole ? !canEdit(myRole) : false;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('none');
  const [deadline, setDeadline] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Description tabs: write / preview
  const [descTab, setDescTab] = useState<'write' | 'preview'>('write');

  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [tagCreating, setTagCreating] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (card) {
        setTitle(card.title);
        setDescription(card.description);
        setPriority(card.priority);
        setDeadline(
          card.deadline ? new Date(card.deadline).toISOString().split('T')[0] : ''
        );
        setSelectedTagIds(card.tags?.map((t) => t.id) || []);
        setAssigneeId(card.assignee_id);
      } else {
        setTitle('');
        setDescription('');
        setPriority('none');
        setDeadline('');
        setSelectedTagIds([]);
        setAssigneeId(null);
      }
      setError('');
      setShowNewTag(false);
      setShowDeleteConfirm(false);
      setDescTab(card ? 'preview' : 'write');
    }
  }, [isOpen, card]);

  const handleToggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const handleCreateTag = useCallback(async () => {
    if (!newTagName.trim()) return;
    setTagCreating(true);
    try {
      const created = await onCreateTag(newTagName.trim(), newTagColor);
      if (created) setSelectedTagIds((prev) => [...prev, created.id]);
      setNewTagName('');
      setShowNewTag(false);
    } catch (err) {
      console.error('Failed to create tag:', err);
    } finally {
      setTagCreating(false);
    }
  }, [newTagName, newTagColor, onCreateTag]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (readOnly) return;
      if (!title.trim()) {
        setError('Card title is required.');
        return;
      }
      setError('');
      await onSave({
        title: title.trim(),
        description,
        priority,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        tag_ids: selectedTagIds,
        assignee_id: assigneeId,
      });
    },
    [title, description, priority, deadline, selectedTagIds, assigneeId, onSave, readOnly]
  );

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    setDeleteLoading(true);
    try {
      await onDelete();
    } finally {
      setDeleteLoading(false);
    }
  }, [onDelete]);

  const deadlineStatus = useMemo(() => {
    if (!deadline) return null;
    const d = new Date(deadline);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (d < now) return 'overdue';
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'today';
    if (days <= 7) return 'soon';
    return 'normal';
  }, [deadline]);

  const handleInsertMarkdown = useCallback((prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('card-desc-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = description.slice(start, end);
    const replacement = prefix + (selected || 'text') + suffix;
    const newDesc = description.slice(0, start) + replacement + description.slice(end);
    setDescription(newDesc);
    // Restore focus after state update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected || 'text').length);
    }, 0);
  }, [description]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={readOnly ? 'VIEW CARD' : card ? 'EDIT CARD' : 'NEW CARD'}
      maxWidth={720}
    >
      <form className="card-modal-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="card-modal-error">
            <AlertTriangle size={12} />
            <span>{error}</span>
          </div>
        )}

        {/* Title */}
        <div className="card-modal-title-field">
          <input
            className="card-modal-title-input"
            type="text"
            placeholder="Card title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            disabled={readOnly}
          />
        </div>

        {/* Description — GitHub style */}
        <div className="card-modal-desc-section">
          <div className="card-modal-desc-header">
            <div className="card-modal-desc-tabs">
              <button
                type="button"
                className={`card-modal-desc-tab ${descTab === 'write' ? 'card-modal-desc-tab--active' : ''}`}
                onClick={() => setDescTab('write')}
                disabled={readOnly}
              >
                <Pencil size={12} />
                Write
              </button>
              <button
                type="button"
                className={`card-modal-desc-tab ${descTab === 'preview' ? 'card-modal-desc-tab--active' : ''}`}
                onClick={() => setDescTab('preview')}
              >
                <Eye size={12} />
                Preview
              </button>
            </div>

            {descTab === 'write' && !readOnly && (
              <div className="card-modal-desc-toolbar">
                <button type="button" className="card-modal-toolbar-btn" onClick={() => handleInsertMarkdown('## ')} title="Heading">
                  <span>H</span>
                </button>
                <button type="button" className="card-modal-toolbar-btn" onClick={() => handleInsertMarkdown('**', '**')} title="Bold">
                  <span>B</span>
                </button>
                <button type="button" className="card-modal-toolbar-btn card-modal-toolbar-btn--italic" onClick={() => handleInsertMarkdown('*', '*')} title="Italic">
                  <span>I</span>
                </button>
                <button type="button" className="card-modal-toolbar-btn" onClick={() => handleInsertMarkdown('`', '`')} title="Code">
                  <span>&lt;/&gt;</span>
                </button>
                <div className="card-modal-toolbar-divider" />
                <button type="button" className="card-modal-toolbar-btn" onClick={() => handleInsertMarkdown('- ')} title="List">
                  <span>•</span>
                </button>
                <button type="button" className="card-modal-toolbar-btn" onClick={() => handleInsertMarkdown('1. ')} title="Numbered list">
                  <span>1.</span>
                </button>
                <button type="button" className="card-modal-toolbar-btn" onClick={() => handleInsertMarkdown('- [ ] ')} title="Task list">
                  <span>☐</span>
                </button>
                <div className="card-modal-toolbar-divider" />
                <button type="button" className="card-modal-toolbar-btn" onClick={() => handleInsertMarkdown('> ')} title="Quote">
                  <span>"</span>
                </button>
                <button type="button" className="card-modal-toolbar-btn" onClick={() => handleInsertMarkdown('\n```\n', '\n```\n')} title="Code block">
                  <span>{'{}'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="card-modal-desc-body">
            {descTab === 'write' ? (
              <textarea
                id="card-desc-textarea"
                className="card-modal-desc-textarea"
                placeholder="Describe the task...&#10;&#10;Supports Markdown:&#10;## Heading&#10;- Bullet list&#10;1. Numbered list&#10;- [ ] Task list&#10;**bold** *italic* `code`&#10;> quote&#10;```code block```"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={readOnly}
              />
            ) : (
              <div className="card-modal-desc-preview markdown-body">
                {description ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {description}
                  </ReactMarkdown>
                ) : (
                  <span className="card-modal-desc-empty">No description provided.</span>
                )}
              </div>
            )}
          </div>

          {descTab === 'write' && !readOnly && (
            <div className="card-modal-desc-footer">
              <span className="card-modal-desc-hint">
                Markdown supported · **bold** · *italic* · `code` · ## heading · - list · - [ ] task
              </span>
            </div>
          )}
        </div>

        {/* Sidebar fields */}
        <div className="card-modal-fields">
          {/* Priority */}
          <div className="card-modal-field">
            <span className="card-modal-field-label">
              <Flag size={12} />
              PRIORITY
            </span>
            <div className="card-modal-priority-list">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`card-modal-priority-btn ${
                    priority === p.value ? 'card-modal-priority-btn--active' : ''
                  }`}
                  style={{ '--priority-btn-color': p.color } as React.CSSProperties}
                  onClick={() => !readOnly && setPriority(p.value)}
                  disabled={readOnly}
                >
                  <span className="card-modal-priority-dot" style={{ background: p.color }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee */}
          {members.length > 0 && (
            <div className="card-modal-field">
              <span className="card-modal-field-label">
                <UserCheck size={12} />
                ASSIGNEE
              </span>
              <div className="card-modal-assignee-list">
                <button
                  type="button"
                  className={`card-modal-assignee-btn ${
                    assigneeId === null ? 'card-modal-assignee-btn--active' : ''
                  }`}
                  onClick={() => !readOnly && setAssigneeId(null)}
                  disabled={readOnly}
                >
                  <span className="card-modal-assignee-none">—</span>
                  Unassigned
                </button>
                {members.map((member) => (
                  <button
                    key={member.user_id}
                    type="button"
                    className={`card-modal-assignee-btn ${
                      assigneeId === member.user_id ? 'card-modal-assignee-btn--active' : ''
                    }`}
                    onClick={() => !readOnly && setAssigneeId(member.user_id)}
                    disabled={readOnly}
                  >
                    <Avatar
                      name={member.profile?.full_name || member.profile?.email || '?'}
                      userId={member.user_id}
                      size="sm"
                    />
                    <span className="card-modal-assignee-name">
                      {member.profile?.full_name || member.profile?.email || 'Unknown'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Deadline */}
          <div className="card-modal-field">
            <span className="card-modal-field-label">
              <Calendar size={12} />
              DEADLINE
            </span>
            <div className="card-modal-deadline-wrap">
              <input
                type="date"
                className={`card-modal-date-input ${
                  deadlineStatus === 'overdue' ? 'card-modal-date-input--overdue' : ''
                }`}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={readOnly}
              />
              {deadline && !readOnly && (
                <button type="button" className="card-modal-date-clear" onClick={() => setDeadline('')}>
                  <X size={11} />
                </button>
              )}
              {deadlineStatus === 'overdue' && (
                <span className="card-modal-deadline-warn"><AlertTriangle size={10} />OVERDUE</span>
              )}
              {deadlineStatus === 'today' && (
                <span className="card-modal-deadline-today"><Clock size={10} />TODAY</span>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="card-modal-field">
            <span className="card-modal-field-label">
              <TagIcon size={12} />
              TAGS
            </span>
            {tags.length > 0 && (
              <div className="card-modal-tags-list">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`card-modal-tag-btn ${
                      selectedTagIds.includes(tag.id) ? 'card-modal-tag-btn--active' : ''
                    }`}
                    style={{ '--tag-btn-color': tag.color } as React.CSSProperties}
                    onClick={() => !readOnly && handleToggleTag(tag.id)}
                    disabled={readOnly}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
            {!readOnly && (
              showNewTag ? (
                <div className="card-modal-new-tag">
                  <input
                    className="card-modal-new-tag-input"
                    placeholder="Tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    autoFocus
                  />
                  <div className="card-modal-new-tag-colors">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`card-modal-tag-color-btn ${newTagColor === c ? 'card-modal-tag-color-btn--active' : ''}`}
                        style={{ background: c }}
                        onClick={() => setNewTagColor(c)}
                      />
                    ))}
                  </div>
                  <div className="card-modal-new-tag-actions">
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewTag(false); setNewTagName(''); }}>Cancel</Button>
                    <Button type="button" variant="primary" size="sm" onClick={handleCreateTag} loading={tagCreating} disabled={!newTagName.trim()}>Add Tag</Button>
                  </div>
                </div>
              ) : (
                <button type="button" className="card-modal-add-tag-btn" onClick={() => setShowNewTag(true)}>
                  <Plus size={11} /> Create Tag
                </button>
              )
            )}
          </div>
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="card-modal-actions">
            {card && onDelete && (
              showDeleteConfirm ? (
                <div className="card-modal-delete-confirm">
                  <span className="card-modal-delete-text">Delete this card?</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>No</Button>
                  <Button type="button" variant="danger" size="sm" onClick={handleDelete} loading={deleteLoading}>Yes, Delete</Button>
                </div>
              ) : (
                <Button type="button" variant="ghost-danger" size="sm" icon={<Trash2 size={12} />} onClick={() => setShowDeleteConfirm(true)}>Delete</Button>
              )
            )}
            <div className="card-modal-actions-right">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
              <Button type="submit" variant="primary" loading={isLoading}>{card ? 'Save Changes' : 'Create Card'}</Button>
            </div>
          </div>
        )}

        {readOnly && (
          <div className="card-modal-actions">
            <div className="card-modal-readonly-badge">VIEW ONLY</div>
            <div className="card-modal-actions-right">
              <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
});

export default CardModal;