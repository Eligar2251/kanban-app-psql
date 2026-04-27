import React, { useState, useCallback, useEffect, memo } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import Input from '../Input/Input';
import type { Column, CreateColumnData } from '../../types';
import './ColumnModal.css';

const COLUMN_COLORS = [
  '#C8FF00', '#00E676', '#FF9500', '#FF3B3B',
  '#00B4D8', '#7B61FF', '#4ECDC4', '#FFE66D',
  '#FF6B6B', '#A8E6CF', '#B4A7D6', '#5A5A72',
];

interface ColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateColumnData) => Promise<void>;
  column?: Column | null;
  isLoading?: boolean;
}

const ColumnModal = memo(function ColumnModal({
  isOpen,
  onClose,
  onSave,
  column,
  isLoading = false,
}: ColumnModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLUMN_COLORS[0]);
  const [wipLimit, setWipLimit] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (column) {
        setName(column.name);
        setColor(column.color);
        setWipLimit(column.wip_limit ? String(column.wip_limit) : '');
      } else {
        setName('');
        setColor(COLUMN_COLORS[0]);
        setWipLimit('');
      }
      setError('');
    }
  }, [isOpen, column]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) {
        setError('Column name is required.');
        return;
      }
      setError('');
      const wip = wipLimit.trim() ? parseInt(wipLimit, 10) : null;
      await onSave({ name: name.trim(), color, wip_limit: isNaN(wip as number) ? null : wip });
    },
    [name, color, wipLimit, onSave]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={column ? 'EDIT COLUMN' : 'NEW COLUMN'}
      maxWidth={420}
    >
      <form className="column-modal-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="column-modal-error">{error}</div>
        )}

        <Input
          label="Column Name"
          type="text"
          placeholder="e.g. In Progress"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <div className="column-modal-field">
          <span className="column-modal-field-label">COLOR</span>
          <div className="column-modal-colors">
            {COLUMN_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`column-modal-color-btn ${
                  color === c ? 'column-modal-color-btn--active' : ''
                }`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <Input
          label="WIP Limit (optional)"
          type="number"
          placeholder="e.g. 5"
          value={wipLimit}
          onChange={(e) => setWipLimit(e.target.value)}
          hint="Max cards allowed in this column"
        />

        <div className="column-modal-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isLoading}>
            {column ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
});

export default ColumnModal;