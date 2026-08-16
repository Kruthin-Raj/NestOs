import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'nestos-theme'

/**
 * Reads the saved choice, falling back to the operating system preference.
 *
 * Runs at module load so the store starts on the right theme; the matching
 * class is applied to <html> before React renders (see index.html) to avoid a
 * flash of the wrong palette.
 */
function initialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  localStorage.setItem(STORAGE_KEY, theme)
}

interface UIStore {
  sidebarOpen: boolean
  toggleSidebar: () => void
  closeSidebar:  () => void

  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

export const useUIStore = create<UIStore>()((set, get) => ({
  sidebarOpen:   false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar:  () => set({ sidebarOpen: false }),

  theme: initialTheme(),
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}))
