import { ServiceError } from './errors';

/**
 * Stand-in for a module with no backend yet. Every method rejects with
 * NOT_IMPLEMENTED, so a stray call can surface an "unavailable" state but can
 * never return demo data or report success.
 */
export function unavailable<T extends object>(label: string): T {
  return new Proxy({} as T, {
    get: (_t, prop) => (prop === 'then' ? undefined
      : () => Promise.reject(new ServiceError('NOT_IMPLEMENTED', `${label} isn't available yet.`))),
  });
}
