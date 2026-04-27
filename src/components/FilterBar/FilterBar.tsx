import React, { memo, useCallback } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import type { Priority } from '../../types';
import './FilterBar.css';

const PRIORITIES: { value: Priority | 'all'; label: string }[] = [
  { value: 'all', label: 'ALL' },
  { value: 'urgent', label: 'URGENT' },
  { value: 'high', label: 'HIGH' },
  { value: 'medium', label: 'MEDIUM' },
  { value: 'low', label: 'LOW' },
  { value: 'none', label: 'NONE' },
];

const DEADLINES = [
  { value: 'all', label: 'ANY DATE' },
  { value: 'overdue', label: 'OVERDUE' },
  { value: 'today', label: 'TODAY' },
  { value: 'week', label: 'THIS WEEK' },
] as const;

const FilterBar = memo(function FilterBar() {
  const filters = useBoardStore((s) => s.filters);
  const tags = useBoardStore((s) => s.tags);
  const members = useBoardStore((s) => s.members);
  const setFilters = useBoardStore((s) => s.setFilters);
  const resetFilters = useBoardStore((s) => s.resetFilters);

  const hasActiveFilters =
    filters.search !== '' ||
    filters.priority !== 'all' ||
    filters.tagIds.length > 0 ||
    filters.deadline !== 'all' ||
    filters.assigneeId !== 'all';

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters({ search: e.target.value });
    },
    [setFilters]
  );

  const handlePriority = useCallback(
    (priority: Priority | 'all') => {
      setFilters({ priority });
    },
    [setFilters]
  );

  const handleDeadline = useCallback(
    (deadline: 'all' | 'overdue' | 'today' | 'week') => {
      setFilters({ deadline });
    },
    [setFilters]
  );

  const handleTagToggle = useCallback(
    (tagId: string) => {
      const currentIds = filters.tagIds;
      const next = currentIds.includes(tagId)
        ? currentIds.filter((id) => id !== tagId)
        : [...currentIds, tagId];
      setFilters({ tagIds: next });
    },
    [filters.tagIds, setFilters]
  );

  const handleAssignee = useCallback(
    (assigneeId: string) => {
      setFilters({ assigneeId });
    },
    [setFilters]
  );

  const handleClearSearch = useCallback(() => {
    setFilters({ search: '' });
  }, [setFilters]);

  return (
    <div className="filter-bar">
      <div className="filter-bar-inner">
        <SlidersHorizontal size={13} className="filter-bar-icon" />

        {/* Search */}
        <div className="filter-search-wrapper">
          <Search size={13} className="filter-search-icon" />
          <input
            className="filter-search-input"
            placeholder="Search cards..."
            value={filters.search}
            onChange={handleSearch}
          />
          {filters.search && (
            <button className="filter-search-clear" onClick={handleClearSearch}>
              <X size={11} />
            </button>
          )}
        </div>

        <div className="filter-divider" />

        {/* Priority */}
        <div className="filter-group">
          <span className="filter-group-label">PRIORITY</span>
          <div className="filter-chips">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                className={`filter-chip filter-chip--priority-${p.value} ${
                  filters.priority === p.value ? 'filter-chip--active' : ''
                }`}
                onClick={() => handlePriority(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-divider" />

        {/* Deadline */}
        <div className="filter-group">
          <span className="filter-group-label">DEADLINE</span>
          <div className="filter-chips">
            {DEADLINES.map((d) => (
              <button
                key={d.value}
                className={`filter-chip ${
                  filters.deadline === d.value ? 'filter-chip--active' : ''
                }`}
                onClick={() => handleDeadline(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <>
            <div className="filter-divider" />
            <div className="filter-group">
              <span className="filter-group-label">TAGS</span>
              <div className="filter-chips">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    className={`filter-chip filter-chip--tag ${
                      filters.tagIds.includes(tag.id) ? 'filter-chip--active' : ''
                    }`}
                    style={
                      {
                        '--tag-color': tag.color,
                      } as React.CSSProperties
                    }
                    onClick={() => handleTagToggle(tag.id)}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Assignee */}
        {members.length > 1 && (
          <>
            <div className="filter-divider" />
            <div className="filter-group">
              <span className="filter-group-label">ASSIGNEE</span>
              <div className="filter-chips">
                <button
                  className={`filter-chip ${
                    filters.assigneeId === 'all' ? 'filter-chip--active' : ''
                  }`}
                  onClick={() => handleAssignee('all')}
                >
                  ALL
                </button>
                {members.map((m) => (
                  <button
                    key={m.user_id}
                    className={`filter-chip ${
                      filters.assigneeId === m.user_id ? 'filter-chip--active' : ''
                    }`}
                    onClick={() => handleAssignee(m.user_id)}
                  >
                    {m.profile?.full_name || m.profile?.email?.split('@')[0] || '?'}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Reset */}
        {hasActiveFilters && (
          <>
            <div className="filter-divider" />
            <button className="filter-reset-btn" onClick={resetFilters}>
              <X size={11} />
              RESET
            </button>
          </>
        )}
      </div>
    </div>
  );
});

export default FilterBar;