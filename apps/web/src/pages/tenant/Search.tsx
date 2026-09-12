import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin, LocateFixed, X, Map as MapIcon, List, AlertCircle, ExternalLink, RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CitySelect } from '@/components/ui/city-select'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { CardSkeleton } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { QUERY_KEYS } from '@/lib/utils/constants'
import { showToast } from '@/components/ui/toaster'
import { PropertyMap, MapProperty } from './PropertyMap'
import { PropertyCard, PropertyCardProps } from './PropertyCard'

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
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationBlocked, setLocationBlocked] = useState(false)

  const usingLocation = Boolean(applied.lat && applied.lng)

  /**
   * Directly triggers the browser and system location permission prompt.
   */
  function searchNearMe() {
    if (!navigator.geolocation) {
      showToast('This browser cannot share your location — search by city instead.', 'error')
      return
    }

    setLocating(true)
    setLocationBlocked(false)

    const handleSuccess = (pos: GeolocationPosition) => {
      const next = {
        ...filters,
        lat: String(pos.coords.latitude),
        lng: String(pos.coords.longitude),
        city: '',
      }
      setFilters(next)
      setApplied(next)
      setLocating(false)
      setLocationBlocked(false)
      setViewMode('map') // Automatically switch to map view on "near me"
      showToast('Location updated! Showing nearby properties.', 'success')
    }

    const handleError = (err: GeolocationPositionError) => {
      setLocating(false)
      if (err.code === err.PERMISSION_DENIED) {
        setLocationBlocked(true)
        showToast('Location permission was denied. Click the lock/settings icon in your address bar to allow location.', 'error')
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        showToast('Position unavailable. Ensure Location Services is enabled on your Mac, or search by city.', 'error')
      } else if (err.code === err.TIMEOUT) {
        showToast('Location request timed out. Please try again or search by city.', 'error')
      } else {
        showToast('Could not get your location. Allow access, or search by city.', 'error')
      }
    }

    // Direct invocation triggers the browser/OS native permission prompt
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
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
  const mapProperties: MapProperty[] = properties.map((p: PropertyCardProps & { latitude: number | null; longitude: number | null }) => ({
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
            <Button
              className="flex-1 md:flex-none"
              variant="outline"
              loading={locating}
              onClick={searchNearMe}
            >
              <LocateFixed className="h-4 w-4 mr-1" />
              Near me
            </Button>
          </div>
        </div>

        {locationBlocked && (
          <div className="mt-3 rounded-xl bg-amber-50/90 border border-amber-200 p-4 text-xs text-amber-900 animate-in fade-in space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-amber-900 text-sm">
                    Location Permission Blocked
                  </h4>
                  <p className="text-amber-700 text-xs mt-0.5">
                    Your browser or Mac has blocked location access for this site.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocationBlocked(false)}
                className="text-amber-500 hover:text-amber-800 p-1 rounded"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-white/80 rounded-lg p-3 border border-amber-200/60 space-y-1.5 text-xs text-amber-900">
              <p className="font-medium text-amber-950">How to allow permission:</p>
              <ol className="list-decimal pl-4 space-y-1 text-amber-900/90">
                <li>
                  Click the <strong>sliders/padlock icon 🔒</strong> on the left side of your browser address bar (next to <code>localhost:3000</code>).
                </li>
                <li>
                  Toggle <strong>Location</strong> to <strong>Allow</strong> (or click <em>Reset permission</em>).
                </li>
                <li>
                  Ensure macOS Location Services is enabled for your browser in Mac Settings.
                </li>
              </ol>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href="x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-sm transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Mac Location Settings
              </a>

              <button
                type="button"
                onClick={searchNearMe}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100/50 text-amber-900 font-medium text-xs transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Ask Permission Again
              </button>

              <button
                type="button"
                onClick={() => setLocationBlocked(false)}
                className="text-xs text-amber-700 hover:text-amber-950 underline ml-auto"
              >
                Search by City Instead
              </button>
            </div>
          </div>
        )}

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
              {properties.map((p: PropertyCardProps) => (
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