import {
  supabase,
  API_URL,
  createSession,
  setStoredSession,
  clearStoredSession,
  getStoredSession,
} from '../lib/supabase';
import type { AuthSession, AuthUser } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthRpcResponse {
  token: string;
  user: AuthUser;
}

interface AuthResult {
  token: string;
  user: AuthUser;
  session: AuthSession;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: any = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.hint ||
      payload?.details ||
      (typeof payload === 'string' ? payload : '') ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

async function postRpc<T>(
  rpcName: string,
  body: Record<string, unknown>,
  withAuth: boolean = false
): Promise<T> {
  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json',
  });

  if (withAuth) {
    const token = getStoredSession()?.access_token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}/rpc/${rpcName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  return parseJsonResponse<T>(response);
}

function buildAuthResult(data: AuthRpcResponse): AuthResult {
  if (!data?.token) {
    throw new Error('Auth RPC did not return a token');
  }
  const session = createSession(data.token, data.user);
  return { token: data.token, user: session.user, session };
}

export const authService = {
  async signUp(
    email: string,
    password: string,
    fullName: string,
    options: { persistSession?: boolean } = {}
  ): Promise<AuthResult> {
    const data = await postRpc<AuthRpcResponse>('sign_up', {
      p_email: email.trim().toLowerCase(),
      p_password: password,
      p_full_name: fullName.trim(),
    });

    const result = buildAuthResult(data);

    if (options.persistSession) {
      setStoredSession(result.session, 'SIGNED_IN');
    }

    return result;
  },

  async signIn(email: string, password: string): Promise<AuthResult> {
    const data = await postRpc<AuthRpcResponse>('sign_in', {
      p_email: email.trim().toLowerCase(),
      p_password: password,
    });

    const result = buildAuthResult(data);
    setStoredSession(result.session, 'SIGNED_IN');
    return result;
  },

  async signOut(): Promise<void> {
    clearStoredSession();
  },

  async resetPassword(email: string) {
    // Если у вас нет этой RPC — можно убрать
    await postRpc('request_password_reset', {
      p_email: email.trim().toLowerCase(),
    });
  },

  async updatePassword(newPassword: string) {
    await postRpc('change_password', { p_new_password: newPassword }, true);
  },

  async getSession() {
    return getStoredSession();
  },

  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data as Profile;
  },

  async updateProfile(userId: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data as Profile;
  },
};