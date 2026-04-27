import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Plus, FolderOpen } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { projectsService } from '../../services/projects.service';
import { supabase } from '../../lib/supabase';
import { usePageVisibility } from '../../hooks/usePageVisibility';
import Header from '../../components/Header/Header';
import ProjectCard from '../../components/ProjectCard/ProjectCard';
import ProjectModal from '../../components/ProjectModal/ProjectModal';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import Button from '../../components/Button/Button';
import type { Project, CreateProjectData } from '../../types';
import './ProjectsPage.css';
import InvitationsBanner from '../../components/InvitationsBanner/InvitationsBanner';

interface ProjectStats {
  total: number;
  done: number;
}

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, ProjectStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const lastSyncRef = useRef<number>(Date.now());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load projects
  const loadProjects = useCallback(async (silent: boolean = false) => {
    if (!user) return;
    if (!silent) setIsLoading(true);

    try {
      const data = await projectsService.getProjects(user.id);
      setProjects(data);

      const statsResults = await Promise.all(
        data.map(async (p) => {
          const stats = await projectsService.getProjectStats(p.id);
          return [p.id, stats] as [string, ProjectStats];
        })
      );
      setStatsMap(Object.fromEntries(statsResults));
      lastSyncRef.current = Date.now();
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProjects(false);
  }, [loadProjects]);

  // Re-sync on tab focus
  const handleTabVisible = useCallback(() => {
    const STALE_MS = 10_000;
    const elapsed = Date.now() - lastSyncRef.current;
    if (elapsed > STALE_MS) {
      loadProjects(true);
    }
  }, [loadProjects]);

  usePageVisibility(handleTabVisible);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`projects-page-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newProject = payload.new as Project;
            setProjects((prev) => {
              if (prev.find((p) => p.id === newProject.id)) return prev;
              return [...prev, newProject].sort((a, b) => a.position - b.position);
            });
            const stats = await projectsService.getProjectStats(newProject.id);
            setStatsMap((prev) => ({ ...prev, [newProject.id]: stats }));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Project;
            setProjects((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p))
            );
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as Project;
            setProjects((prev) => prev.filter((p) => p.id !== deleted.id));
            setStatsMap((prev) => {
              const next = { ...prev };
              delete next[deleted.id];
              return next;
            });
          }
          lastSyncRef.current = Date.now();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          setTimeout(() => {
            if (channelRef.current) {
              channelRef.current.subscribe();
            }
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
  }, [user]);

  // Create project
  const handleCreate = useCallback(async (data: CreateProjectData) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await projectsService.createProject(user.id, data);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  // Edit project
  const handleEdit = useCallback(async (data: CreateProjectData) => {
    if (!editingProject) return;
    setIsSaving(true);
    try {
      await projectsService.updateProject(editingProject.id, data);
      setEditingProject(null);
    } catch (err) {
      console.error('Failed to update project:', err);
    } finally {
      setIsSaving(false);
    }
  }, [editingProject]);

  // Delete project
  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingProject) return;
    setIsDeleting(true);
    try {
      await projectsService.deleteProject(deletingProject.id);
      setDeletingProject(null);
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setIsDeleting(false);
    }
  }, [deletingProject]);

  const handleOpenBoard = useCallback(
    (project: Project) => {
      navigate(`/project/${project.id}`);
    },
    [navigate]
  );

  const handleOpenEdit = useCallback((project: Project) => {
    setEditingProject(project);
  }, []);

  const handleOpenDelete = useCallback((project: Project) => {
    setDeletingProject(project);
  }, []);

  const handleModalSave = useCallback(
    async (data: CreateProjectData) => {
      if (editingProject) {
        await handleEdit(data);
      } else {
        await handleCreate(data);
      }
    },
    [editingProject, handleEdit, handleCreate]
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setEditingProject(null);
  }, []);

  const headerActions = useMemo(
    () => (
      <Button
        variant="primary"
        size="sm"
        icon={<Plus size={13} />}
        onClick={() => setIsModalOpen(true)}
      >
        New Project
      </Button>
    ),
    []
  );

  return (
    <div className="projects-page">
      <Header actions={headerActions} />
      <InvitationsBanner />

      <main className="projects-main dot-grid">
        <div className="projects-container">
          <div className="projects-page-header">
            <h1 className="projects-page-title">Projects</h1>
            <span className="projects-page-count">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </span>
          </div>

          {isLoading ? (
            <div className="projects-loading">
              <div className="projects-loading-dots">
                <span />
                <span />
                <span />
              </div>
              <span className="projects-loading-text">LOADING PROJECTS...</span>
            </div>
          ) : projects.length === 0 ? (
            <motion.div
              className="projects-empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <FolderOpen size={40} className="projects-empty-icon" />
              <h2 className="projects-empty-title">No projects yet</h2>
              <p className="projects-empty-text">
                Create your first project to start organizing work
              </p>
              <Button
                variant="primary"
                size="lg"
                icon={<Plus size={15} />}
                onClick={() => setIsModalOpen(true)}
              >
                Create Project
              </Button>
            </motion.div>
          ) : (
            <motion.div
              className="projects-grid"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <AnimatePresence mode="popLayout">
                {projects.map((project) => (
                  <motion.div
                    key={project.id}
                    variants={cardVariants}
                    layout
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ProjectCard
                      project={project}
                      stats={statsMap[project.id] || { total: 0, done: 0 }}
                      onEdit={handleOpenEdit}
                      onDelete={handleOpenDelete}
                      onClick={handleOpenBoard}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </main>

      <ProjectModal
        isOpen={isModalOpen || !!editingProject}
        onClose={handleModalClose}
        onSave={handleModalSave}
        project={editingProject}
        isLoading={isSaving}
      />

      <ConfirmDialog
        isOpen={!!deletingProject}
        onClose={() => setDeletingProject(null)}
        onConfirm={handleDeleteConfirm}
        title="DELETE PROJECT"
        message={
          <>
            Delete <strong>{deletingProject?.name}</strong>? This will permanently
            remove all columns and cards. This action cannot be undone.
          </>
        }
        confirmLabel="Delete Project"
        isLoading={isDeleting}
      />
    </div>
  );
}