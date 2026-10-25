import type { Services } from './interfaces';
import { mockAuthService } from './mock/auth';
import { mockPropertyService } from './mock/properties';
import { mockRoomService } from './mock/rooms';
import { mockStudentService } from './mock/students';
import { mockPaymentService } from './mock/payments';
import { mockComplaintService, mockLeaveService, mockVisitorService } from './mock/requests';
import { mockInventoryService, mockMaintenanceService, mockStaffService } from './mock/operations';
import { mockActivityService, mockAnnouncementService, mockDocumentService, mockEventService, mockFeedbackService, mockNotificationService } from './mock/communication';
import { mockAnalyticsService, mockSearchService, mockSettingsService } from './mock/insights';
import { httpAuthService, httpPaymentService } from './http/auth-and-payments';
import { httpPropertyService, httpRoomService, httpStudentService } from './http/spine';
import { httpActivityService, httpNotificationService } from './http/misc';
import { withMockSessionMirror } from './http/mockSessionBridge';

/**
 * Service container. When VITE_API_BASE_URL is set, the modules the backend
 * implements use real HTTP; the rest stay on the in-memory mock until their
 * backend modules are built (same interface, so each swap is one line here).
 * Leave VITE_API_BASE_URL unset to run fully on the mock.
 */
const useApi = Boolean(import.meta.env.VITE_API_BASE_URL);

export const services: Services = {
  // Served by the backend:
  auth: useApi ? withMockSessionMirror(httpAuthService) : mockAuthService,
  properties: useApi ? httpPropertyService : mockPropertyService,
  rooms: useApi ? httpRoomService : mockRoomService,
  students: useApi ? httpStudentService : mockStudentService,
  payments: useApi ? httpPaymentService : mockPaymentService,
  notifications: useApi ? httpNotificationService : mockNotificationService,
  activity: useApi ? httpActivityService : mockActivityService,

  // Still mock until their backend modules are built:
  complaints: mockComplaintService,
  leave: mockLeaveService,
  visitors: mockVisitorService,
  maintenance: mockMaintenanceService,
  inventory: mockInventoryService,
  announcements: mockAnnouncementService,
  events: mockEventService,
  staff: mockStaffService,
  feedback: mockFeedbackService,
  documents: mockDocumentService,
  analytics: mockAnalyticsService,
  settings: mockSettingsService,
  search: mockSearchService,
};

export { subscribeToData, dataRecoveredFromCorruption } from './subscription';
export type * from './interfaces';
