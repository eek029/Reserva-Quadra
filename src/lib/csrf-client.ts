/**
 * Client-side CSRF token utilities
 * Provides helpers to read CSRF token from cookies and add to request headers
 */

const CSRF_COOKIE_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Get CSRF token from cookies
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${CSRF_COOKIE_NAME}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() ?? null
  
  return null
}

/**
 * Fetch wrapper that automatically adds CSRF token to requests
 * Use this instead of native fetch for all mutation requests (POST, PATCH, DELETE)
 */
export async function fetchWithCsrf(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const token = getCsrfToken()
  
  if (!token) {
    console.warn(`[CSRF] Token not found in cookies. Ensure the app shell sets the CSRF cookie.`)
  }
  
  const headers = {
    ...options?.headers,
    [CSRF_HEADER_NAME]: token || '',
  }
  
  return fetch(url, {
    ...options,
    headers,
  })
}

/**
 * Axios interceptor configuration for automatic CSRF header injection
 * Use in your axios setup:
 * 
 * axiosInstance.interceptors.request.use((config) => {
 *   const token = getCsrfToken()
 *   if (token) {
 *     config.headers[CSRF_HEADER_NAME] = token
 *   }
 *   return config
 * })
 */
export function getCsrfInterceptorConfig() {
  return {
    headerName: CSRF_HEADER_NAME,
    getCsrfToken,
  }
}
