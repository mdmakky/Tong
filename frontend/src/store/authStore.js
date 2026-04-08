import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'
import { initSocket, disconnectSocket } from '@/lib/socket'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setTokens: (access_token, refresh_token) => {
        localStorage.setItem('access_token', access_token)
        if (refresh_token) localStorage.setItem('refresh_token', refresh_token)
        set({ accessToken: access_token, refreshToken: refresh_token })
      },

      login: async (email, password, totp_code) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/login', { email, password, totp_code })
          const { accessToken, refreshToken, user } = data.data
          localStorage.setItem('access_token', accessToken)
          localStorage.setItem('refresh_token', refreshToken)
          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })
          initSocket(accessToken)
          return { success: true }
        } catch (err) {
          set({ isLoading: false })
          return {
            success: false,
            message: err.response?.data?.message || 'Login failed',
            requires2FA: err.response?.data?.requires_2fa,
          }
        }
      },

      register: async (formData) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/register', formData)
          set({ isLoading: false })
          return { success: true, message: data.message }
        } catch (err) {
          set({ isLoading: false })
          return {
            success: false,
            message: err.response?.data?.message || 'Registration failed',
            errors: err.response?.data?.errors,
          }
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout')
        } catch (_) {}
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        disconnectSocket()
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },

      fetchMe: async () => {
        try {
          const { data } = await api.get('/users/me')
          set({ user: data.data, isAuthenticated: true })
          return data.data
        } catch (err) {
          // Only clear session on explicit 401 — NOT on network errors or 5xx
          if (err.response?.status === 401) {
            set({ user: null, isAuthenticated: false })
          }
          return null
        }
      },

      updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export default useAuthStore
