import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PhoneInput } from '@/components/ui/phone-input'
import { LocationPicker, type LatLng } from '@/components/ui/location-picker'
import { FormField } from '@/components/ui/form-field'
import { Card, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { PageLoader } from '@/components/feedback/loading-state'
import { EmptyState } from '@/components/feedback/empty-state'
import { useBuilding, useUpdateBuilding } from '@/features/owner/buildings/hooks/use-buildings'
import { useRequiredParam } from '@/lib/utils/use-required-param'
import { AMENITY_OPTIONS, INDIAN_STATES } from '@/lib/utils/constants'
import { optionalPhone } from '@/lib/utils/phone'
import { cn } from '@/lib/utils/cn'

// Property type is deliberately absent: the API's updateBuildingSchema omits
// it, so a building cannot change type after creation.
const schema = z.object({
  name:             z.string().min(3, 'Building name must be at least 3 characters'),
  genderPreference: z.enum(['MALE', 'FEMALE', 'CO_ED']),
  addressLine1:     z.string().min(5, 'Enter the full address'),
  addressLine2:     z.string().optional(),
  landmark:         z.string().optional(),
  city:             z.string().min(2, 'Enter city name'),
  state:            z.string().min(2, 'Select a state'),
  pincode:          z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  totalFloors:      z.coerce.number().int().min(1).max(50),
  depositMonths:    z.coerce.number().int().min(0).max(6),
  rentDueDay:       z.coerce.number().int().min(1).max(28),
  description:      z.string().optional(),
  rules:            z.string().optional(),
  contactPhone:     optionalPhone,
})

type FormInput  = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export default function EditBuildingPage() {
  const buildingId = useRequiredParam('buildingId')
  const navigate = useNavigate()
  const { data: building, isLoading } = useBuilding(buildingId)
  const { mutate: update, isPending } = useUpdateBuilding()
  // Amenities are their own control rather than a form field. Derived from the
  // building until the user touches them, which avoids seeding state from an
  // effect once the request resolves.
  const [locationOverride, setLocationOverride] = useState<LatLng | null>(null)
  const [amenityOverride, setAmenityOverride] = useState<string[] | null>(null)
  const savedAmenities = (building?.amenities as Array<{ name: string }> | undefined)
    ?.map((a) => a.name) ?? []
  const selectedAmenities = amenityOverride ?? savedAmenities

  // Same derive-until-touched approach as amenities.
  const savedLocation: LatLng | null =
    building?.latitude != null && building?.longitude != null
      ? { latitude: Number(building.latitude), longitude: Number(building.longitude) }
      : null
  const location = locationOverride ?? savedLocation

  const { register, handleSubmit, control, formState: { errors } } =
    useForm<FormInput, unknown, FormValues>({
      resolver: zodResolver(schema),
      values: {
        name:             building?.name             ?? '',
        genderPreference: (building?.genderPreference as never) ?? 'CO_ED',
        addressLine1:     building?.addressLine1     ?? '',
        addressLine2:     building?.addressLine2     ?? '',
        landmark:         building?.landmark         ?? '',
        city:             building?.city             ?? '',
        state:            building?.state            ?? '',
        pincode:          building?.pincode          ?? '',
        totalFloors:      building?.totalFloors      ?? 1,
        depositMonths:    building?.depositMonths    ?? 2,
        rentDueDay:       building?.rentDueDay       ?? 5,
        description:      building?.description      ?? '',
        rules:            building?.rules            ?? '',
        contactPhone:     building?.contactPhone     ?? '',
      },
    })

  if (isLoading) return <PageLoader />
  if (!building) return <EmptyState title="Building not found" />

  function toggleAmenity(name: string) {
    setAmenityOverride((prev) => {
      const base = prev ?? savedAmenities
      return base.includes(name) ? base.filter((a) => a !== name) : [...base, name]
    })
  }

  function onSubmit(values: FormValues) {
    update(
      {
        id: buildingId,
        payload: { ...values, amenities: selectedAmenities, ...(location ?? {}) },
      },
      { onSuccess: () => navigate(`/owner/buildings/${buildingId}`) }
    )
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Edit building"
        description={building.name}
        actions={
          <Button variant="outline" onClick={() => navigate(`/owner/buildings/${buildingId}`)}>
            Cancel
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardTitle className="mb-4">Basic information</CardTitle>
          <div className="space-y-4">
            <FormField label="Building name" error={errors.name?.message} required>
              <Input {...register('name')} />
            </FormField>
            <FormField label="Gender preference" error={errors.genderPreference?.message} required>
              <Select
                {...register('genderPreference')}
                options={[
                  { value: 'MALE',   label: 'Male only' },
                  { value: 'FEMALE', label: 'Female only' },
                  { value: 'CO_ED',  label: 'Co-ed' },
                ]}
              />
            </FormField>
            <p className="text-xs text-gray-400">
              Property type cannot be changed after a building is created.
            </p>
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-4">Address</CardTitle>
          <div className="space-y-4">
            <FormField label="Address line 1" error={errors.addressLine1?.message} required>
              <Input {...register('addressLine1')} />
            </FormField>
            <FormField label="Address line 2 / Apartment">
              <Input {...register('addressLine2')} />
            </FormField>
            <FormField label="Landmark">
              <Input {...register('landmark')} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="City" error={errors.city?.message} required>
                <Input {...register('city')} />
              </FormField>
              <FormField label="Pincode" error={errors.pincode?.message} required>
                <Input {...register('pincode')} maxLength={6} />
              </FormField>
            </div>
            <FormField label="State" error={errors.state?.message} required>
              <Select
                {...register('state')}
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
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-1">Location</CardTitle>
          <p className="text-sm text-gray-500 mb-3">
            Required before the property can be listed as active.
          </p>
          <LocationPicker value={location} onChange={setLocationOverride} />
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
              <Textarea {...register('description')} rows={3} />
            </FormField>
            <FormField label="House rules">
              <Textarea {...register('rules')} rows={3} />
            </FormField>
          </div>
        </Card>

        <div className="flex gap-3 pb-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/owner/buildings/${buildingId}`)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" loading={isPending} className="flex-1">
            Save changes
          </Button>
        </div>
      </form>
    </div>
  )
}
