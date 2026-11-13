import { addDaysISO, inr, isISODate, period, todayISO } from '@/lib/format';
import { canUpdate, compareVersions, mustUpdate } from '@/lib/version';
import { accessTokenTtl, tokens } from '@/api/tokens';

test('version comparison', () => {
  expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
  expect(compareVersions('0.9', '1.0.0')).toBe(-1);
  expect(mustUpdate('1.0.0', '1.1.0')).toBe(true);
  expect(mustUpdate('1.1.0', '1.1.0')).toBe(false);
  expect(canUpdate('1.1.0', '1.2.0')).toBe(true);
});

test('money and dates', () => {
  expect(inr(150000)).toBe('₹1,50,000');
  expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
  expect(isISODate('2026-02-30')).toBe(false); // JS rolls it over; the API rejects it too
  expect(isISODate('2026-11-20')).toBe(true);
  expect(period('2026-11')).toMatch(/Nov/);
  // 20:00 UTC is already the next day in Asia/Kolkata.
  expect(todayISO(new Date('2026-11-13T20:00:00Z'))).toBe('2026-11-14');
});

test('access token TTL is read from the JWT exp claim', async () => {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const now = Date.UTC(2026, 10, 13, 12, 0, 0);
  await tokens.set({ accessToken: `${b64({ alg: 'HS256' })}.${b64({ exp: now / 1000 + 600 })}.sig` });
  expect(accessTokenTtl(now)).toBe(600);
  await tokens.set({ accessToken: 'not-a-jwt' });
  expect(accessTokenTtl(now)).toBe(0);
});
