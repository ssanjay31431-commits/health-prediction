import axios from 'axios'

// Use explicit VITE_API_URL in production, and fallback to local backend during development.
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const api = axios.create({
  baseURL,
  timeout: 30000, // Increased to 30 seconds for email processing
})

// Add token to every request
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 || error.response?.status === 401) {
      sessionStorage.removeItem('authToken')
      localStorage.removeItem('authToken')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
