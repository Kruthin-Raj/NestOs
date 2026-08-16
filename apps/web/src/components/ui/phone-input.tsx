import { useMemo } from 'react'
import { cn } from '@/lib/utils/cn'
import { COUNTRIES, DEFAULT_COUNTRY, findCountry, splitPhone } from '@/lib/utils/phone'

interface PhoneInputProps {
  /** Full E.164 number, e.g. "+919876543210". Empty string when unset. */
  value?: string | null
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  disabled?: boolean
  placeholder?: string
}

/**
 * Country selector + national number, emitting a single E.164 string.
 *
 * Users previously had to type "+91" by hand on every phone field. The country
 * is derived from the stored value so a saved number reopens on the right one,
 * and defaults to India otherwise.
 */
export function PhoneInput({
  value,
  onChange,
  onBlur,
  error,
  disabled,
  placeholder = '9876543210',
}: PhoneInputProps) {
  const { country, national } = useMemo(() => splitPhone(value), [value])

  function emit(countryCode: string, nationalNumber: string) {
    const digits = nationalNumber.replace(/\D/g, '')
    // Emit "" rather than a bare dial code when the number is cleared, so an
    // optional field reads as empty instead of a half-written value.
    onChange(digits ? `${findCountry(countryCode).dial}${digits}` : '')
  }

  return (
    <div className="flex gap-2">
      <select
        value={country}
        onChange={(e) => emit(e.target.value, national)}
        onBlur={onBlur}
        disabled={disabled}
        aria-label="Country calling code"
        className={cn(
          'h-10 w-32 shrink-0 px-2 text-sm bg-white dark:bg-gray-50 border rounded-lg outline-none transition-colors',
          'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
          error ? 'border-red-400' : 'border-gray-300',
          disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed'
        )}
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} {c.dial}
          </option>
        ))}
      </select>

      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={national}
        onChange={(e) => emit(country, e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          'w-full h-10 px-3 text-sm bg-white dark:bg-gray-50 border rounded-lg outline-none transition-colors',
          'placeholder:text-gray-400',
          'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
          error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300',
          disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed'
        )}
      />
    </div>
  )
}

/** The country list is long; this keeps the default explicit at call sites. */
export { DEFAULT_COUNTRY }
