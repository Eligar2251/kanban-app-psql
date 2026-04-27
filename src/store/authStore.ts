import { create } from 'zustand';
import type { Profile } from '../types';
import type { AuthUser, AuthSession } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { authService } from '../services/auth.service';

interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  setUser: (user: AuthUser | null) => void;
  setSession: (session: AuthSession | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isInitialized: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),

  initialize: async () => {
    try {
      const session = await authService.getSession();

      if (session) {
        set({ user: session.user, session });
        await get().fetchProfile(session.user.id);
      }
    } catch (e) {
      console.error('Auth init error:', e);
    } finally {
      set({ isLoading: false, isInitialized: true });
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      const prevUser = get().user;

      set({
        user: session?.user ?? null,
        session: session ?? null,
      });

      if (session?.user) {
        if (!prevUser || prevUser.id !== session.user.id) {
          await get().fetchProfile(session.user.id);
        }
      } else {
        set({ profile: null });
      }
    });
  },

  fetchProfile: async (userId: string) => {
    try {
      const profile = await authService.getProfile(userId);
      set({ profile });
    } catch (e) {
      console.error('Profile fetch error:', e);
    }
  },

  refreshSession: async () => {
    try {
      const { data } = await supabase.auth.refreshSession();

      if (data.session) {
        set({
          user: data.session.user,
          session: data.session,
        });
      } else {
        set({
          user: null,
          session: null,
          profile: null,
        });
      }
    } catch (e) {
      console.error('Session refresh error:', e);
    }
  },

  logout: async () => {
    await authService.signOut();
    set({ user: null, session: null, profile: null });
  },
}));