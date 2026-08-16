import { Routes, Route, Navigate } from 'react-router-dom'

// Layouts
import MarketingLayout from '@/layouts/MarketingLayout'
import AuthLayout from '@/layouts/AuthLayout'
import TenantLayout from '@/layouts/TenantLayout'
import OwnerLayout from '@/layouts/OwnerLayout'

// Marketing
import HomePage from '@/pages/Home'
import NotFoundPage from '@/pages/NotFound'

// Auth
import LoginPage from '@/pages/auth/Login'
import SignupPage from '@/pages/auth/Signup'
import VerifyOtpPage from '@/pages/auth/VerifyOtp'
import ForgotPasswordPage from '@/pages/auth/ForgotPassword'

// Tenant
import TenantDashboard from '@/pages/tenant/Dashboard'
import TenantSearch from '@/pages/tenant/Search'
import TenantPropertyDetail from '@/pages/tenant/PropertyDetail'
import TenantBookings from '@/pages/tenant/Bookings'
import TenantPayments from '@/pages/tenant/Payments'
import TenantIssues from '@/pages/tenant/Issues'
import TenantIssueDetail from '@/pages/tenant/IssueDetail'
import TenantNotices from '@/pages/tenant/Notices'
import TenantVisits from '@/pages/tenant/Visits'
import TenantSettings from '@/pages/tenant/Settings'
import TenantOnboarding from '@/pages/tenant/Onboarding'

// Owner
import OwnerDashboard from '@/pages/owner/Dashboard'
import OwnerBuildings from '@/pages/owner/Buildings'
import OwnerBuildingNew from '@/pages/owner/BuildingNew'
import OwnerBuildingDetail from '@/pages/owner/BuildingDetail'
import OwnerBuildingEdit from '@/pages/owner/BuildingEdit'
import OwnerRooms from '@/pages/owner/Rooms'
import OwnerRoomDetail from '@/pages/owner/RoomDetail'
import OwnerTenants from '@/pages/owner/Tenants'
import OwnerTenantDetail from '@/pages/owner/TenantDetail'
import OwnerIssues from '@/pages/owner/Issues'
import OwnerIssueDetail from '@/pages/owner/IssueDetail'
import OwnerPayments from '@/pages/owner/Payments'
import OwnerNotices from '@/pages/owner/Notices'
import OwnerVisits from '@/pages/owner/Visits'
import OwnerSettings from '@/pages/owner/Settings'
import OwnerOnboarding from '@/pages/owner/Onboarding'

// Admin
import AdminLayout from '@/layouts/AdminLayout'
import AdminPendingOwners from '@/pages/admin/PendingOwners'
import AdminPendingTenants from '@/pages/admin/PendingTenants'

export default function App() {
  return (
    <Routes>
      {/* Marketing */}
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<HomePage />} />
      </Route>

      {/* Auth */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-otp" element={<VerifyOtpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Tenant Dashboard */}
      <Route path="/tenant" element={<TenantLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="onboarding" element={<TenantOnboarding />} />
        <Route path="dashboard" element={<TenantDashboard />} />
        <Route path="search" element={<TenantSearch />} />
        <Route path="property/:buildingId" element={<TenantPropertyDetail />} />
        <Route path="bookings" element={<TenantBookings />} />
        <Route path="payments" element={<TenantPayments />} />
        <Route path="issues" element={<TenantIssues />} />
        <Route path="issues/:issueId" element={<TenantIssueDetail />} />
        <Route path="visits" element={<TenantVisits />} />
        <Route path="notices" element={<TenantNotices />} />
        <Route path="settings" element={<TenantSettings />} />
      </Route>

      {/* Owner Dashboard */}
      <Route path="/owner" element={<OwnerLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="onboarding" element={<OwnerOnboarding />} />
        <Route path="dashboard" element={<OwnerDashboard />} />
        <Route path="buildings" element={<OwnerBuildings />} />
        <Route path="buildings/new" element={<OwnerBuildingNew />} />
        <Route path="buildings/:buildingId" element={<OwnerBuildingDetail />} />
        <Route path="buildings/:buildingId/edit" element={<OwnerBuildingEdit />} />
        <Route path="buildings/:buildingId/rooms" element={<OwnerRooms />} />
        <Route path="buildings/:buildingId/rooms/:roomId" element={<OwnerRoomDetail />} />
        <Route path="tenants" element={<OwnerTenants />} />
        <Route path="tenants/:tenantId" element={<OwnerTenantDetail />} />
        <Route path="issues" element={<OwnerIssues />} />
        <Route path="issues/:issueId" element={<OwnerIssueDetail />} />
        <Route path="payments" element={<OwnerPayments />} />
        <Route path="visits" element={<OwnerVisits />} />
        <Route path="notices" element={<OwnerNotices />} />
        <Route path="settings" element={<OwnerSettings />} />
      </Route>

      {/* Admin — SUPER_ADMIN only. AdminLayout redirects everyone else. */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="owners" replace />} />
        <Route path="owners" element={<AdminPendingOwners />} />
        <Route path="tenants" element={<AdminPendingTenants />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
