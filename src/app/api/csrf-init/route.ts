import { NextRequest, NextResponse } from 'next/server'
import { generateCsrfToken, setCSRFTokenCookie } from '@/lib/csrf'

export const dynamic = 'force-dynamic'

/**
 * GET /api/csrf-init
 * 
 * Generates and returns a CSRF token via cookie
 * This endpoint is called by the client on app initialization to set up CSRF protection
 * No authentication required
 */
export async function GET(request: NextRequest) {
  try {
    const response = NextResponse.json({ ok: true })
    const token = generateCsrfToken()
    setCSRFTokenCookie(response, token)
    return response
  } catch (error) {
    console.error('[CSRF Init]', error)
    return NextResponse.json({ error: 'Falha ao inicializar CSRF' }, { status: 500 })
  }
}
