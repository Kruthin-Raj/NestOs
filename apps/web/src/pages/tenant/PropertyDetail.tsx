import { useNavigate } from 'react-router-dom'
import { useRequiredParam } from '@/lib/utils/use-required-param'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, MapPin, Phone, Users, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageLoader } from '@/components/feedback/loading-state'
import { EmptyState } from '@/components/feedback/empty-state'
import apiClient from '@/lib/api/client'
import { formatRupees } from '@/lib/utils/format'
import { showToast } from '@/components/ui/toaster'
import { QUERY_KEYS } from '@/lib/utils/constants'
import { cn } from '@/lib/utils/cn'
import { ReportOwnerModal } from '@/components/ui/report-owner-modal'

export default function PropertyDetailPage() {
  const buildingId = useRequiredParam('buildingId')
  const navigate = useNavigate()
  const [selectedBed, setSelectedBed] = useState<{
    id: string; bedLabel: string; monthlyRent: number; roomNumber: string
  } | null>(null)
  const [moveInDate, setMoveInDate] = useState('')
  const [visitAt, setVisitAt] = useState('')
  const [visitNote, setVisitNote] = useState('')
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const queryClient = useQueryClient()

  const { data: property, isLoading } = useQuery({
    queryKey: QUERY_KEYS.properties.detail(buildingId),
    queryFn:  async () => {
      const { data } = await apiClient.get(`/buildings/${buildingId}/public`)
      return data.data
    },
  })

  const { mutate: createBooking, isPending: booking } = useMutation({
    mutationFn: (payload: { bedId: string; moveInDate: string }) =>
      apiClient.post('/bookings', payload),
    onSuccess: (res) => {
      const data = res.data.data
      // Open UPI app via intent link (works on mobile)
      if (data.upiIntentUrl) {
        showToast(
          `Pay deposit of ${formatRupees(data.amountRupees)} via UPI to ${data.payeeName}. UPI ID: ${data.payeeUpiId}`,
          'info'
        )
        window.location.href = data.upiIntentUrl
      } else {
        showToast('Booking created! Owner has not set up UPI yet — contact them to pay deposit.', 'info')
        navigate('/tenant/bookings')
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Booking failed', 'error')
    },
  })

  const { mutate: requestVisit, isPending: requestingVisit } = useMutation({
    mutationFn: (payload: { requestedAt: string; tenantNote?: string }) =>
      apiClient.post('/tenant/visits', { buildingId, ...payload }),
    onSuccess: () => {
      setVisitAt('')
      setVisitNote('')
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.visits.my() })
      showToast('Visit requested. The owner will confirm a time.', 'success')
      navigate('/tenant/visits')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Could not request a visit', 'error')
    },
  })


  if (isLoading) return <PageLoader />
  if (!property) return <EmptyState title="Property not found" />

  const today = new Date().toISOString().split('T')[0]
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 60)
  const maxDateStr = maxDate.toISOString().split('T')[0]

  // datetime-local expects local wall-clock time, so toISOString() (UTC) would
  // be off by the timezone offset — an hour of valid slots would be rejected.
  const toLocalInput = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  const minVisit = toLocalInput(new Date())
  const maxVisit = toLocalInput(maxDate)

  return (
    <div className="max-w-2xl space-y-6">
      {/* Photos */}
      {property.photos?.length > 0 && (
        <div className="rounded-xl overflow-hidden">
          <img
            src={property.photos[0].fileUrl}
            alt={property.name}
            className="w-full h-56 object-cover"
          />
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{property.name}</h1>
              <Badge variant="info">{property.type.replace('_', ' ')}</Badge>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <MapPin className="h-4 w-4" />
              <span>{property.addressLine1}, {property.city}</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setIsReportModalOpen(true)}
          >
            <Flag className="h-4 w-4 mr-2" />
            Report Owner
          </Button>
        </div>
        {property.contactPhone && (
          <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
            <Phone className="h-4 w-4" />
            <span>{property.contactPhone}</span>
          </div>
        )}
      </div>

      {/* Amenities */}
      {property.amenities?.length > 0 && (
        <Card>
          <CardTitle className="mb-3">Amenities</CardTitle>
          <div className="flex flex-wrap gap-2">
            {property.amenities.map((a: string) => (
              <span key={a} className="flex items-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 rounded-lg text-xs font-medium">
                {a}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Description */}
      {property.description && (
        <Card>
          <CardTitle className="mb-2">About</CardTitle>
          <p className="text-sm text-gray-600">{property.description}</p>
        </Card>
      )}

      {/* Rules */}
      {property.rules && (
        <Card>
          <CardTitle className="mb-2">House rules</CardTitle>
          <p className="text-sm text-gray-600 whitespace-pre-line">{property.rules}</p>
        </Card>
      )}

      {/* Visit request — a tenant asking to see the place. Reserves nothing,
          so it stays independent of bed selection below. */}
      <Card>
        <CardTitle className="mb-1 flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-teal-600" />
          Schedule a visit
        </CardTitle>
        <p className="text-xs text-gray-500 mb-3">
          Pick a time that suits you. The owner confirms or suggests another slot —
          nothing is booked and no money is due.
        </p>
        <div className="space-y-2">
          <input
            type="datetime-local"
            min={minVisit}
            max={maxVisit}
            value={visitAt}
            onChange={(e) => setVisitAt(e.target.value)}
            className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
          <input
            type="text"
            maxLength={500}
            value={visitNote}
            onChange={(e) => setVisitNote(e.target.value)}
            placeholder="Anything the owner should know? (optional)"
            className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
          <Button
            variant="secondary"
            className="w-full"
            loading={requestingVisit}
            disabled={!visitAt}
            onClick={() => {
              if (!visitAt) return
              requestVisit({
                // datetime-local has no zone; Date() reads it as local, which
                // is what the tenant meant.
                requestedAt: new Date(visitAt).toISOString(),
                tenantNote:  visitNote.trim() || undefined,
              })
            }}
          >
            Request visit
          </Button>
        </div>
      </Card>

      {/* Room options */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Available rooms</h2>
        {property.roomOptions?.map((room: {
          id: string; type: string; capacity: number; baseRent: number
          amenities: string[]; vacantBeds: number
          vacantBedDetails: Array<{ id: string; bedLabel: string; monthlyRent: number }>
          compatibilityInfo: Array<{ gender?: string; smoking?: string; foodPreference?: string; compatibilityBio?: string }>
          compatibility: {
            score: number | null
            matches: Array<{ label: string; score: number }>
            clashes: Array<{ label: string; score: number }>
            comparedWith: number
          } | null
        }) => (
          <Card key={room.id} className="mb-3">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-medium text-gray-900">
                  {room.type.charAt(0) + room.type.slice(1).toLowerCase()} Room
                </h3>
                <p className="text-xs text-gray-500">
                  {room.capacity} person capacity · {formatRupees(room.baseRent)}/mo
                </p>
              </div>
              <Badge variant={room.vacantBeds > 0 ? 'success' : 'default'}>
                {room.vacantBeds} vacant
              </Badge>
            </div>

            {/* Room amenities */}
            {room.amenities.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {room.amenities.map((a) => (
                  <span key={a} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {a}
                  </span>
                ))}
              </div>
            )}

            {/* How well this room's occupants match your own preferences.
                Only present for shared rooms that already have someone in
                them — see compatibility.ts. */}
            {room.compatibility?.score !== null && room.compatibility && (
              <div className="mb-3 rounded-lg border border-gray-200 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-700">
                    Roommate match
                  </p>
                  <span
                    className={cn(
                      'text-sm font-bold',
                      room.compatibility.score >= 75 ? 'text-green-600'
                        : room.compatibility.score >= 50 ? 'text-amber-600'
                        : 'text-red-600'
                    )}
                  >
                    {room.compatibility.score}%
                  </span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      room.compatibility.score >= 75 ? 'bg-green-500'
                        : room.compatibility.score >= 50 ? 'bg-amber-500'
                        : 'bg-red-500'
                    )}
                    style={{ width: `${room.compatibility.score}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  Based on your lifestyle answers vs {room.compatibility.comparedWith}{' '}
                  current housemate{room.compatibility.comparedWith === 1 ? '' : 's'}.
                </p>
                {room.compatibility.clashes.length > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    Differs on: {room.compatibility.clashes.map((c) => c.label).join(', ')}
                  </p>
                )}
                {room.compatibility.matches.length > 0 && (
                  <p className="text-xs text-green-700 mt-0.5">
                    Agrees on: {room.compatibility.matches.map((m) => m.label).join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Compatibility info */}
            {room.compatibilityInfo.length > 0 && (
              <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Current housemates (lifestyle summary)
                </p>
                <div className="space-y-1">
                  {room.compatibilityInfo.map((c, i) => (
                    <p key={i} className="text-xs text-gray-600">
                      {[c.gender, c.smoking, c.foodPreference, c.compatibilityBio]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Bed selection */}
            {room.vacantBedDetails.length > 0 && (
              <div className="space-y-2">
                {room.vacantBedDetails.map((bed) => (
                  <button
                    key={bed.id}
                    onClick={() =>
                      setSelectedBed({
                        id:           bed.id,
                        bedLabel:     bed.bedLabel,
                        monthlyRent:  bed.monthlyRent,
                        roomNumber:   room.id.slice(0, 4),
                      })
                    }
                    className={cn(
                      'w-full flex items-center justify-between p-2 rounded-lg border text-left transition-colors',
                      selectedBed?.id === bed.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <span className="text-sm text-gray-700">Bed {bed.bedLabel}</span>
                    <span className="text-sm font-semibold text-teal-700">
                      {formatRupees(bed.monthlyRent)}/mo
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Booking CTA */}
      {selectedBed && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-50 border-t border-gray-200 p-4 z-10 lg:static lg:bg-transparent lg:border-0 lg:p-0">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-3">Complete your booking</h3>
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-gray-600">Selected:</span>
              <span className="font-medium">Bed {selectedBed.bedLabel} — {formatRupees(selectedBed.monthlyRent)}/mo</span>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Move-in date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                min={today}
                max={maxDateStr}
                value={moveInDate}
                onChange={(e) => setMoveInDate(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
            </div>
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-gray-600">Booking deposit:</span>
              <span className="font-bold text-gray-900">
                {formatRupees(selectedBed.monthlyRent * (property.depositMonths ?? 2))}
              </span>
            </div>
            <Button
              className="w-full"
              loading={booking}
              disabled={!moveInDate}
              onClick={() => {
                if (!selectedBed || !moveInDate) return
                createBooking({ bedId: selectedBed.id, moveInDate })
              }}
            >
              Book now — pay deposit via UPI
            </Button>
            <button
              onClick={() => setSelectedBed(null)}
              className="text-xs text-gray-400 hover:text-gray-600 mt-2 block text-center w-full"
            >
              Cancel
            </button>
          </Card>
        </div>
      )}

      {property.ownerId && (
        <ReportOwnerModal
          ownerId={property.ownerId}
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}
    </div>
  )
}