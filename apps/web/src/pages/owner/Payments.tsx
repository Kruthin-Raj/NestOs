import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { TableSkeleton } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'
import { formatRupees, formatDateTime, formatBillingPeriod } from '@/lib/utils/format'
import { QUERY_KEYS } from '@/lib/utils/constants'

type OwnerPayment = {
  id: string
  type: string
  status: string
  amountRupees: number
  billingMonth?: number
  billingYear?: number
  createdAt: string
  receiptNumber?: string
  upiTransactionId?: string | null
  tenant: { fullName: string; phone?: string }
  building: { name: string }
  booking?: { room?: { roomNumber: string }; bed?: { bedLabel: string } }
}

export default function OwnerPaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.payments.ownerList(),
    queryFn:  async () => {
      const { data } = await apiClient.get('/payments/owner')
      return data.data
    },
  })

  const payments: OwnerPayment[] = data?.items ?? []
  const summary  = data?.summary

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Confirm the payments you have received, and review your history"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs text-gray-500 mb-1">Total collected</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatRupees(summary?.totalCollected ?? 0)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Awaiting your confirmation</p>
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
            {payments.map((p) => (
              <PaymentRow key={p.id} payment={p} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

/**
 * A UPI intent payment goes straight from the tenant's app to the owner's, so
 * NestOS never sees it happen. The tenant submits the reference (UTR) and the
 * owner checks it against their bank statement and confirms here — that is what
 * marks the payment SUCCESS, issues a receipt, and (for a deposit) confirms the
 * booking.
 */
function PaymentRow({ payment }: { payment: OwnerPayment }) {
  const qc = useQueryClient()

  const { mutate: confirm, isPending } = useMutation({
    mutationFn: () => apiClient.patch(`/payments/${payment.id}/confirm`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.payments.ownerList() })
      showToast('Payment confirmed — receipt issued', 'success')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Could not confirm the payment', 'error')
    },
  })

  const isPendingPayment = payment.status === 'PENDING'

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{payment.tenant.fullName}</p>
          <p className="text-xs text-gray-500">
            {payment.building.name}
            {payment.booking?.room && ` · Room ${payment.booking.room.roomNumber}`}
            {payment.booking?.bed && ` · Bed ${payment.booking.bed.bedLabel}`}
          </p>
          <p className="text-xs text-gray-500">
            {payment.billingMonth
              ? formatBillingPeriod(payment.billingMonth, payment.billingYear!)
              : payment.type.replace('_', ' ')}
          </p>
          {payment.receiptNumber && (
            <p className="text-xs text-gray-400">{payment.receiptNumber}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-gray-900">{formatRupees(payment.amountRupees)}</p>
          <StatusBadge status={payment.status as never} />
          <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(payment.createdAt)}</p>
        </div>
      </div>

      {isPendingPayment && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
          {payment.upiTransactionId ? (
            <p className="text-sm text-amber-900">
              Tenant submitted UPI reference{' '}
              <span className="font-mono font-medium">{payment.upiTransactionId}</span>.
              Check it against your bank statement before confirming.
            </p>
          ) : (
            <p className="text-sm text-amber-900">
              The tenant has not submitted a UPI reference yet. Only confirm if you can
              see the money in your account.
            </p>
          )}

          <Button size="sm" className="mt-2" loading={isPending} onClick={() => confirm()}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Confirm payment received
          </Button>

          {payment.type === 'SECURITY_DEPOSIT' && (
            <p className="text-xs text-amber-700 mt-2">
              Confirming this deposit also confirms the tenant&apos;s booking and marks
              the bed occupied.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
