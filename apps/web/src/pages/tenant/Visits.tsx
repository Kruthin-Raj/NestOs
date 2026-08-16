import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, MapPin, Phone } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/feedback/empty-state'
import { PageLoader } from '@/components/feedback/loading-state'
import { showToast } from '@/components/ui/toaster'
import apiClient from '@/lib/api/client'
import { QUERY_KEYS } from '@/lib/utils/constants'
import { formatDateTime } from '@/lib/utils/format'

interface Visit {
  id:          string
  status:      'REQUESTED' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED'
  requestedAt: string
  confirmedAt: string | null
  tenantNote:  string | null
  ownerNote:   string | null
  building: {
    id: string; name: string; addressLine1: string; city: string
    contactPhone: string | null
  }
}

const STATUS_VARIANT = {
  REQUESTED: 'warning',
  CONFIRMED: 'success',
  DECLINED:  'danger',
  CANCELLED: 'default',
  COMPLETED: 'info',
} as const

const STATUS_LABEL = {
  REQUESTED: 'Awaiting owner',
  CONFIRMED: 'Confirmed',
  DECLINED:  'Declined',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Visited',
} as const

export default function TenantVisitsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.visits.my(),
    queryFn:  async () => {
      const { data } = await apiClient.get('/tenant/visits')
      return data.data
    },
  })

  const { mutate: cancelVisit, isPending: cancelling } = useMutation({
    mutationFn: (visitId: string) => apiClient.post(`/tenant/visits/${visitId}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.visits.my() })
      showToast('Visit cancelled', 'success')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Could not cancel the visit', 'error')
    },
  })

  const visits: Visit[] = data?.visits ?? []

  if (isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="My visits"
        description="Places you have asked to see before booking"
      />

      {!visits.length ? (
        <EmptyState
          icon={<CalendarCheck className="h-12 w-12" />}
          title="No visits scheduled"
          description="Open a property and request a visit to see it in person first"
        />
      ) : (
        <div className="space-y-3">
          {visits.map((v) => {
            const open = v.status === 'REQUESTED' || v.status === 'CONFIRMED'
            // Confirmed visits may have been moved to a different slot by the
            // owner, so show the time that actually applies.
            const shownAt = v.confirmedAt ?? v.requestedAt

            return (
              <Card key={v.id}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <Link
                      to={`/tenant/property/${v.building.id}`}
                      className="font-medium text-gray-900 hover:text-teal-700"
                    >
                      {v.building.name}
                    </Link>
                    <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {v.building.addressLine1}, {v.building.city}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[v.status]}>
                    {STATUS_LABEL[v.status]}
                  </Badge>
                </div>

                <p className="text-sm text-gray-700">
                  <span className="text-gray-500">
                    {v.confirmedAt ? 'Confirmed for: ' : 'Requested for: '}
                  </span>
                  {formatDateTime(shownAt)}
                </p>
                {v.confirmedAt && v.confirmedAt !== v.requestedAt && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    The owner moved this from {formatDateTime(v.requestedAt)}.
                  </p>
                )}

                {v.tenantNote && (
                  <p className="text-xs text-gray-500 mt-2">Your note: {v.tenantNote}</p>
                )}
                {v.ownerNote && (
                  <p className="text-xs text-gray-600 mt-1">Owner said: {v.ownerNote}</p>
                )}

                {v.status === 'CONFIRMED' && v.building.contactPhone && (
                  <a
                    href={`tel:${v.building.contactPhone}`}
                    className="flex items-center gap-1 text-xs text-teal-700 hover:underline mt-2"
                  >
                    <Phone className="h-3 w-3" />
                    {v.building.contactPhone}
                  </a>
                )}

                {open && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    loading={cancelling}
                    onClick={() => cancelVisit(v.id)}
                  >
                    Cancel visit
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
