import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  DndContext,
  pointerWithin,
  rectIntersection,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  MeasuringStrategy,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Plus } from "lucide-react";
import { useBoardStore } from "../../store/boardStore";
import { useAuthStore } from "../../store/authStore";
import { columnsService } from "../../services/columns.service";
import { cardsService } from "../../services/cards.service";
import { tagsService } from "../../services/tags.service";
import { activityService } from "../../services/activity.service";
import KanbanColumn from "../KanbanColumn/KanbanColumn";
import KanbanCard from "../KanbanCard/KanbanCard";
import ColumnModal from "../ColumnModal/ColumnModal";
import CardModal from "../CardModal/CardModal";
import CardDrawer from "../CardDrawer/CardDrawer";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import Button from "../Button/Button";
import type {
  Column,
  CardWithTags,
  CreateColumnData,
  CreateCardData,
  Tag,
} from "../../types";
import { canManage, canEdit } from "../../types";
import "./KanbanBoard.css";

interface KanbanBoardProps {
  projectId: string;
}

const measuring = {
  droppable: { strategy: MeasuringStrategy.Always },
};

const columnVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  }),
};

const customCollisionDetection: CollisionDetection = (args) => {
  const p = pointerWithin(args);
  if (p.length > 0) return p;
  const r = rectIntersection(args);
  if (r.length > 0) return r;
  return closestCenter(args);
};

export default function KanbanBoard({ projectId }: KanbanBoardProps) {
  const { user } = useAuthStore();
  const {
    columns,
    cards,
    tags,
    myRole,
    setColumns,
    setCards,
    addColumn,
    updateColumn,
    removeColumn,
    addCard,
    updateCard,
    removeCard,
    addTag,
  } = useBoardStore();

  const iCanManage = myRole ? canManage(myRole) : false;
  const iCanEdit = myRole ? canEdit(myRole) : false;
  const isViewer = myRole === "viewer";

  // DnD
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const dragStartedRef = useRef(false);
  const cardsBeforeDragRef = useRef<CardWithTags[]>([]);

  // Edit modal (teamlead/owner)
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [columnSaving, setColumnSaving] = useState(false);

  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardWithTags | null>(null);
  const [addingToColumnId, setAddingToColumnId] = useState<string | null>(null);
  const [cardSaving, setCardSaving] = useState(false);

  const [deletingColumn, setDeletingColumn] = useState<Column | null>(null);
  const [columnDeleting, setColumnDeleting] = useState(false);

  // Read drawer (editor/viewer)
  const [drawerCard, setDrawerCard] = useState<CardWithTags | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: isViewer ? Infinity : 5 },
    }),
  );

  const sortedColumnIds = useMemo(
    () => columns.map((c) => `column-${c.id}`),
    [columns],
  );

  const activeCard = useMemo(
    () =>
      activeCardId ? cards.find((c) => c.id === activeCardId) || null : null,
    [activeCardId, cards],
  );

  const activeColumn = useMemo(
    () =>
      activeColumnId
        ? columns.find((c) => `column-${c.id}` === activeColumnId) || null
        : null,
    [activeColumnId, columns],
  );

  // ===== DnD =====

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (isViewer) return;
      cardsBeforeDragRef.current = [...cards];
      dragStartedRef.current = true;
      const data = event.active.data.current;
      if (data?.type === "card") setActiveCardId(event.active.id as string);
      else if (data?.type === "column")
        setActiveColumnId(event.active.id as string);
    },
    [cards, isViewer],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (isViewer) return;
      const { active, over } = event;
      if (!over) return;
      const activeData = active.data.current;
      const overData = over.data.current;
      if (activeData?.type !== "card") return;

      const draggedCardId = active.id as string;
      let overColumnId: string | null = null;
      if (overData?.type === "column")
        overColumnId = (overData.column as Column).id;
      else if (overData?.type === "card")
        overColumnId = (overData.card as CardWithTags).column_id;
      if (!overColumnId) return;

      setCards(
        (() => {
          const cur = useBoardStore.getState().cards;
          const ac = cur.find((c) => c.id === draggedCardId);
          if (!ac) return cur;
          if (ac.column_id === overColumnId && overData?.type === "column")
            return cur;

          if (ac.column_id !== overColumnId) {
            const dest = cur
              .filter(
                (c) => c.column_id === overColumnId && c.id !== draggedCardId,
              )
              .sort((a, b) => a.position - b.position);
            let idx = dest.length;
            if (overData?.type === "card") {
              const oi = dest.findIndex(
                (c) => c.id === (overData.card as CardWithTags).id,
              );
              if (oi >= 0) idx = oi;
            }
            const updated = cur.map((c) =>
              c.id === draggedCardId
                ? { ...c, column_id: overColumnId!, position: idx }
                : c,
            );
            const colCards = updated
              .filter((c) => c.column_id === overColumnId)
              .sort((a, b) => {
                if (a.id === draggedCardId) return idx - b.position;
                if (b.id === draggedCardId) return a.position - idx;
                return a.position - b.position;
              });
            const pm: Record<string, number> = {};
            colCards.forEach((c, i) => {
              pm[c.id] = i;
            });
            return updated.map((c) =>
              pm[c.id] !== undefined ? { ...c, position: pm[c.id] } : c,
            );
          }

          if (overData?.type === "card") {
            const same = cur
              .filter((c) => c.column_id === overColumnId)
              .sort((a, b) => a.position - b.position);
            const oi = same.findIndex((c) => c.id === draggedCardId);
            const ni = same.findIndex(
              (c) => c.id === (overData.card as CardWithTags).id,
            );
            if (oi === ni || oi < 0 || ni < 0) return cur;
            const reord = arrayMove(same, oi, ni);
            const pm: Record<string, number> = {};
            reord.forEach((c, i) => {
              pm[c.id] = i;
            });
            return cur.map((c) =>
              pm[c.id] !== undefined ? { ...c, position: pm[c.id] } : c,
            );
          }
          return cur;
        })(),
      );
    },
    [setCards, isViewer],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (isViewer) return;
      const { active, over } = event;
      const activeData = active.data.current;
      setActiveCardId(null);
      setActiveColumnId(null);
      setTimeout(() => {
        dragStartedRef.current = false;
      }, 100);

      if (!over) {
        setCards(cardsBeforeDragRef.current);
        return;
      }

      if (activeData?.type === "column") {
        const overData = over.data.current;
        if (overData?.type !== "column") return;
        const aId = (activeData.column as Column).id,
          oId = (overData.column as Column).id;
        if (aId === oId) return;
        const oi = columns.findIndex((c) => c.id === aId),
          ni = columns.findIndex((c) => c.id === oId);
        if (oi < 0 || ni < 0) return;
        const reord = arrayMove(columns, oi, ni).map((c, i) => ({
          ...c,
          position: i,
        }));
        setColumns(reord);
        try {
          await columnsService.reorderColumns(
            reord.map((c) => ({ id: c.id, position: c.position })),
          );
        } catch (e) {
          console.error(e);
        }
        return;
      }

      if (activeData?.type === "card") {
        const cur = useBoardStore.getState().cards;
        const changedCards = cur.filter((card) => {
          const b = cardsBeforeDragRef.current.find((x) => x.id === card.id);
          return (
            !b || b.column_id !== card.column_id || b.position !== card.position
          );
        });
        if (changedCards.length > 0) {
          try {
            await cardsService.reorderCards(
              changedCards.map((c) => ({
                id: c.id,
                position: c.position,
                column_id: c.column_id,
              })),
            );

            // Log card_moved events for cards that changed column
            for (const c of changedCards) {
              const before = cardsBeforeDragRef.current.find((b) => b.id === c.id);
              if (before && before.column_id !== c.column_id) {
                const fromCol = columns.find((col) => col.id === before.column_id);
                const toCol = columns.find((col) => col.id === c.column_id);
                activityService
                  .log(projectId, c.id, "card_moved", {
                    from_column: fromCol?.name || before.column_id,
                    to_column: toCol?.name || c.column_id,
                  })
                  .catch(console.error);
              }
            }
          } catch (e) {
            console.error(e);
            setCards(cardsBeforeDragRef.current);
          }
        }
      }
    },
    [columns, setColumns, setCards, isViewer, projectId],
  );

  // ===== Card click logic =====
  const handleCardClick = useCallback(
    (card: CardWithTags) => {
      if (dragStartedRef.current) return;
      if (iCanManage) {
        setEditingCard(card);
        setAddingToColumnId(null);
        setCardModalOpen(true);
      } else {
        setDrawerCard(card);
        setDrawerOpen(true);
      }
    },
    [iCanManage],
  );

  const handleDrawerEdit = useCallback((card: CardWithTags) => {
    setDrawerOpen(false);
    setDrawerCard(null);
    setEditingCard(card);
    setAddingToColumnId(null);
    setCardModalOpen(true);
  }, []);

  // ===== Column CRUD =====
  const handleOpenColumnModal = useCallback(() => {
    if (!iCanManage) return;
    setEditingColumn(null);
    setColumnModalOpen(true);
  }, [iCanManage]);

  const handleEditColumn = useCallback(
    (col: Column) => {
      if (!iCanManage) return;
      setEditingColumn(col);
      setColumnModalOpen(true);
    },
    [iCanManage],
  );

  const handleColumnModalClose = useCallback(() => {
    setColumnModalOpen(false);
    setEditingColumn(null);
  }, []);

  const handleDeleteColumn = useCallback(
    (col: Column) => {
      if (!iCanManage) return;
      setDeletingColumn(col);
    },
    [iCanManage],
  );

  const handleColumnSave = useCallback(
    async (data: CreateColumnData) => {
      if (!user || !iCanManage) return;
      setColumnSaving(true);
      try {
        if (editingColumn) {
          const u = await columnsService.updateColumn(editingColumn.id, data);
          updateColumn(editingColumn.id, u);
        } else {
          const n = await columnsService.createColumn(
            projectId,
            user.id,
            data,
            columns.length,
          );
          addColumn(n);
        }
        setColumnModalOpen(false);
        setEditingColumn(null);
      } catch (e) {
        console.error(e);
      } finally {
        setColumnSaving(false);
      }
    },
    [
      user,
      editingColumn,
      columns.length,
      projectId,
      updateColumn,
      addColumn,
      iCanManage,
    ],
  );

  const handleDeleteColumnConfirm = useCallback(async () => {
    if (!deletingColumn || !iCanManage) return;
    setColumnDeleting(true);
    try {
      await columnsService.deleteColumn(deletingColumn.id);
      removeColumn(deletingColumn.id);
      setDeletingColumn(null);
    } catch (e) {
      console.error(e);
    } finally {
      setColumnDeleting(false);
    }
  }, [deletingColumn, removeColumn, iCanManage]);

  // ===== Card CRUD =====
  const handleAddCard = useCallback(
    (columnId: string) => {
      if (!iCanManage) return;
      setEditingCard(null);
      setAddingToColumnId(columnId);
      setCardModalOpen(true);
    },
    [iCanManage],
  );

  const handleCardModalClose = useCallback(() => {
    setCardModalOpen(false);
    setEditingCard(null);
    setAddingToColumnId(null);
  }, []);

  const handleCardSave = useCallback(
    async (data: CreateCardData) => {
      if (!user || !iCanManage) return;
      setCardSaving(true);
      try {
        if (editingCard) {
          const u = await cardsService.updateCard(editingCard.id, {
            title: data.title,
            description: data.description,
            priority: data.priority,
            deadline: data.deadline,
            assignee_id: data.assignee_id,
          });
          await cardsService.updateCardTags(editingCard.id, data.tag_ids);
          const allTags = useBoardStore.getState().tags;
          updateCard(editingCard.id, {
            ...u,
            tags: allTags.filter((t) => data.tag_ids.includes(t.id)),
          });

          // Log card updated
          activityService
            .log(projectId, editingCard.id, "card_updated", { title: data.title })
            .catch(console.error);
        } else if (addingToColumnId) {
          const pos = cards.filter(
            (c) => c.column_id === addingToColumnId,
          ).length;
          const n = await cardsService.createCard(
            addingToColumnId,
            projectId,
            user.id,
            data,
            pos,
          );
          addCard(n);

          // Log card created
          activityService
            .log(projectId, n.id, "card_created", { title: data.title })
            .catch(console.error);
        }
        setCardModalOpen(false);
        setEditingCard(null);
        setAddingToColumnId(null);
      } catch (e) {
        console.error(e);
      } finally {
        setCardSaving(false);
      }
    },
    [
      user,
      editingCard,
      addingToColumnId,
      cards,
      projectId,
      updateCard,
      addCard,
      iCanManage,
    ],
  );

  const handleCardDelete = useCallback(async () => {
    if (!editingCard || !iCanManage) return;
    try {
      // Log card deleted before removal
      activityService
        .log(projectId, editingCard.id, "card_deleted", { title: editingCard.title })
        .catch(console.error);

      await cardsService.deleteCard(editingCard.id);
      removeCard(editingCard.id);
      setCardModalOpen(false);
      setEditingCard(null);
    } catch (e) {
      console.error(e);
    }
  }, [editingCard, removeCard, iCanManage, projectId]);

  const handleCreateTag = useCallback(
    async (name: string, color: string): Promise<Tag | undefined> => {
      if (!user || !iCanManage) return;
      const t = await tagsService.createTag(projectId, user.id, name, color);
      addTag(t);
      return t;
    },
    [user, projectId, addTag, iCanManage],
  );

  const noopCardClick = useCallback(() => {}, []);

  return (
    <div className="kanban-board">
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        measuring={measuring}
      >
        <div className="kanban-board-columns">
          <SortableContext
            items={sortedColumnIds}
            strategy={horizontalListSortingStrategy}
          >
            <AnimatePresence mode="popLayout">
              {columns.map((column, index) => (
                <motion.div
                  key={column.id}
                  className="kanban-board-column-wrapper"
                  variants={columnVariants}
                  custom={index}
                  initial="hidden"
                  animate="visible"
                  exit={{
                    opacity: 0,
                    scale: 0.95,
                    transition: { duration: 0.15 },
                  }}
                  layout
                >
                  <KanbanColumn
                    column={column}
                    onEditColumn={handleEditColumn}
                    onDeleteColumn={handleDeleteColumn}
                    onAddCard={handleAddCard}
                    onEditCard={handleCardClick}
                    readOnly={isViewer}
                    hideManage={!iCanManage}
                    isDragOverlay={false}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </SortableContext>

          {iCanManage && (
            <div className="kanban-board-add-column">
              <Button
                variant="ghost"
                size="md"
                icon={<Plus size={14} />}
                onClick={handleOpenColumnModal}
                fullWidth
              >
                Add Column
              </Button>
            </div>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCard && (
            <KanbanCard
              card={activeCard}
              onClick={noopCardClick}
              isDragOverlay
            />
          )}
          {activeColumn && (
            <div className="kanban-board-column-overlay">
              <KanbanColumn
                column={activeColumn}
                onEditColumn={handleEditColumn}
                onDeleteColumn={handleDeleteColumn}
                onAddCard={handleAddCard}
                onEditCard={handleCardClick}
                isDragOverlay
                readOnly={isViewer}
                hideManage={!iCanManage}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Edit modal — teamlead/owner */}
      <CardModal
        isOpen={cardModalOpen}
        onClose={handleCardModalClose}
        onSave={handleCardSave}
        onDelete={editingCard && iCanManage ? handleCardDelete : undefined}
        card={editingCard}
        tags={tags}
        onCreateTag={handleCreateTag}
        isLoading={cardSaving}
      />

      {/* Read drawer — editor/viewer */}
      <CardDrawer
        card={drawerCard}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerCard(null);
        }}
        onEdit={handleDrawerEdit}
      />

      <ColumnModal
        isOpen={columnModalOpen}
        onClose={handleColumnModalClose}
        onSave={handleColumnSave}
        column={editingColumn}
        isLoading={columnSaving}
      />
      <ConfirmDialog
        isOpen={!!deletingColumn}
        onClose={() => setDeletingColumn(null)}
        onConfirm={handleDeleteColumnConfirm}
        title="DELETE COLUMN"
        message={
          <>
            Delete <strong>{deletingColumn?.name}</strong> and all its cards?
          </>
        }
        confirmLabel="Delete Column"
        isLoading={columnDeleting}
      />
    </div>
  );
}