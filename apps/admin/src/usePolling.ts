import { useCallback, useEffect, useRef, useState } from 'react';

/** One request at a time; stop while hidden and abort requests when leaving a page. */
export function usePolling<T>(read: (signal: AbortSignal) => Promise<T>, interval = 30_000): { data: T | null; error: unknown; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);
  useEffect(() => {
    let closed = false;
    let controller: AbortController | null = null;
    const load = async (): Promise<void> => {
      if (closed || controller || document.hidden) return;
      controller = new AbortController();
      setLoading(true);
      try {
        const next = await read(controller.signal);
        if (!closed) { setData(next); setError(null); }
      } catch (e) { if (!closed) setError(e); }
      finally { controller = null; if (!closed) setLoading(false); }
    };
    refreshRef.current = () => { void load(); };
    void load();
    const timer = window.setInterval(() => { void load(); }, interval);
    const visible = (): void => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { closed = true; controller?.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [read, interval]);
  return { data, error, loading, refresh };
}
