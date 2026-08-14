import { TenantSidebar } from '@/components/layout/tenant-sidebar'
import { Outlet } from 'react-router-dom'
import { Topbar } from '@/components/layout/topbar'

export default function TenantLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <TenantSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}