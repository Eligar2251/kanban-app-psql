import React, { memo, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Layout, Zap, Star, Flame, Target, Box,
  Layers, Code, Terminal, Cpu, Database, Globe,
  Rocket, Shield, Wrench, BarChart, BookOpen, Clock,
  MoreHorizontal, Pencil, Trash2, CheckSquare, ArrowRight
} from 'lucide-react';
import type { Project } from '../../types';
import './ProjectCard.css';

const ICON_MAP: Record<string, React.ElementType> = {
  layout: Layout, zap: Zap, star: Star, flame: Flame,
  target: Target, box: Box, layers: Layers, code: Code,
  terminal: Terminal, cpu: Cpu, database: Database, globe: Globe,
  rocket: Rocket, shield: Shield, wrench: Wrench,
  'bar-chart': BarChart, 'book-open': BookOpen, clock: Clock,
};

interface ProjectCardProps {
  project: Project;
  stats: { total: number; done: number };
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onClick: (project: Project) => void;
}

const ProjectCard = memo(function ProjectCard({
  project,
  stats,
  onEdit,
  onDelete,
  onClick,
}: ProjectCardProps) {
  const IconComponent = ICON_MAP[project.icon] || Layout;

  const progress = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.done / stats.total) * 100);
  }, [stats.done, stats.total]);

  const formattedDate = useMemo(() => {
    return new Date(project.updated_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [project.updated_at]);

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit(project);
    },
    [onEdit, project]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(project);
    },
    [onDelete, project]
  );

  const handleClick = useCallback(() => {
    onClick(project);
  }, [onClick, project]);

  return (
    <motion.div
      className="project-card"
      style={{ '--card-accent': project.color } as React.CSSProperties}
      onClick={handleClick}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      layout
    >
      {/* Top accent bar */}
      <div className="project-card-accent-bar" />

      <div className="project-card-inner">
        {/* Header row */}
        <div className="project-card-header">
          <div className="project-card-icon-wrap">
            <IconComponent size={18} />
          </div>
          <div className="project-card-menu">
            <button
              className="project-card-menu-btn"
              onClick={handleEdit}
              title="Edit project"
            >
              <Pencil size={13} />
            </button>
            <button
              className="project-card-menu-btn project-card-menu-btn--danger"
              onClick={handleDelete}
              title="Delete project"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Name & description */}
        <div className="project-card-body">
          <h3 className="project-card-name">{project.name}</h3>
          {project.description && (
            <p className="project-card-desc">{project.description}</p>
          )}
        </div>

        {/* Stats */}
        <div className="project-card-stats">
          <div className="project-card-stat">
            <CheckSquare size={11} />
            <span>{stats.done}/{stats.total} tasks</span>
          </div>
          <div className="project-card-stat project-card-stat--date">
            <Clock size={11} />
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="project-card-progress-wrap">
          <div className="project-card-progress-header">
            <span className="project-card-progress-label">PROGRESS</span>
            <span className="project-card-progress-pct">{progress}%</span>
          </div>
          <div className="project-card-progress-track">
            <div
              className="project-card-progress-fill"
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </div>
        </div>

        {/* Open link */}
        <div className="project-card-footer">
          <span className="project-card-open">
            Open Board
            <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </motion.div>
  );
});

export default ProjectCard;