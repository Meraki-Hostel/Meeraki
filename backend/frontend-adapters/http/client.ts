import { ServiceError, type ServiceErrorCode } from '../errors';

/**
 * Tiny fetch wrapper used by all HTTP service adapters.
 * - Sends the access token as `Authorization: Bearer ...` (works for web AND app).
 * - On a 401 it transparently refreshes once and retries.
 * - Maps the API error envelope `{ error: { code, message, fieldErrors } }`
 *   onto the app's typed `ServiceError`, so pages catch errors exactly as they
 *   did with the mock services.
 */

const BASE = import.meta.env.VITE_API_BASE_URL as string; // e.g. http://localhost:4000/api/v1
const ACCESS_KEY = 'meraki.accessToken';
const REFRESH_KEY = 'meraki.refreshToken';

export const tokens = {
  get access() { return localStorage.getItem(ACCESS_KEY); },
  get refresh() { return localStorage.getItem(REFRESH_KEY); },
  set({ accessToken, refreshToken }: { accessToken?: string; refreshToken?: string }) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); },
};

async function raw(path: string, init: RequestInit, auth = true): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (auth && tokens.access) headers.set('Authorization', `Bearer ${tokens.access}`);
  return fetch(`${BASE}${path}`, { ...init, headers });
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (res.ok) return (body?.data ?? null) as T;
  const code = (body?.error?.code as ServiceErrorCode) || 'CONFLICT';
  throw new ServiceError(code, body?.error?.message || 'Request failed', body?.error?.fieldErrors);
}

async function tryRefresh(): Promise<boolean> {
  if (!tokens.refresh) return false;
  const res = await raw('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: tokens.refresh }) }, false);
  if (!res.ok) { tokens.clear(); return false; }
  const data = (await res.json()).data;
  tokens.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return true;
}

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  let res = await raw(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }, auth);
  if (res.status === 401 && auth && (await tryRefresh())) {
    res = await raw(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }, auth);
  }
  return parse<T>(res);
}

function qs(params?: Record<string, unknown>): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const http = {
  get: <T>(path: string, params?: Record<string, unknown>, auth = true) => request<T>('GET', path + qs(params), undefined, auth),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>('POST', path, body, auth),
  patch: <T>(path: string, body?: unknown, auth = true) => request<T>('PATCH', path, body, auth),
  del: <T>(path: string, auth = true) => request<T>('DELETE', path, undefined, auth),
};
