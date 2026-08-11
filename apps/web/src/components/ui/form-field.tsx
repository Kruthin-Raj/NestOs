import React from 'react'
import { Label } from './label'
import { cn } from '@/lib/utils/cn'

interface FormFieldProps {
  label?:    string
  error?:    string
  hint?:     string
  required?: boolean
  children:  React.ReactNode
  className?: string
}

export function FormField({ label, error, hint, required, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {label && <Label required={required}>{label}</Label>}
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}