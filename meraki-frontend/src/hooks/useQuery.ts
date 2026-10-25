import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeToData } from '@/services';
import { errorMessage } from '@/services/errors';

export interface QueryState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Runs a service call and re-runs it whenever demo data changes (so every
 * screen stays consistent after a mutation anywhere). `key` should capture
 * every input the call depends on.
 */
export function useQuery<T>(fn: () => Promise<T>, key: unknown[] = []): QueryState<T> {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const depKey = JSON.stringify(key);

  useEffect(() => {
    let alive = true;
    const run = (silent: boolean) => {
      if (!silent) setLoading(true);
      fnRef.current()
        .then((d) => { if (alive) { setData(d); setError(null); } })
        .catch((e: unknown) => { if (alive) setError(errorMessage(e)); })
        .finally(() => { if (alive) setLoading(false); });
    };
    run(false);
    const unsub = subscribeToData(() => run(true));
    return () => { alive = false; unsub(); };
  }, [depKey, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading: loading && data === undefined, reload };
}
