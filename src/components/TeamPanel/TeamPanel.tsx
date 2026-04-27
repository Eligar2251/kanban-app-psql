import React, { memo, useState, useCallback, useMemo } from 'react';
import {
  Users, UserPlus, Shield, ShieldCheck,
  Pencil, Eye, Crown, X, Trash2, LogOut,
  Mail, ChevronDown, Check, AlertCircle,
} from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import { useAuthStore } from '../../store/authStore';
import { membersService } from '../../services/members.service';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import Input from '../Input/Input';
import Avatar from '../Avatar/Avatar';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import type { ProjectMember, Invitation, ProjectRole } from '../../types';
import { canAdmin, isOwner } from '../../types';
import './TeamPanel.css';

interface TeamPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

const ROLE_INFO: Record<ProjectRole, { label: string; icon: React.ReactNode; desc: string }> = {
  owner: { label: 'OWNER', icon: <Crown size={12} />, desc: 'Full access, project deletion' },
  teamlead: { label: 'TEAMLEAD', icon: <ShieldCheck size={12} />, desc: 'Manage members, cards, columns' },
  editor: { label: 'EDITOR', icon: <Pencil size={12} />, desc: 'Take tasks, drag cards' },
  viewer: { label: 'VIEWER', icon: <Eye size={12} />, desc: 'View only' },
};

const ASSIGNABLE_ROLES: ProjectRole[] = ['teamlead', 'editor', 'viewer'];

const TeamPanel = memo(function TeamPanel({
  isOpen,
  onClose,
  projectId,
}: TeamPanelProps) {
  const { user } = useAuthStore();
  const { members, myRole } = useBoardStore();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('editor');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationsLoaded, setInvitationsLoaded] = useState(false);

  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<ProjectMember | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const [leavingProject, setLeavingProject] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  const iCanAdmin = myRole ? canAdmin(myRole) : false;
  const iAmOwner = myRole ? isOwner(myRole) : false;

  // Load invitations when panel opens
  React.useEffect(() => {
    if (isOpen && iCanAdmin && !invitationsLoaded) {
      membersService.getInvitations(projectId).then((inv) => {
        setInvitations(inv);
        setInvitationsLoaded(true);
      }).catch(console.error);
    }
  }, [isOpen, iCanAdmin, projectId, invitationsLoaded]);

  // Reset on close
  React.useEffect(() => {
    if (!isOpen) {
      setInviteEmail('');
      setInviteError('');
      setInviteSuccess('');
      setChangingRole(null);
      setInvitationsLoaded(false);
    }
  }, [isOpen]);

  const handleInvite = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inviteEmail.trim()) {
      setInviteError('Email is required.');
      return;
    }
    if (inviteEmail.trim().toLowerCase() === user.email?.toLowerCase()) {
      setInviteError('You cannot invite yourself.');
      return;
    }
    const exists = members.find(
      (m) => m.profile?.email?.toLowerCase() === inviteEmail.trim().toLowerCase()
    );
    if (exists) {
      setInviteError('This user is already a member.');
      return;
    }
    setInviteError('');
    setInviteSuccess('');
    setInviteLoading(true);
    try {
      const inv = await membersService.invite(projectId, inviteEmail.trim(), inviteRole, user.id);
      setInvitations((prev) => [inv, ...prev]);
      setInviteEmail('');
      setInviteSuccess(`Invitation sent to ${inv.email}`);
      setTimeout(() => setInviteSuccess(''), 4000);
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.code === '23505') {
        setInviteError('An invitation already exists for this email.');
      } else {
        setInviteError(err.message || 'Failed to send invitation.');
      }
    } finally {
      setInviteLoading(false);
    }
  }, [user, inviteEmail, inviteRole, projectId, members]);

  const handleRoleChange = useCallback(async (member: ProjectMember, newRole: ProjectRole) => {
    setChangingRole(member.id);
    try {
      await membersService.updateMemberRole(member.id, newRole);
      useBoardStore.getState().updateMember(member.id, { role: newRole });
    } catch (err) {
      console.error('Role change failed:', err);
    } finally {
      setChangingRole(null);
    }
  }, []);

  const handleRemoveConfirm = useCallback(async () => {
    if (!removingMember) return;
    setRemoveLoading(true);
    try {
      await membersService.removeMember(removingMember.id);
      useBoardStore.getState().removeMember(removingMember.id);
      setRemovingMember(null);
    } catch (err) {
      console.error('Remove member failed:', err);
    } finally {
      setRemoveLoading(false);
    }
  }, [removingMember]);

  const handleCancelInvitation = useCallback(async (invId: string) => {
    try {
      await membersService.cancelInvitation(invId);
      setInvitations((prev) => prev.filter((i) => i.id !== invId));
    } catch (err) {
      console.error('Cancel invitation failed:', err);
    }
  }, []);

  const handleLeave = useCallback(async () => {
    if (!user) return;
    setLeaveLoading(true);
    try {
      await membersService.leaveProject(projectId, user.id);
      window.location.href = '/';
    } catch (err) {
      console.error('Leave failed:', err);
    } finally {
      setLeaveLoading(false);
    }
  }, [user, projectId]);

  const sortedMembers = useMemo(() => {
    const order: Record<string, number> = { owner: 0, admin: 1, editor: 2, viewer: 3 };
    return [...members].sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9));
  }, [members]);

  const pendingInvitations = useMemo(
    () => invitations.filter((i) => i.status === 'pending'),
    [invitations]
  );

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="TEAM" maxWidth={540}>
        <div className="team-panel">
          {/* Members list */}
          <div className="team-section">
            <div className="team-section-header">
              <Users size={13} />
              <span>MEMBERS ({members.length})</span>
            </div>
            <div className="team-members-list">
              {sortedMembers.map((member) => {
                const info = ROLE_INFO[member.role];
                const isMe = member.user_id === user?.id;
                const memberIsOwner = isOwner(member.role);

                return (
                  <div key={member.id} className="team-member-row">
                    <Avatar
                      name={member.profile?.full_name || member.profile?.email || '?'}
                      userId={member.user_id}
                      size="sm"
                    />
                    <div className="team-member-info">
                      <span className="team-member-name">
                        {member.profile?.full_name || 'Unknown'}
                        {isMe && <span className="team-member-you">(you)</span>}
                      </span>
                      <span className="team-member-email">
                        {member.profile?.email}
                      </span>
                    </div>

                    <div className="team-member-role-area">
                      {iCanAdmin && !memberIsOwner && !isMe ? (
                        <div className="team-role-dropdown">
                          <select
                            className="team-role-select"
                            value={member.role}
                            onChange={(e) =>
                              handleRoleChange(member, e.target.value as ProjectRole)
                            }
                            disabled={changingRole === member.id}
                          >
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_INFO[r].label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span
                          className={`team-role-badge team-role-badge--${member.role}`}
                        >
                          {info.icon}
                          {info.label}
                        </span>
                      )}

                      {iCanAdmin && !memberIsOwner && !isMe && (
                        <button
                          className="team-remove-btn"
                          onClick={() => setRemovingMember(member)}
                          title="Remove member"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Invite */}
          {iCanAdmin && (
            <div className="team-section">
              <div className="team-section-header">
                <UserPlus size={13} />
                <span>INVITE</span>
              </div>
              <form className="team-invite-form" onSubmit={handleInvite} noValidate>
                {inviteError && (
                  <div className="team-alert team-alert--error">
                    <AlertCircle size={11} />
                    {inviteError}
                  </div>
                )}
                {inviteSuccess && (
                  <div className="team-alert team-alert--success">
                    <Check size={11} />
                    {inviteSuccess}
                  </div>
                )}

                <div className="team-invite-row">
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    icon={<Mail size={14} />}
                  />
                  <select
                    className="team-invite-role-select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_INFO[r].label}</option>
                    ))}
                  </select>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={inviteLoading}
                    icon={<UserPlus size={12} />}
                  >
                    Invite
                  </Button>
                </div>
              </form>

              {/* Pending invitations */}
              {pendingInvitations.length > 0 && (
                <div className="team-pending">
                  <span className="team-pending-label">
                    PENDING ({pendingInvitations.length})
                  </span>
                  {pendingInvitations.map((inv) => (
                    <div key={inv.id} className="team-pending-row">
                      <Mail size={12} className="team-pending-icon" />
                      <span className="team-pending-email">{inv.email}</span>
                      <span className="team-pending-role">
                        {ROLE_INFO[inv.role]?.label}
                      </span>
                      <button
                        className="team-pending-cancel"
                        onClick={() => handleCancelInvitation(inv.id)}
                        title="Cancel invitation"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Role legend */}
          <div className="team-section">
            <div className="team-section-header">
              <Shield size={13} />
              <span>ROLES</span>
            </div>
            <div className="team-roles-legend">
              {Object.entries(ROLE_INFO).map(([role, info]) => (
                <div key={role} className="team-role-legend-row">
                  <span className={`team-role-badge team-role-badge--${role}`}>
                    {info.icon}
                    {info.label}
                  </span>
                  <span className="team-role-desc">{info.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Leave project */}
          {!iAmOwner && (
            <div className="team-leave-section">
              <Button
                variant="ghost-danger"
                size="sm"
                icon={<LogOut size={12} />}
                onClick={() => setLeavingProject(true)}
              >
                Leave Project
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!removingMember}
        onClose={() => setRemovingMember(null)}
        onConfirm={handleRemoveConfirm}
        title="REMOVE MEMBER"
        message={
          <>
            Remove <strong>{removingMember?.profile?.full_name || removingMember?.profile?.email}</strong> from this project?
          </>
        }
        confirmLabel="Remove"
        isLoading={removeLoading}
      />

      <ConfirmDialog
        isOpen={leavingProject}
        onClose={() => setLeavingProject(false)}
        onConfirm={handleLeave}
        title="LEAVE PROJECT"
        message="You will lose access to this project. Continue?"
        confirmLabel="Leave"
        isLoading={leaveLoading}
      />
    </>
  );
});

export default TeamPanel;