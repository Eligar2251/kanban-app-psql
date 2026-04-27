import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Pencil, Trash2, X, Check, MoreHorizontal } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useBoardStore } from '../../store/boardStore';
import { commentsService } from '../../services/comments.service';
import { activityService } from '../../services/activity.service';
import Avatar from '../Avatar/Avatar';
import Button from '../Button/Button';
import type { Comment } from '../../types';
import { canEdit, canManage } from '../../types';
import './CommentSection.css';

interface CommentSectionProps {
  cardId: string;
  projectId: string;
}

const CommentSection = memo(function CommentSection({
  cardId,
  projectId,
}: CommentSectionProps) {
  const { user, profile } = useAuthStore();
  const myRole = useBoardStore((s) => s.myRole);

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const listEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canComment = myRole ? canEdit(myRole) : false;
  const canModerate = myRole ? canManage(myRole) : false;

  // Load comments
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    commentsService
      .getComments(cardId)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cardId]);

  // Auto-scroll on new comments
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  // Submit new comment
  const handleSubmit = useCallback(async () => {
    if (!user || !newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const comment = await commentsService.addComment(
        cardId,
        projectId,
        user.id,
        newComment.trim()
      );
      setComments((prev) => [...prev, comment]);
      setNewComment('');
      textareaRef.current?.focus();

      await activityService.log(projectId, cardId, 'comment_added', {
        comment_id: comment.id,
        preview: newComment.trim().slice(0, 80),
      });
    } catch (err) {
      console.error('Comment failed:', err);
    } finally {
      setSubmitting(false);
    }
  }, [user, newComment, cardId, projectId, submitting]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Edit comment
  const handleStartEdit = useCallback((comment: Comment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
    setMenuOpen(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editBody.trim()) return;
    try {
      await commentsService.updateComment(editingId, editBody.trim());
      setComments((prev) =>
        prev.map((c) =>
          c.id === editingId ? { ...c, body: editBody.trim(), updated_at: new Date().toISOString() } : c
        )
      );
      setEditingId(null);
      setEditBody('');
    } catch (err) {
      console.error('Edit failed:', err);
    }
  }, [editingId, editBody]);

  // Delete comment
  const handleDelete = useCallback(async (commentId: string) => {
    setMenuOpen(null);
    try {
      await commentsService.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, []);

  const formatTime = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  return (
    <div className="comment-section">
      {/* Comments list */}
      <div className="comment-list">
        {loading ? (
          <div className="comment-loading">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="comment-empty">No comments yet</div>
        ) : (
          comments.map((comment) => {
            const isAuthor = comment.user_id === user?.id;
            const isEditing = editingId === comment.id;
            const wasEdited = comment.created_at !== comment.updated_at;

            return (
              <div key={comment.id} className="comment-item">
                <Avatar
                  name={comment.profile?.full_name || comment.profile?.email || '?'}
                  userId={comment.user_id}
                  size="sm"
                />
                <div className="comment-content">
                  <div className="comment-header">
                    <span className="comment-author">
                      {comment.profile?.full_name || 'Unknown'}
                    </span>
                    <span className="comment-time">
                      {formatTime(comment.created_at)}
                      {wasEdited && ' (edited)'}
                    </span>

                    {(isAuthor || canModerate) && !isEditing && (
                      <div className="comment-menu-wrap">
                        <button
                          className="comment-menu-trigger"
                          onClick={() => setMenuOpen(menuOpen === comment.id ? null : comment.id)}
                        >
                          <MoreHorizontal size={13} />
                        </button>
                        {menuOpen === comment.id && (
                          <>
                            <div className="comment-menu-backdrop" onClick={() => setMenuOpen(null)} />
                            <div className="comment-menu">
                              {isAuthor && (
                                <button className="comment-menu-item" onClick={() => handleStartEdit(comment)}>
                                  <Pencil size={11} /> Edit
                                </button>
                              )}
                              <button className="comment-menu-item comment-menu-item--danger" onClick={() => handleDelete(comment.id)}>
                                <Trash2 size={11} /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="comment-edit-wrap">
                      <textarea
                        className="comment-edit-textarea"
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        autoFocus
                      />
                      <div className="comment-edit-actions">
                        <Button variant="ghost" size="sm" icon={<X size={11} />} onClick={() => setEditingId(null)}>Cancel</Button>
                        <Button variant="primary" size="sm" icon={<Check size={11} />} onClick={handleSaveEdit}>Save</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="comment-body markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {comment.body}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={listEndRef} />
      </div>

      {/* New comment input */}
      {canComment && (
        <div className="comment-input-section">
          <Avatar
            name={profile?.full_name || profile?.email || '?'}
            userId={user?.id}
            size="sm"
          />
          <div className="comment-input-wrap">
            <textarea
              ref={textareaRef}
              className="comment-input-textarea"
              placeholder="Write a comment... (Ctrl+Enter to send)"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
            />
            <div className="comment-input-footer">
              <span className="comment-input-hint">Markdown supported</span>
              <Button
                variant="primary"
                size="sm"
                icon={<Send size={11} />}
                onClick={handleSubmit}
                loading={submitting}
                disabled={!newComment.trim()}
              >
                Comment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default CommentSection;