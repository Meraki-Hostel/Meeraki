import { http } from './client';
import type { IAnalyticsService, ManagerOverview, OwnerOverview, PropertyWithStats, TrendPoint } from '../interfaces';

/** Dashboard figures, computed by the API (snapshots for past months, live for this one). */
export const httpAnalyticsService: IAnalyticsService = {
  ownerOverview: (period?: string) => http.get<OwnerOverview>('/analytics/owner-overview', { period }),
  trends: (filters) => http.get<TrendPoint[]>('/analytics/trends', filters),
  propertyComparison: () => http.get<PropertyWithStats[]>('/analytics/property-comparison'),
  managerOverview: () => http.get<ManagerOverview>('/analytics/manager-overview'),
};
