import { supabase } from '../lib/supabase';
import type { ActivityLogEntry, Profile } from '../types';

export const activityService = {
  async log(
    projectId: string,
    cardId: string | null,
    action: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    await supabase.rpc('log_activity', {
      p_project_id: projectId,
      p_card_id: cardId,
      p_action: action,
      p_details: details,
    });
  },

  async getProjectActivity(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ActivityLogEntry[]> {
    const { data: entries, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    if (!entries || entries.length === 0) return [];

    const userIds = [...new Set(entries.map((e) => e.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profileMap = new Map<string, Profile>();
    (profiles ?? []).forEach((p: Profile) => profileMap.set(p.id, p));

    return entries.map((e) => ({
      ...e,
      profile: profileMap.get(e.user_id),
    }));
  },

  async getCardActivity(
    cardId: string,
    limit: number = 30
  ): Promise<ActivityLogEntry[]> {
    const { data: entries, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (!entries || entries.length === 0) return [];

    const userIds = [...new Set(entries.map((e) => e.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profileMap = new Map<string, Profile>();
    (profiles ?? []).forEach((p: Profile) => profileMap.set(p.id, p));

    return entries.map((e) => ({
      ...e,
      profile: profileMap.get(e.user_id),
    }));
  },
};