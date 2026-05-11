import { create } from 'zustand'
import { authApi } from '@/lib/api'

interface User {
  id: string
  email: string
  full_name: string
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loadFromStorage: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  loadFromStorage: () => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('access_token')
    const userStr = localStorage.getItem('user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        set({ token, user, isAuthenticated: true })
      } catch {}
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      const res = await authApi.login(email, password)
      const { access_token, user } = res.data
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('user', JSON.stringify(user))
      set({ token: access_token, user, isAuthenticated: true, isLoading: false })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    set({ user: null, token: null, isAuthenticated: false })
    window.location.href = '/auth'
  },
}))
