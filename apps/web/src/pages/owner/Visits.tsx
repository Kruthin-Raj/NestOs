import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Phone, ShieldCheck } from 'lucide-react'
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
  building: { id: string; name: string }
  tenant:   { id: string; fullName: string; phone: string | null; isIdVerified: boolean }
}

const STATUS_VARIANT = {
  REQUESTED: 'warning',
  CONFIRMED: 'success',
  DECLINED:  'danger',
  CANCELLED: 'default',
  COMPLETED: 'info',
} as const

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function OwnerVisitsPage() {
  const qc = useQueryClient()
  // Which request is open for a reply, and what the owner has typed into it.
  const [replyTo, setReplyTo]   = useState<string | null>(null)
  const [slot, setSlot]         = useState('')
  const [note, setNote]         = useState('')

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.visits.ownerList(),
    queryFn:  async () => {
      const { data } = await apiClient.get('/owner/visits')
      return data.data
    },
  })

  const { mutate: respond, isPending: responding } = useMutation({
    mutationFn: (payload: {
      visitId: string; action: 'CONFIRM' | 'DECLINE'
      confirmedAt?: string; ownerNote?: string
    }) => {
      const { visitId, ...body } = payload
      return apiClient.post(`/owner/visits/${visitId}/respond`, body)
    },
    onSuccess: (_res, vars) => {
      setReplyTo(null)
      setSlot('')
      setNote('')
      qc.invalidateQueries({ queryKey: QUERY_KEYS.visits.ownerList() })
      showToast(vars.action === 'CONFIRM' ? 'Visit confirmed' : 'Visit declined', 'success')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Could not update the visit', 'error')
    },
  })

  const visits: Visit[] = data?.visits ?? []
  const pending = visits.filter((v) => v.status === 'REQUESTED').length

  if (isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Visit requests"
        description={
          pending > 0
            ? `${pending} request${pending > 1 ? 's' : ''} waiting on you`
            : 'People asking to see your properties'
        }
      />

      {!visits.length ? (
        <EmptyState
          icon={<CalendarCheck className="h-12 w-12" />}
          title="No visit requests yet"
          description="Tenants who find your listing can ask to visit before booking"
        />
      ) : (
        <div className="space-y-3">
          {visits.map((v) => (
            <Card key={v.id}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 flex items-center gap-1.5">
                    {v.tenant.fullName}
                    {v.tenant.isIdVerified && (
                      <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{v.building.name}</p>
                </div>
                <Badge variant={STATUS_VARIANT[v.status]}>
                  {v.status.charAt(0) + v.status.slice(1).toLowerCase()}
                </Badge>
              </div>

              <p className="text-sm text-gray-700">
                <span className="text-gray-500">Asked for: </span>
                {formatDateTime(v.requestedAt)}
              </p>
              {v.confirmedAt && (
                <p className="text-sm text-green-700">
                  <span className="text-gray-500">Confirmed for: </span>
                  {formatDateTime(v.confirmedAt)}
                </p>
              )}

              {v.tenantNote && (
                <p className="text-xs text-gray-500 mt-2">Note: {v.tenantNote}</p>
              )}

              {/* Phone only once a visit is on — no reason to hand out a
                  stranger's number before the owner has agreed to meet them. */}
              {v.status === 'CONFIRMED' && v.tenant.phone && (
                <a
                  href={`tel:${v.tenant.phone}`}
                  className="flex items-center gap-1 text-xs text-indigo-700 hover:underline mt-2"
                >
                  <Phone className="h-3 w-3" />
                  {v.tenant.phone}
                </a>
              )}

              {v.status === 'REQUESTED' && (
                replyTo === v.id ? (
                  <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                    <label className="block text-xs font-medium text-gray-700">
                      Time (leave as-is to accept what they asked for)
                    </label>
                    <input
                      type="datetime-local"
                      value={slot || toLocalInput(v.requestedAt)}
                      onChange={(e) => setSlot(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                    <input
                      type="text"
                      maxLength={500}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Message for the tenant (optional)"
                      className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        loading={responding}
                        onClick={() =>
                          respond({
                            visitId:     v.id,
                            action:      'CONFIRM',
                            confirmedAt: new Date(slot || toLocalInput(v.requestedAt)).toISOString(),
                            ownerNote:   note.trim() || undefined,
                          })
                        }
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={responding}
                        onClick={() =>
                          respond({
                            visitId:   v.id,
                            action:    'DECLINE',
                            ownerNote: note.trim() || undefined,
                          })
                        }
                      >
                        Decline
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                        Close
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setReplyTo(v.id)
                      setSlot(toLocalInput(v.requestedAt))
                      setNote('')
                    }}
                  >
                    Respond
                  </Button>
                )
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
