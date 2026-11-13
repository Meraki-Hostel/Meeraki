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
const ACCESS_KEY = 'staypookie.accessToken';
const REFRESH_KEY = 'staypookie.refreshToken';

export const tokens = {
  get access() { return localStorage.getItem(ACCESS_KEY); },
  get refresh() { return localStorage.getItem(REFRESH_KEY); },
  set({ accessToken, refreshToken }: { accessToken?: string; refreshToken?: string }) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); },
};

const UNREACHABLE = "Can't reach the StayPookie server right now. Check your connection and try again.";
const KNOWN_CODES: ServiceErrorCode[] = ['VALIDATION', 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT', 'UNAUTHENTICATED', 'EXPIRED', 'NOT_IMPLEMENTED', 'NOT_CONFIGURED'];

async function raw(path: string, init: RequestInit, auth = true): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (auth && tokens.access) headers.set('Authorization', `Bearer ${tokens.access}`);
  try {
    return await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    // Network down, DNS, CORS, server not running: never fall back to anything.
    throw new ServiceError('UNAVAILABLE', UNREACHABLE);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (res.ok) return (body?.data ?? null) as T;
  const reported = body?.error?.code as ServiceErrorCode | undefined;
  // Unknown codes (e.g. INTERNAL) and bodies that are not our envelope (proxy errors) are "unavailable".
  const code: ServiceErrorCode = reported && KNOWN_CODES.includes(reported) ? reported : res.status >= 500 || !body ? 'UNAVAILABLE' : 'CONFLICT';
  const message = code === 'UNAVAILABLE' && !body?.error?.message ? UNREACHABLE : body?.error?.message || 'Request failed';
  throw new ServiceError(code, message, body?.error?.fieldErrors);
}

async function tryRefresh(): Promise<boolean> {
  if (!tokens.refresh) return false;
  const res = await raw('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: tokens.refresh }) }, false);
  if (!res.ok) { tokens.clear(); return false; }
  const data = (await res.json().catch(() => null))?.data;
  if (!data) { tokens.clear(); return false; }
  tokens.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return true;
}

/**
 * Change feed for HTTP writes. Pages re-fetch via `subscribeToData`, which the
 * mock drives from the repository; here every successful non-GET request
 * (except auth calls, which SessionProvider handles itself) signals a change.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribeToHttpChanges(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  let res = await raw(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }, auth);
  if (res.status === 401 && auth && (await tryRefresh())) {
    res = await raw(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }, auth);
  }
  const data = await parse<T>(res);
  if (method !== 'GET' && !path.startsWith('/auth/')) listeners.forEach((l) => l());
  return data;
}

function qs(params?: object): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Binary download (e.g. a PDF receipt) with the same auth and refresh handling. */
async function blob(path: string): Promise<Blob> {
  let res = await raw(path, { method: 'GET' });
  if (res.status === 401 && (await tryRefresh())) res = await raw(path, { method: 'GET' });
  if (!res.ok) await parse(res); // throws the typed ServiceError
  return res.blob();
}

export const http = {
  get: <T>(path: string, params?: object, auth = true) => request<T>('GET', path + qs(params), undefined, auth),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>('POST', path, body, auth),
  patch: <T>(path: string, body?: unknown, auth = true) => request<T>('PATCH', path, body, auth),
  put: <T>(path: string, body?: unknown, auth = true) => request<T>('PUT', path, body, auth),
  del: <T>(path: string, auth = true) => request<T>('DELETE', path, undefined, auth),
  blob,
};

/**
 * Uploads one file the way the API expects: ask for a short-lived upload link,
 * PUT the bytes straight to storage (Cloudflare R2, or the API's local stand-in
 * in development), and return the upload id to hand to the owning record.
 */
export async function uploadFile(purpose: 'document' | 'complaint', file: File): Promise<string> {
  const contentType = file.type || 'application/octet-stream';
  const target = await http.post<{ uploadId: string; url: string; method: string; headers: Record<string, string> }>(
    '/uploads', { purpose, fileName: file.name, contentType, sizeBytes: file.size });
  let res: Response;
  try {
    res = await fetch(target.url, { method: target.method, headers: target.headers, body: file });
  } catch {
    throw new ServiceError('UNAVAILABLE', "Couldn't upload the file. Check your connection and try again.");
  }
  if (!res.ok) throw new ServiceError('VALIDATION', 'The file upload was refused. Try again.', { file: 'The file upload was refused. Try again.' });
  return target.uploadId;
}
