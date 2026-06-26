'use client'

import { useEffect } from 'react'

/**
 * Initializes CSRF token on app load
 * Runs a GET request to the app to trigger CSRF cookie setting
 * This component should be placed in the root layout
 */
export default function CsrfTokenInitializer() {
  useEffect(() => {
    const initializeCsrfToken = async () => {
      try {
        // Making a simple GET request to app to trigger CSRF token generation
        // We use a GET /api endpoint that doesn't require auth and sets the CSRF cookie
        await fetch('/api/csrf-init', {
          method: 'GET',
          credentials: 'include',
        })
      } catch (error) {
        console.error('[CSRF] Failed to initialize token:', error)
        // Non-critical error - app will still work but CSRF protection may fail
      }
    }

    initializeCsrfToken()
  }, [])

  return null
}
