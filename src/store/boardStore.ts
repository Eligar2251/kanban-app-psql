import { create } from 'zustand';
import type { Column, CardWithTags, Tag, BoardFilters, ProjectMember, ProjectRole } from '../types';

interface BoardState {
  columns: Column[];
  cards: CardWithTags[];
  tags: Tag[];
  members: ProjectMember[];
  myRole: ProjectRole | null;
  filters: BoardFilters;
  isLoading: boolean;

  setColumns: (columns: Column[]) => void;
  setCards: (cards: CardWithTags[]) => void;
  setTags: (tags: Tag[]) => void;
  setMembers: (members: ProjectMember[]) => void;
  setMyRole: (role: ProjectRole | null) => void;
  setFilters: (filters: Partial<BoardFilters>) => void;
  resetFilters: () => void;
  setLoading: (loading: boolean) => void;

  addColumn: (column: Column) => void;
  updateColumn: (id: string, updates: Partial<Column>) => void;
  removeColumn: (id: string) => void;

  addCard: (card: CardWithTags) => void;
  updateCard: (id: string, updates: Partial<CardWithTags>) => void;
  removeCard: (id: string) => void;
  moveCardLocal: (cardId: string, newColumnId: string, newPosition: number) => void;

  addTag: (tag: Tag) => void;
  removeTag: (id: string) => void;

  addMember: (member: ProjectMember) => void;
  updateMember: (id: string, updates: Partial<ProjectMember>) => void;
  removeMember: (id: string) => void;

  getFilteredCards: (columnId: string) => CardWithTags[];
}

const defaultFilters: BoardFilters = {
  search: '',
  priority: 'all',
  tagIds: [],
  deadline: 'all',
  assigneeId: 'all',
};

export const useBoardStore = create<BoardState>((set, get) => ({
  columns: [],
  cards: [],
  tags: [],
  members: [],
  myRole: null,
  filters: defaultFilters,
  isLoading: true,

  setColumns: (columns) => set({ columns }),
  setCards: (cards) => set({ cards }),
  setTags: (tags) => set({ tags }),
  setMembers: (members) => set({ members }),
  setMyRole: (myRole) => set({ myRole }),
  setLoading: (isLoading) => set({ isLoading }),

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  resetFilters: () => set({ filters: { ...defaultFilters } }),

  addColumn: (column) =>
    set((state) => {
      if (state.columns.find((c) => c.id === column.id)) return state;
      return {
        columns: [...state.columns, column].sort((a, b) => a.position - b.position),
      };
    }),

  updateColumn: (id, updates) =>
    set((state) => ({
      columns: state.columns
        .map((c) => (c.id === id ? { ...c, ...updates } : c))
        .sort((a, b) => a.position - b.position),
    })),

  removeColumn: (id) =>
    set((state) => ({
      columns: state.columns.filter((c) => c.id !== id),
      cards: state.cards.filter((card) => card.column_id !== id),
    })),

  addCard: (card) =>
    set((state) => {
      if (state.cards.find((c) => c.id === card.id)) return state;
      return { cards: [...state.cards, card] };
    }),

  updateCard: (id, updates) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  removeCard: (id) =>
    set((state) => ({
      cards: state.cards.filter((c) => c.id !== id),
    })),

  moveCardLocal: (cardId, newColumnId, newPosition) =>
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === cardId ? { ...c, column_id: newColumnId, position: newPosition } : c
      ),
    })),

  addTag: (tag) =>
    set((state) => {
      if (state.tags.find((t) => t.id === tag.id)) return state;
      return { tags: [...state.tags, tag] };
    }),

  removeTag: (id) =>
    set((state) => ({ tags: state.tags.filter((t) => t.id !== id) })),

  addMember: (member) =>
    set((state) => {
      if (state.members.find((m) => m.id === member.id)) return state;
      return { members: [...state.members, member] };
    }),

  updateMember: (id, updates) =>
    set((state) => ({
      members: state.members.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),

  removeMember: (id) =>
    set((state) => ({
      members: state.members.filter((m) => m.id !== id),
    })),

  getFilteredCards: (columnId: string) => {
    const { cards, filters } = get();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(todayStart.getDate() + 7);

    return cards
      .filter((card) => card.column_id === columnId)
      .filter((card) => {
        if (filters.search) {
          return card.title.toLowerCase().includes(filters.search.toLowerCase());
        }
        return true;
      })
      .filter((card) => {
        if (filters.priority !== 'all') return card.priority === filters.priority;
        return true;
      })
      .filter((card) => {
        if (filters.tagIds.length > 0) {
          return filters.tagIds.some((tid) => (card.tags || []).some((t) => t.id === tid));
        }
        return true;
      })
      .filter((card) => {
        if (filters.deadline === 'all') return true;
        if (!card.deadline) return false;
        const d = new Date(card.deadline);
        if (filters.deadline === 'overdue') return d < todayStart;
        if (filters.deadline === 'today') return d >= todayStart && d <= todayEnd;
        if (filters.deadline === 'week') return d >= todayStart && d <= weekEnd;
        return true;
      })
      .filter((card) => {
        if (filters.assigneeId !== 'all') {
          return card.assignee_id === filters.assigneeId;
        }
        return true;
      })
      .sort((a, b) => a.position - b.position);
  },
}));