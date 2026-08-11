import * as React from 'react'
import { cn } from '@/lib/utils/cn'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full px-3 py-2 text-sm bg-white border rounded-lg outline-none transition-colors resize-none',
        'placeholder:text-gray-400',
        'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
        error ? 'border-red-400' : 'border-gray-300',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'