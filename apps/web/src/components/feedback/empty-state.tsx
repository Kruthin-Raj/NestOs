import { cn } from '@/lib/utils/cn'
import { Button } from '../ui/button'

interface EmptyStateProps {
  icon?:       React.ReactNode
  title:       string
  description?: string
  action?:     { label: string; onClick: () => void }
  className?:  string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-16 px-4', className)}>
      {icon && (
        <div className="flex justify-center mb-4 text-gray-300">{icon}</div>
      )}
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          <Button onClick={action.onClick} size="sm">
            {action.label}
          </Button>
        </div>
      )}
    </div>
  )
}