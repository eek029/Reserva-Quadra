import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export function getServiceClient() {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function createApiClient(
  token: string,
  refreshToken?: string
): Promise<SupabaseClient> {
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  if (refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: token, refresh_token: refreshToken })
    if (error) throw new Error('Não autorizado.')
  } else {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw new Error('Não autorizado.')
  }

  return supabase
}
