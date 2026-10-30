import { http } from './client';
import { ServiceError } from '../errors';
import type { CollectionSummary, ComplaintView, IAnalyticsService, LeaveView, PropertyWithStats } from '../interfaces';
import { currentPeriod, previousPeriod } from '@/lib/clock';

/**
 * Dashboard figures composed from real API data only: properties with their
 * live stats, payment summaries, complaints and leave. Figures that need
 * modules without a backend (visitors, maintenance, inventory) are left
 * undefined so screens omit them rather than show a made-up zero.
 */
const properties = () => http.get<PropertyWithStats[]>('/properties');
const summary = (period: string, propertyId?: string) =>
  http.get<CollectionSummary>('/payments/summary', { period, propertyId });

export const httpAnalyticsService: IAnalyticsService = {
  async ownerOverview(period = currentPeriod()) {
    const [props, collection, last] = await Promise.all([properties(), summary(period), summary(previousPeriod(period))]);
    const total = (k: 'rooms' | 'beds' | 'occupiedBeds' | 'students') => props.reduce((a, p) => a + p.stats[k], 0);
    const beds = total('beds');
    const occupiedBeds = total('occupiedBeds');
    return {
      properties: props.length,
      activeProperties: props.filter((p) => p.status === 'active').length,
      rooms: total('rooms'), beds, occupiedBeds, students: total('students'),
      occupancyPct: beds ? Math.round((occupiedBeds / beds) * 100) : 0,
      expectedRent: collection.expected,
      collection,
      lastMonthCollectionPct: last.collectionPct,
    };
  },
  propertyComparison: properties,
  async managerOverview() {
    const [props, collection, urgent, pendingLeave] = await Promise.all([
      properties(), summary(currentPeriod()), http.get<ComplaintView[]>('/complaints', { priority: 'urgent' }),
      http.get<LeaveView[]>('/leave', { status: 'pending' }),
    ]);
    const property = props[0];
    if (!property) throw new ServiceError('NOT_FOUND', 'No hostel is linked to your account.');
    return {
      property, collection,
      openComplaints: property.stats.openComplaints,
      urgentComplaints: urgent.filter((c) => c.status === 'open' || c.status === 'in_progress').length,
      pendingLeaves: pendingLeave.length,
    };
  },
  trends: () => Promise.reject(new ServiceError('NOT_IMPLEMENTED', "Analytics trends aren't available yet.")),
};
