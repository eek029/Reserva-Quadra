import { NextResponse } from 'next/server'

interface RateLimitConfig {
  windowMs: number
  max: number
  message?: string
}

interface Entry {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key)
    }
  }, 60_000)
}

function check(key: string, config: RateLimitConfig) {
  const { windowMs, max } = config
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs }
  }

  entry.count++
  const remaining = Math.max(0, max - entry.count)

  if (entry.count > max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining, resetAt: entry.resetAt }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}

export function rateLimitResponse(entry: { allowed: boolean; remaining: number; resetAt: number }, config: RateLimitConfig): NextResponse | null {
  if (entry.allowed) return null

  const retryAfter = Math.ceil((entry.resetAt - Date.now()) / 1000)

  return NextResponse.json(
    { error: config.message ?? 'Muitas requisições. Tente novamente mais tarde.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(config.max),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
      },
    }
  )
}

export function rateLimitKey(request: Request, prefix: string): string {
  return `${prefix}:${getClientIp(request)}`
}

export function createRateLimiter(config: RateLimitConfig) {
  return {
    check(request: Request): NextResponse | null {
      const ip = getClientIp(request)
      const entry = check(ip, config)
      return rateLimitResponse(entry, config)
    },
    checkWithKey(key: string): NextResponse | null {
      const entry = check(key, config)
      return rateLimitResponse(entry, config)
    },
  }
}
