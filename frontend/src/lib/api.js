import axios from 'axios'

const backendUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
const apiBaseUrl = backendUrl ? `${backendUrl}/api` : '/api'

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 15000,
})

// Lazy-load authStore to avoid circular dependency
const forceLogout = () => {
  // Import dynamically so we don't create circular imports
  import('@/store/authStore').then(({ default: useAuthStore }) => {
    useAuthStore.getState().logout()
  })
}

// ─── Request Interceptor: attach access token ─────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Response Interceptor: handle token refresh ────────────────────────────
let isRefreshing = false
let pendingQueue = []

const processQueue = (error, token = null) => {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)))
  pendingQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }

      original._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        isRefreshing = false
        processQueue(error, null)
        forceLogout()
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(
          `${apiBaseUrl}/auth/refresh`,
          { refresh_token: refreshToken },
          { withCredentials: true, timeout: 15000 }
        )
        const newToken = data.data.accessToken
        localStorage.setItem('access_token', newToken)
        if (data.data.refreshToken) {
          localStorage.setItem('refresh_token', data.data.refreshToken)
        }
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (refreshError) {
        processQueue(refreshError, null)
        forceLogout()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
