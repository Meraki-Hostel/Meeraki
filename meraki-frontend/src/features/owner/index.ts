import { createElement } from 'react';
import { ComplaintsBoard } from '@/features/common/ComplaintsBoard';
import { EventsBoard } from '@/features/common/EventsBoard';
import { InventoryBoard } from '@/features/common/InventoryBoard';
import { StaffBoard } from '@/features/common/StaffBoard';

export { OwnerDashboard } from './OwnerDashboard';
export { PropertiesPage, PropertyNewPage } from './PropertiesPages';
export { PropertyDetailPage } from './PropertyDetailPage';
export { AnalyticsPage } from './AnalyticsPage';
export { FinancePage } from './FinancePage';
export { PlansPage } from './PlansPage';
export { SettingsPage } from './SettingsPage';
export const OwnerStaffPage = () => createElement(StaffBoard, { scope: 'owner' });
export const OwnerComplaintsPage = () => createElement(ComplaintsBoard, { scope: 'owner' });
export const OwnerEventsPage = () => createElement(EventsBoard, { scope: 'owner' });
export const OwnerInventoryPage = () => createElement(InventoryBoard, { scope: 'owner' });
