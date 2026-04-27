import React, { memo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Check, X, Bell } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { membersService } from '../../services/members.service';
import Button from '../Button/Button';
import type { Invitation } from '../../types';
import './InvitationsBanner.css';

interface InvitationsBannerProps {
  compact?: boolean;
}

const InvitationsBanner = memo(function InvitationsBanner({
  compact = false,
}: InvitationsBannerProps) {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(false);

  const fetchInvitations = useCallback(async () => {
    if (!profile?.email) return;
    try {
      const data = await membersService.getMyInvitations(profile.email);
      setInvitations(data);
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    }
  }, [profile?.email]);

  // Initial fetch
  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // Poll every 30 seconds for new invitations
  useEffect(() => {
    if (!profile?.email) return;
    const interval = setInterval(fetchInvitations, 30_000);
    return () => clearInterval(interval);
  }, [fetchInvitations, profile?.email]);

  // Re-fetch on visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        fetchInvitations();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [fetchInvitations]);

  const handleAccept = useCallback(async (inv: Invitation) => {
    setLoading((p) => ({ ...p, [inv.id]: true }));
    try {
      await membersService.acceptInvitation(inv.id);
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      // Navigate to the project
      if (inv.project_id) {
        navigate(`/project/${inv.project_id}`);
      }
    } catch (err) {
      console.error('Accept failed:', err);
    } finally {
      setLoading((p) => ({ ...p, [inv.id]: false }));
    }
  }, [navigate]);

  const handleDecline = useCallback(async (inv: Invitation) => {
    setLoading((p) => ({ ...p, [inv.id]: true }));
    try {
      await membersService.declineInvitation(inv.id);
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
    } catch (err) {
      console.error('Decline failed:', err);
    } finally {
      setLoading((p) => ({ ...p, [inv.id]: false }));
    }
  }, []);

  // Compact mode — just a bell icon with count (for header)
  if (compact) {
    if (invitations.length === 0) return null;

    return (
      <div className="invitations-compact">
        <button
          className="invitations-bell-btn"
          onClick={() => setExpanded(!expanded)}
          title={`${invitations.length} pending invitation(s)`}
        >
          <Bell size={15} />
          <span className="invitations-bell-count">{invitations.length}</span>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              className="invitations-dropdown"
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
            >
              <div className="invitations-dropdown-header">
                <span>INVITATIONS ({invitations.length})</span>
              </div>
              <div className="invitations-dropdown-list">
                {invitations.map((inv) => (
                  <div key={inv.id} className="invitations-dropdown-item">
                    <div className="invitations-dropdown-info">
                      <span className="invitations-dropdown-project">
                        {(inv as any).project?.name || 'Unknown project'}
                      </span>
                      <span className="invitations-dropdown-from">
                        from {(inv as any).inviter_profile?.full_name || (inv as any).inviter_profile?.email || 'someone'}
                        {' · '}
                        <span className="invitations-dropdown-role">
                          {inv.role.toUpperCase()}
                        </span>
                      </span>
                    </div>
                    <div className="invitations-dropdown-actions">
                      <button
                        className="invitations-dropdown-accept"
                        onClick={() => handleAccept(inv)}
                        disabled={loading[inv.id]}
                        title="Accept"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        className="invitations-dropdown-decline"
                        onClick={() => handleDecline(inv)}
                        disabled={loading[inv.id]}
                        title="Decline"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Backdrop to close dropdown */}
        {expanded && (
          <div
            className="invitations-backdrop"
            onClick={() => setExpanded(false)}
          />
        )}
      </div>
    );
  }

  // Full banner mode (for pages)
  if (invitations.length === 0) return null;

  return (
    <div className="invitations-banner">
      <AnimatePresence mode="popLayout">
        {invitations.map((inv) => (
          <motion.div
            key={inv.id}
            className="invitation-item"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Mail size={13} className="invitation-icon" />
            <span className="invitation-text">
              <strong>
                {(inv as any).inviter_profile?.full_name ||
                  (inv as any).inviter_profile?.email ||
                  'Someone'}
              </strong>
              {' invited you to '}
              <strong>{(inv as any).project?.name || 'a project'}</strong>
              {' as '}
              <span className="invitation-role">{inv.role.toUpperCase()}</span>
            </span>
            <div className="invitation-actions">
              <Button
                variant="primary"
                size="sm"
                icon={<Check size={11} />}
                onClick={() => handleAccept(inv)}
                loading={loading[inv.id]}
              >
                Accept
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<X size={11} />}
                onClick={() => handleDecline(inv)}
                disabled={loading[inv.id]}
              >
                Decline
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

export default InvitationsBanner;