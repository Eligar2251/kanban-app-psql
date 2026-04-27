export type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
export type ProjectRole = 'owner' | 'teamlead' | 'editor' | 'viewer';
export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  accent_color: string;
  board_bg: string;
  position: number;
  card_numbers?: boolean;
  show_card_id?: boolean;
  auto_archive_done?: boolean;
  compact_mode?: boolean;
  done_column_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface Invitation {
  id: string;
  project_id: string;
  email: string;
  role: ProjectRole;
  invited_by: string;
  status: InvitationStatus;
  created_at: string;
  updated_at: string;
  project?: Project;
  inviter_profile?: Profile;
}

export interface Column {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  color: string;
  position: number;
  wip_limit: number | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  color: string;
}

export interface Card {
  id: string;
  column_id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string;
  priority: Priority;
  deadline: string | null;
  position: number;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

export interface CardWithTags extends Card {
  tags: Tag[];
}

export interface BoardFilters {
  search: string;
  priority: Priority | 'all';
  tagIds: string[];
  deadline: 'all' | 'overdue' | 'today' | 'week';
  assigneeId: string | 'all';
}

export interface CreateProjectData {
  name: string;
  description: string;
  color: string;
  icon: string;
  accent_color: string;
}

export interface CreateColumnData {
  name: string;
  color: string;
  wip_limit: number | null;
}

export interface CreateCardData {
  title: string;
  description: string;
  priority: Priority;
  deadline: string | null;
  tag_ids: string[];
  assignee_id: string | null;
}

export const ROLE_LEVELS: Record<ProjectRole, number> = {
  owner: 4,
  teamlead: 3,
  editor: 2,
  viewer: 1,
};

/** Can create/edit/delete cards, columns, tags */
export function canManage(role: ProjectRole): boolean {
  return ROLE_LEVELS[role] >= ROLE_LEVELS.teamlead;
}

/** Can drag cards + self-assign */
export function canEdit(role: ProjectRole): boolean {
  return ROLE_LEVELS[role] >= ROLE_LEVELS.editor;
}

/** Can manage members + project settings */
export function canAdmin(role: ProjectRole): boolean {
  return ROLE_LEVELS[role] >= ROLE_LEVELS.teamlead;
}

export function isOwner(role: ProjectRole): boolean {
  return role === 'owner';
}

export interface ActivityLogEntry {
  id: string;
  project_id: string;
  card_id: string | null;
  user_id: string;
  action: string;
  details: Record<string, any>;
  created_at: string;
  profile?: Profile;
}

export interface Comment {
  id: string;
  card_id: string;
  project_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface ProjectSettings {
  default_priority: Priority;
  card_numbers: boolean;
  show_card_id: boolean;
  auto_archive_done: boolean;
  compact_mode: boolean;
  done_column_name: string;
}