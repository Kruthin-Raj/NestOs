'use client'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Plus, MapPin, Bed, TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { CardSkeleton } from '@/components/feedback/loading-state'
import { useBuildings } from '@/features/owner/buildings/hooks/use-buildings'
import { formatRupees } from '@/lib/utils/format'
import type { Building } from '@/types'

export default function BuildingsPage() {
  const navigate = useNavigate()
  const { data, isLoading }       = useBuildings()
  const buildings: Building[]     = data?.items ?? []

  return (
    <div>
      <PageHeader
        title="Buildings"
        description="Manage all your properties"
        actions={
          <Button onClick={() => navigate('/owner/buildings/new')}>
            <Plus className="h-4 w-4 mr-1" /> Add building
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : buildings.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-16 w-16" />}
          title="No buildings yet"
          description="Add your first building to start managing tenants and collecting rent"
          action={{ label: 'Add building', onClick: () => navigate('/owner/buildings/new') }}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {buildings.map((b) => (
            <BuildingCard key={b.id} building={b} />
          ))}
        </div>
      )}
    </div>
  )
}

function BuildingCard({ building: b }: { building: Building }) {
  const occupancyPercent = b.totalBeds
    ? Math.round((b.occupiedBeds / b.totalBeds) * 100)
    : 0

  return (
    <Link to={`/owner/buildings/${b.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full p-0 overflow-hidden">
        {b.photos?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.photos[0].fileUrl}
            alt={b.name}
            className="w-full h-36 object-cover"
          />
        )}
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{b.name}</h3>
              <p className="text-xs text-gray-500">{b.type.replace('_', ' ')}</p>
            </div>
            <StatusBadge status={b.status} />
          </div>

          <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{b.addressLine1}, {b.city}</span>
          </div>

          {/* Occupancy bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500">Occupancy</span>
              <span className="font-medium">{occupancyPercent}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${occupancyPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Bed className="h-3 w-3" />
              <span>{b.totalBeds - b.occupiedBeds} vacant / {b.totalBeds} total</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}