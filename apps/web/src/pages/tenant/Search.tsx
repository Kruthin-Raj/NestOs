import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, MapPin, LocateFixed, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { CardSkeleton } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { formatRupees } from '@/lib/utils/format'
import { QUERY_KEYS } from '@/lib/utils/constants'
import { showToast } from '@/components/ui/toaster'

interface SearchFilters {
  city:             string
  genderPreference: string
  minRent:          string
  maxRent:          string
  /** Set together to switch the API into proximity search. */
  lat:              string
  lng:              string
  radiusKm:         string
}

const RADIUS_OPTIONS = ['2', '5', '10', '25', '50']

export default function SearchPage() {
  const [filters, setFilters] = useState<SearchFilters>({
    city: '', genderPreference: '', minRent: '', maxRent: '',
    lat: '', lng: '', radiusKm: '10',
  })
  const [applied, setApplied] = useState<SearchFilters>(filters)
  const [locating, setLocating] = useState(false)

  const usingLocation = Boolean(applied.lat && applied.lng)

  /**
   * Asks the browser for a fix and searches from it.
   *
   * Requires HTTPS in production; localhost is exempt. Denial is a normal
   * outcome, not an error — fall back to searching by city.
   */
  function searchNearMe() {
    if (!navigator.geolocation) {
      showToast('This browser cannot share your location — search by city instead.', 'error')
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          ...filters,
          lat: String(pos.coords.latitude),
          lng: String(pos.coords.longitude),
          city: '',
        }
        setFilters(next)
        setApplied(next)
        setLocating(false)
      },
      () => {
        showToast('Could not get your location. Allow access, or search by city.', 'error')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function clearLocation() {
    const next = { ...filters, lat: '', lng: '' }
    setFilters(next)
    setApplied(next)
  }

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.properties.search(applied),
    queryFn:  async () => {
      const params = new URLSearchParams(
        Object.fromEntries(Object.entries(applied).filter(([, v]) => v !== ''))
      ).toString()
      const { data } = await apiClient.get(`/buildings/search${params ? '?' + params : ''}`)
      return data.data
    },
  })

  const properties = data?.items ?? []

  return (
    <div className="space-y-4">
      <PageHeader title="Find a PG" description="Search available PGs and hostels near you" />

      {/* Search bar */}
      <Card>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={filters.city}
              onChange={(e) => setFilters((p) => ({ ...p, city: e.target.value }))}
              placeholder="Search by city (e.g. Hyderabad)"
              className="pl-9"
              onKeyDown={(e) => e.key === 'Enter' && setApplied({ ...filters })}
            />
          </div>
          <Button onClick={() => setApplied({ ...filters })}>Search</Button>
          <Button variant="outline" loading={locating} onClick={searchNearMe}>
            <LocateFixed className="h-4 w-4 mr-1" />
            Near me
          </Button>
        </div>

        {usingLocation && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-teal-50 border border-teal-200 px-3 py-2">
            <MapPin className="h-4 w-4 text-teal-700" />
            <span className="text-sm text-teal-800">
              Showing places within
            </span>
            <select
              value={filters.radiusKm}
              onChange={(e) => {
                const next = { ...filters, radiusKm: e.target.value }
                setFilters(next)
                setApplied(next)
              }}
              className="h-8 rounded-lg border border-teal-300 bg-white dark:bg-gray-50 px-2 text-sm"
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>{r} km</option>
              ))}
            </select>
            <span className="text-sm text-teal-800">of you, nearest first</span>
            <button
              onClick={clearLocation}
              className="ml-auto flex items-center gap-1 text-xs text-teal-700 hover:underline"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mt-3">
          <Select
            value={filters.genderPreference}
            onChange={(e) => setFilters((p) => ({ ...p, genderPreference: e.target.value }))}
            options={[
              { value: 'MALE',   label: 'Male only' },
              { value: 'FEMALE', label: 'Female only' },
              { value: 'CO_ED',  label: 'Co-ed' },
            ]}
            placeholder="Any gender"
          />
          <Input
            type="number"
            value={filters.minRent}
            onChange={(e) => setFilters((p) => ({ ...p, minRent: e.target.value }))}
            placeholder="Min rent ₹"
          />
          <Input
            type="number"
            value={filters.maxRent}
            onChange={(e) => setFilters((p) => ({ ...p, maxRent: e.target.value }))}
            placeholder="Max rent ₹"
          />
        </div>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : !properties.length ? (
        <EmptyState
          icon={<MapPin className="h-12 w-12" />}
          title="No properties found"
          description={
            usingLocation
              ? 'Nothing listed within that distance. Try a larger radius, or search by city.'
              : 'Try a different city or adjust your filters'
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {properties.map((p: {
            id: string; name: string; type: string; genderPreference: string
            city: string; addressLine1: string; landmark?: string
            minRent: number | null; maxRent: number | null
            vacantBeds: number; amenities: string[]; coverPhoto: string | null
            distanceKm: number | null
          }) => (
            <Link key={p.id} to={`/tenant/property/${p.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer p-0 overflow-hidden h-full">
                {p.coverPhoto && (
                  <img
                    src={p.coverPhoto}
                    alt={p.name}
                    className="w-full h-40 object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-semibold text-gray-900">{p.name}</h3>
                    <Badge variant={p.vacantBeds > 0 ? 'success' : 'default'}>
                      {p.vacantBeds > 0 ? `${p.vacantBeds} vacant` : 'Full'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                    <MapPin className="h-3 w-3" />
                    <span>{p.addressLine1}, {p.city}</span>
                    {p.distanceKm !== null && (
                      <span className="ml-auto font-medium text-teal-700">
                        {p.distanceKm < 1
                          ? `${Math.round(p.distanceKm * 1000)} m away`
                          : `${p.distanceKm} km away`}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="info">{p.type.replace('_', ' ')}</Badge>
                    <Badge variant="default">{p.genderPreference.replace('_', ' ')}</Badge>
                  </div>

                  {p.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {p.amenities.slice(0, 3).map((a) => (
                        <span key={a} className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {a}
                        </span>
                      ))}
                      {p.amenities.length > 3 && (
                        <span className="text-xs text-gray-400">+{p.amenities.length - 3}</span>
                      )}
                    </div>
                  )}

                  <p className="text-base font-bold text-indigo-600">
                    {p.minRent ? (
                      <>
                        {formatRupees(p.minRent)}
                        {p.maxRent && p.maxRent !== p.minRent && ` – ${formatRupees(p.maxRent)}`}
                        <span className="text-xs font-normal text-gray-500">/month</span>
                      </>
                    ) : (
                      'Contact for price'
                    )}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}