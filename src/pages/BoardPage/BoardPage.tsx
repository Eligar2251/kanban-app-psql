import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings, Palette, ArrowLeft, Users, Activity, Hash, ToggleLeft, Archive, Minimize2, Type } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useBoardStore } from '../../store/boardStore';
import { projectsService } from '../../services/projects.service';
import { columnsService } from '../../services/columns.service';
import { cardsService } from '../../services/cards.service';
import { tagsService } from '../../services/tags.service';
import { membersService } from '../../services/members.service';
import { supabase } from '../../lib/supabase';
import { usePageVisibility } from '../../hooks/usePageVisibility';
import { canAdmin } from '../../types';
import Header from '../../components/Header/Header';
import FilterBar from '../../components/FilterBar/FilterBar';
import KanbanBoard from '../../components/KanbanBoard/KanbanBoard';
import TeamPanel from '../../components/TeamPanel/TeamPanel';
import InvitationsBanner from '../../components/InvitationsBanner/InvitationsBanner';
import ActivityFeed from '../../components/ActivityFeed/ActivityFeed';
import Button from '../../components/Button/Button';
import Modal from '../../components/Modal/Modal';
import type { Project, Column, CardWithTags, Tag, ProjectMember } from '../../types';
import './BoardPage.css';

const BOARD_BG_OPTIONS = [
  { label: 'Default', value: '#0B0B0D' },
  { label: 'Charcoal', value: '#0F0F14' },
  { label: 'Dark Navy', value: '#0A0E1A' },
  { label: 'Dark Green', value: '#0A110E' },
  { label: 'Deep Brown', value: '#11100D' },
  { label: 'Midnight', value: '#0D0B14' },
];

const ACCENT_OPTIONS = [
  '#C8FF00', '#00E676', '#FF9500', '#FF3B3B',
  '#00B4D8', '#7B61FF', '#4ECDC4', '#FFE66D',
];

export default function BoardPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const {
    columns,
    cards,
    tags,
    members,
    myRole,
    isLoading,
    setColumns,
    setCards,
    setTags,
    setMembers,
    setMyRole,
    setLoading,
    addColumn,
    updateColumn,
    removeColumn,
    addCard,
    updateCard,
    removeCard,
    addTag,
    removeTag,
    addMember,
    removeMember,
    updateMember,
    resetFilters,
  } = useBoardStore();

  const [project, setProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'appearance' | 'behavior' | 'activity'>('appearance');
  const [boardBg, setBoardBg] = useState('#0B0B0D');
  const [accentColor, setAccentColor] = useState('#C8FF00');
  const [savingSettings, setSavingSettings] = useState(false);

  // Behavior settings state
  const [cardNumbers, setCardNumbers] = useState(true);
  const [showCardId, setShowCardId] = useState(false);
  const [autoArchiveDone, setAutoArchiveDone] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [doneColumnName, setDoneColumnName] = useState('Done');

  const [teamOpen, setTeamOpen] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSyncRef = useRef<number>(Date.now());
  const isInitialLoadRef = useRef(true);

  // ============ Load board ============

  const loadBoard = useCallback(
    async (silent: boolean = false) => {
      if (!projectId || !user) return;
      if (!silent) setLoading(true);

      try {
        const [projectData, columnsData, cardsData, tagsData, membersData] =
          await Promise.all([
            projectsService.getProject(projectId),
            columnsService.getColumns(projectId),
            cardsService.getCards(projectId),
            tagsService.getTags(projectId),
            membersService.getMembers(projectId),
          ]);

        const myMembership = membersData.find((m) => m.user_id === user.id);
        if (!myMembership) {
          setProjectError(true);
          setLoading(false);
          return;
        }

        setProject(projectData);
        setColumns(columnsData);
        setCards(cardsData);
        setTags(tagsData);
        setMembers(membersData);
        setMyRole(myMembership.role);
        setBoardBg(projectData.board_bg || '#0B0B0D');
        setAccentColor(projectData.accent_color || '#C8FF00');

        // Behavior settings from project data
        setCardNumbers(projectData.card_numbers ?? true);
        setShowCardId(projectData.show_card_id ?? false);
        setAutoArchiveDone(projectData.auto_archive_done ?? false);
        setCompactMode(projectData.compact_mode ?? false);
        setDoneColumnName(projectData.done_column_name ?? 'Done');

        lastSyncRef.current = Date.now();
      } catch (err) {
        console.error('Failed to load board:', err);
        if (!silent) setProjectError(true);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [projectId, user, setLoading, setColumns, setCards, setTags, setMembers, setMyRole]
  );

  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      resetFilters();
      loadBoard(false);
    }
  }, [loadBoard, resetFilters]);

  // ============ Re-sync on tab focus ============

  const handleTabVisible = useCallback(() => {
    const STALE_MS = 10_000;
    const elapsed = Date.now() - lastSyncRef.current;
    if (elapsed > STALE_MS && projectId && user) {
      loadBoard(true);
    }
  }, [loadBoard, projectId, user]);

  usePageVisibility(handleTabVisible);

  // ============ Realtime ============

  useEffect(() => {
    if (!projectId || !user) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`board-${projectId}-${Date.now()}`)

      // Columns
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'columns', filter: `project_id=eq.${projectId}` },
        (payload) => {
          const newCol = payload.new as Column;
          const state = useBoardStore.getState();
          if (!state.columns.find((c) => c.id === newCol.id)) addColumn(newCol);
          lastSyncRef.current = Date.now();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'columns', filter: `project_id=eq.${projectId}` },
        (payload) => {
          updateColumn((payload.new as Column).id, payload.new as Column);
          lastSyncRef.current = Date.now();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'columns', filter: `project_id=eq.${projectId}` },
        (payload) => {
          removeColumn((payload.old as Column).id);
          lastSyncRef.current = Date.now();
        }
      )

      // Cards
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cards', filter: `project_id=eq.${projectId}` },
        async (payload) => {
          const newCard = payload.new as CardWithTags;
          const state = useBoardStore.getState();
          if (!state.cards.find((c) => c.id === newCard.id)) {
            try {
              const { data: tagLinks } = await supabase
                .from('card_tags')
                .select('tag:tags(*)')
                .eq('card_id', newCard.id);
              const cardTags = (tagLinks ?? []).map((ct: any) => ct.tag).filter(Boolean);
              addCard({ ...newCard, tags: cardTags });
            } catch {
              addCard({ ...newCard, tags: [] });
            }
          }
          lastSyncRef.current = Date.now();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cards', filter: `project_id=eq.${projectId}` },
        async (payload) => {
          const updated = payload.new as CardWithTags;
          try {
            const { data: tagLinks } = await supabase
              .from('card_tags')
              .select('tag:tags(*)')
              .eq('card_id', updated.id);
            const cardTags = (tagLinks ?? []).map((ct: any) => ct.tag).filter(Boolean);
            updateCard(updated.id, { ...updated, tags: cardTags });
          } catch {
            updateCard(updated.id, updated);
          }
          lastSyncRef.current = Date.now();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'cards', filter: `project_id=eq.${projectId}` },
        (payload) => {
          removeCard((payload.old as { id: string }).id);
          lastSyncRef.current = Date.now();
        }
      )

      // Tags
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tags', filter: `project_id=eq.${projectId}` },
        (payload) => {
          const newTag = payload.new as Tag;
          const state = useBoardStore.getState();
          if (!state.tags.find((t) => t.id === newTag.id)) addTag(newTag);
          lastSyncRef.current = Date.now();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tags', filter: `project_id=eq.${projectId}` },
        (payload) => {
          removeTag((payload.old as { id: string }).id);
          lastSyncRef.current = Date.now();
        }
      )

      // Members
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'project_members', filter: `project_id=eq.${projectId}` },
        async (payload) => {
          const newMember = payload.new as ProjectMember;
          const state = useBoardStore.getState();
          if (!state.members.find((m) => m.id === newMember.id)) {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', newMember.user_id)
                .single();
              addMember({ ...newMember, profile: profile || undefined });
            } catch {
              addMember(newMember);
            }
          }
          lastSyncRef.current = Date.now();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'project_members', filter: `project_id=eq.${projectId}` },
        (payload) => {
          const updated = payload.new as ProjectMember;
          updateMember(updated.id, updated);
          if (updated.user_id === user.id) {
            setMyRole(updated.role);
          }
          lastSyncRef.current = Date.now();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'project_members', filter: `project_id=eq.${projectId}` },
        (payload) => {
          const deleted = payload.old as ProjectMember;
          removeMember(deleted.id);
          if (deleted.user_id === user.id) {
            window.location.href = '/';
          }
          lastSyncRef.current = Date.now();
        }
      )

      // Project settings
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` },
        (payload) => {
          const updated = payload.new as Project;
          setProject(updated);
          setBoardBg(updated.board_bg || '#0B0B0D');
          setAccentColor(updated.accent_color || '#C8FF00');
          lastSyncRef.current = Date.now();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          setTimeout(() => {
            if (channelRef.current) channelRef.current.subscribe();
          }, 2000);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [
    projectId, user,
    addColumn, updateColumn, removeColumn,
    addCard, updateCard, removeCard,
    addTag, removeTag,
    addMember, updateMember, removeMember, setMyRole,
  ]);

  // ============ Board settings ============

  const handleOpenSettings = useCallback(() => {
    if (project) {
      setBoardBg(project.board_bg || '#0B0B0D');
      setAccentColor(project.accent_color || '#C8FF00');
      setCardNumbers(project.card_numbers ?? true);
      setShowCardId(project.show_card_id ?? false);
      setAutoArchiveDone(project.auto_archive_done ?? false);
      setCompactMode(project.compact_mode ?? false);
      setDoneColumnName(project.done_column_name ?? 'Done');
    }
    setSettingsTab('appearance');
    setSettingsOpen(true);
  }, [project]);

  const handleSaveSettings = useCallback(async () => {
    if (!project) return;
    setSavingSettings(true);
    try {
      const updated = await projectsService.updateProject(project.id, {
        board_bg: boardBg,
        accent_color: accentColor,
        card_numbers: cardNumbers,
        show_card_id: showCardId,
        auto_archive_done: autoArchiveDone,
        compact_mode: compactMode,
        done_column_name: doneColumnName,
      });
      setProject(updated);
      setSettingsOpen(false);
    } catch (err) {
      console.error('Settings save failed:', err);
    } finally {
      setSavingSettings(false);
    }
  }, [project, boardBg, accentColor, cardNumbers, showCardId, autoArchiveDone, compactMode, doneColumnName]);

  // ============ Memos ============

  const breadcrumbs = useMemo(
    () => [
      { label: 'Projects', href: '/' },
      { label: project?.name || 'Loading...' },
    ],
    [project?.name]
  );

  const headerActions = useMemo(
    () => (
      <>
        <Button
          variant="ghost"
          size="sm"
          icon={<Users size={13} />}
          onClick={() => setTeamOpen(true)}
        >
          Team ({members.length})
        </Button>
        {myRole && canAdmin(myRole) && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Settings size={13} />}
            onClick={handleOpenSettings}
          >
            Settings
          </Button>
        )}
      </>
    ),
    [handleOpenSettings, members.length, myRole]
  );

  const boardStyle = useMemo(
    () =>
      ({
        '--color-accent': accentColor,
        '--color-accent-dim': `${accentColor}14`,
        '--color-accent-dim2': `${accentColor}26`,
        '--board-bg': boardBg,
      } as React.CSSProperties),
    [accentColor, boardBg]
  );

  // ============ Error ============

  if (projectError) {
    return (
      <div className="board-page">
        <Header />
        <div className="board-error">
          <motion.div
            className="board-error-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="board-error-title">Project not found</h2>
            <p className="board-error-text">
              This project doesn't exist or you don't have access.
            </p>
            <Button
              variant="primary"
              icon={<ArrowLeft size={13} />}
              onClick={() => navigate('/')}
            >
              Back to Projects
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ============ Loading ============

  if (isLoading || !project) {
    return (
      <div className="board-page">
        <Header breadcrumbs={breadcrumbs} />
        <div className="board-loading">
          <div className="board-loading-cols">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="board-loading-col">
                <div className="board-loading-col-header" />
                <div className="board-loading-col-cards">
                  {[...Array(3 - (i % 2))].map((__, j) => (
                    <div key={j} className="board-loading-card" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <span className="board-loading-text">LOADING BOARD...</span>
        </div>
      </div>
    );
  }

  // ============ Main ============

  return (
    <div className="board-page" style={boardStyle}>
      <Header breadcrumbs={breadcrumbs} actions={headerActions} />
      <FilterBar />
      <InvitationsBanner />

      <div className="board-content" style={{ backgroundColor: boardBg }}>
        <KanbanBoard projectId={project.id} />
      </div>

      {/* Team panel */}
      <TeamPanel
        isOpen={teamOpen}
        onClose={() => setTeamOpen(false)}
        projectId={project.id}
      />

      {/* Board settings */}
      <Modal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="PROJECT SETTINGS"
        maxWidth={settingsTab === 'activity' ? 640 : 500}
      >
        <div className="board-settings">
          {/* Tabs */}
          <div className="board-settings-tabs">
            <button
              className={`board-settings-tab ${settingsTab === 'appearance' ? 'board-settings-tab--active' : ''}`}
              onClick={() => setSettingsTab('appearance')}
            >
              <Palette size={12} /> Appearance
            </button>
            <button
              className={`board-settings-tab ${settingsTab === 'behavior' ? 'board-settings-tab--active' : ''}`}
              onClick={() => setSettingsTab('behavior')}
            >
              <Settings size={12} /> Behavior
            </button>
            <button
              className={`board-settings-tab ${settingsTab === 'activity' ? 'board-settings-tab--active' : ''}`}
              onClick={() => setSettingsTab('activity')}
            >
              <Activity size={12} /> Activity
            </button>
          </div>

          {/* Appearance tab */}
          {settingsTab === 'appearance' && (
            <div className="board-settings-panel">
              <div className="board-settings-section">
                <span className="board-settings-label">
                  <Palette size={12} /> BOARD BACKGROUND
                </span>
                <div className="board-settings-bg-grid">
                  {BOARD_BG_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`board-settings-bg-btn ${boardBg === opt.value ? 'board-settings-bg-btn--active' : ''}`}
                      style={{ background: opt.value }}
                      onClick={() => setBoardBg(opt.value)}
                      title={opt.label}
                    >
                      <span className="board-settings-bg-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="board-settings-section">
                <span className="board-settings-label">
                  <Palette size={12} /> ACCENT COLOR
                </span>
                <div className="board-settings-accent-grid">
                  {ACCENT_OPTIONS.map((color) => (
                    <button
                      key={color}
                      className={`board-settings-accent-btn ${accentColor === color ? 'board-settings-accent-btn--active' : ''}`}
                      style={{ '--swatch': color } as React.CSSProperties}
                      onClick={() => setAccentColor(color)}
                    />
                  ))}
                </div>
              </div>

              <div className="board-settings-section">
                <span className="board-settings-label">PREVIEW</span>
                <div
                  className="board-settings-preview"
                  style={{ background: boardBg, '--preview-accent': accentColor } as React.CSSProperties}
                >
                  <div className="board-settings-preview-col">
                    <div className="board-settings-preview-header" />
                    <div className="board-settings-preview-card" />
                    <div className="board-settings-preview-card board-settings-preview-card--sm" />
                  </div>
                  <div className="board-settings-preview-col">
                    <div className="board-settings-preview-header" />
                    <div className="board-settings-preview-card board-settings-preview-card--sm" />
                  </div>
                  <div className="board-settings-preview-col">
                    <div className="board-settings-preview-header" />
                    <div className="board-settings-preview-card" />
                    <div className="board-settings-preview-card" />
                  </div>
                </div>
              </div>

              <div className="board-settings-actions">
                <Button variant="ghost" onClick={() => setSettingsOpen(false)} disabled={savingSettings}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSaveSettings} loading={savingSettings}>
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Behavior tab */}
          {settingsTab === 'behavior' && (
            <div className="board-settings-panel">
              <div className="board-settings-toggle-list">
                <label className="board-settings-toggle-row">
                  <div className="board-settings-toggle-info">
                    <Hash size={13} />
                    <div>
                      <span className="board-settings-toggle-title">Card numbers</span>
                      <span className="board-settings-toggle-desc">Show sequential number on each card</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="board-settings-checkbox"
                    checked={cardNumbers}
                    onChange={(e) => setCardNumbers(e.target.checked)}
                  />
                </label>

                <label className="board-settings-toggle-row">
                  <div className="board-settings-toggle-info">
                    <Type size={13} />
                    <div>
                      <span className="board-settings-toggle-title">Show card ID</span>
                      <span className="board-settings-toggle-desc">Display UUID snippet on cards</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="board-settings-checkbox"
                    checked={showCardId}
                    onChange={(e) => setShowCardId(e.target.checked)}
                  />
                </label>

                <label className="board-settings-toggle-row">
                  <div className="board-settings-toggle-info">
                    <Minimize2 size={13} />
                    <div>
                      <span className="board-settings-toggle-title">Compact mode</span>
                      <span className="board-settings-toggle-desc">Reduce card padding and font sizes</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="board-settings-checkbox"
                    checked={compactMode}
                    onChange={(e) => setCompactMode(e.target.checked)}
                  />
                </label>

                <label className="board-settings-toggle-row">
                  <div className="board-settings-toggle-info">
                    <Archive size={13} />
                    <div>
                      <span className="board-settings-toggle-title">Auto-archive completed</span>
                      <span className="board-settings-toggle-desc">Hide cards in Done column after 7 days</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="board-settings-checkbox"
                    checked={autoArchiveDone}
                    onChange={(e) => setAutoArchiveDone(e.target.checked)}
                  />
                </label>

                <div className="board-settings-input-row">
                  <div className="board-settings-toggle-info">
                    <Archive size={13} />
                    <div>
                      <span className="board-settings-toggle-title">Done column name</span>
                      <span className="board-settings-toggle-desc">Column matching this name counts as "done"</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    className="board-settings-text-input"
                    value={doneColumnName}
                    onChange={(e) => setDoneColumnName(e.target.value)}
                    placeholder="Done"
                  />
                </div>
              </div>

              <div className="board-settings-actions">
                <Button variant="ghost" onClick={() => setSettingsOpen(false)} disabled={savingSettings}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSaveSettings} loading={savingSettings}>
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Activity tab */}
          {settingsTab === 'activity' && (
            <div className="board-settings-panel board-settings-panel--activity">
              <ActivityFeed projectId={project.id} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}