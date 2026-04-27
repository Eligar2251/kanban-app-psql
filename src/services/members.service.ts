import { supabase } from '../lib/supabase';
import type { ProjectMember, Invitation, ProjectRole, Profile } from '../types';

export const membersService = {
  async getMembers(projectId: string): Promise<ProjectMember[]> {
    // Step 1: get members
    const { data: members, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (!members || members.length === 0) return [];

    // Step 2: get profiles for all member user_ids
    const userIds = members.map((m) => m.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);
    
    const profileMap = new Map<string, Profile>();
    if (profiles && !profilesError) {
      profiles.forEach((p: Profile) => {
        profileMap.set(p.id, p);
      });
    }

    // Step 3: merge
    return members.map((m) => ({
      ...m,
      profile: profileMap.get(m.user_id) || undefined,
    }));
  },

  async updateMemberRole(memberId: string, role: ProjectRole): Promise<ProjectMember> {
    const { data, error } = await supabase
      .from('project_members')
      .update({ role })
      .eq('id', memberId)
      .select('*')
      .single();
    if (error) throw error;

    // Fetch profile separately
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user_id)
      .single();

    return {
      ...data,
      profile: profile || undefined,
    };
  },

  async removeMember(memberId: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberId);
    if (error) throw error;
  },

  async leaveProject(projectId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  // Invitations
  async getInvitations(projectId: string): Promise<Invitation[]> {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async invite(
    projectId: string,
    email: string,
    role: ProjectRole,
    invitedBy: string
  ): Promise<Invitation> {
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        project_id: projectId,
        email: email.toLowerCase().trim(),
        role,
        invited_by: invitedBy,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async cancelInvitation(id: string): Promise<void> {
    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getMyInvitations(email: string): Promise<Invitation[]> {
    // Step 1: get pending invitations for this email
    const { data: invitations, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!invitations || invitations.length === 0) return [];

    // Step 2: get project info
    const projectIds = [...new Set(invitations.map((i) => i.project_id))];
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, color, icon')
      .in('id', projectIds);

    const projectMap = new Map<string, any>();
    (projects ?? []).forEach((p: any) => projectMap.set(p.id, p));

    // Step 3: get inviter profiles
    const inviterIds = [...new Set(invitations.map((i) => i.invited_by))];
    const { data: inviters } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', inviterIds);

    const inviterMap = new Map<string, any>();
    (inviters ?? []).forEach((p: any) => inviterMap.set(p.id, p));

    // Step 4: merge
    return invitations.map((inv) => ({
      ...inv,
      project: projectMap.get(inv.project_id) || undefined,
      inviter_profile: inviterMap.get(inv.invited_by) || undefined,
    }));
  },

  async acceptInvitation(invitationId: string): Promise<void> {
    const { error } = await supabase.rpc('accept_invitation', {
      invitation_id: invitationId,
    });
    if (error) throw error;
  },

  async declineInvitation(invitationId: string): Promise<void> {
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'declined' })
      .eq('id', invitationId);
    if (error) throw error;
  },

  async getMemberRole(projectId: string, userId: string): Promise<ProjectRole | null> {
    const { data, error } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data?.role ?? null;
  },
};