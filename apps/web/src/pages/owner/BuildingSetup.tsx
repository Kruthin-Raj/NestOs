import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRequiredParam } from '@/lib/utils/use-required-param'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { useBuilding } from '@/features/owner/buildings/hooks/use-buildings'
import { PageLoader } from '@/components/feedback/loading-state'
import { CheckCircle2, ChevronRight, Image as ImageIcon, Layers, Loader2, Plus, BedDouble, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/utils/constants'

type Step = 'floors' | 'rooms' | 'photos' | 'done'

export default function BuildingSetupPage() {
  const buildingId = useRequiredParam('buildingId')
  const navigate = useNavigate()
  const { data: building, isLoading } = useBuilding(buildingId)
  const [currentStep, setCurrentStep] = useState<Step>('floors')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const qc = useQueryClient()

  if (isLoading || !building) return <PageLoader />

  const isApartment = building.type === 'APARTMENT'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Setup Your Property"
        description="Let's get your building ready for tenants in just a few steps."
      />

      <div className="flex items-center justify-between mb-8">
        <StepIndicator step="floors" currentStep={currentStep} label={isApartment ? "Apartment Details" : "Floors & Layout"} />
        <div className="flex-1 border-t-2 mx-4 border-gray-200" />
        <StepIndicator step="rooms" currentStep={currentStep} label={isApartment ? "Amenities" : "Rooms & Beds"} />
        <div className="flex-1 border-t-2 mx-4 border-gray-200" />
        <StepIndicator step="photos" currentStep={currentStep} label="Photos" />
        <div className="flex-1 border-t-2 mx-4 border-gray-200" />
        <StepIndicator step="done" currentStep={currentStep} label="Live" />
      </div>

      <div className="mt-8">
        {currentStep === 'floors' && (
          <FloorsStep
            buildingId={buildingId}
            isApartment={isApartment}
            onNext={() => setCurrentStep('rooms')}
          />
        )}
        {currentStep === 'rooms' && (
          <RoomsStep
            buildingId={buildingId}
            isApartment={isApartment}
            onNext={() => setCurrentStep('photos')}
          />
        )}
        {currentStep === 'photos' && (
          <PhotosStep
            buildingId={buildingId}
            onNext={() => setCurrentStep('done')}
          />
        )}
        {currentStep === 'done' && (
          <DoneStep buildingId={buildingId} />
        )}
      </div>
    </div>
  )
}

function StepIndicator({ step, currentStep, label }: { step: Step; currentStep: Step; label: string }) {
  const steps: Step[] = ['floors', 'rooms', 'photos', 'done']
  const currentIndex = steps.indexOf(currentStep)
  const thisIndex = steps.indexOf(step)
  
  const isPast = thisIndex < currentIndex
  const isCurrent = thisIndex === currentIndex

  return (
    <div className="flex flex-col items-center">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
        isPast ? 'bg-indigo-600 text-white' :
        isCurrent ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-600 ring-offset-2' :
        'bg-gray-100 text-gray-400'
      }`}>
        {isPast ? <CheckCircle2 className="w-5 h-5" /> : thisIndex + 1}
      </div>
      <span className={`mt-2 text-xs font-medium ${isCurrent ? 'text-indigo-900' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Floors Step
// ─────────────────────────────────────────────────────────────────
function FloorsStep({ buildingId, isApartment, onNext }: { buildingId: string; isApartment: boolean; onNext: () => void }) {
  const [numFloors, setNumFloors] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const qc = useQueryClient()

  async function handleCreateFloors() {
    setIsSubmitting(true)
    try {
      // In Apartment mode, usually just 1 floor (the apartment itself)
      const count = isApartment ? 1 : numFloors
      for (let i = 0; i < count; i++) {
        await apiClient.post(`/buildings/${buildingId}/floors`, {
          floorNumber: i,
          label: i === 0 ? 'Ground Floor' : `Floor ${i}`
        })
      }
      qc.invalidateQueries({ queryKey: QUERY_KEYS.buildings.floors(buildingId) })
      onNext()
    } catch (err) {
      showToast('Failed to create floors', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-2">
          <Layers className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold">
          {isApartment ? 'Setup Your Apartment Unit' : 'How many floors does this building have?'}
        </h2>
        <p className="text-gray-500 text-sm max-w-sm">
          {isApartment 
            ? "We'll create a single unit representing this apartment. You can add the rooms inside it next."
            : "We'll automatically generate these floors for you. You can rename them later."}
        </p>

        {!isApartment && (
          <div className="w-32 mt-6">
            <Input 
              type="number" 
              min={1} 
              max={50} 
              value={numFloors} 
              onChange={(e) => setNumFloors(parseInt(e.target.value) || 1)} 
              className="text-center text-lg font-bold"
            />
          </div>
        )}

        <Button 
          className="w-full max-w-sm mt-8" 
          size="lg" 
          onClick={handleCreateFloors}
          disabled={isSubmitting}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue to Rooms <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────
// Rooms Step
// ─────────────────────────────────────────────────────────────────
function RoomsStep({ buildingId, isApartment, onNext }: { buildingId: string; isApartment: boolean; onNext: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const qc = useQueryClient()
  
  // Apartment specific
  const APARTMENT_ROOMS = ['Kitchen', 'Living Room', 'Master Bedroom', 'Balcony', 'Dining Area', 'Study Room']
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(['Kitchen', 'Living Room', 'Master Bedroom'])
  
  // Standard building specific
  const [roomsPerFloor, setRoomsPerFloor] = useState(2)
  const [roomType, setRoomType] = useState('PRIVATE')
  const [baseRent, setBaseRent] = useState(5000)

  async function handleCreateRooms() {
    setIsSubmitting(true)
    try {
      const floorsRes = await apiClient.get(`/buildings/${buildingId}/floors`)
      const floors = floorsRes.data?.data || []
      if (!floors.length) throw new Error('No floors found')

      if (isApartment) {
        // Create 1 Private Room representing the entire apartment
        await apiClient.post(`/buildings/${buildingId}/rooms`, {
          floorId: floors[0].id,
          roomNumber: 'Flat Unit',
          type: 'PRIVATE',
          capacity: 1, // Will auto-create 1 bed
          baseRent: baseRent,
          amenities: selectedAmenities
        })
      } else {
        // Bulk create rooms for each floor
        for (const floor of floors) {
          const capacity = roomType === 'PRIVATE' ? 1 : roomType === 'SHARED' ? 2 : 5
          await apiClient.post(`/buildings/${buildingId}/rooms/bulk`, {
            floorId: floor.id,
            startNumber: (floor.floorNumber * 100) + 1, // e.g. Floor 1 -> 101, 102
            count: roomsPerFloor,
            type: roomType,
            capacity: capacity,
            baseRent: baseRent
          })
        }
      }
      qc.invalidateQueries({ queryKey: QUERY_KEYS.buildings.rooms(buildingId) })
      onNext()
    } catch (err) {
      showToast('Failed to create rooms', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  function toggleAmenity(am: string) {
    setSelectedAmenities(prev => 
      prev.includes(am) ? prev.filter(x => x !== am) : [...prev, am]
    )
  }

  return (
    <Card className="p-6">
      <div className="py-6 space-y-6">
        <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
            <BedDouble className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              {isApartment ? 'Apartment Layout' : 'Generate Rooms'}
            </h2>
            <p className="text-gray-500 text-sm">
              {isApartment 
                ? "Select the rooms and areas included in this apartment."
                : "We'll automatically generate rooms and beds for your floors."}
            </p>
          </div>
        </div>

        {isApartment ? (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">What does this apartment include?</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {APARTMENT_ROOMS.map(am => (
                  <div 
                    key={am}
                    onClick={() => toggleAmenity(am)}
                    className={`p-3 border rounded-xl cursor-pointer text-center text-sm font-medium transition-all ${
                      selectedAmenities.includes(am) 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {am}
                  </div>
                ))}
              </div>
            </div>
            <FormField label="Monthly Rent for the entire apartment" required>
              <Input type="number" value={baseRent} onChange={e => setBaseRent(Number(e.target.value))} />
            </FormField>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <FormField label="Rooms per floor" required>
              <Input type="number" min={1} value={roomsPerFloor} onChange={e => setRoomsPerFloor(Number(e.target.value))} />
            </FormField>
            <FormField label="Room Type" required>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={roomType} 
                onChange={e => setRoomType(e.target.value)}
              >
                <option value="PRIVATE">Private Single</option>
                <option value="SHARED">Shared (2 beds)</option>
                <option value="DORMITORY">Dormitory (5 beds)</option>
              </select>
            </FormField>
            <FormField label="Base Rent (per bed)" required>
              <Input type="number" min={500} value={baseRent} onChange={e => setBaseRent(Number(e.target.value))} />
            </FormField>
          </div>
        )}

        <div className="pt-4 flex justify-end">
          <Button size="lg" onClick={handleCreateRooms} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate {isApartment ? 'Apartment' : 'Rooms & Beds'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────
// Photos Step
// ─────────────────────────────────────────────────────────────────
function PhotosStep({ buildingId, onNext }: { buildingId: string; onNext: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleAddPhoto() {
    if (!file) {
      onNext() // Allow skipping
      return
    }
    
    setIsSubmitting(true)
    try {
      // 1. Get presigned URL
      const presignedRes = await apiClient.post('/uploads/presigned-url', {
        documentType: 'BUILDING_PHOTO',
        fileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
      })
      
      const { uploadUrl, fileKey } = presignedRes.data.data

      // 2. Upload file bytes
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      // 3. Link photo to building
      await apiClient.post(`/buildings/${buildingId}/photos`, {
        fileKey: fileKey,
        caption: 'Building Cover Photo'
      })
      
      showToast('Photo added!', 'success')
      onNext()
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to upload photo'
      showToast(msg, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-2">
          <ImageIcon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold">Add a Cover Photo</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          A great photo helps tenants understand what your property looks like.
          Upload an image from your device.
        </p>

        <div className="w-full max-w-md mt-6">
          <Input 
            type="file"
            accept="image/jpeg, image/png, image/webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="flex gap-4 mt-8">
          <Button variant="outline" size="lg" onClick={onNext} disabled={isSubmitting}>
            Skip for now
          </Button>
          <Button size="lg" onClick={handleAddPhoto} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload & Save
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────
// Done Step
// ─────────────────────────────────────────────────────────────────
function DoneStep({ buildingId }: { buildingId: string }) {
  const navigate = useNavigate()
  return (
    <Card className="p-10 text-center space-y-6">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto">
        <CheckCircle2 className="w-10 h-10" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">You're all set!</h2>
        <p className="text-gray-500 mt-2">
          Your property has been fully configured with floors, rooms, and beds.
          You can now start onboarding tenants!
        </p>
      </div>
      <Button size="lg" onClick={() => navigate(`/owner/buildings/${buildingId}`)} className="mt-4">
        Go to Dashboard
      </Button>
    </Card>
  )
}
