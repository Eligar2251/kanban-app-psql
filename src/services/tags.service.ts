import { supabase } from '../lib/supabase';
import type { Tag } from '../types';

export const tagsService = {
  async getTags(projectId: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('project_id', projectId);
    if (error) throw error;
    return data ?? [];
  },

  async createTag(projectId: string, userId: string, name: string, color: string): Promise<Tag> {
    const { data, error } = await supabase
      .from('tags')
      .insert({ project_id: projectId, user_id: userId, name, color })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTag(id: string): Promise<void> {
    const { error } = await supabase.from('tags').delete().eq('id', id);
    if (error) throw error;
  },
};