import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

const configuredUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'
export const API_URL = typeof window !== 'undefined' 
  ? configuredUrl.replace(/(localhost|127\.0\.0\.1)/, window.location.hostname)
  : configuredUrl

const apiClient = axios.create({
  baseURL:         API_URL,
  withCredentials: true,
  headers:         { 'Content-Type': 'application/json' },
})

/**
 * Endpoints where a 401 is a real answer rather than an expired session.
 *
 * "Wrong password" comes back as 401 from /auth/login. Treating that as an
 * expired session meant the interceptor tried to refresh, failed, and reloaded
 * the page — which threw away the error toast the login form had just raised,
 * so a wrong password looked like nothing happening at all.
 */
const NO_REFRESH_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/refresh-token',
  '/auth/logout',
  '/auth/send-otp',
  '/auth/verify-otp',
  '/auth/forgot-password',
  '/auth/reset-password',
]

/** Set once on a retried request so a failing refresh can never loop. */
type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined
    const url    = config?.url ?? ''

    const isAuthCall = NO_REFRESH_PATHS.some((p) => url.startsWith(p))
    const shouldTryRefresh =
      error.response?.status === 401 && config && !config._retried && !isAuthCall

    if (shouldTryRefresh) {
      try {
        await axios.post(`${API_URL}/auth/refresh-token`, {}, { withCredentials: true })
        config._retried = true
        return await apiClient(config)
      } catch {
        // The session really is gone. Skip the redirect if we are already on
        // /login, or the reload loops and the user can never read the error.
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
