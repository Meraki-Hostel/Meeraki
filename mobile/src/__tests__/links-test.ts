import { appRouteFor, HOME, NOTIFICATIONS_ROUTE } from '@/lib/links';

test.each([
  ['/student/rent', 'student', '/student/rent'],
  ['/student/leave', 'student', '/student/requests?tab=leave'],
  ['/student/complaints', 'student', '/student/requests'],
  ['/manager/complaints?id=c-1', 'manager', '/manager/complaints/c-1'],
  ['/owner/complaints?id=c-2', 'owner', '/owner/complaints/c-2'],
  ['/manager/students/s-9', 'manager', '/manager/students/s-9'],
  ['/owner/properties/p-1', 'owner', '/owner/properties/p-1'],
  ['/manager/dashboard', 'manager', '/manager/today'],
  ['/owner/finance', 'owner', '/owner/finance'],
] as const)('%s for %s → %s', (link, role, to) => {
  expect(appRouteFor(link, role)).toBe(to);
});

test('web-only pages open the role home, not a dead end', () => {
  expect(appRouteFor('/owner/settings', 'owner')).toBe(HOME.owner);
  expect(appRouteFor('/manager/activity', 'manager')).toBe(HOME.manager);
});

test("another role's link, unknown or missing links open the notifications list", () => {
  expect(appRouteFor('/manager/payments', 'student')).toBe(NOTIFICATIONS_ROUTE);
  expect(appRouteFor('/student/something-new', 'student')).toBe(NOTIFICATIONS_ROUTE);
  expect(appRouteFor(undefined, 'owner')).toBe(NOTIFICATIONS_ROUTE);
  expect(appRouteFor('https://evil.example/x', 'owner')).toBe(NOTIFICATIONS_ROUTE);
});
