import { Badge, type Tone } from './Badge';

/**
 * One map for every status enum in the app — text label + tone, so colour is
 * never the only signal.
 */
const MAP: Record<string, Record<string, [string, Tone]>> = {
  property: { active: ['Active', 'moss'], onboarding: ['Onboarding', 'amber'], inactive: ['Inactive', 'neutral'] },
  bed: { available: ['Available', 'moss'], occupied: ['Occupied', 'slate'], unavailable: ['Unavailable', 'neutral'] },
  room: { active: ['Active', 'moss'], maintenance: ['Under maintenance', 'amber'] },
  student: { active: ['Active', 'moss'], notice: ['On notice', 'amber'], pending: ['Awaiting bed', 'clay'], moved_out: ['Moved out', 'neutral'] },
  staff: { active: ['Active', 'moss'], invited: ['Invited', 'clay'], on_leave: ['On leave', 'amber'], inactive: ['Inactive', 'neutral'] },
  charge: { paid: ['Paid', 'moss'], partial: ['Part paid', 'amber'], pending: ['Due', 'slate'], overdue: ['Overdue', 'brick'] },
  complaint: { open: ['Open', 'clay'], in_progress: ['In progress', 'slate'], resolved: ['Resolved', 'moss'], closed: ['Closed', 'neutral'] },
  priority: { low: ['Low', 'neutral'], medium: ['Medium', 'slate'], high: ['High', 'amber'], urgent: ['Urgent', 'brick'] },
  leave: { pending: ['Pending', 'amber'], approved: ['Approved', 'moss'], rejected: ['Rejected', 'brick'], cancelled: ['Cancelled', 'neutral'] },
  visitor: { pending: ['Pending', 'amber'], approved: ['Approved', 'moss'], rejected: ['Rejected', 'brick'], checked_in: ['Checked in', 'slate'], checked_out: ['Checked out', 'neutral'], cancelled: ['Cancelled', 'neutral'] },
  maintenance: { open: ['Open', 'clay'], assigned: ['Assigned', 'slate'], in_progress: ['In progress', 'slate'], on_hold: ['On hold', 'amber'], completed: ['Completed', 'moss'] },
  announcement: { draft: ['Draft', 'neutral'], published: ['Published', 'moss'], archived: ['Archived', 'neutral'] },
  event: { scheduled: ['Scheduled', 'slate'], completed: ['Completed', 'moss'], cancelled: ['Cancelled', 'neutral'] },
  document: { missing: ['Missing', 'brick'], uploaded: ['Under review', 'amber'], verified: ['Verified', 'moss'], rejected: ['Re-upload needed', 'brick'] },
  invitation: { pending: ['Pending', 'amber'], accepted: ['Accepted', 'moss'], expired: ['Expired', 'neutral'] },
};
export type StatusKind = keyof typeof MAP;

export function statusLabel(kind: StatusKind, value: string): string {
  return MAP[kind]?.[value]?.[0] ?? value;
}
export function statusOptions(kind: StatusKind) {
  return Object.entries(MAP[kind] ?? {}).map(([value, [label]]) => ({ value, label }));
}

export function StatusBadge({ kind, value }: { kind: StatusKind; value: string }) {
  const [label, tone] = MAP[kind]?.[value] ?? [value, 'neutral' as Tone];
  return <Badge tone={tone}>{label}</Badge>;
}
