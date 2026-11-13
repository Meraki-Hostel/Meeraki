import type { Services } from './interfaces';
import { httpAuthService, httpPaymentService } from './http/auth-and-payments';
import { httpPropertyService, httpRoomService, httpStudentService } from './http/spine';
import { httpActivityService, httpNotificationService } from './http/misc';
import { httpAnalyticsService } from './http/analytics';
import { httpPayoutService } from './http/payouts';
import {
  httpAnnouncementService, httpComplaintService, httpDocumentService, httpEmergencyService, httpEventService, httpFeedbackService,
  httpInventoryService, httpLeaveService, httpMaintenanceService, httpSearchService, httpSettingsService, httpStaffService,
  httpUploadService, httpVisitorService,
} from './http/operations';

/**
 * Service container for the real application. It talks only to the API at
 * VITE_API_BASE_URL; there is no mock fallback. The mock-only prototype lives
 * in /prototype.
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
  analytics: httpAnalyticsService,
  complaints: httpComplaintService,
  leave: httpLeaveService,
  visitors: httpVisitorService,
  maintenance: httpMaintenanceService,
  inventory: httpInventoryService,
  announcements: httpAnnouncementService,
  events: httpEventService,
  staff: httpStaffService,
  feedback: httpFeedbackService,
  documents: httpDocumentService,
  settings: httpSettingsService,
  payouts: httpPayoutService,
  search: httpSearchService,
  emergency: httpEmergencyService,
  uploads: httpUploadService,
};

export { subscribeToData } from './subscription';
export type * from './interfaces';
