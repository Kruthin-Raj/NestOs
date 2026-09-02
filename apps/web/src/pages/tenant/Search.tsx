import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { MapPin, LocateFixed, X, Map as MapIcon, List } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CitySelect } from '@/components/ui/city-select'
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
import { PropertyMap, MapProperty } from './PropertyMap'
import { PropertyCard } from './PropertyCard'

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
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null)

  const usingLocation = Boolean(applied.lat && applied.lng)

  /**
   * Asks the browser for a fix and searches from it.
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
        setViewMode('map') // Automatically switch to map view on "near me"
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
  
  // Format for the map
  const mapProperties: MapProperty[] = properties.map((p: any) => ({
    id: p.id,
    name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
    minRent: p.minRent,
    coverPhoto: p.coverPhoto,
  }))

  const mapCenter: [number, number] | undefined = applied.lat && applied.lng 
    ? [Number(applied.lat), Number(applied.lng)] 
    : undefined

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <PageHeader title="Find a PG" description="Search available PGs and hostels near you" />
        
        {/* Mobile View Toggle */}
        <div className="lg:hidden flex bg-gray-100 p-1 rounded-lg">
          <button 
            className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" /> List
          </button>
          <button 
            className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 ${viewMode === 'map' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            onClick={() => setViewMode('map')}
          >
            <MapIcon className="h-4 w-4" /> Map
          </button>
        </div>
      </div>

      {/* Search bar */}
      <Card className="mb-4 flex-shrink-0 z-10">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <CitySelect
              value={filters.city}
              onChange={(city) => setFilters((p) => ({ ...p, city }))}
              placeholder="Search by city..."
            />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 md:flex-none" onClick={() => setApplied({ ...filters })}>Search</Button>
            <Button className="flex-1 md:flex-none" variant="outline" loading={locating} onClick={searchNearMe}>
              <LocateFixed className="h-4 w-4 mr-1" />
              Near me
            </Button>
          </div>
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

      {/* Main Content Area: Split View on Large Screens */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 relative">
        
        {/* List View */}
        <div className={`flex-1 overflow-y-auto lg:w-1/2 pr-2 ${viewMode === 'map' ? 'hidden lg:block' : 'block'}`}>
          {/* Categories / Filters */}
          <div className="flex items-center gap-4 overflow-x-auto pb-4 mb-4 border-b border-gray-100 no-scrollbar whitespace-nowrap">
            {['Rooms', 'Apartments', 'Villas', 'Trending', 'New', 'Guest Favourites'].map((cat, i) => (
              <button
                key={cat}
                className={`flex flex-col items-center gap-1.5 min-w-[70px] transition-opacity hover:opacity-100 ${
                  i === 0 ? 'opacity-100 border-b-2 border-black pb-1' : 'opacity-60 hover:border-b-2 hover:border-gray-300 pb-1'
                }`}
              >
                {/* Mock Icons for aesthetics */}
                <div className="text-gray-900 font-medium text-sm">
                  {cat}
                </div>
              </button>
            ))}
          </div>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-10 pb-10">
              {properties.map((p: any) => (
                <div 
                  key={p.id}
                  onMouseEnter={() => setActivePropertyId(p.id)}
                  onMouseLeave={() => setActivePropertyId(null)}
                >
                  <PropertyCard property={p} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map View */}
        <div className={`flex-1 h-[400px] lg:h-auto lg:w-1/2 lg:sticky lg:top-0 ${viewMode === 'list' ? 'hidden lg:block' : 'block'}`}>
          <PropertyMap 
            properties={mapProperties} 
            center={mapCenter}
            activePropertyId={activePropertyId}
            onMarkerClick={(id) => setActivePropertyId(id)}
          />
        </div>
        
      </div>
    </div>
  )
}