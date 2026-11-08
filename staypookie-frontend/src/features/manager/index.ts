import { createElement } from 'react';
import { ComplaintsBoard } from '@/features/common/ComplaintsBoard';
import { EventsBoard } from '@/features/common/EventsBoard';
import { InventoryBoard } from '@/features/common/InventoryBoard';
import { StaffBoard } from '@/features/common/StaffBoard';

export { ManagerDashboard } from './ManagerDashboard';
export { RoomsPage } from './RoomsPage';
export { StudentsPage } from './StudentsPage';
export { StudentProfilePage } from './StudentProfilePage';
export { PaymentsPage } from './PaymentsPage';
export { LeavePage, VisitorsPage } from './LeaveVisitorsPages';
export { MaintenancePage } from './MaintenancePage';
export { AnnouncementsPage, FeedbackPage, ActivityPage } from './CommunityPages';
export const ManagerComplaintsPage = () => createElement(ComplaintsBoard, { scope: 'manager' });
export const ManagerEventsPage = () => createElement(EventsBoard, { scope: 'manager' });
export const ManagerInventoryPage = () => createElement(InventoryBoard, { scope: 'manager' });
export const ManagerStaffPage = () => createElement(StaffBoard, { scope: 'manager' });
