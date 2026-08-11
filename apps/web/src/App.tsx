import { Routes, Route, Navigate } from 'react-router-dom'

// Layouts
import MarketingLayout from './app/(marketing)/layout'
import AuthLayout from './app/(auth)/layout'
import TenantLayout from './app/(tenant)/layout'
import OwnerLayout from './app/(owner)/layout'

// Marketing Pages
import HomePage from './app/(marketing)/page'

// Auth Pages
import LoginPage from './app/(auth)/login/page'
import SignupPage from './app/(auth)/signup/page'
import VerifyOtpPage from './app/(auth)/verify-otp/page'

// Tenant Pages
import TenantDashboard from './app/(tenant)/tenant/dashboard/page'
import TenantSearch from './app/(tenant)/tenant/search/page'
import TenantPropertyDetail from './app/(tenant)/tenant/property/[buildingId]/page'
import TenantPayments from './app/(tenant)/tenant/payments/page'
import TenantIssues from './app/(tenant)/tenant/issues/page'
import TenantIssueDetail from './app/(tenant)/tenant/issues/[issuesId]/page'
import TenantOnboarding from './app/(tenant)/tenant/onboarding/page'

// Owner Pages
import OwnerDashboard from './app/(owner)/owner/dashboard/page'
import OwnerBuildings from './app/(owner)/owner/buildings/page'
import OwnerBuildingNew from './app/(owner)/owner/buildings/new/page'
import OwnerBuildingDetail from './app/(owner)/owner/buildings/[buildingId]/page'
import OwnerRooms from './app/(owner)/owner/buildings/[buildingId]/rooms/page'
import OwnerRoomDetail from './app/(owner)/owner/buildings/[buildingId]/rooms/[roomId]/page'
import OwnerTenants from './app/(owner)/owner/tenants/page'
import OwnerIssues from './app/(owner)/owner/issues/page'
import OwnerIssueDetail from './app/(owner)/owner/issues/[issuesId]/page'
import OwnerOnboarding from './app/(owner)/owner/onboarding/page'

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
      </Route>

      {/* Tenant Dashboard */}
      <Route path="/tenant" element={<TenantLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="onboarding" element={<TenantOnboarding />} />
        <Route path="dashboard" element={<TenantDashboard />} />
        <Route path="search" element={<TenantSearch />} />
        <Route path="property/:buildingId" element={<TenantPropertyDetail />} />
        <Route path="payments" element={<TenantPayments />} />
        <Route path="issues" element={<TenantIssues />} />
        <Route path="issues/:issuesId" element={<TenantIssueDetail />} />
      </Route>

      {/* Owner Dashboard */}
      <Route path="/owner" element={<OwnerLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="onboarding" element={<OwnerOnboarding />} />
        <Route path="dashboard" element={<OwnerDashboard />} />
        <Route path="buildings" element={<OwnerBuildings />} />
        <Route path="buildings/new" element={<OwnerBuildingNew />} />
        <Route path="buildings/:buildingId" element={<OwnerBuildingDetail />} />
        <Route path="buildings/:buildingId/rooms" element={<OwnerRooms />} />
        <Route path="buildings/:buildingId/rooms/:roomId" element={<OwnerRoomDetail />} />
        <Route path="tenants" element={<OwnerTenants />} />
        <Route path="issues" element={<OwnerIssues />} />
        <Route path="issues/:issuesId" element={<OwnerIssueDetail />} />
      </Route>
    </Routes>
  )
}
