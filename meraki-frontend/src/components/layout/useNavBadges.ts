import { services } from '@/services';
import { useQuery } from '@/hooks/useQuery';
import { isAvailable } from '@/lib/features';
import type { Role } from '@/types/domain';
import type { BadgeKey } from './nav';

/** Live counters for sidebar badges. Modules without a backend contribute nothing (no made-up counts). */
export function useNavBadges(role: Role | null): Partial<Record<BadgeKey, number>> {
  const q = useQuery(async () => {
    const out: Partial<Record<BadgeKey, number>> = {};
    if (!role) return out;
    const jobs: Promise<void>[] = [];
    if (role === 'student') {
      if (isAvailable('announcements')) jobs.push(services.announcements.list().then((n) => { out.notices = n.filter((x) => !x.isRead).length; }));
    } else {
      if (isAvailable('complaints')) jobs.push(services.complaints.list({ status: 'open' }).then((c) => { out.complaints = c.length; }));
      if (isAvailable('inventory')) jobs.push(services.inventory.list({ lowStockOnly: true }).then((i) => { out.lowStock = i.length; }));
      if (role === 'manager') {
        if (isAvailable('leave')) jobs.push(services.leave.list({ status: 'pending' }).then((l) => { out.leave = l.length; }));
        if (isAvailable('visitors')) jobs.push(services.visitors.list({ status: 'pending' }).then((v) => { out.visitors = v.length; }));
        if (isAvailable('maintenance')) jobs.push(services.maintenance.list({ status: 'open' }).then((m) => { out.maintenance = m.length; }));
      }
    }
    await Promise.all(jobs);
    return out;
  }, [role]);
  return q.data ?? {};
}
