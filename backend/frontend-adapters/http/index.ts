import type { Services } from './interfaces';
// Mock services (unchanged)
import { mockAuthService } from './mock/auth';
import { mockPropertyService } from './mock/properties';
import { mockRoomService } from './mock/rooms';
import { mockStudentService } from './mock/students';
import { mockPaymentService } from './mock/payments';
import { mockComplaintService, mockLeaveService, mockVisitorService } from './mock/requests';
import { mockInventoryService, mockMaintenanceService, mockStaffService } from './mock/operations';
import { mockActivityService, mockAnnouncementService, mockDocumentService, mockEventService, mockFeedbackService, mockNotificationService } from './mock/communication';
import { mockAnalyticsService, mockSearchService, mockSettingsService } from './mock/insights';

// HTTP adapters (real backend). Copy the three adapter files into src/services/http/.
import { httpAuthService, httpPaymentService } from './http/auth-and-payments';
import { httpPropertyService, httpRoomService, httpStudentService } from './http/spine';

/**
 * When VITE_API_BASE_URL is set, the services that the backend implements use
 * real HTTP; everything else keeps using the in-memory mock so the app keeps
 * working. As you build more backend modules, flip them from mock → http here.
 */
const useApi = Boolean(import.meta.env.VITE_API_BASE_URL);

export const services: Services = {
  // Implemented on the backend:
  auth:       useApi ? httpAuthService     : mockAuthService,
  properties: useApi ? httpPropertyService : mockPropertyService,
  rooms:      useApi ? httpRoomService     : mockRoomService,
  students:   useApi ? httpStudentService  : mockStudentService,
  payments:   useApi ? httpPaymentService  : mockPaymentService,

  // Still mock until their backend modules are built (same interface, so the
  // swap is a one-line change each):
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
  notifications: mockNotificationService,
  activity: mockActivityService,
  analytics: mockAnalyticsService,
  settings: mockSettingsService,
  search: mockSearchService,
};

export { subscribeToData, dataRecoveredFromCorruption } from './subscription';
export type * from './interfaces';
