import axios, { AxiosError } from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'

const apiClient = axios.create({
  baseURL:         API_URL,
  withCredentials: true,
  headers:         { 'Content-Type': 'application/json' },
})

// Response interceptor — normalize errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status

    if (status === 401) {
      // Try silent token refresh
      try {
        await axios.post(
          `${API_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        )
        // Retry original request
        return apiClient(error.config!)
      } catch {
        // Refresh failed — clear session and redirect
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient