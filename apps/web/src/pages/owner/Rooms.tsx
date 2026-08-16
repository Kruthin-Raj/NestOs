import { useRequiredParam } from '@/lib/utils/use-required-param'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, ChevronRight, Layers } from 'lucide-react'
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
  const [showBulkAdd, setShowBulkAdd] = useState(false)

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
            <Button variant="outline" size="sm" onClick={() => setShowAddRoom(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add room
            </Button>
            <Button size="sm" onClick={() => setShowBulkAdd(true)}>
              <Layers className="h-4 w-4 mr-1" /> Add many
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

      {showBulkAdd && (
        <BulkAddRoomsForm
          buildingId={buildingId}
          floors={floors}
          onClose={() => setShowBulkAdd(false)}
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

/**
 * Creates a numbered run of identical rooms, each with its beds.
 *
 * The preview uses the same rule as the API, so what an owner sees before
 * submitting is exactly what gets created. Numbers already used in the building
 * are skipped rather than failing the whole batch.
 */
function BulkAddRoomsForm({
  buildingId, floors, onClose,
}: { buildingId: string; floors: Floor[]; onClose: () => void }) {
  const qc = useQueryClient()

  const [floorId, setFloorId]         = useState('')
  const [prefix, setPrefix]           = useState('')
  const [startNumber, setStartNumber] = useState('101')
  const [count, setCount]             = useState('10')
  const [padTo, setPadTo]             = useState('0')
  const [type, setType]               = useState<'PRIVATE' | 'SHARED' | 'DORMITORY'>('SHARED')
  const [capacity, setCapacity]       = useState('2')
  const [baseRent, setBaseRent]       = useState('')
  const [bedLabelStyle, setBedLabelStyle] = useState<'ALPHA' | 'NUMERIC'>('ALPHA')

  const startNum = parseInt(startNumber, 10)
  const howMany  = parseInt(count, 10)
  const pad      = parseInt(padTo, 10) || 0
  const cap      = parseInt(capacity, 10) || 1

  // Mirrors buildRoomNumber() in rooms.service.ts.
  const preview = Number.isFinite(startNum) && Number.isFinite(howMany) && howMany > 0
    ? Array.from({ length: Math.min(howMany, 200) }, (_, i) =>
        `${prefix}${String(startNum + i).padStart(pad, '0')}`
      )
    : []

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      apiClient.post(`/buildings/${buildingId}/rooms/bulk`, {
        floorId,
        startNumber: startNum,
        count:       howMany,
        type,
        capacity:    cap,
        baseRent:    Number(baseRent),
        prefix:      prefix || undefined,
        padTo:       pad || undefined,
        bedLabelStyle,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.buildings.rooms(buildingId) })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.buildings.floors(buildingId) })
      const d = res.data.data
      showToast(
        d.skipped.length
          ? `${d.createdRooms} rooms and ${d.createdBeds} beds created. ${d.skipped.length} already existed and were skipped.`
          : `${d.createdRooms} rooms and ${d.createdBeds} beds created`,
        'success'
      )
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Could not create the rooms', 'error')
    },
  })

  const ready = Boolean(floorId) && preview.length > 0 && Number(baseRent) >= 500

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Add many rooms</h3>
      <p className="text-xs text-gray-500 mb-4">
        Generates a numbered run of identical rooms, each with {cap} bed{cap === 1 ? '' : 's'}.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <FormField label="Floor" required className="col-span-2 sm:col-span-1">
          <Select
            value={floorId}
            onChange={(e) => setFloorId(e.target.value)}
            placeholder="Select floor"
            options={floors.map((f) => ({
              value: f.id,
              label: f.label || `Floor ${f.floorNumber}`,
            }))}
          />
        </FormField>
        <FormField label="Prefix" hint="optional, e.g. A-">
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="A-" />
        </FormField>
        <FormField label="Start at" required>
          <Input value={startNumber} onChange={(e) => setStartNumber(e.target.value)} type="number" />
        </FormField>
        <FormField label="How many" required>
          <Input value={count} onChange={(e) => setCount(e.target.value)} type="number" min={1} max={200} />
        </FormField>
        <FormField label="Pad to" hint="1 becomes 001">
          <Input value={padTo} onChange={(e) => setPadTo(e.target.value)} type="number" min={0} max={6} />
        </FormField>
        <FormField label="Room type" required>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            options={[
              { value: 'PRIVATE',    label: 'Private' },
              { value: 'SHARED',     label: 'Shared' },
              { value: 'DORMITORY',  label: 'Dormitory' },
            ]}
          />
        </FormField>
        <FormField label="Beds per room" required hint="private 1 · shared 2-4 · dorm 5-20">
          <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" min={1} max={20} />
        </FormField>
        <FormField label="Rent per bed (Rs)" required>
          <Input value={baseRent} onChange={(e) => setBaseRent(e.target.value)} type="number" placeholder="6000" />
        </FormField>
        <FormField label="Bed labels">
          <Select
            value={bedLabelStyle}
            onChange={(e) => setBedLabelStyle(e.target.value as typeof bedLabelStyle)}
            options={[
              { value: 'ALPHA',   label: 'A, B, C...' },
              { value: 'NUMERIC', label: '1, 2, 3...' },
            ]}
          />
        </FormField>
      </div>

      {preview.length > 0 && (
        <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">
            Will create {preview.length} rooms and {preview.length * cap} beds
          </p>
          <div className="flex flex-wrap gap-1">
            {preview.slice(0, 24).map((n) => (
              <span
                key={n}
                className="text-xs bg-white dark:bg-gray-50 border border-gray-200 text-gray-700 px-1.5 py-0.5 rounded"
              >
                {n}
              </span>
            ))}
            {preview.length > 24 && (
              <span className="text-xs text-gray-500 px-1.5 py-0.5">
                +{preview.length - 24} more
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Numbers already used in this building are skipped.
          </p>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <Button size="sm" loading={isPending} disabled={!ready} onClick={() => mutate()}>
          Create {preview.length || ''} rooms
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
      </div>
    </Card>
  )
}
