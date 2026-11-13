import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { ApiError, toApiError } from '@/api/errors';

/** Read data. Cached, refetched on focus/pull-to-refresh; errors come back typed. */
export function useApi<T>(key: QueryKey, fn: () => Promise<T>, opts: { enabled?: boolean } = {}) {
  const q = useQuery<T, ApiError>({
    queryKey: key,
    queryFn: async () => {
      try { return await fn(); } catch (e) { throw toApiError(e); }
    },
    enabled: opts.enabled ?? true,
  });
  return {
    data: q.data,
    error: q.error,
    loading: q.isPending && q.fetchStatus !== 'idle',
    refreshing: q.isRefetching,
    refetch: () => { void q.refetch(); },
  };
}

/**
 * A write. On success every cached query is invalidated, so the screens behind
 * refresh themselves — the same rule as the web app's `subscribeToData`.
 * `fieldErrors` holds the API's VALIDATION messages keyed by field name.
 */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const qc = useQueryClient();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const m = useMutation<R, ApiError, A>({
    mutationFn: async (args) => {
      try { return await fn(...args); } catch (e) { throw toApiError(e); }
    },
    onMutate: () => setFieldErrors({}),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e) => setFieldErrors(e.fieldErrors ?? {}),
  });
  /** Resolves true on success, false on failure (the error is in `error` / `fieldErrors`). */
  const run = useCallback(async (...args: A): Promise<boolean> => {
    try { await m.mutateAsync(args); return true; } catch { return false; }
  }, [m]);
  return {
    run,
    result: m.data,
    busy: m.isPending,
    /** The last error, unless it was only field errors (those show under the fields). */
    error: m.error && !(m.error.code === 'VALIDATION' && Object.keys(m.error.fieldErrors).length) ? m.error : null,
    fieldErrors,
    setFieldErrors,
    done: m.isSuccess,
    reset: () => { m.reset(); setFieldErrors({}); },
  };
}
