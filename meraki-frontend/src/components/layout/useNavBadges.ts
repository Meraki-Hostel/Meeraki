import { services } from '@/services';
import { useQuery } from '@/hooks/useQuery';
import type { Role } from '@/types/domain';
import type { BadgeKey } from './nav';

/** Live counters for sidebar badges, recomputed after any demo mutation. */
export function useNavBadges(role: Role | null): Partial<Record<BadgeKey, number>> {
  const q = useQuery(async () => {
    if (!role) return {};
    if (role === 'student') {
      const notices = await services.announcements.list();
      return { notices: notices.filter((n) => !n.isRead).length };
    }
    const [complaints, lowStock] = await Promise.all([services.complaints.list({ status: 'open' }), services.inventory.list({ lowStockOnly: true })]);
    if (role === 'owner') return { complaints: complaints.length, lowStock: lowStock.length };
    const [leave, visitors, maintenance] = await Promise.all([services.leave.list({ status: 'pending' }), services.visitors.list({ status: 'pending' }), services.maintenance.list({ status: 'open' })]);
    return { complaints: complaints.length, lowStock: lowStock.length, leave: leave.length, visitors: visitors.length, maintenance: maintenance.length };
  }, [role]);
  return q.data ?? {};
}
