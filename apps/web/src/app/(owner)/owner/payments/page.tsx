'use client'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, TrendingUp } from 'lucide-react'
import { Card, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { TableSkeleton } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { formatRupees, formatDateTime, formatBillingPeriod } from '@/lib/utils/format'
import { QUERY_KEYS } from '@/lib/utils/constants'

export default function OwnerPaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.payments.ownerList(),
    queryFn:  async () => {
      const { data } = await apiClient.get('/payments/owner')
      return data.data
    },
  })

  const payments = data?.items ?? []
  const summary  = data?.summary

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="All payments across your properties" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs text-gray-500 mb-1">Total collected</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatRupees(summary?.totalCollected ?? 0)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Pending this month</p>
          <p className="text-2xl font-bold text-amber-600">
            {formatRupees(summary?.pendingAmount ?? 0)}
          </p>
        </Card>
      </div>

      {/* Payment list */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-gray-100">
          <CardTitle>Payment history</CardTitle>
        </div>
        {isLoading ? (
          <div className="p-4"><TableSkeleton /></div>
        ) : !payments.length ? (
          <EmptyState title="No payments yet" />
        ) : (
          <div className="divide-y divide-gray-100">
            {payments.map((p: {
              id: string; type: string; status: string;
              amountRupees: number; billingMonth?: number; billingYear?: number
              createdAt: string; receiptNumber?: string
              tenant: { fullName: string; phone?: string }
              building: { name: string }
              booking?: { room?: { roomNumber: string }; bed?: { bedLabel: string } }
            }) => (
              <div key={p.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.tenant.fullName}</p>
                  <p className="text-xs text-gray-500">
                    {p.building.name}
                    {p.booking?.room && ` · Room ${p.booking.room.roomNumber}`}
                    {p.billingMonth && ` · ${formatBillingPeriod(p.billingMonth, p.billingYear!)}`}
                  </p>
                  {p.receiptNumber && (
                    <p className="text-xs text-gray-400">{p.receiptNumber}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatRupees(p.amountRupees)}</p>
                  <StatusBadge status={p.status as never} />
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(p.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}