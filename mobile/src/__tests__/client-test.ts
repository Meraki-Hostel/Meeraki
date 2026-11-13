import { http, refreshSession, setSessionEndedHandler } from '@/api/client';
import { ApiError } from '@/api/errors';
import { tokens } from '@/api/tokens';

type Reply = { status: number; body?: unknown } | Error;
const json = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => { if (body === undefined) throw new Error('no body'); return body; },
});

let replies: ((url: string, init: RequestInit) => Reply)[];
let calls: { url: string; init: RequestInit }[];

beforeEach(async () => {
  calls = [];
  replies = [];
  globalThis.fetch = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = replies.shift();
    if (!next) throw new Error(`unexpected fetch ${url}`);
    const r = next(url, init);
    if (r instanceof Error) throw r;
    return json(r.status, r.body);
  }) as unknown as typeof fetch;
  await tokens.clear();
  setSessionEndedHandler(() => undefined);
});

const ok = (data: unknown) => () => ({ status: 200, body: { data, error: null, meta: {} } });
const fail = (status: number, code: string, message = 'nope', fieldErrors: Record<string, string> | null = null) =>
  () => ({ status, body: { data: null, error: { code, message, fieldErrors }, meta: {} } });

test('unwraps the envelope and sends the bearer token', async () => {
  await tokens.set({ accessToken: 'A1', refreshToken: 'R1' });
  replies.push(ok({ hello: 'world' }));
  await expect(http.get('/thing', { a: 1, empty: '', skip: undefined })).resolves.toEqual({ hello: 'world' });
  expect(calls[0].url).toBe('http://api.test/api/v1/thing?a=1');
  expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer A1');
});

test('maps API errors to typed errors with field messages', async () => {
  await tokens.set({ accessToken: 'A1' });
  replies.push(fail(422, 'VALIDATION', 'Check the highlighted fields.', { title: 'Required' }));
  const err = (await http.post('/x', {}).catch((e: unknown) => e)) as ApiError;
  expect(err).toBeInstanceOf(ApiError);
  expect(err.code).toBe('VALIDATION');
  expect(err.fieldErrors).toEqual({ title: 'Required' });
});

test('NOT_CONFIGURED reads as an unavailable feature, never success', async () => {
  await tokens.set({ accessToken: 'A1' });
  replies.push(fail(503, 'NOT_CONFIGURED', 'Online payment is not set up.'));
  const err = (await http.post('/payments/pay-now', {}).catch((e: unknown) => e)) as ApiError;
  expect(err.code).toBe('NOT_CONFIGURED');
  expect(err.isUnavailableFeature).toBe(true);
});

test('a server error without our envelope, or no network, is UNAVAILABLE', async () => {
  await tokens.set({ accessToken: 'A1' });
  replies.push(() => ({ status: 502 }));
  await expect(http.get('/x')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  replies.push(() => new TypeError('Network request failed'));
  await expect(http.get('/x')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
});

test('parallel 401s share ONE refresh, then retry with the new token', async () => {
  await tokens.set({ accessToken: 'OLD', refreshToken: 'R1' });
  const authOf = (init: RequestInit) => (init.headers as Record<string, string>).Authorization;
  replies.push(fail(401, 'UNAUTHENTICATED'), fail(401, 'UNAUTHENTICATED'));
  replies.push((url, init) => {
    expect(url).toMatch(/\/auth\/refresh$/);
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: 'R1' });
    return { status: 200, body: { data: { accessToken: 'NEW', refreshToken: 'R2' }, error: null } };
  });
  replies.push((_u, init) => ({ status: 200, body: { data: authOf(init) } }), (_u, init) => ({ status: 200, body: { data: authOf(init) } }));

  const [a, b] = await Promise.all([http.get('/a'), http.get('/b')]);
  expect([a, b]).toEqual(['Bearer NEW', 'Bearer NEW']);
  expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
  await expect(tokens.refreshToken()).resolves.toBe('R2');
});

test('a refused refresh ends the session and clears the stored token', async () => {
  await tokens.set({ accessToken: 'OLD', refreshToken: 'R1' });
  const ended = jest.fn();
  setSessionEndedHandler(ended);
  replies.push(fail(401, 'UNAUTHENTICATED'), fail(401, 'UNAUTHENTICATED', 'Invalid or expired refresh token'), fail(401, 'UNAUTHENTICATED'));
  await expect(http.get('/a')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  expect(ended).toHaveBeenCalledTimes(1);
  await expect(tokens.refreshToken()).resolves.toBeNull();
});

test('a server outage during refresh keeps the session (offline, not signed out)', async () => {
  await tokens.set({ refreshToken: 'R1' });
  replies.push(() => ({ status: 503 }));
  await expect(refreshSession()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  await expect(tokens.refreshToken()).resolves.toBe('R1');
});

test('with only a stored refresh token, the first request refreshes before sending', async () => {
  await tokens.set({ refreshToken: 'R1' });
  replies.push(ok({ accessToken: 'NEW', refreshToken: 'R2' }), ok('done'));
  await expect(http.get('/a')).resolves.toBe('done');
  expect(calls.map((c) => c.url.replace('http://api.test/api/v1', ''))).toEqual(['/auth/refresh', '/a']);
});
