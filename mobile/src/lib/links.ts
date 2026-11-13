import type { Role } from '@/contract/domain';

/**
 * Notifications (in-app and push) carry a WEB path, e.g. "/student/rent" or
 * "/manager/students/abc". The app's routes mirror the web paths where a
 * screen exists; this maps the rest onto the closest app screen. Anything
 * unknown, or for another role, opens the notifications list.
 *
 * Keep in step with staypookie-frontend/src/components/layout/nav.ts.
 */
const EXACT: Record<string, string> = {
  // student
  '/student/home': '/student/home',
  '/student/rent': '/student/rent',
  '/student/notices': '/student/notices',
  '/student/complaints': '/student/requests',
  '/student/leave': '/student/requests?tab=leave',
  '/student/visitors': '/student/requests?tab=visitors',
  '/student/profile': '/student/profile',
  '/student/documents': '/student/documents',
  '/student/feedback': '/student/feedback',
  '/student/emergency': '/student/emergency',
  // manager
  '/manager/dashboard': '/manager/today',
  '/manager/complaints': '/manager/requests',
  '/manager/leave': '/manager/requests?tab=leave',
  '/manager/visitors': '/manager/requests?tab=visitors',
  '/manager/payments': '/manager/payments',
  '/manager/students': '/manager/students',
  '/manager/rooms': '/manager/rooms',
  '/manager/maintenance': '/manager/maintenance',
  '/manager/inventory': '/manager/inventory',
  '/manager/announcements': '/manager/announcements',
  '/manager/emergency': '/manager/emergency',
  // owner
  '/owner/dashboard': '/owner/dashboard',
  '/owner/analytics': '/owner/dashboard',
  '/owner/finance': '/owner/finance',
  '/owner/complaints': '/owner/complaints',
  '/owner/properties': '/owner/properties',
  '/owner/staff': '/owner/staff',
  '/owner/events': '/owner/events',
  '/owner/inventory': '/owner/dashboard',
  '/owner/overview': '/owner/dashboard',
};

/** Pages that exist only on the web: open the role's home instead of a dead end. */
const WEB_ONLY = new Set([
  '/manager/events', '/manager/feedback', '/manager/staff', '/manager/activity',
  '/owner/settings', '/owner/plans', '/owner/payouts',
]);

const DETAIL: [RegExp, (id: string) => string][] = [
  [/^\/student\/complaints\/([^/?#]+)$/, (id) => `/student/complaints/${id}`],
  [/^\/manager\/complaints\/([^/?#]+)$/, (id) => `/manager/complaints/${id}`],
  [/^\/owner\/complaints\/([^/?#]+)$/, (id) => `/owner/complaints/${id}`],
  [/^\/manager\/students\/([^/?#]+)$/, (id) => `/manager/students/${id}`],
  [/^\/owner\/properties\/([^/?#]+)$/, (id) => `/owner/properties/${id}`],
];

export const NOTIFICATIONS_ROUTE = '/notifications';

export function appRouteFor(link: string | null | undefined, role: Role): string {
  if (!link || !link.startsWith('/')) return NOTIFICATIONS_ROUTE;
  const [rawPath, query = ''] = link.split('#')[0].split('?');
  const path = rawPath.replace(/\/+$/, '') || '/';
  if (!path.startsWith(`/${role}/`)) return NOTIFICATIONS_ROUTE;
  // The API links complaints as "/manager/complaints?id=<id>".
  const id = /(?:^|&)id=([^&]+)/.exec(query)?.[1];
  if (id && path === `/${role}/complaints`) return `/${role}/complaints/${decodeURIComponent(id)}`;
  if (EXACT[path]) return EXACT[path];
  if (WEB_ONLY.has(path)) return HOME[role];
  for (const [re, to] of DETAIL) {
    const m = re.exec(path);
    if (m) return to(m[1]);
  }
  return NOTIFICATIONS_ROUTE;
}

/** Where each role lands after sign-in. */
export const HOME: Record<Role, string> = {
  student: '/student/home',
  manager: '/manager/today',
  owner: '/owner/dashboard',
};
