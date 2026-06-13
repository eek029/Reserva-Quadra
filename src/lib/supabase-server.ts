import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export function getServiceClient() {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function getRouteClient(
  getAllCookies: () => Array<{ name: string; value: string }>
) {
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: getAllCookies,
      setAll: () => {},
    },
  })
}
