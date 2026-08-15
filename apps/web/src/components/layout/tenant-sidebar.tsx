import { Link } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Search, CreditCard,
  AlertCircle, Bell, Settings, LogOut, X, BedDouble,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useUIStore } from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'
import { useLogout } from '@/features/auth/hooks/use-auth'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api/client'

const BASE_NAV = [
  { href: '/tenant/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/tenant/search',    icon: Search,          label: 'Find a PG' },
  { href: '/tenant/bookings',  icon: BedDouble,       label: 'My booking' },
  { href: '/tenant/payments',  icon: CreditCard,      label: 'Payments' },
  { href: '/tenant/issues',    icon: AlertCircle,     label: 'Issues' },
  { href: '/tenant/notices',   icon: Bell,            label: 'Notices' },
  { href: '/tenant/settings',  icon: Settings,        label: 'Settings' },
]

export function TenantSidebar() {
  const location = useLocation()
  const pathname = location.pathname
  const { sidebarOpen, closeSidebar } = useUIStore()
  const user        = useAuthStore((s) => s.user)
  const { mutate: doLogout } = useLogout()

  // Unread notice count
  const { data: unreadCount } = useQuery({
    queryKey: ['notices', 'unread'],
    queryFn:  async () => {
      const { data } = await apiClient.get('/tenant/notices?limit=1')
      return data.data.unreadCount as number
    },
    refetchInterval: 60000,
  })

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-30 flex flex-col',
          'w-60 bg-white border-r border-gray-200 transition-transform duration-200',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <Link to="/tenant/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">N</span>
            </div>
            <span className="font-semibold text-gray-900">NestOS</span>
          </Link>
          <button onClick={closeSidebar} className="lg:hidden p-1 rounded text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {BASE_NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            const isNotices = href === '/tenant/notices'

            return (
              <Link
                key={href}
                to={href}
                onClick={closeSidebar}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-teal-50 text-teal-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className={cn('h-4 w-4', active ? 'text-teal-600' : '')} />
                <span className="flex-1">{label}</span>
                {isNotices && unreadCount && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-teal-700 text-xs font-semibold">
                {user?.tenantProfile?.fullName?.[0]?.toUpperCase() ?? 'T'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.tenantProfile?.fullName ?? 'Tenant'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => doLogout()}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}