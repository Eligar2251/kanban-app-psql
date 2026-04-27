import { supabase } from '../lib/supabase';
import type { Comment, Profile } from '../types';

export const commentsService = {
  async getComments(cardId: string): Promise<Comment[]> {
    const { data: comments, error } = await supabase
      .from('comments')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (!comments || comments.length === 0) return [];

    const userIds = [...new Set(comments.map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profileMap = new Map<string, Profile>();
    (profiles ?? []).forEach((p: Profile) => profileMap.set(p.id, p));

    return comments.map((c) => ({
      ...c,
      profile: profileMap.get(c.user_id),
    }));
  },

  async addComment(
    cardId: string,
    projectId: string,
    userId: string,
    body: string
  ): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .insert({ card_id: cardId, project_id: projectId, user_id: userId, body })
      .select()
      .single();
    if (error) throw error;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    return { ...data, profile: profile || undefined };
  },

  async updateComment(id: string, body: string): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .update({ body })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteComment(id: string): Promise<void> {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};