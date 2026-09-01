import { Outlet, Navigate, Link, useLocation } from 'react-router-dom'
import { ShieldCheck, LogOut } from 'lucide-react'
import { useMe, useLogout } from '@/features/auth/hooks/use-auth'
import { PageLoader } from '@/components/feedback/loading-state'
import { cn } from '@/lib/utils/cn'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const NAV_ITEMS = [
  { href: '/admin/users',   label: 'Users' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/issues',  label: 'Issues' },
  { href: '/admin/owners',  label: 'Owner verification' },
  { href: '/admin/tenants', label: 'Tenant identity' },
]

/**
 * Admin shell.
 *
 * The role check here is a convenience, not a security boundary — every /admin
 * API route is guarded server-side by `isAdmin`. Hiding the UI just avoids
 * showing a screen that would only return 403s.
 */
export default function AdminLayout() {
  const { data: user, isLoading } = useMe()
  const { mutate: doLogout } = useLogout()
  const { pathname } = useLocation()

  if (isLoading) return <PageLoader />

  // Not logged in at all — send to login.
  if (!user) return <Navigate to="/login" replace />

  // Logged in as the wrong role — send them to their own dashboard.
  if (user.role !== 'SUPER_ADMIN') {
    return <Navigate to={user.role === 'OWNER' ? '/owner' : '/tenant'} replace />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-400" />
            <span className="font-semibold">NestOS Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300 dark:text-gray-600 hidden sm:inline">{user.email}</span>
            <ThemeToggle className="text-gray-300 hover:bg-white/10 hover:text-white dark:text-gray-600" />
            <button
              onClick={() => doLogout()}
              className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>

        <nav className="max-w-5xl mx-auto px-6 flex gap-1">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              to={href}
              className={cn(
                'px-3 py-2 text-sm border-b-2 -mb-px',
                pathname.startsWith(href)
                  ? 'border-indigo-400 text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
