import { useState, useRef, useEffect } from 'react'
import { MapPin, ChevronDown, Check, X } from 'lucide-react'
import { INDIAN_CITIES, POPULAR_CITIES, lookupStateByCity } from '@/lib/utils/cities'
import { cn } from '@/lib/utils/cn'

interface CitySelectProps {
  value?: string
  onChange: (city: string) => void
  onSelectState?: (state: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  error?: boolean
  name?: string
  required?: boolean
}

export function CitySelect({
  value = '',
  onChange,
  onSelectState,
  placeholder = 'Select or type city...',
  disabled = false,
  className,
  error = false,
  name,
}: CitySelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)

  // Keep search in sync with external value changes
  useEffect(() => {
    setSearch(value)
  }, [value])

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredCities = INDIAN_CITIES.filter((city) =>
    city.name.toLowerCase().includes(search.toLowerCase()) ||
    city.state.toLowerCase().includes(search.toLowerCase())
  )

  function handleSelectCity(cityName: string) {
    onChange(cityName)
    setSearch(cityName)
    setIsOpen(false)

    // Lookup and auto-fill state if handler provided
    const matchedState = lookupStateByCity(cityName)
    if (matchedState && onSelectState) {
      onSelectState(matchedState)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.value
    setSearch(newVal)
    onChange(newVal)
    if (!isOpen) setIsOpen(true)

    // Also attempt matching state as user types
    const matchedState = lookupStateByCity(newVal)
    if (matchedState && onSelectState) {
      onSelectState(matchedState)
    }
  }

  function handleClear() {
    setSearch('')
    onChange('')
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <MapPin className="h-4 w-4" />
        </div>

        <input
          type="text"
          name={name}
          value={search}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'w-full h-10 pl-9 pr-16 text-sm bg-white dark:bg-gray-800 border rounded-lg outline-none transition-colors text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
            error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-700',
            disabled && 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed opacity-60',
            className
          )}
        />

        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
          {search && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-2 text-sm">
          {/* Quick Popular Chips */}
          <div className="px-3 pb-2 border-b border-gray-100 dark:border-gray-700 mb-1">
            <p className="text-[11px] font-semibold tracking-wider text-gray-400 dark:text-gray-400 uppercase mb-1.5">
              Popular Cities
            </p>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_CITIES.slice(0, 8).map((city) => (
                <button
                  key={city.name}
                  type="button"
                  onClick={() => handleSelectCity(city.name)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md transition-colors border',
                    search.toLowerCase() === city.name.toLowerCase()
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>

          {/* Filtered Cities List */}
          {filteredCities.length > 0 ? (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/40">
              {filteredCities.map((city) => {
                const isSelected = search.toLowerCase() === city.name.toLowerCase()
                return (
                  <div
                    key={`${city.name}-${city.state}`}
                    onClick={() => handleSelectCity(city.name)}
                    className={cn(
                      'px-3 py-2 flex items-center justify-between cursor-pointer transition-colors hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40',
                      isSelected && 'bg-indigo-50 dark:bg-indigo-950/60 font-medium'
                    )}
                  >
                    <div>
                      <p className="text-gray-900 dark:text-gray-100">{city.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-400">{city.state}</p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="px-3 py-3 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                No matching city found. Pressing enter will use <span className="font-semibold text-gray-900 dark:text-gray-100">"{search}"</span>.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
