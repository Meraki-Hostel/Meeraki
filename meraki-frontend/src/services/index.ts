import type {
  IAnnouncementService, IDocumentService, IEventService, IFeedbackService, IInventoryService,
  ILeaveService, IMaintenanceService, ISearchService, ISettingsService, IStaffService, IVisitorService, Services,
} from './interfaces';
import { httpAuthService, httpPaymentService } from './http/auth-and-payments';
import { httpPropertyService, httpRoomService, httpStudentService } from './http/spine';
import { httpActivityService, httpNotificationService } from './http/misc';
import { httpAnalyticsService } from './http/analytics';
import { httpComplaintService } from './http/complaints';
import { unavailable } from './unavailable';

/**
 * Service container for the real application. It talks only to the API at
 * VITE_API_BASE_URL; there is no mock fallback and no per-module switching.
 * Modules without a backend yet are explicit "unavailable" stand-ins (see
 * lib/features.ts). The mock-only prototype lives in /prototype.
 */
export const apiBaseUrl: string | undefined = import.meta.env.VITE_API_BASE_URL || undefined;
export const configError: string | null = apiBaseUrl
  ? null
  : 'VITE_API_BASE_URL is not set, so the app has no server to talk to.';

export const services: Services = {
  auth: httpAuthService,
  properties: httpPropertyService,
  rooms: httpRoomService,
  students: httpStudentService,
  payments: httpPaymentService,
  notifications: httpNotificationService,
  activity: httpActivityService,
  analytics: httpAnalyticsService, // composed from the endpoints above
  complaints: httpComplaintService,

  // No backend yet:
  leave: unavailable<ILeaveService>('Leave'),
  visitors: unavailable<IVisitorService>('Visitors'),
  maintenance: unavailable<IMaintenanceService>('Maintenance'),
  inventory: unavailable<IInventoryService>('Inventory'),
  announcements: unavailable<IAnnouncementService>('Notices'),
  events: unavailable<IEventService>('Events'),
  staff: unavailable<IStaffService>('Staff'),
  feedback: unavailable<IFeedbackService>('Feedback'),
  documents: unavailable<IDocumentService>('Documents'),
  settings: unavailable<ISettingsService>('Settings'),
  search: unavailable<ISearchService>('Search'),
};

export { subscribeToData } from './subscription';
export type * from './interfaces';
