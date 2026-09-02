import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Grid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface PropertyGalleryProps {
  photos: { fileUrl: string }[]
  propertyName: string
}

export function PropertyGallery({ photos, propertyName }: PropertyGalleryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!photos || photos.length === 0) return null

  const openLightbox = (index: number) => {
    setCurrentIndex(index)
    setIsOpen(true)
    document.body.style.overflow = 'hidden'
  }

  const closeLightbox = () => {
    setIsOpen(false)
    document.body.style.overflow = 'auto'
  }

  const nextPhoto = () => setCurrentIndex((prev) => (prev + 1) % photos.length)
  const prevPhoto = () => setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length)

  const isMulti = photos.length > 1
  const displayPhotos = photos.slice(0, 5) // Show up to 5 photos in the grid

  return (
    <>
      {/* Hero Gallery Grid */}
      <div className={cn("relative rounded-2xl overflow-hidden bg-gray-100", isMulti ? "grid grid-cols-4 grid-rows-2 gap-2 h-[50vh] min-h-[300px]" : "aspect-[21/9] max-h-[60vh] w-full")}>
        {isMulti ? (
          <>
            <div 
              className="col-span-2 row-span-2 cursor-pointer relative group overflow-hidden"
              onClick={() => openLightbox(0)}
            >
              <img src={displayPhotos[0].fileUrl} alt={propertyName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </div>
            {displayPhotos.slice(1).map((photo, i) => (
              <div 
                key={i} 
                className="col-span-1 row-span-1 cursor-pointer relative group overflow-hidden"
                onClick={() => openLightbox(i + 1)}
              >
                <img src={photo.fileUrl} alt={`${propertyName} ${i + 2}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
            ))}
            
            <Button 
              className="absolute bottom-4 right-4 bg-white text-black hover:bg-gray-100 shadow-md gap-2"
              onClick={() => openLightbox(0)}
            >
              <Grid className="w-4 h-4" />
              Show all photos
            </Button>
          </>
        ) : (
          <div className="w-full h-full cursor-pointer relative group flex items-center justify-center" onClick={() => openLightbox(0)}>
             <img src={photos[0].fileUrl} alt={propertyName} className="w-full h-full object-contain transition-transform duration-500" />
             <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="flex justify-between items-center p-4 text-white">
            <span className="text-sm">{currentIndex + 1} / {photos.length}</span>
            <button onClick={closeLightbox} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex-1 relative flex items-center justify-center p-4 md:p-12">
            {photos.length > 1 && (
              <button 
                onClick={prevPhoto}
                className="absolute left-4 md:left-12 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-all"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            
            <img 
              src={photos[currentIndex].fileUrl} 
              alt={`${propertyName} ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
            
            {photos.length > 1 && (
              <button 
                onClick={nextPhoto}
                className="absolute right-4 md:right-12 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-all"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
