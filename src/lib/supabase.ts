import { PostgrestClient } from '@supabase/postgrest-js';

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string | null;
  [key: string]: unknown;
}

export interface AuthSession {
  access_token: string;
  token_type: 'bearer';
  expires_at: number | null;
  user: AuthUser;
}

export type AuthChangeEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED';

type AuthChangeCallback = (
  event: AuthChangeEvent,
  session: AuthSession | null
) => void | Promise<void>;

type ChannelStatus = 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR';
type ChannelState = 'closed' | 'joining' | 'joined' | 'errored';

interface PostgresChangeFilter {
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema: string;
  table: string;
  filter?: string;
}

interface PostgresChangePayload<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  new: T | null;
  old: T | null;
  hydrate?: boolean;
}

interface RealtimeServerMessage {
  type: 'subscribed' | 'error' | 'postgres_changes' | 'pong';
  channel?: string;
  message?: string;
  payload?: PostgresChangePayload;
}

interface RealtimeSubscriptionBinding {
  type: 'postgres_changes';
  filter: PostgresChangeFilter;
  callback: (payload: PostgresChangePayload) => void;
}

// ===== Конфигурация =====

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const DEFAULT_REALTIME_URL = `${API_URL.replace(/^https/i, 'wss').replace(/^http/i, 'ws')}/ws/realtime`;
const REALTIME_URL = (
  import.meta.env.VITE_REALTIME_URL || DEFAULT_REALTIME_URL
).replace(/\/+$/, '');
const JWT_STORAGE_KEY =
  import.meta.env.VITE_JWT_STORAGE_KEY || 'kanban.auth.session';

if (!API_URL) {
  throw new Error('VITE_API_URL is not defined');
}

// ===== JWT утилиты =====

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '='
  );
  return atob(padded);
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

function normalizeUser(
  user: Partial<AuthUser> | null | undefined,
  payload: Record<string, any> | null
): AuthUser {
  return {
    id: String(user?.id ?? payload?.sub ?? ''),
    email: String(user?.email ?? payload?.email ?? ''),
    full_name:
      (user?.full_name as string | null | undefined) ??
      (payload?.full_name as string | undefined) ??
      (payload?.user?.full_name as string | undefined) ??
      null,
    ...(payload?.user ?? {}),
    ...(user ?? {}),
  };
}

export function createSession(
  token: string,
  user?: Partial<AuthUser> | null
): AuthSession {
  const payload = decodeJwtPayload(token);
  const expires_at =
    typeof payload?.exp === 'number' ? payload.exp * 1000 : null;

  return {
    access_token: token,
    token_type: 'bearer',
    expires_at,
    user: normalizeUser(user, payload),
  };
}

function isSessionExpired(session: AuthSession | null): boolean {
  if (!session?.expires_at) return false;
  return Date.now() >= session.expires_at;
}

// ===== Session storage =====

function readStoredSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(JWT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.access_token) return null;
    if (isSessionExpired(parsed)) {
      window.localStorage.removeItem(JWT_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

let currentSession: AuthSession | null = readStoredSession();
const authListeners = new Set<AuthChangeCallback>();

function emitAuthChange(event: AuthChangeEvent, session: AuthSession | null) {
  for (const listener of authListeners) {
    try {
      void listener(event, session);
    } catch (err) {
      console.error('Auth listener error:', err);
    }
  }
}

export function getStoredSession(): AuthSession | null {
  if (!currentSession) currentSession = readStoredSession();
  if (isSessionExpired(currentSession)) {
    clearStoredSession(false);
    return null;
  }
  return currentSession;
}

export function getAccessToken(): string | null {
  return getStoredSession()?.access_token ?? null;
}

let realtimeManagerRef: RealtimeManager | null = null;

export function setStoredSession(
  session: AuthSession,
  event: AuthChangeEvent = 'SIGNED_IN'
) {
  currentSession = session;
  window.localStorage.setItem(JWT_STORAGE_KEY, JSON.stringify(session));
  emitAuthChange(event, session);
  realtimeManagerRef?.handleAuthChanged();
}

export function clearStoredSession(emit: boolean = true) {
  currentSession = null;
  window.localStorage.removeItem(JWT_STORAGE_KEY);
  if (emit) emitAuthChange('SIGNED_OUT', null);
  realtimeManagerRef?.handleAuthChanged();
}

// ===== PostgREST клиент =====
// НЕ передаём schema — иначе postgrest-js добавляет заголовок accept-profile

const authorizedFetch: typeof fetch = async (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  const token = getAccessToken();

  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  // Удаляем заголовки которые вызывают CORS проблемы с PostgREST
  headers.delete('accept-profile');
  headers.delete('content-profile');

  return fetch(input, { ...init, headers });
};

const postgrest = new PostgrestClient(API_URL, {
  fetch: authorizedFetch,
});

// ===== Realtime: фильтрация =====

function parseEqFilter(filter?: string) {
  if (!filter) return null;
  const match = filter.match(/^([^=]+)=eq\.(.+)$/);
  if (!match) return null;
  return {
    column: decodeURIComponent(match[1]),
    value: decodeURIComponent(match[2]),
  };
}

function getPayloadRow(payload: PostgresChangePayload) {
  return payload.eventType === 'DELETE' ? payload.old : payload.new;
}

function matchesBinding(
  bindingFilter: PostgresChangeFilter,
  payload: PostgresChangePayload
) {
  if (
    bindingFilter.event !== '*' &&
    bindingFilter.event !== payload.eventType
  )
    return false;
  if (bindingFilter.schema !== payload.schema) return false;
  if (bindingFilter.table !== payload.table) return false;
  if (!bindingFilter.filter) return true;

  const parsed = parseEqFilter(bindingFilter.filter);
  if (!parsed) return true;

  const row = getPayloadRow(payload) as Record<string, unknown> | null;
  if (!row) return false;

  return String(row[parsed.column] ?? '') === parsed.value;
}

async function hydratePayload(
  payload: PostgresChangePayload
): Promise<PostgresChangePayload> {
  if (!payload?.hydrate) return payload;
  if (payload.eventType === 'DELETE') return payload;
  if (!payload.new || typeof payload.new !== 'object') return payload;

  const row = payload.new as Record<string, any>;
  const id = row.id;
  if (!id) return payload;

  try {
    const { data, error } = await postgrest
      .from(payload.table)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return payload;
    return { ...payload, new: data };
  } catch {
    return payload;
  }
}

// ===== Realtime Channel =====

class RealtimeChannel {
  topic: string;
  state: ChannelState = 'closed';
  private bindings: RealtimeSubscriptionBinding[] = [];
  private statusCallback?: (status: ChannelStatus) => void;

  constructor(topic: string) {
    this.topic = topic;
  }

  on(
    _type: 'postgres_changes',
    filter: PostgresChangeFilter,
    callback: (payload: PostgresChangePayload) => void
  ) {
    this.bindings.push({ type: 'postgres_changes', filter, callback });
    return this;
  }

  subscribe(callback?: (status: ChannelStatus) => void) {
    this.statusCallback = callback;
    this.state = 'joining';
    realtimeManager.addChannel(this);
    return this;
  }

  _markJoined() {
    this.state = 'joined';
    this.statusCallback?.('SUBSCRIBED');
  }

  _markClosed() {
    this.state = 'closed';
    this.statusCallback?.('CLOSED');
  }

  _markErrored() {
    this.state = 'errored';
    this.statusCallback?.('CHANNEL_ERROR');
  }

  _getBindings() {
    return this.bindings;
  }

  async _dispatch(payload: PostgresChangePayload) {
    for (const binding of this.bindings) {
      if (matchesBinding(binding.filter, payload)) {
        try {
          binding.callback(payload);
        } catch (err) {
          console.error('Realtime callback error:', err);
        }
      }
    }
  }
}

// ===== Realtime Manager =====

class RealtimeManager {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private connectTimer: number | null = null;
  private channels = new Map<string, RealtimeChannel>();
  private pingTimer: number | null = null;
  private destroyed = false;

  addChannel(channel: RealtimeChannel) {
    this.channels.set(channel.topic, channel);

    // Если уже подключены — сразу подписываем
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(channel);
    } else {
      // Небольшая задержка защищает от StrictMode double-invoke
      this.scheduleConnect();
    }
  }

  async removeChannel(channel: RealtimeChannel) {
    // Ждём немного — защита от StrictMode который сразу unmount/mount
    await new Promise<void>((resolve) => setTimeout(resolve, 80));

    // Если за это время канал снова добавили — не удаляем
    if (!this.channels.has(channel.topic)) {
      return 'ok';
    }

    this.channels.delete(channel.topic);
    channel._markClosed();

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({ type: 'unsubscribe', channel: channel.topic })
      );
    }

    if (this.channels.size === 0) {
      this.disconnect();
    }

    return 'ok';
  }

  getChannels() {
    return Array.from(this.channels.values());
  }

  handleAuthChanged() {
    this.disconnect();
    if (this.channels.size > 0 && getAccessToken()) {
      this.scheduleConnect(200);
    }
  }

  private scheduleConnect(delay: number = 50) {
    if (this.connectTimer !== null) return;
    this.connectTimer = window.setTimeout(() => {
      this.connectTimer = null;
      this.connect();
    }, delay);
  }

  private connect() {
    if (this.destroyed) return;
    if (this.channels.size === 0) return;

    const token = getAccessToken();
    if (!token) return;

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const url = new URL(REALTIME_URL);
    url.searchParams.set('token', token);

    try {
      this.socket = new WebSocket(url.toString());
    } catch (err) {
      console.error('[Realtime] WebSocket create error:', err);
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.clearReconnectTimer();
      this.startPing();

      for (const channel of this.channels.values()) {
        this.sendSubscribe(channel);
      }
    };

    this.socket.onmessage = (event) => {
      void this.handleMessage(event.data as string);
    };

    this.socket.onerror = () => {
      // onerror всегда сопровождается onclose, там обработаем
    };

    this.socket.onclose = (event) => {
      this.socket = null;
      this.stopPing();

      if (this.destroyed) return;
      if (this.channels.size === 0) return;
      if (!getAccessToken()) {
        for (const channel of this.channels.values()) {
          channel._markClosed();
        }
        return;
      }

      // Только ошибочное закрытие — репортим и переподключаемся
      if (event.code !== 1000 && event.code !== 1001) {
        for (const channel of this.channels.values()) {
          channel._markErrored();
        }
      }

      this.scheduleReconnect();
    };
  }

  private disconnect() {
    this.clearReconnectTimer();
    this.stopPing();
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.socket) {
      this.socket.onclose = null; // не триггерим reconnect
      this.socket.onerror = null;
      this.socket.close(1000, 'disconnect');
      this.socket = null;
    }
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25_000);
  }

  private stopPing() {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private sendSubscribe(channel: RealtimeChannel) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const bindings = channel._getBindings().map((b) => ({
      event: b.filter.event,
      schema: b.filter.schema,
      table: b.filter.table,
      filter: b.filter.filter || '',
    }));

    this.socket.send(
      JSON.stringify({
        type: 'subscribe',
        channel: channel.topic,
        bindings,
      })
    );
  }

  private async handleMessage(raw: string) {
    let msg: RealtimeServerMessage | null = null;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg) return;

    if (msg.type === 'subscribed' && msg.channel) {
      this.channels.get(msg.channel)?._markJoined();
      return;
    }

    if (msg.type === 'error' && msg.channel) {
      console.warn(`[Realtime] Error on channel ${msg.channel}:`, msg.message);
      this.channels.get(msg.channel)?._markErrored();
      return;
    }

    if (msg.type === 'pong') return;

    if (msg.type === 'postgres_changes' && msg.channel && msg.payload) {
      const channel = this.channels.get(msg.channel);
      if (!channel) return;

      const hydrated = await hydratePayload(msg.payload);
      await channel._dispatch(hydrated);
    }
  }
}

const realtimeManager = new RealtimeManager();
realtimeManagerRef = realtimeManager;

// ===== Публичный API — совместимый с supabase-js =====

export const supabase = {
  from: (table: string) => postgrest.from(table),

  rpc: (fn: string, params?: Record<string, unknown>) =>
    postgrest.rpc(fn, params ?? {}),

  auth: {
    async getSession() {
      return { data: { session: getStoredSession() }, error: null };
    },

    async refreshSession() {
      const session = getStoredSession();
      if (session) emitAuthChange('TOKEN_REFRESHED', session);
      return { data: { session }, error: null };
    },

    async signOut() {
      clearStoredSession();
      return { error: null };
    },

    onAuthStateChange(callback: AuthChangeCallback) {
      authListeners.add(callback);
      queueMicrotask(() => void callback('INITIAL_SESSION', getStoredSession()));
      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
  },

  channel(name: string) {
    return new RealtimeChannel(name);
  },

  async removeChannel(channel: RealtimeChannel) {
    return realtimeManager.removeChannel(channel);
  },

  getChannels() {
    return realtimeManager.getChannels();
  },
};

export { API_URL, REALTIME_URL, JWT_STORAGE_KEY, postgrest };