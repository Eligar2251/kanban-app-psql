import { useEffect, useCallback } from 'react';
import { useBoardStore } from '../store/boardStore';
import { useAuthStore } from '../store/authStore';
import { columnsService } from '../services/columns.service';
import { cardsService } from '../services/cards.service';
import { tagsService } from '../services/tags.service';

export function useBoardData(projectId: string | undefined) {
  const { user } = useAuthStore();
  const { setColumns, setCards, setTags, setLoading } = useBoardStore();

  const reload = useCallback(async () => {
    if (!projectId || !user) return;
    setLoading(true);
    try {
      const [cols, crds, tgs] = await Promise.all([
        columnsService.getColumns(projectId),
        cardsService.getCards(projectId),
        tagsService.getTags(projectId),
      ]);
      setColumns(cols);
      setCards(crds);
      setTags(tgs);
    } catch (err) {
      console.error('Board data load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, user, setColumns, setCards, setTags, setLoading]);

  return { reload };
}