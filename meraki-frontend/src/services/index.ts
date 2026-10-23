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

/**
 * Service container. To integrate a backend, implement the same interfaces
 * with HTTP adapters (e.g. `src/services/http/*`) and swap them in here.
 * TODO(backend): choose implementation via `import.meta.env.VITE_API_BASE_URL`.
 */
export const services: Services = {
  auth: mockAuthService,
  properties: mockPropertyService,
  rooms: mockRoomService,
  students: mockStudentService,
  payments: mockPaymentService,
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
