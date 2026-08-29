import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Smartphone } from 'lucide-react'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { PageLoader } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'
import { QUERY_KEYS } from '@/lib/utils/constants'
import { formatRupees, formatDateTime, formatBillingPeriod } from '@/lib/utils/format'

type Payment = {
  id: string; type: string; status: string
  amountRupees: number; billingMonth?: number; billingYear?: number
  receiptNumber?: string; createdAt: string
  upiTransactionId?: string | null
  building?: { name: string }
}

export default function TenantPaymentsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.payments.my(),
    queryFn:  async () => {
      const { data } = await apiClient.get('/payments/my')
      return data.data
    },
  })

  // create-order needs a bookingId, and quickActions on the dashboard does not
  // carry one, so the active booking is read from /bookings/my.
  const { data: bookings } = useQuery({
    queryKey: QUERY_KEYS.bookings.my(),
    queryFn:  async () => {
      const { data } = await apiClient.get('/bookings/my')
      return data.data
    },
  })

  const [paymentDetails, setPaymentDetails] = useState<any>(null)

  const { mutate: createOrder, isPending } = useMutation({
    mutationFn: async (bookingId: string) => {
      const now = new Date()
      const { data } = await apiClient.post('/payments/create-order', {
        bookingId,
        type:         'RENT',
        billingMonth: now.getMonth() + 1,
        billingYear:  now.getFullYear(),
      })
      return data.data
    },
    onSuccess: (orderData) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.payments.my() })
      setPaymentDetails(orderData)

      if (orderData.upiIntentUrl) {
        window.location.href = orderData.upiIntentUrl
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Could not initiate payment', 'error')
    },
  })

  if (isLoading) return <PageLoader />

  const payments: Payment[] = data?.items ?? []
  const summary  = data?.summary
  const activeBooking = bookings?.activeBooking as
    | {
        id: string; monthlyRent: number; status?: string; depositPaid?: boolean
        nextRentDue?: string; building?: { name: string }
      }
    | null
    | undefined

  // Rent can only be paid once the deposit has confirmed the booking, so show
  // the deposit prompt instead of a button that would fail with DEPOSIT_NOT_PAID.
  const depositOutstanding = Boolean(activeBooking && !activeBooking.depositPaid)

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Your rent and payment history" />

      {/* Pay rent — UPI intent. Opens the tenant's UPI app with the owner's
          VPA, amount and note prefilled; no card data passes through NestOS. */}
      {activeBooking && depositOutstanding && (
        <Card>
          <CardTitle className="mb-1">Deposit due</CardTitle>
          <p className="text-sm text-gray-500 mb-3">
            Your booking is not confirmed until the security deposit is paid.
          </p>
          <Link to="/tenant/bookings">
            <Button size="sm">Go to my booking</Button>
          </Link>
        </Card>
      )}

      {activeBooking && !depositOutstanding && !paymentDetails && (
        <Card>
          <CardTitle className="mb-1">Pay rent</CardTitle>
          <p className="text-sm text-gray-500 mb-3">
            {formatRupees(activeBooking.monthlyRent)} / month
            {activeBooking.building?.name ? ` · ${activeBooking.building.name}` : ''}
          </p>
          <Button
            size="sm"
            loading={isPending}
            onClick={() => createOrder(activeBooking.id)}
          >
            <Smartphone className="h-4 w-4 mr-1" />
            Proceed to Pay
          </Button>
        </Card>
      )}

      {paymentDetails && (
        <Card>
          <CardTitle className="mb-3 text-green-700">Payment Order Created</CardTitle>
          <p className="text-sm text-gray-600 mb-4">Please pay {formatRupees(paymentDetails.amountRupees)} using one of the methods below:</p>
          
          <div className="space-y-4">
            {paymentDetails.payeeUpiId && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm font-medium text-gray-900 mb-1">UPI Transfer</p>
                <p className="text-sm text-gray-600">UPI ID: <span className="font-mono">{paymentDetails.payeeUpiId}</span></p>
                <p className="text-sm text-gray-600">Name: {paymentDetails.payeeName}</p>
                {paymentDetails.upiIntentUrl && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => window.location.href = paymentDetails.upiIntentUrl}>
                    Open UPI App
                  </Button>
                )}
              </div>
            )}
            
            {paymentDetails.bankDetails?.bankAccountNumber && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm font-medium text-gray-900 mb-1">Bank Transfer</p>
                <p className="text-sm text-gray-600">Bank: {paymentDetails.bankDetails.bankName}</p>
                <p className="text-sm text-gray-600">Account Name: {paymentDetails.bankDetails.bankAccountName}</p>
                <p className="text-sm text-gray-600">Account Number: <span className="font-mono">{paymentDetails.bankDetails.bankAccountNumber}</span></p>
                <p className="text-sm text-gray-600">IFSC: <span className="font-mono">{paymentDetails.bankDetails.bankIfscCode}</span></p>
              </div>
            )}
          </div>
          
          <p className="text-xs text-gray-500 mt-4">
            After paying, scroll down and enter your transaction reference (UTR) below so the owner can confirm it.
          </p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPaymentDetails(null)}>
            Dismiss
          </Button>
        </Card>
      )}

      {/* Summary. Pending is shown separately because a UPI payment stays
          PENDING until the owner confirms the reference — without it, money the
          tenant has already sent looks like it vanished. */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs text-gray-500 mb-1">Total paid</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatRupees(summary?.totalPaid ?? 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Confirmed by your owner</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Awaiting confirmation</p>
          <p className="text-2xl font-bold text-amber-600">
            {formatRupees(summary?.totalPending ?? 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Submit the UPI reference below</p>
        </Card>
      </div>

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
            {payments.map((p) => (
              <div key={p.id} className="p-4">
                <div className="flex items-center justify-between">
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

                {p.status === 'PENDING' && <UpiReferenceForm payment={p} />}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/**
 * A UPI intent payment leaves no server-side trail — the money moves between
 * the tenant's and owner's UPI apps. The tenant submits the UTR here, and the
 * owner confirms it from their payments page. Without this step a payment stays
 * PENDING forever.
 */
function UpiReferenceForm({ payment }: { payment: Payment }) {
  const qc = useQueryClient()
  const [utr, setUtr] = useState('')

  const { mutate: submitUtr, isPending } = useMutation({
    mutationFn: (upiTransactionId: string) =>
      apiClient.patch(`/payments/${payment.id}/upi-reference`, { upiTransactionId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.payments.my() })
      showToast('Reference submitted — waiting for your owner to confirm', 'success')
      setUtr('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Could not submit reference', 'error')
    },
  })

  if (payment.upiTransactionId) {
    return (
      <p className="mt-3 text-xs text-gray-500">
        Reference <span className="font-medium">{payment.upiTransactionId}</span> submitted —
        waiting for your owner to confirm.
      </p>
    )
  }

  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (utr.trim()) submitUtr(utr.trim())
      }}
    >
      <Input
        value={utr}
        onChange={(e) => setUtr(e.target.value)}
        placeholder="UPI reference / UTR"
        className="flex-1"
      />
      <Button type="submit" size="sm" variant="outline" loading={isPending} disabled={!utr.trim()}>
        Submit
      </Button>
    </form>
  )
}
