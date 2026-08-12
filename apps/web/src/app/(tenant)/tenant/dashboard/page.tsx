import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle, Bell, Search, MapPin,
  ChevronRight, CheckCircle, Clock, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { PageLoader } from '@/components/feedback/loading-state'
import { Badge } from '@/components/ui/badge'
import apiClient from '@/lib/api/client'
import { QUERY_KEYS } from '@/lib/utils/constants'
import { formatRupees, formatDate, relativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

export default function TenantDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.dashboard.tenant(),
    queryFn:  async () => {
      const { data } = await apiClient.get('/tenant/dashboard/tenant')
      return data.data
    },
  })

  if (isLoading) return <PageLoader />

  if (!data) return null

  const isActive = data.tenantStatus === 'ACTIVE'

  return isActive ? (
    <ActiveResidentDashboard data={data} />
  ) : (
    <SearchingDashboard data={data} />
  )
}

function SearchingDashboard({ data }: { data: Record<string, unknown> }) {
  const completion = (data.profileCompletion as number) ?? 0
  const prompts    = (data.profilePrompts as string[]) ?? []
  const properties = (data.featuredProperties as Array<{
    id: string; name: string; city: string; vacantBeds: number;
    minRent: number | null; amenities: string[]; coverPhoto: string | null
  }>) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Find your PG</h1>
        <p className="text-sm text-gray-500">Search and book the perfect place to stay</p>
      </div>

      {/* Profile completion */}
      {completion < 100 && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-900">Profile completion</p>
            <span className="text-sm font-bold text-indigo-600">{completion}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full mb-3">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
          {prompts.slice(0, 2).map((p) => (
            <Link
              key={p}
              to="/tenant/settings"
              className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"
            >
              <ChevronRight className="h-3 w-3" />
              {p}
            </Link>
          ))}
        </Card>
      )}

      {/* Search CTA */}
      <Link to="/tenant/search">
        <Card className="bg-gradient-to-br from-teal-600 to-teal-700 text-white cursor-pointer hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-lg">Search PGs near you</p>
              <p className="text-teal-100 text-sm mt-0.5">Browse available rooms and beds</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <Search className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </Link>

      {/* Featured properties */}
      {properties.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Available near you</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {properties.map((p) => (
              <Link key={p.id} to={`/tenant/property/${p.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer p-0 overflow-hidden">
                  {p.coverPhoto && (
                    <img src={p.coverPhoto} alt={p.name} className="w-full h-28 object-cover" />
                  )}
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <MapPin className="h-3 w-3" /> {p.city}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-medium text-indigo-600">
                        {p.minRent ? `From ${formatRupees(p.minRent)}/mo` : 'Contact for price'}
                      </p>
                      <Badge variant="success">{p.vacantBeds} vacant</Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ActiveResidentDashboard({ data }: { data: Record<string, unknown> }) {
  const booking  = data.activeBooking as {
    building: { name: string; addressLine1: string; contactPhone?: string }
    room: { roomNumber: string }
    bed: { bedLabel: string }
    moveInDate: string
  } | null

  const rent = data.rent as {
    nextDueDate: string | null
    nextDueAmount: number | null
    currentMonthStatus: string
    paidAt: string | null
  }

  const issues   = data.issues  as { open: number; recent: Array<{ id: string; title: string; status: string }> }
  const notices  = data.notices as { unreadCount: number; recent: Array<{ id: string; title: string; isRead: boolean }> }

  const RentStatusIcon = rent?.currentMonthStatus === 'SUCCESS'
    ? CheckCircle
    : rent?.currentMonthStatus === 'FAILED'
    ? XCircle
    : Clock

  const rentIconColor = rent?.currentMonthStatus === 'SUCCESS'
    ? 'text-green-600'
    : rent?.currentMonthStatus === 'FAILED'
    ? 'text-red-600'
    : 'text-amber-600'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My home</h1>
        {booking && (
          <p className="text-sm text-gray-500">
            {booking.building.name} · Room {booking.room.roomNumber}, Bed {booking.bed.bedLabel}
          </p>
        )}
      </div>

      {/* Rent card */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">This month's rent</p>
            <div className="flex items-center gap-2">
              <RentStatusIcon className={cn('h-5 w-5', rentIconColor)} />
              <p className="text-xl font-bold text-gray-900">
                {rent?.nextDueAmount ? formatRupees(rent.nextDueAmount) : '—'}
              </p>
            </div>
            {rent?.currentMonthStatus === 'SUCCESS' && rent.paidAt && (
              <p className="text-xs text-green-600 mt-0.5">Paid {relativeTime(rent.paidAt)}</p>
            )}
            {rent?.currentMonthStatus !== 'SUCCESS' && rent?.nextDueDate && (
              <p className="text-xs text-amber-600 mt-0.5">
                Due {formatDate(rent.nextDueDate)}
              </p>
            )}
          </div>
          {rent?.currentMonthStatus !== 'SUCCESS' && (
            <Link to="/tenant/payments">
              <Button size="sm">Pay now</Button>
            </Link>
          )}
        </div>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/tenant/issues">
          <Card className="cursor-pointer hover:shadow-md transition-shadow text-center py-4">
            <AlertCircle className="h-6 w-6 text-orange-500 mx-auto mb-1" />
            <p className="text-xs font-medium text-gray-700">Raise issue</p>
            {issues?.open > 0 && (
              <Badge variant="warning" className="mt-1">{issues.open} open</Badge>
            )}
          </Card>
        </Link>
        <Link to="/tenant/notices">
          <Card className="cursor-pointer hover:shadow-md transition-shadow text-center py-4">
            <Bell className="h-6 w-6 text-blue-500 mx-auto mb-1" />
            <p className="text-xs font-medium text-gray-700">Notices</p>
            {notices?.unreadCount > 0 && (
              <Badge variant="danger" className="mt-1">{notices.unreadCount} unread</Badge>
            )}
          </Card>
        </Link>
      </div>

      {/* Current residence info */}
      {booking && (
        <Card>
          <CardTitle className="mb-3">My residence</CardTitle>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span>{booking.building.addressLine1}</span>
            </div>
            <p className="text-xs text-gray-400">
              Move-in: {formatDate(booking.moveInDate)}
            </p>
            {booking.building.contactPhone && (
              <p className="text-xs text-gray-500">
                Owner: {booking.building.contactPhone}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Recent notices */}
      {notices?.recent?.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle>Recent notices</CardTitle>
            <Link to="/tenant/notices" className="text-xs text-teal-600 hover:underline">
              View all
            </Link>
          </div>
          {notices.recent.map((n) => (
            <Link
              key={n.id}
              to="/tenant/notices"
              className={cn(
                'flex items-center gap-2 py-2 border-b border-gray-100 last:border-0',
                !n.isRead && 'font-medium'
              )}
            >
              {!n.isRead && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />}
              <p className="text-sm text-gray-700 truncate flex-1">{n.title}</p>
              <ChevronRight className="h-3 w-3 text-gray-400" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  )
}