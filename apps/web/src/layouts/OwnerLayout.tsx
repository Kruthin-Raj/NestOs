import { OwnerSidebar } from '@/components/layout/owner-sidebar'
import { Outlet, Navigate } from 'react-router-dom'
import { Topbar } from '@/components/layout/topbar'
import { useMe } from '@/features/auth/hooks/use-auth'
import { PageLoader } from '@/components/feedback/loading-state'
import { HOME_BY_ROLE } from '@/lib/utils/auth-routes'

export default function OwnerLayout() {
  const { data: user, isLoading } = useMe()

  if (isLoading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  
  if (user.role !== 'OWNER') {
    return <Navigate to={HOME_BY_ROLE[user.role] || '/login'} replace />
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <OwnerSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}