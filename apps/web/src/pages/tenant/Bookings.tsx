import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BedDouble, Smartphone, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { PageLoader } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'
import { QUERY_KEYS } from '@/lib/utils/constants'
import { formatRupees, formatDate } from '@/lib/utils/format'

type Booking = {
  id: string
  status: string
  moveInDate: string
  monthlyRent: number
  depositAmount: number
  depositPaid: boolean
  nextRentDue?: string | null
  building?: { name: string; addressLine1?: string; city?: string; contactPhone?: string | null } | null
  room?: { roomNumber: string; type: string } | null
  bed?: { bedLabel: string } | null
}

export default function TenantBookingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.bookings.my(),
    queryFn:  async () => {
      const { data } = await apiClient.get('/bookings/my')
      return data.data
    },
  })

  if (isLoading) return <PageLoader />

  const active: Booking | null = data?.activeBooking ?? null
  const past:   Booking[]      = data?.pastBookings ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="My booking" description="Your current stay and booking history" />

      {!active && !past.length ? (
        <EmptyState
          icon={<BedDouble className="h-12 w-12" />}
          title="No bookings yet"
          description="Find a place you like and reserve a bed."
          action={{ label: 'Find a PG', onClick: () => { window.location.href = '/tenant/search' } }}
        />
      ) : null}

      {active && <ActiveBookingCard booking={active} />}

      {past.length > 0 && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-100">
            <CardTitle>Past bookings</CardTitle>
          </div>
          <div className="divide-y divide-gray-100">
            {past.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{b.building?.name}</p>
                  <p className="text-xs text-gray-500">
                    Room {b.room?.roomNumber} · Bed {b.bed?.bedLabel}
                  </p>
                  <p className="text-xs text-gray-400">Moved in {formatDate(b.moveInDate)}</p>
                </div>
                <StatusBadge status={b.status as never} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function ActiveBookingCard({ booking }: { booking: Booking }) {
  const qc = useQueryClient()
  const [showCancel, setShowCancel] = useState(false)
  const [reason, setReason] = useState('')

  const refresh = () => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.bookings.my() })
    qc.invalidateQueries({ queryKey: QUERY_KEYS.payments.my() })
  }

  const onError = (fallback: string) => (err: unknown) => {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    showToast(msg ?? fallback, 'error')
  }

  // Paying the deposit is what turns a PENDING booking into a confirmed
  // tenancy, so this is the main action while the booking is still pending.
  const { mutate: payDeposit, isPending: paying } = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/payments/create-order', {
        bookingId: booking.id,
        type:      'SECURITY_DEPOSIT',
      })
      return data.data
    },
    onSuccess: (order) => {
      refresh()
      if (order.upiIntentUrl) {
        showToast(
          `Pay ${formatRupees(order.amountRupees)} to ${order.payeeName} via UPI (${order.payeeUpiId}), then submit the reference on the Payments page.`,
          'info'
        )
        window.location.href = order.upiIntentUrl
      } else {
        showToast('Owner has not set up UPI yet — contact them.', 'error')
      }
    },
    onError: onError('Could not start the deposit payment'),
  })

  const { mutate: cancel, isPending: cancelling } = useMutation({
    mutationFn: () => apiClient.post(`/bookings/${booking.id}/cancel`, { reason }),
    onSuccess: () => {
      refresh()
      showToast('Booking cancelled', 'success')
      setShowCancel(false)
      setReason('')
    },
    onError: onError('Could not cancel the booking'),
  })

  const isPendingBooking = booking.status === 'PENDING'

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <CardTitle>{booking.building?.name}</CardTitle>
          <p className="text-sm text-gray-500">
            Room {booking.room?.roomNumber} · Bed {booking.bed?.bedLabel}
            {booking.room?.type ? ` · ${booking.room.type.toLowerCase()}` : ''}
          </p>
          {booking.building?.addressLine1 && (
            <p className="text-xs text-gray-400 mt-1">
              {booking.building.addressLine1}
              {booking.building.city ? `, ${booking.building.city}` : ''}
            </p>
          )}
        </div>
        <StatusBadge status={booking.status as never} />
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Monthly rent', value: formatRupees(booking.monthlyRent) },
          { label: 'Deposit',      value: formatRupees(booking.depositAmount) },
          { label: 'Move-in',      value: formatDate(booking.moveInDate) },
          {
            label: 'Next rent due',
            value: booking.nextRentDue ? formatDate(booking.nextRentDue) : '—',
          },
        ].map((s) => (
          <div key={s.label}>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-sm font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {isPendingBooking && !booking.depositPaid && (
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p className="text-sm text-amber-800">
            This booking is not confirmed yet. Pay the security deposit to confirm it —
            the bed is held for you until then.
          </p>
          <Button size="sm" className="mt-2" loading={paying} onClick={() => payDeposit()}>
            <Smartphone className="h-4 w-4 mr-1" />
            Pay deposit via UPI
          </Button>
        </div>
      )}

      {booking.depositPaid && (
        <p className="mt-4 text-sm text-gray-500 flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" />
          Deposit paid. Rent is due on the {new Date(booking.moveInDate).getDate()}
          {' '}of each month — pay it from the{' '}
          <Link to="/tenant/payments" className="text-teal-600 hover:underline">
            Payments
          </Link>{' '}
          page.
        </p>
      )}

      <div className="mt-5 border-t pt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Link to="/tenant/payments">
            <Button size="sm" variant="outline">View payments</Button>
          </Link>
          <Button size="sm" variant="outline" onClick={() => setShowCancel((v) => !v)}>
            {showCancel ? 'Keep booking' : 'Cancel booking'}
          </Button>
        </div>

        {showCancel && (
          <div className="space-y-2">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why are you cancelling? (at least 5 characters)"
            />
            <Button
              size="sm"
              variant="outline"
              loading={cancelling}
              disabled={reason.trim().length < 5}
              onClick={() => cancel()}
            >
              Confirm cancellation
            </Button>
            <p className="text-xs text-gray-400">
              Cancelling frees the bed. You will need to book again to reserve it.
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
