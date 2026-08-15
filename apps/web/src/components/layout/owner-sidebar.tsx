import { Link } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, CreditCard,
  AlertCircle, Bell, Settings, LogOut, X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useUIStore } from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'
import { useLogout } from '@/features/auth/hooks/use-auth'

const NAV_ITEMS = [
  { href: '/owner/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/owner/buildings', icon: Building2,        label: 'Buildings' },
  { href: '/owner/tenants',   icon: Users,             label: 'Tenants' },
  { href: '/owner/payments',  icon: CreditCard,        label: 'Payments' },
  { href: '/owner/issues',    icon: AlertCircle,       label: 'Issues' },
  { href: '/owner/notices',   icon: Bell,              label: 'Notices' },
  { href: '/owner/settings',  icon: Settings,          label: 'Settings' },
]

export function OwnerSidebar() {
  const location = useLocation()
  const pathname = location.pathname
  const { sidebarOpen, closeSidebar } = useUIStore()
  const user        = useAuthStore((s) => s.user)
  const { mutate: doLogout } = useLogout()

  const verificationStatus = user?.ownerProfile?.verificationStatus

  return (
    <>
      {/* Mobile overlay */}
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
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <Link to="/owner/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">N</span>
            </div>
            <span className="font-semibold text-gray-900">NestOS</span>
          </Link>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1 rounded text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Verification warning */}
        {verificationStatus && verificationStatus !== 'VERIFIED' && (
          <div className="mx-3 mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700 font-medium">Account not verified</p>
            <Link to="/owner/onboarding"
              className="text-xs text-amber-600 hover:underline"
            >
              Complete verification →
            </Link>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                to={href}
                onClick={closeSidebar}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className={cn('h-4 w-4', active ? 'text-indigo-600' : '')} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-700 text-xs font-semibold">
                {user?.ownerProfile?.fullName?.[0]?.toUpperCase() ?? 'O'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.ownerProfile?.fullName ?? 'Owner'}
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