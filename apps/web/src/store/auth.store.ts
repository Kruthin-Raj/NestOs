'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthStore {
  user:        User | null
  isHydrated:  boolean
  setUser:     (user: User) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user:        null,
      isHydrated:  false,
      setUser:     (user) => set({ user, isHydrated: true }),
      clearSession: () =>
        set({ user: null }),
    }),
    {
      name:    'nestos-auth',
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true
      },
    }
  )
)