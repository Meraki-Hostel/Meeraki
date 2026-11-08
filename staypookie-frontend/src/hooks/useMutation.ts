import { useCallback, useState } from 'react';
import { errorMessage, isServiceError } from '@/services/errors';
import { useToast } from '@/app/providers/ToastProvider';

interface Options<R> {
  success?: string | ((r: R) => string);
  onSuccess?: (r: R) => void;
  /** Show a toast for non-validation errors (default true). */
  toastErrors?: boolean;
}

/** Wraps a service mutation with pending state, field errors and toasts. */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>, opts: Options<R> = {}) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const r = await fn(...args);
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success);
      opts.onSuccess?.(r);
      return r;
    } catch (e) {
      if (isServiceError(e) && e.code === 'VALIDATION' && e.fieldErrors) {
        setFieldErrors(e.fieldErrors);
        setError(e.message);
      } else {
        setError(errorMessage(e));
        if (opts.toastErrors !== false) toast.error(errorMessage(e));
      }
      return undefined;
    } finally {
      setPending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, toast, opts.success, opts.onSuccess, opts.toastErrors]);

  const clearErrors = useCallback(() => { setFieldErrors({}); setError(null); }, []);
  return { run, pending, fieldErrors, error, setFieldErrors, clearErrors };
}
