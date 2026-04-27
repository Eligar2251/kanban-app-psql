import { supabase } from '../lib/supabase';
import type { Project, CreateProjectData } from '../types';

export const projectsService = {
  async getProjects(userId: string): Promise<Project[]> {
    // Get projects where user is owner OR member
    const { data: memberProjects } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId);

    const projectIds = (memberProjects ?? []).map((m) => m.project_id);

    if (projectIds.length === 0) {
      // Fallback: own projects only
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('position', { ascending: true });
      if (error) throw error;
      return data ?? [];
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .in('id', projectIds)
      .order('position', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getProject(id: string): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createProject(userId: string, projectData: CreateProjectData): Promise<Project> {
    const { data: existing } = await supabase
      .from('projects')
      .select('position')
      .eq('user_id', userId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        ...projectData,
        position: nextPosition,
      })
      .select()
      .single();
    if (error) throw error;
    // owner membership is auto-created by trigger
    return data;
  },

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteProject(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getProjectStats(projectId: string): Promise<{ total: number; done: number }> {
    const { data: cards, error } = await supabase
      .from('cards')
      .select('column_id')
      .eq('project_id', projectId);
    if (error) throw error;

    const { data: doneCols } = await supabase
      .from('columns')
      .select('id')
      .eq('project_id', projectId)
      .ilike('name', '%done%');

    const doneIds = new Set((doneCols ?? []).map((c: { id: string }) => c.id));
    const total = (cards ?? []).length;
    const done = (cards ?? []).filter((c: { column_id: string }) => doneIds.has(c.column_id)).length;

    return { total, done };
  },
};