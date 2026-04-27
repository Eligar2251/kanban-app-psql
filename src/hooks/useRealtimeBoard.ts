// Optional hook - kept as utility for future per-table subscriptions
// Currently all realtime logic is in BoardPage for performance (single channel)

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeTable(
  table: string,
  filter: string,
  onInsert?: (payload: any) => void,
  onUpdate?: (payload: any) => void,
  onDelete?: (payload: any) => void,
  enabled: boolean = true
) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channelName = `${table}-${filter}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    if (onInsert) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table, filter },
        (payload) => onInsert(payload.new)
      );
    }

    if (onUpdate) {
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table, filter },
        (payload) => onUpdate(payload.new)
      );
    }

    if (onDelete) {
      channel.on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table, filter },
        (payload) => onDelete(payload.old)
      );
    }

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [table, filter, enabled, onInsert, onUpdate, onDelete]);
}