'use client'
import { useRequiredParam } from '@/lib/utils/use-required-param'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, User } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { PageLoader } from '@/components/feedback/loading-state'
import { EmptyState } from '@/components/feedback/empty-state'
import apiClient from '@/lib/api/client'
import { formatRupees, formatDate } from '@/lib/utils/format'
import { showToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils/cn'
import type { Bed } from '@/types'

const addBedSchema = z.object({
  bedLabel:    z.string().min(1, 'Enter a label like A, B, or Bed 1'),
  monthlyRent: z.coerce.number().positive().min(500),
  notes:       z.string().optional(),
})

export default function RoomDetailPage() {
  const buildingId = useRequiredParam('buildingId')
  const roomId     = useRequiredParam('roomId')
  const [showAddBed, setShowAddBed] = useState(false)
  const [releasingBedId, setReleasingBedId] = useState<string | null>(null)
  const qc = useQueryClient()

  const bedsKey = ['beds', buildingId, roomId]

 const { data: beds = [], isLoading } = useQuery<Bed[]>({
  queryKey: bedsKey,
  enabled: !!buildingId && !!roomId,
  queryFn: async (): Promise<Bed[]> => {
    const response = await apiClient.get(
      `/buildings/${buildingId}/rooms/${roomId}/beds`
    )
    return response.data?.data?.beds ?? []
  },
})

  const { mutate: addBed, isPending: adding } = useMutation({
    mutationFn: (v: unknown) =>
      apiClient.post(`/buildings/${buildingId}/rooms/${roomId}/beds`, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bedsKey })
      showToast('Bed added', 'success')
      setShowAddBed(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Failed to add bed', 'error')
    },
  })

  const { mutate: releaseBed, isPending: releasing } = useMutation({
    mutationFn: ({ bedId, date }: { bedId: string; date: string }) =>
      apiClient.post(`/buildings/${buildingId}/rooms/${roomId}/beds/${bedId}/release`, {
        actualMoveOutDate: date,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bedsKey })
      showToast('Tenant moved out. Bed is now vacant.', 'success')
      setReleasingBedId(null)
    },
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(addBedSchema),
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Room ${roomId.slice(0, 4)}`}
        description="Manage beds in this room"
        actions={
          <Button size="sm" onClick={() => setShowAddBed(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add bed
          </Button>
        }
      />

      {showAddBed && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Add new bed</h3>
          <form
            onSubmit={handleSubmit((v) => { addBed(v); reset() })}
            className="grid grid-cols-2 gap-3"
          >
            <FormField label="Bed label" error={errors.bedLabel?.message} required>
              <Input {...register('bedLabel')} placeholder="A or Bed 1" />
            </FormField>
            <FormField label="Monthly rent (₹)" error={errors.monthlyRent?.message} required>
              <Input {...register('monthlyRent')} type="number" placeholder="8000" />
            </FormField>
            <FormField label="Notes (internal)" className="col-span-2">
              <Input {...register('notes')} placeholder="Window-side bed" />
            </FormField>
            <div className="col-span-2 flex gap-2">
              <Button type="submit" size="sm" loading={adding}>Add bed</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddBed(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {!beds.length ? (
  <EmptyState
    title="No beds in this room"
    description="Add beds to start assigning tenants"
  />
) : (
  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
    {beds.map((bed) => (
      <BedCard
        key={bed.id}
        bed={bed}
        onRelease={() => setReleasingBedId(bed.id)}
      />
    ))}
  </div>
)}

      {/* Release confirmation */}
      {releasingBedId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 mb-2">Confirm move-out</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will mark the tenant as moved out and free up the bed.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setReleasingBedId(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={releasing}
                onClick={() =>
                  releaseBed({
                    bedId: releasingBedId,
                    date:  new Date().toISOString().split('T')[0],
                  })
                }
                className="flex-1"
              >
                Move out
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function BedCard({ bed, onRelease }: { bed: Bed; onRelease: () => void }) {
  return (
    <Card className={cn(
      'relative',
      bed.status === 'OCCUPIED' && 'border-blue-200',
      bed.status === 'VACANT'   && 'border-green-200',
      bed.status === 'BLOCKED'  && 'opacity-60',
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-900">Bed {bed.bedLabel}</p>
          <p className="text-sm text-gray-500">{formatRupees(bed.monthlyRent)}/mo</p>
        </div>
        <StatusBadge status={bed.status} />
      </div>

      {bed.currentTenant ? (
        <div className="mt-2 p-2 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <User className="h-3.5 w-3.5 text-blue-600" />
            <p className="text-xs font-medium text-blue-900">{bed.currentTenant.fullName}</p>
          </div>
          {bed.currentTenant.moveInDate && (
            <p className="text-xs text-blue-600 ml-5">
              Since {formatDate(bed.currentTenant.moveInDate)}
            </p>
          )}
          {bed.currentTenant.paymentStatus && (
            <p className="text-xs ml-5 mt-0.5">
              This month: <StatusBadge status={bed.currentTenant.paymentStatus as never} />
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onRelease}
            className="mt-2 w-full text-xs"
          >
            Move out
          </Button>
        </div>
      ) : (
        <p className="text-xs text-gray-400">{bed.notes ?? 'No notes'}</p>
      )}
    </Card>
  )
}