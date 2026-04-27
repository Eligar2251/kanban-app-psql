import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useSupabaseReconnect() {
  const lastHiddenAt = useRef<number>(0);

  useEffect(() => {
    const STALE_THRESHOLD = 30_000;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAt.current = Date.now();
        return;
      }

      const hiddenDuration = Date.now() - lastHiddenAt.current;

      // Refresh auth session on return
      try {
        await supabase.auth.getSession();
      } catch (err) {
        console.warn('Session refresh failed:', err);
      }

      // If hidden too long, do a full data reload instead of reconnecting channels
      // The page components handle their own reload via usePageVisibility
      if (hiddenDuration > STALE_THRESHOLD) {
        const channels = supabase.getChannels();
        for (const channel of channels) {
          try {
            // Remove and let the page component recreate if needed
            if (channel.state === 'errored' || channel.state === 'closed') {
              await supabase.removeChannel(channel);
            }
          } catch {
            // ignore
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}