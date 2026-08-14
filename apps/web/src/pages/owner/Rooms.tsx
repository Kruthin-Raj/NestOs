import { useRequiredParam } from '@/lib/utils/use-required-param'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, ChevronRight } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { PageLoader } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { formatRupees } from '@/lib/utils/format'
import { showToast } from '@/components/ui/toaster'
import { QUERY_KEYS } from '@/lib/utils/constants'
import { Link } from 'react-router-dom'
import type { Room, Floor } from '@/types'

export default function RoomsPage() {
  const buildingId         = useRequiredParam('buildingId')
  const [showAddRoom, setShowAddRoom] = useState(false)
  const [showAddFloor, setShowAddFloor] = useState(false)

 const { data: floors = [], isLoading } = useQuery<Floor[]>({
  queryKey: QUERY_KEYS.buildings.floors(buildingId),
  enabled: !!buildingId,
  queryFn: async (): Promise<Floor[]> => {
    const response = await apiClient.get(`/buildings/${buildingId}/floors`)
    return response.data?.data ?? []
  },
})

const { data: rooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
  queryKey: QUERY_KEYS.buildings.rooms(buildingId),
  enabled: !!buildingId,
  queryFn: async (): Promise<Room[]> => {
    const response = await apiClient.get(`/buildings/${buildingId}/rooms`)
    return response.data?.data?.rooms ?? []
  },
})
  if (isLoading || roomsLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms & Beds"
        description="Manage floors, rooms and beds"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddFloor(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add floor
            </Button>
            <Button size="sm" onClick={() => setShowAddRoom(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add room
            </Button>
          </div>
        }
      />

      {showAddFloor && (
        <AddFloorForm
          buildingId={buildingId}
          onClose={() => setShowAddFloor(false)}
        />
      )}

      {showAddRoom &&  (
        <AddRoomForm
          buildingId={buildingId}
          floors={floors}
          onClose={() => setShowAddRoom(false)}
        />
      )}

      {!rooms?.length ? (
        <EmptyState
          title="No rooms yet"
          description="Add floors first, then add rooms to each floor"
        />
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <Link
              key={room.id}
              to={`/owner/buildings/${buildingId}/rooms/${room.id}`}
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">Room {room.roomNumber}</h3>
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-500 capitalize">
                        {room.type.toLowerCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {room.currentCount}/{room.capacity} occupied · {formatRupees(room.baseRent)}/mo
                    </p>
                    {room.amenities?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        {room.amenities.map((a) => a.name).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {room.beds?.filter((b) => b.status === 'VACANT').length ?? 0} vacant
                      </p>
                      <p className="text-xs text-gray-500">
                        {room.beds?.length ?? 0} total beds
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function AddFloorForm({ buildingId, onClose }: { buildingId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const schema = z.object({
    floorNumber: z.coerce.number().int().min(0),
    label:       z.string().optional(),
  })
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  const { mutate, isPending } = useMutation({
    // A blank label arrives as "" and is normalised to absent by the API, so
    // the floor falls back to "Floor <n>" instead of rendering nameless.
    mutationFn: (v: unknown) => apiClient.post(`/buildings/${buildingId}/floors`, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.buildings.floors(buildingId) })
      showToast('Floor added', 'success')
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Failed to add floor', 'error')
    },
  })

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Add floor</h3>
      <form onSubmit={handleSubmit((v) => mutate(v))} className="flex gap-3">
        <FormField label="Floor number" error={errors.floorNumber?.message} required className="flex-1">
          <Input {...register('floorNumber')} type="number" placeholder="0 = Ground" />
        </FormField>
        <FormField label="Label" className="flex-1">
          <Input {...register('label')} placeholder="Ground Floor" />
        </FormField>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm" loading={isPending}>Add</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}

function AddRoomForm({
  buildingId, floors, onClose,
}: { buildingId: string; floors: Floor[]; onClose: () => void }) {
  const qc = useQueryClient()
  const schema = z.object({
    floorId:    z.string().min(1, 'Select a floor'),
    roomNumber: z.string().min(1, 'Enter room number'),
    type:       z.enum(['PRIVATE', 'SHARED', 'DORMITORY']),
    capacity:   z.coerce.number().int().min(1).max(20),
    baseRent:   z.coerce.number().positive().min(500),
  })
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (v: unknown) => apiClient.post(`/buildings/${buildingId}/rooms`, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.buildings.rooms(buildingId) })
      showToast('Room added', 'success')
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Failed to add room', 'error')
    },
  })

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Add room</h3>
      <form onSubmit={handleSubmit((v) => mutate(v))} className="grid grid-cols-2 gap-3">
        <FormField label="Floor" error={errors.floorId?.message} required>
  <select
    {...register('floorId')}
    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
    defaultValue=""
  >
    <option value="" disabled>
      Select floor
    </option>
    {floors.map((floor) => (
      <option key={floor.id} value={floor.id}>
        {floor.label || `Floor ${floor.floorNumber}`}
      </option>
    ))}
  </select>
</FormField>
        <FormField label="Room number" error={errors.roomNumber?.message} required>
          <Input {...register('roomNumber')} placeholder="101" />
        </FormField>
        <FormField label="Room type" error={errors.type?.message} required>
          <Select
            {...register('type')}
            placeholder="Select type"
            options={[
              { value: 'PRIVATE',   label: 'Private (1 person)' },
              { value: 'SHARED',    label: 'Shared (2-4 persons)' },
              { value: 'DORMITORY', label: 'Dormitory (5+ persons)' },
            ]}
          />
        </FormField>
        <FormField label="Capacity" error={errors.capacity?.message} required>
          <Input {...register('capacity')} type="number" min={1} max={20} />
        </FormField>
        <FormField label="Rent per bed (₹/month)" error={errors.baseRent?.message} required className="col-span-2">
          <Input {...register('baseRent')} type="number" placeholder="8000" />
        </FormField>
        <div className="col-span-2 flex gap-2">
          <Button type="submit" loading={isPending}>Add room</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}