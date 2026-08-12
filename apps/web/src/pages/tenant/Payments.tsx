import { useQuery } from '@tanstack/react-query'
import { CreditCard } from 'lucide-react'
import { Card, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { PageLoader } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { QUERY_KEYS } from '@/lib/utils/constants'
import { formatRupees, formatDateTime, formatBillingPeriod } from '@/lib/utils/format'

export default function TenantPaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.payments.my(),
    queryFn:  async () => {
      const { data } = await apiClient.get('/payments/my')
      return data.data
    },
  })


  if (isLoading) return <PageLoader />

  const payments = data?.items ?? []
  const summary  = data?.summary

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Your rent and payment history" />

      {/* Summary */}
      <Card>
        <p className="text-xs text-gray-500 mb-1">Total paid</p>
        <p className="text-2xl font-bold text-gray-900">
          {formatRupees(summary?.totalPaid ?? 0)}
        </p>
      </Card>

      {/* Payment list */}
      {!payments.length ? (
        <EmptyState
          icon={<CreditCard className="h-12 w-12" />}
          title="No payments yet"
          description="Your payment history will appear here"
        />
      ) : (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-100">
            <CardTitle>Payment history</CardTitle>
          </div>
          <div className="divide-y divide-gray-100">
            {payments.map((p: {
              id: string; type: string; status: string;
              amountRupees: number; billingMonth?: number; billingYear?: number
              receiptNumber?: string; createdAt: string
              building?: { name: string }
            }) => (
              <div key={p.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {p.billingMonth
                      ? `Rent — ${formatBillingPeriod(p.billingMonth, p.billingYear!)}`
                      : p.type.replace('_', ' ')
                    }
                  </p>
                  {p.building && (
                    <p className="text-xs text-gray-500">{p.building.name}</p>
                  )}
                  {p.receiptNumber && (
                    <p className="text-xs text-gray-400">{p.receiptNumber}</p>
                  )}
                  <p className="text-xs text-gray-400">{formatDateTime(p.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatRupees(p.amountRupees)}</p>
                  <StatusBadge status={p.status as never} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}