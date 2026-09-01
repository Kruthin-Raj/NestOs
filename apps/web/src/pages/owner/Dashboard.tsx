import { Building2, CreditCard, AlertCircle, TrendingDown, CheckCircle, X, Eye, Download } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { PageLoader } from '@/components/feedback/loading-state'
import { EmptyState } from '@/components/feedback/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { useOwnerDashboard } from '@/features/owner/dashboard/hooks/use-owner-dashboard'
import { formatRupees, relativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import apiClient from '@/lib/api/client'
import { QUERY_KEYS } from '@/lib/utils/constants'
import { showToast } from '@/components/ui/toaster'

export default function OwnerDashboardPage() {
  const { data, isLoading } = useOwnerDashboard()
  const qc = useQueryClient()

  const { mutate: resolveAlert, isPending: isResolving } = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/reports/owner/alerts/${id}/resolve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.dashboard.owner() })
      showToast('Alert marked as resolved', 'success')
    },
    onError: () => {
      showToast('Failed to resolve alert', 'error')
    }
  })

  const { mutate: dismissAlert, isPending: isDismissing } = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/reports/owner/escalated/${id}/dismiss`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.dashboard.owner() })
    }
  })

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

      {/* Critical Alerts */}
      {d?.alerts?.length > 0 && (
        <div className="space-y-3">
          {d.alerts.map((a: { id: string, message: string, reason?: string, attachments?: string[], createdAt: string, isResolved?: boolean }) => (
            <Card key={a.id} className={cn("shadow-sm p-4", a.isResolved ? "border-amber-500 bg-amber-50" : "border-red-500 bg-red-50")}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className={cn("h-5 w-5", a.isResolved ? "text-amber-600" : "text-red-600")} />
                    <h3 className={cn("text-sm font-bold", a.isResolved ? "text-amber-900" : "text-red-900")}>
                      {a.isResolved ? 'Pending Admin Verification' : 'Action Required: Report Escalated by Admin'}
                    </h3>
                  </div>
                  <p className={cn("text-sm font-medium mb-1", a.isResolved ? "text-amber-800" : "text-red-800")}>{a.message}</p>
                  {a.reason && <p className={cn("text-xs italic mb-2", a.isResolved ? "text-amber-700" : "text-red-700")}>Original issue: "{a.reason}"</p>}
                  
                  {a.attachments && a.attachments.length > 0 && (
                    <div className="flex flex-col gap-2 mt-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Attached Evidence</p>
                      <div className="flex flex-wrap gap-3">
                        {a.attachments.map((docId: string, i: number) => {
                          const baseUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'}/uploads/documents/${docId}`
                          const viewUrl = `${baseUrl}?inline=true`
                          return (
                            <div key={docId} className="flex items-center gap-3 bg-white p-2 pr-4 border border-gray-200 rounded-md shadow-sm w-max">
                              <div className="h-10 w-10 relative rounded overflow-hidden bg-gray-100 border">
                                <img 
                                  src={viewUrl} 
                                  alt={`Attachment ${i + 1}`} 
                                  className="w-full h-full object-cover" 
                                />
                              </div>
                              <a 
                                href={viewUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5"
                              >
                                <Eye className="w-4 h-4" /> View
                              </a>
                              <div className="w-px h-4 bg-gray-300 mx-1"></div>
                              <a 
                                href={baseUrl} 
                                download 
                                className="text-gray-400 hover:text-gray-900 transition-colors"
                                title="Download attachment"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button 
                    onClick={() => dismissAlert(a.id)}
                    disabled={isDismissing}
                    className="text-gray-400 hover:text-gray-600 mb-1"
                    title="Dismiss from dashboard"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {!a.isResolved && (
                    <Button 
                      variant="danger" 
                      size="sm" 
                      onClick={() => resolveAlert(a.id)}
                      disabled={isResolving}
                      className="flex-shrink-0"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Resolved
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

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