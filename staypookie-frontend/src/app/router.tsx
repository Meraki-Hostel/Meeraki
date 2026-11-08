import { Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useSession } from '@/app/providers/SessionProvider';
import { AppShell } from '@/components/layout/AppShell';
import { RedirectIfAuthed, RequireAuth, RootRedirect, Splash } from '@/components/layout/Guards';
import { PageSkeleton } from '@/components/ui/States';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { LoginPage } from '@/features/auth/LoginPage';
import { ForgotPasswordPage, InviteAcceptPage, ResetPasswordPage } from '@/features/auth/RecoveryPages';
import { NotFoundPage, UnauthorizedPage } from '@/features/shared/SystemPages';
import { lazyNamed } from './lazy';
import { NotAvailablePage } from '@/features/shared/NotAvailablePage';
import { isAvailable, type Feature } from '@/lib/features';

const owner = () => import('@/features/owner');
const manager = () => import('@/features/manager');
const student = () => import('@/features/student');
const shared = () => import('@/features/shared/lazy');

const O = {
  Dashboard: lazyNamed(owner, 'OwnerDashboard'), Properties: lazyNamed(owner, 'PropertiesPage'), PropertyNew: lazyNamed(owner, 'PropertyNewPage'),
  PropertyDetail: lazyNamed(owner, 'PropertyDetailPage'), Analytics: lazyNamed(owner, 'AnalyticsPage'), Finance: lazyNamed(owner, 'FinancePage'),
  Staff: lazyNamed(owner, 'OwnerStaffPage'), Complaints: lazyNamed(owner, 'OwnerComplaintsPage'), Events: lazyNamed(owner, 'OwnerEventsPage'),
  Inventory: lazyNamed(owner, 'OwnerInventoryPage'), Plans: lazyNamed(owner, 'PlansPage'), Settings: lazyNamed(owner, 'SettingsPage'),
};
const M = {
  Dashboard: lazyNamed(manager, 'ManagerDashboard'), Rooms: lazyNamed(manager, 'RoomsPage'), Students: lazyNamed(manager, 'StudentsPage'),
  Student: lazyNamed(manager, 'StudentProfilePage'), Payments: lazyNamed(manager, 'PaymentsPage'), Complaints: lazyNamed(manager, 'ManagerComplaintsPage'),
  Leave: lazyNamed(manager, 'LeavePage'), Visitors: lazyNamed(manager, 'VisitorsPage'), Maintenance: lazyNamed(manager, 'MaintenancePage'),
  Inventory: lazyNamed(manager, 'ManagerInventoryPage'), Staff: lazyNamed(manager, 'ManagerStaffPage'), Announcements: lazyNamed(manager, 'AnnouncementsPage'),
  Events: lazyNamed(manager, 'ManagerEventsPage'), Feedback: lazyNamed(manager, 'FeedbackPage'), Activity: lazyNamed(manager, 'ActivityPage'),
};
const S = {
  Home: lazyNamed(student, 'StudentHome'), Profile: lazyNamed(student, 'StudentProfilePage'), Rent: lazyNamed(student, 'StudentRentPage'),
  Complaints: lazyNamed(student, 'StudentComplaintsPage'), Leave: lazyNamed(student, 'StudentLeavePage'), Visitors: lazyNamed(student, 'StudentVisitorsPage'),
  Notices: lazyNamed(student, 'StudentNoticesPage'), Documents: lazyNamed(student, 'StudentDocumentsPage'), Feedback: lazyNamed(student, 'StudentFeedbackPage'),
  Emergency: lazyNamed(student, 'StudentEmergencyPage'),
};
const Shared = { Notifications: lazyNamed(shared, 'NotificationsPage'), Profile: lazyNamed(shared, 'ProfilePage'), Help: lazyNamed(shared, 'HelpPage') };

const page = (el: ReactNode) => <Suspense fallback={<PageSkeleton />}>{el}</Suspense>;
/** A module without a backend renders "Not available yet" instead of its (demo-only) screen. */
const gated = (feature: Feature, el: ReactNode) => (isAvailable(feature) ? page(el) : <NotAvailablePage feature={feature} />);

/** /help is reachable signed-out (from the login page) and signed-in (inside the shell). */
function HelpEntry() {
  const { ready, user } = useSession();
  if (!ready) return <Splash />;
  if (user) return <AppShell>{page(<Shared.Help />)}</AppShell>;
  return (
    <div className="min-h-dvh bg-ivory">
      <header className="mx-auto flex h-16 max-w-5xl items-center px-6"><a href="/login" aria-label="Back to sign in"><BrandLogo /></a></header>
      <main className="mx-auto max-w-5xl px-6 pb-16 pt-4">{page(<Shared.Help />)}</main>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/invite/accept" element={<InviteAcceptPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/help" element={<HelpEntry />} />

      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/notifications" element={page(<Shared.Notifications />)} />
        <Route path="/profile" element={page(<Shared.Profile />)} />
      </Route>

      <Route path="/owner" element={<RequireAuth roles={['owner']}><AppShell /></RequireAuth>}>
        <Route index element={<RootRedirect />} />
        <Route path="dashboard" element={page(<O.Dashboard />)} />
        <Route path="properties" element={page(<O.Properties />)} />
        <Route path="properties/new" element={page(<O.PropertyNew />)} />
        <Route path="properties/:propertyId" element={page(<O.PropertyDetail />)} />
        <Route path="analytics" element={gated('analytics', <O.Analytics />)} />
        <Route path="finance" element={page(<O.Finance />)} />
        <Route path="staff" element={gated('staff', <O.Staff />)} />
        <Route path="complaints" element={gated('complaints', <O.Complaints />)} />
        <Route path="events" element={gated('events', <O.Events />)} />
        <Route path="inventory" element={gated('inventory', <O.Inventory />)} />
        <Route path="plans" element={gated('plans', <O.Plans />)} />
        <Route path="settings" element={gated('settings', <O.Settings />)} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="/manager" element={<RequireAuth roles={['manager']}><AppShell /></RequireAuth>}>
        <Route index element={<RootRedirect />} />
        <Route path="dashboard" element={page(<M.Dashboard />)} />
        <Route path="rooms" element={page(<M.Rooms />)} />
        <Route path="students" element={page(<M.Students />)} />
        <Route path="students/:studentId" element={page(<M.Student />)} />
        <Route path="payments" element={page(<M.Payments />)} />
        <Route path="complaints" element={gated('complaints', <M.Complaints />)} />
        <Route path="leave" element={gated('leave', <M.Leave />)} />
        <Route path="visitors" element={gated('visitors', <M.Visitors />)} />
        <Route path="maintenance" element={gated('maintenance', <M.Maintenance />)} />
        <Route path="inventory" element={gated('inventory', <M.Inventory />)} />
        <Route path="staff" element={gated('staff', <M.Staff />)} />
        <Route path="announcements" element={gated('announcements', <M.Announcements />)} />
        <Route path="events" element={gated('events', <M.Events />)} />
        <Route path="feedback" element={gated('feedback', <M.Feedback />)} />
        <Route path="activity" element={page(<M.Activity />)} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="/student" element={<RequireAuth roles={['student']}><AppShell /></RequireAuth>}>
        <Route index element={<RootRedirect />} />
        <Route path="home" element={page(<S.Home />)} />
        <Route path="profile" element={page(<S.Profile />)} />
        <Route path="rent" element={page(<S.Rent />)} />
        <Route path="complaints" element={gated('complaints', <S.Complaints />)} />
        <Route path="leave" element={gated('leave', <S.Leave />)} />
        <Route path="visitors" element={gated('visitors', <S.Visitors />)} />
        <Route path="notices" element={gated('announcements', <S.Notices />)} />
        <Route path="documents" element={gated('documents', <S.Documents />)} />
        <Route path="feedback" element={gated('feedback', <S.Feedback />)} />
        <Route path="emergency" element={gated('emergency', <S.Emergency />)} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
