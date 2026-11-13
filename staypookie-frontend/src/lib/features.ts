/**
 * Modules that have a real backend. Anything listed in FEATURE_LABEL but not in
 * AVAILABLE is hidden from navigation and its URL shows "Not available yet".
 */
export const FEATURE_LABEL = {
  analytics: 'Analytics trends',
  announcements: 'Notices',
  complaints: 'Complaints',
  documents: 'Documents',
  emergency: 'Emergency alerts',
  events: 'Events',
  feedback: 'Feedback',
  inventory: 'Inventory',
  leave: 'Leave',
  maintenance: 'Maintenance',
  payouts: 'Payout accounts',
  plans: 'Plans',
  search: 'Search',
  settings: 'Settings',
  staff: 'Staff',
  visitors: 'Visitors',
} as const;
export type Feature = keyof typeof FEATURE_LABEL;

// Every module now has a backend. Keep the gate so a future module can ship UI first.
const AVAILABLE = new Set<Feature>(Object.keys(FEATURE_LABEL) as Feature[]);
export const isAvailable = (f: Feature): boolean => AVAILABLE.has(f);

/** Route → module, for hiding navigation entries and gating their URLs. */
export const ROUTE_FEATURE: Record<string, Feature> = {
  '/owner/analytics': 'analytics', '/owner/staff': 'staff', '/owner/complaints': 'complaints', '/owner/events': 'events',
  '/owner/inventory': 'inventory', '/owner/payouts': 'payouts', '/owner/plans': 'plans', '/owner/settings': 'settings',
  '/manager/complaints': 'complaints', '/manager/leave': 'leave', '/manager/visitors': 'visitors', '/manager/maintenance': 'maintenance',
  '/manager/inventory': 'inventory', '/manager/staff': 'staff', '/manager/announcements': 'announcements', '/manager/events': 'events',
  '/manager/feedback': 'feedback',
  '/student/notices': 'announcements', '/student/complaints': 'complaints', '/student/leave': 'leave', '/student/visitors': 'visitors',
  '/student/documents': 'documents', '/student/feedback': 'feedback', '/student/emergency': 'emergency',
};
export const routeAvailable = (path: string): boolean => {
  const f = ROUTE_FEATURE[path];
  return !f || isAvailable(f);
};
