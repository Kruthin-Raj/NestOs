import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { formatRupees } from '@/lib/utils/format'

export interface PropertyCardProps {
  id: string
  name: string
  city: string
  addressLine1: string
  minRent: number | null
  maxRent: number | null
  coverPhoto: string | null
  photos?: string[]
  vacantBeds: number
}

export function PropertyCard({ property }: { property: PropertyCardProps }) {
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)

  const photos = property.photos?.length ? property.photos : (property.coverPhoto ? [property.coverPhoto] : [])
  const hasPhotos = photos.length > 0

  const nextPhoto = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentPhotoIdx((prev) => (prev + 1) % photos.length)
  }

  const prevPhoto = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentPhotoIdx((prev) => (prev - 1 + photos.length) % photos.length)
  }

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsFavorited(!isFavorited)
  }

  return (
    <Link to={`/tenant/property/${property.id}`} className="group flex flex-col gap-3">
      {/* Image Container */}
      <div 
        className="relative aspect-square overflow-hidden rounded-xl bg-gray-200"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {hasPhotos ? (
          <img
            src={photos[currentPhotoIdx]}
            alt={property.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            No image
          </div>
        )}

        {/* Favorite Button */}
        <button 
          onClick={toggleFavorite}
          className="absolute right-3 top-3 z-10 transition-transform active:scale-95"
        >
          <Heart 
            className={`h-6 w-6 stroke-white stroke-2 ${isFavorited ? 'fill-[#FF385C]' : 'fill-black/30'}`} 
          />
        </button>

        {/* Guest Favorite Badge Example (mocked for aesthetics) */}
        {property.vacantBeds > 0 && property.vacantBeds <= 2 && (
          <div className="absolute left-3 top-3 z-10 rounded-full bg-white px-2.5 py-1 text-xs font-semibold shadow-md">
            Guest favourite
          </div>
        )}

        {/* Carousel Controls */}
        {hasPhotos && photos.length > 1 && isHovered && (
          <>
            <button
              onClick={prevPhoto}
              className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-sm transition-transform hover:scale-105 hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={nextPhoto}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-sm transition-transform hover:scale-105 hover:bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Dots */}
        {hasPhotos && photos.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {photos.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentPhotoIdx ? 'w-1.5 bg-white' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col text-sm">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-gray-900 line-clamp-1">{property.name}</h3>
          <div className="flex items-center gap-1 text-gray-900 font-medium">
            <Star className="h-3.5 w-3.5 fill-current" />
            <span>4.96</span> {/* Mocked rating for aesthetic */}
          </div>
        </div>
        <p className="text-gray-500 line-clamp-1">{property.city}</p>
        <p className="text-gray-500">{property.vacantBeds > 0 ? `${property.vacantBeds} beds available` : 'Full'}</p>
        
        <div className="mt-1">
          <span className="font-semibold text-gray-900">
            {property.minRent ? formatRupees(property.minRent) : 'Price unavailable'}
          </span>
          <span className="text-gray-900"> / month</span>
        </div>
      </div>
    </Link>
  )
}
