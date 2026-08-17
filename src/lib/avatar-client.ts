import type { SupabaseClient } from '@supabase/supabase-js'
import { avatarObjectPath } from '@/lib/avatar'

export async function assinarFotoCliente(
  supabase: SupabaseClient,
  fotoUrl?: string | null,
): Promise<string | null> {
  if (!fotoUrl?.trim()) return null
  const path = avatarObjectPath(fotoUrl)
  if (!path) return fotoUrl

  const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) return fotoUrl
  return data.signedUrl
}
