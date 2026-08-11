import * as React from 'react'
import { cn } from '@/lib/utils/cn'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?:    string
  options:   Array<{ value: string; label: string }>
  placeholder?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, options, placeholder, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full h-10 px-3 text-sm bg-white border rounded-lg outline-none transition-colors',
        'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
        error ? 'border-red-400' : 'border-gray-300',
        props.disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
        className
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
)
Select.displayName = 'Select'