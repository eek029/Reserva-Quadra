import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const CSRF_COOKIE_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_TOKEN_LENGTH = 32

/**
 * Gera um novo token CSRF aleatório
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
}

/**
 * Valida um token CSRF comparando com o cookie
 * Usa double-submit cookie pattern
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  const headerToken = request.headers.get(CSRF_HEADER_NAME)

  // Ambos devem estar presentes e ser iguais
  if (!cookieToken || !headerToken) return false
  return cookieToken === headerToken
}

/**
 * Adiciona CSRF token ao response como cookie
 */
export function setCSRFTokenCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Precisa ser acessível ao JS do cliente
    secure: true, // HTTPS only
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 horas
    path: '/',
  })
}

/**
 * Middleware para adicionar CSRF token ao response
 * Use em GET requests que precisam retornar o token para o cliente usar em mutações
 */
export function addCSRFTokenToResponse(response: NextResponse): NextResponse {
  const token = generateCsrfToken()
  setCSRFTokenCookie(response, token)
  return response
}
