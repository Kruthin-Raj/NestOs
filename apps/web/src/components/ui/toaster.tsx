import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id:      string
  type:    ToastType
  message: string
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside Toaster')
  return ctx
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-4 w-4 text-green-600" />,
  error:   <AlertCircle className="h-4 w-4 text-red-600" />,
  info:    <Info className="h-4 w-4 text-blue-600" />,
}

const BG: Record<ToastType, string> = {
  success: 'border-green-200 bg-green-50',
  error:   'border-red-200 bg-red-50',
  info:    'border-blue-200 bg-blue-50',
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  // Expose globally
  useEffect(() => {
    ;(window as unknown as { __nestos_toast: typeof toast }).__nestos_toast = toast
  }, [toast])

  return (
    <ToastContext.Provider value={{ toast }}>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border shadow-lg',
              BG[t.type]
            )}
          >
            <span className="flex-shrink-0 mt-0.5">{ICONS[t.type]}</span>
            <p className="text-sm text-gray-800 flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)}>
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Utility function — call anywhere without hook
export function showToast(message: string, type: ToastType = 'info') {
  const fn = (window as unknown as { __nestos_toast?: (m: string, t: ToastType) => void }).__nestos_toast
  if (fn) fn(message, type)
}