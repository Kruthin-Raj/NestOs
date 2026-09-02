import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useNavigate } from 'react-router-dom'
import { formatRupees } from '@/lib/utils/format'
import 'leaflet/dist/leaflet.css'

// Define the Property type expected by the map
export interface MapProperty {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  minRent: number | null
  coverPhoto: string | null
}

interface PropertyMapProps {
  properties: MapProperty[]
  center?: [number, number]
  zoom?: number
  onMarkerClick?: (id: string) => void
  activePropertyId?: string | null
}

// Map Controller component to adjust bounds automatically
function MapController({ properties, center, zoom }: { properties: MapProperty[], center?: [number, number], zoom?: number }) {
  const map = useMap()
  
  useEffect(() => {
    if (properties.length === 0) {
      if (center && zoom) {
        map.setView(center, zoom)
      }
      return
    }
    
    const validCoords = properties
      .filter(p => p.latitude !== null && p.longitude !== null)
      .map(p => [p.latitude, p.longitude] as [number, number])
      
    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords)
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    } else if (center && zoom) {
      map.setView(center, zoom)
    }
  }, [map, properties, center, zoom])
  
  return null
}

export function PropertyMap({ properties, center = [20.5937, 78.9629], zoom = 5, onMarkerClick, activePropertyId }: PropertyMapProps) {
  const navigate = useNavigate()

  // Generate custom DivIcon for each property
  const createPriceMarker = (property: MapProperty, isActive: boolean) => {
    // Basic price formatting e.g., 6500 -> 6.5k
    let formattedPrice = 'N/A'
    if (property.minRent) {
      if (property.minRent >= 1000) {
        formattedPrice = '₹' + (property.minRent / 1000).toFixed(1).replace('.0', '') + 'k'
      } else {
        formattedPrice = '₹' + property.minRent
      }
    }
    
    // Create an Airbnb style pill marker
    const html = `
      <div class="relative flex items-center justify-center font-bold text-sm px-2 py-1 rounded-full shadow-md transition-all duration-200 border-2 ${
        isActive 
          ? 'bg-teal-600 text-white border-teal-600 scale-[1.3] shadow-lg z-50' 
          : 'bg-white text-gray-900 border-white hover:scale-105'
      }">
        ${formattedPrice}
      </div>
    `

    return L.divIcon({
      html,
      className: 'bg-transparent border-none', // Override default leaflet icon styles
      iconSize: [60, 28],
      iconAnchor: [30, 14],
    })
  }

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-gray-200 shadow-sm relative z-0">
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ width: '100%', height: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController properties={properties} center={center} zoom={zoom} />
        
        {properties.map(property => {
          if (property.latitude === null || property.longitude === null) return null
          
          const isActive = activePropertyId === property.id
          
          return (
            <Marker
              key={property.id}
              position={[property.latitude, property.longitude]}
              icon={createPriceMarker(property, isActive)}
              eventHandlers={{
                click: () => onMarkerClick?.(property.id)
              }}
            >
              <Popup className="property-popup" closeButton={false}>
                <div 
                  className="w-48 cursor-pointer flex flex-col gap-2 overflow-hidden -m-1"
                  onClick={() => navigate(`/tenant/property/${property.id}`)}
                >
                  <div className="w-full h-32 bg-gray-200 rounded-t-lg overflow-hidden">
                    {property.coverPhoto ? (
                      <img 
                        src={property.coverPhoto} 
                        alt={property.name} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        No Photo
                      </div>
                    )}
                  </div>
                  <div className="px-3 pb-3">
                    <h4 className="font-semibold text-sm text-gray-900 truncate mt-1">{property.name}</h4>
                    <p className="text-gray-600 text-xs font-medium mt-0.5">
                      {property.minRent ? formatRupees(property.minRent) : 'Price unavailable'} / month
                    </p>
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
      
      <style>{`
        /* Overrides for leaflet popup to make it flush */
        .property-popup .leaflet-popup-content-wrapper {
          padding: 0;
          overflow: hidden;
          border-radius: 0.5rem;
        }
        .property-popup .leaflet-popup-content {
          margin: 0;
          width: auto !important;
        }
      `}</style>
    </div>
  )
}
