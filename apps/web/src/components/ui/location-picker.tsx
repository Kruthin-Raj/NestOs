import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { MapPin, LocateFixed } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Bundled through Vite rather than fetched from a CDN, so markers still render
// with no network access.
const DefaultIcon = L.icon({
  iconUrl:       markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl:     markerShadow,
  iconSize:      [25, 41],
  iconAnchor:    [12, 41],
  popupAnchor:   [1, -34],
  shadowSize:    [41, 41],
})

/** Roughly the centre of India — the starting view when nothing is set yet. */
const INDIA_CENTRE: [number, number] = [20.5937, 78.9629]

export interface LatLng {
  latitude: number
  longitude: number
}

interface LocationPickerProps {
  value: LatLng | null
  onChange: (value: LatLng) => void
}

/**
 * Click the map (or drag the pin) to set a building's coordinates.
 *
 * A building cannot be made ACTIVE without latitude and longitude — the API
 * rejects it with MISSING_LOCATION — and until now no screen collected them,
 * so no property could ever go live.
 */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const markerRef    = useRef<L.Marker | null>(null)
  const onChangeRef  = useRef(onChange)
  const [locating, setLocating] = useState(false)

  // Keep the latest callback without re-creating the map on every render.
  useEffect(() => {
    onChangeRef.current = onChange
  })

  // Build the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const start: [number, number] = value
      ? [value.latitude, value.longitude]
      : INDIA_CENTRE

    const map = L.map(containerRef.current).setView(start, value ? 16 : 4)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    function place(lat: number, lng: number) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        const marker = L.marker([lat, lng], { icon: DefaultIcon, draggable: true }).addTo(map)
        marker.on('dragend', () => {
          const p = marker.getLatLng()
          onChangeRef.current({ latitude: p.lat, longitude: p.lng })
        })
        markerRef.current = marker
      }
      onChangeRef.current({ latitude: lat, longitude: lng })
    }

    if (value) place(value.latitude, value.longitude)
    map.on('click', (e: L.LeafletMouseEvent) => place(e.latlng.lat, e.latlng.lng))

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // Intentionally mount-only: re-running would tear down the user's pan/zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recentre when a saved value arrives after the map has mounted (edit page)
  // or when the parent explicitly updates the value (e.g., parsing a Maps URL).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !value) return

    if (!markerRef.current) {
      const marker = L.marker([value.latitude, value.longitude], {
        icon: DefaultIcon,
        draggable: true,
      }).addTo(map)
      marker.on('dragend', () => {
        const p = marker.getLatLng()
        onChangeRef.current({ latitude: p.lat, longitude: p.lng })
      })
      markerRef.current = marker
      map.setView([value.latitude, value.longitude], 16)
    } else {
      const currentPos = markerRef.current.getLatLng()
      if (currentPos.lat !== value.latitude || currentPos.lng !== value.longitude) {
        markerRef.current.setLatLng([value.latitude, value.longitude])
        map.setView([value.latitude, value.longitude], 16)
      }
    }
  }, [value])

  function useMyLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        mapRef.current?.setView([latitude, longitude], 16)
        if (markerRef.current) markerRef.current.setLatLng([latitude, longitude])
        onChangeRef.current({ latitude, longitude })
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="h-64 w-full rounded-xl border border-gray-200 z-0" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {value
            ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`
            : 'Tap the map to drop a pin'}
        </p>
        <Button type="button" size="sm" variant="outline" loading={locating} onClick={useMyLocation}>
          <LocateFixed className="h-4 w-4 mr-1" /> Use my location
        </Button>
      </div>
    </div>
  )
}
