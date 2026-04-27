import { supabase } from '../lib/supabase';
import type { Card, CardWithTags, CreateCardData } from '../types';

export const cardsService = {
  async getCards(projectId: string): Promise<CardWithTags[]> {
    const { data, error } = await supabase
      .from('cards')
      .select(`
        *,
        tags:card_tags(
          tag:tags(*)
        )
      `)
      .eq('project_id', projectId)
      .order('position', { ascending: true });
    if (error) throw error;

    return (data ?? []).map((card: any) => ({
      ...card,
      tags: (card.tags ?? []).map((ct: any) => ct.tag).filter(Boolean),
    }));
  },

  async createCard(
    columnId: string,
    projectId: string,
    userId: string,
    cardData: CreateCardData,
    position: number
  ): Promise<CardWithTags> {
    const { data: card, error } = await supabase
      .from('cards')
      .insert({
        column_id: columnId,
        project_id: projectId,
        user_id: userId,
        title: cardData.title,
        description: cardData.description,
        priority: cardData.priority,
        deadline: cardData.deadline,
        assignee_id: cardData.assignee_id,
        position,
      })
      .select()
      .single();
    if (error) throw error;

    if (cardData.tag_ids.length > 0) {
      const tagInserts = cardData.tag_ids.map((tag_id) => ({
        card_id: card.id,
        tag_id,
      }));
      await supabase.from('card_tags').insert(tagInserts);
    }

    const { data: tagsData } = await supabase
      .from('card_tags')
      .select('tag:tags(*)')
      .eq('card_id', card.id);

    return {
      ...card,
      tags: (tagsData ?? []).map((ct: any) => ct.tag).filter(Boolean),
    };
  },

  async updateCard(id: string, updates: Partial<Card>): Promise<Card> {
    const { data, error } = await supabase
      .from('cards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateCardTags(cardId: string, tagIds: string[]): Promise<void> {
    await supabase.from('card_tags').delete().eq('card_id', cardId);
    if (tagIds.length > 0) {
      await supabase.from('card_tags').insert(
        tagIds.map((tag_id) => ({ card_id: cardId, tag_id }))
      );
    }
  },

  async deleteCard(id: string): Promise<void> {
    const { error } = await supabase.from('cards').delete().eq('id', id);
    if (error) throw error;
  },

  async moveCard(cardId: string, newColumnId: string, newPosition: number): Promise<void> {
    const { error } = await supabase
      .from('cards')
      .update({ column_id: newColumnId, position: newPosition })
      .eq('id', cardId);
    if (error) throw error;
  },

  async reorderCards(cards: { id: string; position: number; column_id: string }[]): Promise<void> {
    const updates = cards.map(({ id, position, column_id }) =>
      supabase.from('cards').update({ position, column_id }).eq('id', id)
    );
    await Promise.all(updates);
  },
};