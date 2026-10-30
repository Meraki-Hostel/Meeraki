import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppStoreProvider, useStore } from './store/AppStore'
import { ConfirmProvider, ToastProvider } from './components/ui'
import { ModalsProvider } from './components/domain/ModalsProvider'
import { AppShell } from './components/layout/AppShell'
import ManagerDashboard from './pages/manager/Dashboard'
import StudentsPage from './pages/manager/Students'
import StudentProfile from './pages/manager/StudentProfile'
import RoomsPage from './pages/manager/Rooms'
import PaymentsPage from './pages/manager/Payments'
import ComplaintsPage from './pages/manager/Complaints'
import LeavePage from './pages/manager/Leave'
import VisitorsPage from './pages/manager/Visitors'
import StaffPage from './pages/manager/Staff'
import MaintenancePage from './pages/manager/Maintenance'
import InventoryPage from './pages/manager/Inventory'
import AnnouncementsPage from './pages/manager/Announcements'
import EventsPage from './pages/manager/Events'
import FeedbackPage from './pages/manager/Feedback'
import ActivityPage from './pages/manager/Activity'
import StudentHome from './pages/student/Home'
import StudentRent from './pages/student/Rent'
import StudentComplaints from './pages/student/Complaints'
import StudentLeave from './pages/student/Leave'
import StudentVisitors from './pages/student/Visitors'
import StudentNotices from './pages/student/Notices'
import StudentDocuments from './pages/student/Documents'
import StudentFeedback from './pages/student/Feedback'
import StudentProfilePage from './pages/student/Profile'
import StudentEmergency from './pages/student/Emergency'
import OwnerOverview from './pages/owner/Overview'
import OwnerProperties from './pages/owner/Properties'
import PropertyDetail from './pages/owner/PropertyDetail'
import OwnerFinance from './pages/owner/Finance'
import OwnerAnalytics from './pages/owner/Analytics'
import OwnerComplaints from './pages/owner/Complaints'
import OwnerStaff from './pages/owner/Staff'
import OwnerInventory from './pages/owner/Inventory'
import OwnerEvents from './pages/owner/Events'
import OwnerPlans from './pages/owner/Plans'
import OwnerSettings from './pages/owner/Settings'
import NotFound from './pages/NotFound'

function Home() {
  const { session } = useStore()
  return <Navigate to={`/${session.role}`} replace />
}

export default function App() {
  return (
    <AppStoreProvider>
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <ModalsProvider>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/manager" element={<AppShell role="manager" />}>
                  <Route index element={<ManagerDashboard />} />
                  <Route path="students" element={<StudentsPage />} />
                  <Route path="students/:id" element={<StudentProfile />} />
                  <Route path="rooms" element={<RoomsPage />} />
                  <Route path="payments" element={<PaymentsPage />} />
                  <Route path="complaints" element={<ComplaintsPage />} />
                  <Route path="leave" element={<LeavePage />} />
                  <Route path="visitors" element={<VisitorsPage />} />
                  <Route path="staff" element={<StaffPage />} />
                  <Route path="maintenance" element={<MaintenancePage />} />
                  <Route path="inventory" element={<InventoryPage />} />
                  <Route path="announcements" element={<AnnouncementsPage />} />
                  <Route path="events" element={<EventsPage />} />
                  <Route path="feedback" element={<FeedbackPage />} />
                  <Route path="activity" element={<ActivityPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
                <Route path="/student" element={<AppShell role="student" />}>
                  <Route index element={<StudentHome />} />
                  <Route path="rent" element={<StudentRent />} />
                  <Route path="complaints" element={<StudentComplaints />} />
                  <Route path="leave" element={<StudentLeave />} />
                  <Route path="visitors" element={<StudentVisitors />} />
                  <Route path="notices" element={<StudentNotices />} />
                  <Route path="documents" element={<StudentDocuments />} />
                  <Route path="feedback" element={<StudentFeedback />} />
                  <Route path="profile" element={<StudentProfilePage />} />
                  <Route path="emergency" element={<StudentEmergency />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
                <Route path="/owner" element={<AppShell role="owner" />}>
                  <Route index element={<OwnerOverview />} />
                  <Route path="properties" element={<OwnerProperties />} />
                  <Route path="properties/:id" element={<PropertyDetail />} />
                  <Route path="students" element={<StudentsPage owner />} />
                  <Route path="students/:id" element={<StudentProfile owner />} />
                  <Route path="finance" element={<OwnerFinance />} />
                  <Route path="analytics" element={<OwnerAnalytics />} />
                  <Route path="complaints" element={<OwnerComplaints />} />
                  <Route path="staff" element={<OwnerStaff />} />
                  <Route path="inventory" element={<OwnerInventory />} />
                  <Route path="events" element={<OwnerEvents />} />
                  <Route path="plans" element={<OwnerPlans />} />
                  <Route path="settings" element={<OwnerSettings />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
                <Route path="*" element={<Home />} />
              </Routes>
            </ModalsProvider>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </AppStoreProvider>
  )
}
