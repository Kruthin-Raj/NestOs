import * as React from 'react'
import { cn } from '@/lib/utils/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full h-10 px-3 text-sm bg-white dark:bg-gray-50 border rounded-lg outline-none transition-colors',
        'placeholder:text-gray-400',
        'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
        error
          ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
          : 'border-gray-300',
        props.disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'