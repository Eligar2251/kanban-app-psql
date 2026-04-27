import React, { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, MoreHorizontal, Pencil, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import { useBoardStore } from '../../store/boardStore';
import KanbanCard from '../KanbanCard/KanbanCard';
import Button from '../Button/Button';
import type { Column, CardWithTags } from '../../types';
import './KanbanColumn.css';

interface KanbanColumnProps {
  column: Column;
  onEditColumn: (column: Column) => void;
  onDeleteColumn: (column: Column) => void;
  onAddCard: (columnId: string) => void;
  onEditCard: (card: CardWithTags) => void;
  isDragOverlay?: boolean;
  readOnly?: boolean;
  hideManage?: boolean;
}

const KanbanColumn = memo(function KanbanColumn({
  column,
  onEditColumn,
  onDeleteColumn,
  onAddCard,
  onEditCard,
  isDragOverlay = false,
  readOnly = false,
  hideManage = false,
}: KanbanColumnProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [scrollTop, setScrollTop] = useState(false);
  const [scrollBottom, setScrollBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const cards = useBoardStore((s) => s.cards);
  const filters = useBoardStore((s) => s.filters);
  const getFilteredCards = useBoardStore((s) => s.getFilteredCards);

  const filteredCards = useMemo(
    () => getFilteredCards(column.id),
    [column.id, cards, filters, getFilteredCards]
  );

  const cardIds = useMemo(() => filteredCards.map((c) => c.id), [filteredCards]);

  const allColumnCards = useMemo(
    () => cards.filter((c) => c.column_id === column.id),
    [cards, column.id]
  );

  const isOverWipLimit = useMemo(() => {
    if (!column.wip_limit) return false;
    return allColumnCards.length >= column.wip_limit;
  }, [column.wip_limit, allColumnCards.length]);

  // Scroll detection
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasScrollContent = el.scrollHeight > el.clientHeight;
    const isAtTop = el.scrollTop > 4;
    const isAtBottom = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setScrollTop(hasScrollContent && isAtTop);
    setScrollBottom(hasScrollContent && isAtBottom);
  }, []);

  useEffect(() => { checkScroll(); }, [filteredCards.length, checkScroll]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [checkScroll]);

  const {
    attributes: sortableAttributes,
    listeners: sortableListeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging: isColumnDragging,
  } = useSortable({
    id: `column-${column.id}`,
    data: { type: 'column', column },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', column },
  });

  const sortableStyle = useMemo(() => {
    if (!transform) return {};
    return {
      transform: CSS.Transform.toString({ ...transform, scaleX: 1, scaleY: 1 }),
      transition,
      opacity: isColumnDragging ? 0.4 : 1,
    };
  }, [transform, transition, isColumnDragging]);

  const handleEdit = useCallback(() => { setShowMenu(false); onEditColumn(column); }, [onEditColumn, column]);
  const handleDelete = useCallback(() => { setShowMenu(false); onDeleteColumn(column); }, [onDeleteColumn, column]);
  const handleAdd = useCallback(() => { onAddCard(column.id); }, [onAddCard, column.id]);
  const handleCardClick = useCallback((card: CardWithTags) => { onEditCard(card); }, [onEditCard]);
  const toggleMenu = useCallback((e: React.MouseEvent) => { e.stopPropagation(); setShowMenu((p) => !p); }, []);
  const closeMenu = useCallback(() => { setShowMenu(false); }, []);

  const columnClasses = [
    'kanban-column',
    isOver ? 'kanban-column--drag-over' : '',
    isColumnDragging ? 'kanban-column--dragging' : '',
    isDragOverlay ? 'kanban-column--overlay' : '',
    isOverWipLimit ? 'kanban-column--wip-exceeded' : '',
  ].filter(Boolean).join(' ');

  const wrapperClasses = [
    'kanban-column-cards-wrapper',
    scrollTop ? 'kanban-column-cards-wrapper--scrolled-top' : '',
    scrollBottom ? 'kanban-column-cards-wrapper--scrolled-bottom' : '',
  ].filter(Boolean).join(' ');

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      setDroppableRef(node);
    },
    [setDroppableRef]
  );

  return (
    <div ref={setSortableRef} style={sortableStyle as React.CSSProperties} className={columnClasses}>
      <div className="kanban-column-header" style={{ '--col-color': column.color } as React.CSSProperties}>
        <div className="kanban-column-header-left">
          {/* Drag handle — только для editor+ (не viewer) */}
          {!readOnly && (
            <div className="kanban-column-drag-handle" {...sortableAttributes} {...sortableListeners}>
              <GripVertical size={12} />
            </div>
          )}
          <span className="kanban-column-name">{column.name}</span>
          <span className="kanban-column-count">{allColumnCards.length}</span>
          {column.wip_limit && (
            <span className={`kanban-column-wip ${isOverWipLimit ? 'kanban-column-wip--exceeded' : ''}`}>
              /{column.wip_limit}
            </span>
          )}
        </div>

        {/* Menu — скрывать при hideManage */}
        {!hideManage && (
          <div className="kanban-column-header-right">
            <button className="kanban-column-menu-trigger" onClick={toggleMenu}>
              <MoreHorizontal size={14} />
            </button>
            {showMenu && (
              <>
                <div className="kanban-column-menu-backdrop" onClick={closeMenu} />
                <div className="kanban-column-menu">
                  <button className="kanban-column-menu-item" onClick={handleEdit}>
                    <Pencil size={12} /> Edit Column
                  </button>
                  <button className="kanban-column-menu-item kanban-column-menu-item--danger" onClick={handleDelete}>
                    <Trash2 size={12} /> Delete Column
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {isOverWipLimit && (
        <div className="kanban-column-wip-warning">
          <AlertCircle size={11} /> <span>WIP limit reached</span>
        </div>
      )}

      <div className={wrapperClasses}>
        <div ref={setRefs} className="kanban-column-cards">
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            {filteredCards.map((card) => (
              <KanbanCard key={card.id} card={card} onClick={handleCardClick} />
            ))}
          </SortableContext>
          {filteredCards.length === 0 && (
            <div className="kanban-column-empty"><span>No cards</span></div>
          )}
        </div>
      </div>

      {/* Footer — скрывать при hideManage */}
      {!hideManage && (
        <div className="kanban-column-footer">
          <Button variant="ghost" size="sm" icon={<Plus size={12} />} fullWidth onClick={handleAdd} disabled={isOverWipLimit}>
            Add Card
          </Button>
        </div>
      )}
    </div>
  );
});

export default KanbanColumn;