import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useRequiredParam } from '@/lib/utils/use-required-param'
import {
  MapPin, Plus,
  Settings, ToggleLeft, ToggleRight, ChevronRight, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { PageLoader } from '@/components/feedback/loading-state'
import { EmptyState } from '@/components/feedback/empty-state'
import {
  useBuilding,
  useUpdateBuildingStatus,
} from '@/features/owner/buildings/hooks/use-buildings'
import { formatRupees } from '@/lib/utils/format'
import type { Floor } from '@/types'
import { ReadOnlyMap } from '@/components/ui/read-only-map'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/utils/constants'
import { showToast } from '@/components/ui/toaster'
import apiClient from '@/lib/api/client'

export default function BuildingDetailPage() {
  const buildingId      = useRequiredParam('buildingId')
  const navigate = useNavigate()
  const { data: building, isLoading } = useBuilding(buildingId)
  const { mutate: updateStatus, isPending } = useUpdateBuildingStatus()

  if (isLoading) return <PageLoader />
  if (!building) return <EmptyState title="Building not found" />

  const isActive        = building.status === 'ACTIVE'
  const occupancyPct    = building.totalBeds
    ? Math.round((building.occupiedBeds / building.totalBeds) * 100)
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={building.name}
        description={`${building.type.replace('_', ' ')} · ${building.city}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateStatus({ id: buildingId, status: isActive ? 'INACTIVE' : 'ACTIVE' })}
              loading={isPending}
            >
              {isActive ? (
                <><ToggleRight className="h-4 w-4 mr-1 text-green-600" /> Active</>
              ) : (
                <><ToggleLeft className="h-4 w-4 mr-1" /> Inactive</>
              )}
            </Button>
            <Link to={`/owner/buildings/${buildingId}/edit`}>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-1" /> Edit
              </Button>
            </Link>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total beds',    value: building.totalBeds },
          { label: 'Occupied',      value: building.occupiedBeds },
          { label: 'Vacant',        value: building.totalBeds - building.occupiedBeds },
          { label: 'Occupancy',     value: `${occupancyPct}%` },
        ].map((stat) => (
          <Card key={stat.label} className="py-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Address */}
      <Card>
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-400" />
          <div>
            <p>{building.addressLine1}</p>
            {building.addressLine2 && <p>{building.addressLine2}</p>}
            {building.landmark && <p className="text-gray-400">{building.landmark}</p>}
            <p>{building.city}, {building.state} – {building.pincode}</p>
            {building.googleMapsUrl && (
              <a href={building.googleMapsUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline mt-1 inline-block text-sm">
                View on Google Maps
              </a>
            )}
          </div>
        </div>
        {building.amenities?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {building.amenities.map((a: { name: string }) => (
              <span key={a.name} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                {a.name}
              </span>
            ))}
          </div>
        )}
      </Card>

      {building.latitude && building.longitude && (
        <Card className="p-0 overflow-hidden">
          <ReadOnlyMap latitude={building.latitude} longitude={building.longitude} />
        </Card>
      )}

      {/* Photos Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Photos</h2>
      </div>
      <BuildingPhotosGallery buildingId={buildingId} photos={building.photos || []} />

      {/* Floors / rooms section */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Floors & Rooms</h2>
        <Link to={`/owner/buildings/${buildingId}/rooms`}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> Manage rooms
          </Button>
        </Link>
      </div>

      {!building.floors?.length ? (
        <Card>
          <EmptyState
            title="No floors added"
            description="Add floors and rooms to start assigning tenants"
            action={{
              label:   'Add rooms',
              onClick: () => navigate(`/owner/buildings/${buildingId}/rooms`),
            }}
          />
        </Card>
      ) : (
        building.floors.map((floor: Floor) => (
          <FloorCard key={floor.id} floor={floor} buildingId={buildingId} />
        ))
      )}
    </div>
  )
}

function FloorCard({ floor, buildingId }: { floor: Floor; buildingId: string }) {
  return (
    <Card padding={false}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">
          {floor.label || `Floor ${floor.floorNumber}`}
        </h3>
        <span className="text-xs text-gray-500">
          {floor.rooms?.length ?? 0} rooms
        </span>
      </div>
      {floor.rooms?.map((room) => (
        <Link
          key={room.id}
          to={`/owner/buildings/${buildingId}/rooms/${room.id}`}
          className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
        >
          <div>
            <p className="text-sm font-medium text-gray-900">Room {room.roomNumber}</p>
            <p className="text-xs text-gray-500">
              {room.type} · {room.currentCount}/{room.capacity} occupied · {formatRupees(room.baseRent)}/mo
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </Link>
      ))}
    </Card>
  )
}

function BuildingPhotosGallery({ buildingId, photos }: { buildingId: string; photos: any[] }) {
  const [isUploading, setIsUploading] = useState(false)
  const qc = useQueryClient()

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const presignedRes = await apiClient.post('/uploads/presigned-url', {
        documentType: 'BUILDING_PHOTO',
        fileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
      })
      
      const { uploadUrl, fileKey } = presignedRes.data.data

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      await apiClient.post(`/buildings/${buildingId}/photos`, {
        fileKey: fileKey,
        caption: 'Building Photo'
      })
      
      showToast('Photo uploaded successfully', 'success')
      qc.invalidateQueries({ queryKey: QUERY_KEYS.buildings.detail(buildingId) })
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to upload photo'
      showToast(msg, 'error')
    } finally {
      setIsUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  return (
    <Card className="p-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {photos.map((p, i) => (
          <div key={i} className="aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
            <img src={p.fileUrl} alt="Property" className="w-full h-full object-cover" />
          </div>
        ))}
        
        <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
          {isUploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <Plus className="w-6 h-6 mb-2" />
              <span className="text-sm font-medium">Add Photo</span>
              <input type="file" accept="image/jpeg, image/png, image/webp" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </>
          )}
        </label>
      </div>
    </Card>
  )
}