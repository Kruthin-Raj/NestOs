import { OwnerSidebar } from '@/components/layout/owner-sidebar'
import { Outlet } from 'react-router-dom'
import { Topbar } from '@/components/layout/topbar'

export default function OwnerLayout() {
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