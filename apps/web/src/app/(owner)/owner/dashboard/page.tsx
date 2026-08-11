'use client'
import { Building2, Users, CreditCard, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { PageLoader } from '@/components/feedback/loading-state'
import { EmptyState } from '@/components/feedback/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { useOwnerDashboard } from '@/features/owner/dashboard/hooks/use-owner-dashboard'
import { formatRupees, formatDateTime, relativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'

export default function OwnerDashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useOwnerDashboard()

  if (isLoading) return <PageLoader />

  const d = data

  const STAT_CARDS = [
    {
      label:     'Occupancy',
      value:     `${d?.occupancy?.occupancyPercent ?? 0}%`,
      sub:       `${d?.occupancy?.occupiedBeds ?? 0} / ${d?.occupancy?.totalBeds ?? 0} beds`,
      icon:      <Building2 className="h-5 w-5" />,
      color:     'text-indigo-600 bg-indigo-50',
      href:      '/owner/buildings',
    },
    {
      label:     'Monthly revenue',
      value:     formatRupees(d?.revenue?.thisMonthCollected ?? 0),
      sub:       `${d?.revenue?.collectionRate ?? 0}% collected`,
      icon:      <CreditCard className="h-5 w-5" />,
      color:     'text-green-600 bg-green-50',
      href:      '/owner/payments',
    },
    {
      label:     'Pending dues',
      value:     formatRupees(d?.revenue?.thisMonthPending ?? 0),
      sub:       `${d?.revenue?.overdueCount ?? 0} tenants`,
      icon:      <TrendingDown className="h-5 w-5" />,
      color:     'text-amber-600 bg-amber-50',
      href:      '/owner/payments',
    },
    {
      label:     'Open issues',
      value:     String(d?.issues?.open ?? 0),
      sub:       `${d?.issues?.urgent ?? 0} urgent`,
      icon:      <AlertCircle className="h-5 w-5" />,
      color:     'text-red-600 bg-red-50',
      href:      '/owner/issues',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your properties"
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => (
          <Link key={card.label} to={card.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs text-gray-500 font-medium">{card.label}</p>
                <span className={cn('p-2 rounded-lg', card.color)}>
                  {card.icon}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.sub}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent payments */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Recent Payments</h3>
            <Link to="/owner/payments" className="text-xs text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          {!d?.recentPayments?.length ? (
            <EmptyState title="No payments yet" />
          ) : (
            <div className="space-y-3">
              {d.recentPayments.map((p: {
                id: string; tenantName: string; amountRupees: number;
                type: string; status: string; paidAt: string; buildingName: string
              }) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.tenantName}</p>
                    <p className="text-xs text-gray-500">{p.buildingName} · {relativeTime(p.paidAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatRupees(p.amountRupees)}</p>
                    <StatusBadge status={p.status as never} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent issues */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Open Issues</h3>
            <Link to="/owner/issues" className="text-xs text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          {!d?.issues?.recentIssues?.length ? (
            <EmptyState title="No open issues" />
          ) : (
            <div className="space-y-3">
              {d.issues.recentIssues.map((issue: {
                id: string; title: string; priority: string;
                status: string; tenantName: string; buildingName: string; createdAt: string
              }) => (
                <Link
                  key={issue.id}
                  to={`/owner/issues/${issue.id}`}
                  className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{issue.title}</p>
                    <p className="text-xs text-gray-500">{issue.tenantName} · {issue.buildingName}</p>
                  </div>
                  <div className="ml-2 flex flex-col items-end gap-1">
                    <StatusBadge status={issue.priority as never} />
                    <StatusBadge status={issue.status as never} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Buildings summary */}
      {d?.buildings?.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Buildings</h3>
            <Link to="/owner/buildings" className="text-xs text-indigo-600 hover:underline">
              Manage buildings
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {d.buildings.map((b: { id: string; name: string; occupancyPercent: number }) => (
              <Link
                key={b.id}
                to={`/owner/buildings/${b.id}`}
                className="p-3 rounded-lg border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
              >
                <p className="text-xs font-medium text-gray-900 truncate">{b.name}</p>
                <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${b.occupancyPercent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{b.occupancyPercent}% occupied</p>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}