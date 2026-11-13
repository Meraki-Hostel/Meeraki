import { ApiError, KNOWN_CODES, UNREACHABLE, type ApiErrorCode } from './errors';
import { accessTokenTtl, tokens } from './tokens';

/**
 * The one place the app talks HTTP. Mirrors staypookie-frontend's client:
 * bearer token, `{ data, error, meta }` envelope, typed errors. Differences for
 * a phone:
 *  - Only ONE refresh runs at a time. The API rotates refresh tokens and treats
 *    reuse of an old one (outside a 15 s grace window) as theft, revoking every
 *    session — so parallel 401s must share one refresh, never race.
 *  - When the session can't be refreshed, `onSessionEnded` tells the app to
 *    show sign-in.
 */

export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

let onSessionEnded: () => void = () => undefined;
export function setSessionEndedHandler(fn: () => void) { onSessionEnded = fn; }

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function send(method: Method, path: string, body: unknown, auth: boolean): Promise<Response> {
  if (!API_BASE) throw new ApiError('UNAVAILABLE', 'The app is not configured: EXPO_PUBLIC_API_BASE_URL is missing.');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  try {
    return await fetch(`${API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('UNAVAILABLE', UNREACHABLE);
  }
}

export async function parse<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as
    | { data?: T; error?: { code?: string; message?: string; fieldErrors?: Record<string, string> | null } | null }
    | null;
  if (res.ok) return (json?.data ?? null) as T;
  const reported = json?.error?.code as ApiErrorCode | undefined;
  const code: ApiErrorCode = reported && KNOWN_CODES.includes(reported)
    ? reported
    : res.status >= 500 || !json ? 'UNAVAILABLE' : 'CONFLICT';
  const message = json?.error?.message || (code === 'UNAVAILABLE' ? UNREACHABLE : 'Request failed');
  throw new ApiError(code, message, json?.error?.fieldErrors ?? {});
}

// ── Refresh (single flight) ──────────────────────────────────────────────────
let inFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = await tokens.refreshToken();
  if (!refreshToken) return false;
  let res: Response;
  try {
    res = await send('POST', '/auth/refresh', { refreshToken }, false);
  } catch {
    // Offline: keep the stored token, the session is not over.
    throw new ApiError('UNAVAILABLE', UNREACHABLE);
  }
  // Server trouble is not the end of the session: keep the token, report offline.
  if (res.status >= 500) throw new ApiError('UNAVAILABLE', UNREACHABLE);
  if (!res.ok) {
    await tokens.clear();
    return false;
  }
  const data = (await res.json().catch(() => null))?.data as { accessToken?: string; refreshToken?: string } | undefined;
  if (!data?.accessToken) return false;
  await tokens.set(data);
  return true;
}

/** Refreshes the access token. Concurrent callers share the same attempt. */
export function refreshSession(): Promise<boolean> {
  if (!inFlight) inFlight = doRefresh().finally(() => { inFlight = null; });
  return inFlight;
}

/** A usable access token for requests made outside `http` (file downloads). */
export async function freshAccessToken(): Promise<string | null> {
  if (accessTokenTtl() > 30) return tokens.access;
  return (await refreshSession()) ? tokens.access : null;
}

async function request<T>(method: Method, path: string, body?: unknown, auth = true): Promise<T> {
  if (auth && !tokens.access && (await tokens.refreshToken())) await refreshSession();
  let res = await send(method, path, body, auth);
  if (res.status === 401 && auth) {
    if (await refreshSession()) {
      res = await send(method, path, body, auth);
    } else {
      onSessionEnded();
    }
  }
  return parse<T>(res);
}

export function qs(params?: object): string {
  if (!params) return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export const http = {
  get: <T>(path: string, params?: object, auth = true) => request<T>('GET', path + qs(params), undefined, auth),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>('POST', path, body ?? {}, auth),
  patch: <T>(path: string, body?: unknown, auth = true) => request<T>('PATCH', path, body ?? {}, auth),
  del: <T>(path: string, auth = true) => request<T>('DELETE', path, undefined, auth),
};
