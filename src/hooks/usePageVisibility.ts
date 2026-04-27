import { useEffect, useCallback, useRef } from 'react';

export function usePageVisibility(onVisible: () => void, onHidden?: () => void) {
  const onVisibleRef = useRef(onVisible);
  const onHiddenRef = useRef(onHidden);

  onVisibleRef.current = onVisible;
  onHiddenRef.current = onHidden;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onVisibleRef.current();
      } else if (document.visibilityState === 'hidden') {
        onHiddenRef.current?.();
      }
    };

    const handleFocus = () => {
      onVisibleRef.current();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
}