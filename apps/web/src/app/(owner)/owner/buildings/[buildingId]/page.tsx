'use client'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useRequiredParam } from '@/lib/utils/use-required-param'
import {
  MapPin, Bed, Users, CreditCard, Plus,
  Settings, ToggleLeft, ToggleRight, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { PageLoader } from '@/components/feedback/loading-state'
import { EmptyState } from '@/components/feedback/empty-state'
import {
  useBuilding,
  useUpdateBuildingStatus,
} from '@/features/owner/buildings/hooks/use-buildings'
import { formatRupees } from '@/lib/utils/format'
import type { Floor } from '@/types'

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
          {floor.label ?? `Floor ${floor.floorNumber}`}
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