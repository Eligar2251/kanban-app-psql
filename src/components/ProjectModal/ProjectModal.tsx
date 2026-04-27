import React, { useState, useCallback, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import {
  Layout, Zap, Star, Flame, Target, Box,
  Layers, Code, Terminal, Cpu, Database, Globe,
  Rocket, Shield, Wrench, BarChart, BookOpen, Clock
} from 'lucide-react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import Input from '../Input/Input';
import Textarea from '../Input/Textarea';
import type { Project, CreateProjectData } from '../../types';
import './ProjectModal.css';

const PALETTE_COLORS = [
  '#C8FF00', '#00E676', '#FF9500', '#FF3B3B',
  '#00B4D8', '#7B61FF', '#FF6B6B', '#4ECDC4',
  '#FFE66D', '#A8E6CF', '#FF8B94', '#B4A7D6',
];

const ACCENT_COLORS = [
  '#C8FF00', '#00E676', '#FF9500', '#FF3B3B',
  '#00B4D8', '#7B61FF', '#4ECDC4', '#FFE66D',
];

const ICONS = [
  { id: 'layout', Icon: Layout },
  { id: 'zap', Icon: Zap },
  { id: 'star', Icon: Star },
  { id: 'flame', Icon: Flame },
  { id: 'target', Icon: Target },
  { id: 'box', Icon: Box },
  { id: 'layers', Icon: Layers },
  { id: 'code', Icon: Code },
  { id: 'terminal', Icon: Terminal },
  { id: 'cpu', Icon: Cpu },
  { id: 'database', Icon: Database },
  { id: 'globe', Icon: Globe },
  { id: 'rocket', Icon: Rocket },
  { id: 'shield', Icon: Shield },
  { id: 'wrench', Icon: Wrench },
  { id: 'bar-chart', Icon: BarChart },
  { id: 'book-open', Icon: BookOpen },
  { id: 'clock', Icon: Clock },
];

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateProjectData) => Promise<void>;
  project?: Project | null;
  isLoading?: boolean;
}

const defaultData: CreateProjectData = {
  name: '',
  description: '',
  color: '#C8FF00',
  icon: 'layout',
  accent_color: '#C8FF00',
};

const ProjectModal = memo(function ProjectModal({
  isOpen,
  onClose,
  onSave,
  project,
  isLoading = false,
}: ProjectModalProps) {
  const [formData, setFormData] = useState<CreateProjectData>(defaultData);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (project) {
        setFormData({
          name: project.name,
          description: project.description,
          color: project.color,
          icon: project.icon,
          accent_color: project.accent_color,
        });
      } else {
        setFormData(defaultData);
      }
      setError('');
    }
  }, [isOpen, project]);

  const handleChange = useCallback(
    (field: keyof CreateProjectData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim()) {
        setError('Project name is required.');
        return;
      }
      setError('');
      await onSave(formData);
    },
    [formData, onSave]
  );

  const selectedIconDef = ICONS.find((i) => i.id === formData.icon) || ICONS[0];
  const SelectedIcon = selectedIconDef.Icon;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={project ? 'EDIT PROJECT' : 'NEW PROJECT'}
      maxWidth={520}
    >
      <form className="project-modal-form" onSubmit={handleSubmit} noValidate>
        {/* Preview */}
        <div
          className="project-modal-preview"
          style={{ '--preview-color': formData.color } as React.CSSProperties}
        >
          <div className="project-modal-preview-icon">
            <SelectedIcon size={20} />
          </div>
          <div className="project-modal-preview-info">
            <span className="project-modal-preview-name">
              {formData.name || 'Project Name'}
            </span>
            <span className="project-modal-preview-label">PREVIEW</span>
          </div>
        </div>

        {error && (
          <div className="project-modal-error">
            <span>{error}</span>
          </div>
        )}

        {/* Name */}
        <Input
          label="Project Name"
          type="text"
          placeholder="My Awesome Project"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          autoFocus
        />

        {/* Description */}
        <Textarea
          label="Description"
          placeholder="What is this project about?"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
        />

        {/* Icon */}
        <div className="project-modal-field">
          <span className="project-modal-field-label">ICON</span>
          <div className="project-modal-icons">
            {ICONS.map(({ id, Icon }) => (
              <button
                key={id}
                type="button"
                className={`project-modal-icon-btn ${
                  formData.icon === id ? 'project-modal-icon-btn--active' : ''
                }`}
                onClick={() => handleChange('icon', id)}
                title={id}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>

        {/* Color label */}
        <div className="project-modal-field">
          <span className="project-modal-field-label">COLOR LABEL</span>
          <div className="project-modal-palette">
            {PALETTE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`project-modal-color-btn ${
                  formData.color === color ? 'project-modal-color-btn--active' : ''
                }`}
                style={{ '--swatch-color': color } as React.CSSProperties}
                onClick={() => handleChange('color', color)}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* Accent color */}
        <div className="project-modal-field">
          <span className="project-modal-field-label">ACCENT COLOR</span>
          <p className="project-modal-field-hint">
            Overrides board accent for this project
          </p>
          <div className="project-modal-palette">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`project-modal-color-btn ${
                  formData.accent_color === color
                    ? 'project-modal-color-btn--active'
                    : ''
                }`}
                style={{ '--swatch-color': color } as React.CSSProperties}
                onClick={() => handleChange('accent_color', color)}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="project-modal-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isLoading}>
            {project ? 'Save Changes' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
});

export default ProjectModal;