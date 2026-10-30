/**
 * Modules that have a real backend. Everything listed in FEATURE_LABEL but not in
 * AVAILABLE has no server side yet: it is hidden from navigation, its URL shows
 * "Not available yet", and its service rejects with NOT_IMPLEMENTED. When a
 * module's API lands, add it here and swap its service in services/index.ts.
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
  plans: 'Plans',
  search: 'Search',
  settings: 'Settings',
  staff: 'Staff',
  visitors: 'Visitors',
} as const;
export type Feature = keyof typeof FEATURE_LABEL;

const AVAILABLE = new Set<Feature>(['complaints', 'leave']);
export const isAvailable = (f: Feature): boolean => AVAILABLE.has(f);

/** Route → module, for hiding navigation entries and gating their URLs. */
export const ROUTE_FEATURE: Record<string, Feature> = {
  '/owner/analytics': 'analytics', '/owner/staff': 'staff', '/owner/complaints': 'complaints', '/owner/events': 'events',
  '/owner/inventory': 'inventory', '/owner/plans': 'plans', '/owner/settings': 'settings',
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
