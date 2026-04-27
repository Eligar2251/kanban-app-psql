import { supabase } from '../lib/supabase';
import type { Column, CreateColumnData } from '../types';

export const columnsService = {
  async getColumns(projectId: string): Promise<Column[]> {
    const { data, error } = await supabase
      .from('columns')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async createColumn(
    projectId: string,
    userId: string,
    columnData: CreateColumnData,
    position: number
  ): Promise<Column> {
    const { data, error } = await supabase
      .from('columns')
      .insert({
        project_id: projectId,
        user_id: userId,
        ...columnData,
        position,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateColumn(id: string, updates: Partial<Column>): Promise<Column> {
    const { data, error } = await supabase
      .from('columns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteColumn(id: string): Promise<void> {
    const { error } = await supabase
      .from('columns')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async reorderColumns(columns: { id: string; position: number }[]): Promise<void> {
    const updates = columns.map(({ id, position }) =>
      supabase.from('columns').update({ position }).eq('id', id)
    );
    await Promise.all(updates);
  },
};