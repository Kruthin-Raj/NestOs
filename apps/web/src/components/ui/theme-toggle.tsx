import { Moon, Sun } from 'lucide-react'
import { useUIStore } from '@/store/ui.store'
import { cn } from '@/lib/utils/cn'

/**
 * Light/dark switch. The choice is stored in localStorage and applied as a
 * `.dark` class on <html>; see src/styles/globals.css for how that re-skins the
 * palette.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useUIStore((s) => s.theme)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors',
        className
      )}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
