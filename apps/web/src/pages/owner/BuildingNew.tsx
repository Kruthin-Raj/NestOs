import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { Card, CardTitle } from '@/components/ui/card'
import { CitySelect } from '@/components/ui/city-select'
import { LocationPicker, type LatLng } from '@/components/ui/location-picker'
import { PageHeader } from '@/components/shared/page-header'
import { useCreateBuilding } from '@/features/owner/buildings/hooks/use-buildings'
import { resolveMapUrl } from '@/features/owner/buildings/services/buildings.service'
import { AMENITY_OPTIONS, INDIAN_STATES } from '@/lib/utils/constants'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import { optionalPhone } from '@/lib/utils/phone'
import { PhoneInput } from '@/components/ui/phone-input'

const schema = z.object({
  name:             z.string().min(3, 'Building name must be at least 3 characters'),
  type:             z.enum(['PG', 'HOSTEL', 'APARTMENT', 'SHARED_FLAT']),
  genderPreference: z.enum(['MALE', 'FEMALE', 'CO_ED']),
  addressLine1:     z.string().min(5, 'Enter the full address'),
  addressLine2:     z.string().optional(),
  landmark:         z.string().optional(),
  city:             z.string().min(2, 'Enter city name'),
  state:            z.string().min(2, 'Select a state'),
  pincode:          z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  totalFloors:      z.coerce.number().int().min(1).max(50),
  depositMonths:    z.coerce.number().int().min(0).max(6).default(2),
  rentDueDay:       z.coerce.number().int().min(1).max(28),
  description:      z.string().optional(),
  rules:            z.string().optional(),
  contactPhone:     optionalPhone,
  googleMapsUrl:    z.string().url('Must be a valid URL').optional().or(z.literal('')),
})

// z.coerce.number() means the form's raw input type (unknown, straight from
// the <input>) differs from the parsed output type (number). Keeping both
// apart is what lets useForm type the resolver correctly without a cast.
type FormInput  = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export default function NewBuildingPage() {
  const navigate = useNavigate()
  const { mutate: create, isPending } = useCreateBuilding()
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([])
  // Kept outside the form: these come from map clicks, not typed input, and a
  // building cannot be made ACTIVE without them.
  const [location, setLocation] = useState<LatLng | null>(null)

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rentDueDay: 5, depositMonths: 2, totalFloors: 1 },
  })

  function toggleAmenity(name: string) {
    setSelectedAmenities((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    )
  }

  const googleMapsUrl = watch('googleMapsUrl')
  useEffect(() => {
    if (!googleMapsUrl || !googleMapsUrl.startsWith('http')) return
    const timeout = setTimeout(async () => {
      try {
        const coords = await resolveMapUrl(googleMapsUrl)
        if (coords.latitude && coords.longitude) {
          setLocation({ latitude: coords.latitude, longitude: coords.longitude })
        }
      } catch {
        // ignore
      }
    }, 1000)
    return () => clearTimeout(timeout)
  }, [googleMapsUrl])

  function onSubmit(values: FormValues) {
    // Blank optional fields arrive as "" and are normalised away by the API
    // (see optional() in apps/api/src/utils/zod.util.ts).
    create(
      { ...values, amenities: selectedAmenities, ...(location ?? {}) },
      {
        onSuccess: (data) => {
          navigate(`/owner/buildings/${data.id}`)
        },
      }
    )
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Add building"
        description="Fill in the property details"
        actions={
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardTitle className="mb-4">Basic information</CardTitle>
          <div className="space-y-4">
            <FormField label="Building name" error={errors.name?.message} required>
              <Input {...register('name')} placeholder="Sharma PG Block A" />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Property type" error={errors.type?.message} required>
                <Select
                  {...register('type')}
                  placeholder="Select type"
                  options={[
                    { value: 'PG',          label: 'PG' },
                    { value: 'HOSTEL',       label: 'Hostel' },
                    { value: 'APARTMENT',    label: 'Apartment' },
                    { value: 'SHARED_FLAT',  label: 'Shared flat' },
                  ]}
                />
              </FormField>
              <FormField label="Gender preference" error={errors.genderPreference?.message} required>
                <Select
                  {...register('genderPreference')}
                  placeholder="Select"
                  options={[
                    { value: 'MALE',   label: 'Male only' },
                    { value: 'FEMALE', label: 'Female only' },
                    { value: 'CO_ED',  label: 'Co-ed' },
                  ]}
                />
              </FormField>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-4">Address</CardTitle>
          <div className="space-y-4">
            <FormField label="Address line 1" error={errors.addressLine1?.message} required>
              <Input {...register('addressLine1')} placeholder="42, Kondapur Main Road" />
            </FormField>
            <FormField label="Address line 2 / Apartment">
              <Input {...register('addressLine2')} placeholder="Near Metro Station" />
            </FormField>
            <FormField label="Landmark">
              <Input {...register('landmark')} placeholder="Opposite Axis Bank" />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="City" error={errors.city?.message} required>
                <Controller
                  name="city"
                  control={control}
                  render={({ field }) => (
                    <CitySelect
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onSelectState={(s) => setValue('state', s, { shouldValidate: true })}
                      error={!!errors.city}
                    />
                  )}
                />
              </FormField>
              <FormField label="Pincode" error={errors.pincode?.message} required>
                <Input {...register('pincode')} placeholder="500084" maxLength={6} />
              </FormField>
            </div>
            <FormField label="State" error={errors.state?.message} required>
              <Select
                {...register('state')}
                placeholder="Select state"
                options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
              />
            </FormField>
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-4">Property settings</CardTitle>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Total floors" error={errors.totalFloors?.message} required>
                <Input {...register('totalFloors')} type="number" min={1} />
              </FormField>
              <FormField label="Deposit (months)" error={errors.depositMonths?.message}>
                <Input {...register('depositMonths')} type="number" min={0} max={6} />
              </FormField>
              <FormField label="Rent due day" error={errors.rentDueDay?.message} required hint="1-28">
                <Input {...register('rentDueDay')} type="number" min={1} max={28} />
              </FormField>
            </div>
            <FormField label="Contact phone" error={errors.contactPhone?.message}>
              <Controller
                name="contactPhone"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.contactPhone?.message}
                  />
                )}
              />
            </FormField>
            <FormField label="Google Maps URL" error={errors.googleMapsUrl?.message} hint="Optional link to exact location">
              <Input {...register('googleMapsUrl')} placeholder="https://maps.google.com/..." type="url" />
            </FormField>
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-1">Location</CardTitle>
          <p className="text-sm text-gray-500 mb-3">
            Required before the property can be listed as active.
          </p>
          <LocationPicker value={location} onChange={setLocation} />
        </Card>

        <Card>
          <CardTitle className="mb-4">Amenities</CardTitle>
          <div className="flex flex-wrap gap-2">
            {AMENITY_OPTIONS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggleAmenity(a)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  selectedAmenities.includes(a)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-gray-50 text-gray-600 border-gray-300 hover:border-indigo-400'
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-4">Description and rules</CardTitle>
          <div className="space-y-4">
            <FormField label="Description">
              <Textarea
                {...register('description')}
                rows={3}
                placeholder="Describe your property..."
              />
            </FormField>
            <FormField label="House rules">
              <Textarea
                {...register('rules')}
                rows={3}
                placeholder="No smoking. Guests allowed till 10 PM..."
              />
            </FormField>
          </div>
        </Card>

        <div className="flex gap-3 pb-6">
          <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={isPending} className="flex-1">
            Create building
          </Button>
        </div>
      </form>
    </div>
  )
}