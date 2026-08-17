import type { SupabaseClient } from '@supabase/supabase-js'

const AVATAR_SIGN_SECONDS = 60 * 60
const PUBLIC_PREFIX = '/storage/v1/object/public/avatars/'
const SIGN_PREFIX = '/storage/v1/object/sign/avatars/'

export function avatarObjectPath(fotoUrl?: string | null): string | null {
  if (!fotoUrl) return null
  const trimmed = fotoUrl.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('avatars/')) return trimmed
  try {
    const url = new URL(trimmed)
    if (url.pathname.startsWith(PUBLIC_PREFIX)) {
      return decodeURIComponent(url.pathname.slice(PUBLIC_PREFIX.length))
    }
    if (url.pathname.startsWith(SIGN_PREFIX)) {
      return decodeURIComponent(url.pathname.slice(SIGN_PREFIX.length))
    }
  } catch {
    return null
  }
  return null
}

export async function assinarFotoUrl(
  supabase: SupabaseClient,
  fotoUrl?: string | null,
  expiresIn = AVATAR_SIGN_SECONDS,
): Promise<string | null> {
  if (!fotoUrl?.trim()) return null
  const path = avatarObjectPath(fotoUrl)
  if (!path) return fotoUrl

  const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) return fotoUrl
  return data.signedUrl
}

export async function assinarFotoUrls(
  supabase: SupabaseClient,
  fotoUrls: Array<string | null | undefined>,
  expiresIn = AVATAR_SIGN_SECONDS,
): Promise<Map<string, string>> {
  const unique = [...new Set(fotoUrls.filter((url): url is string => Boolean(url?.trim())))]
  const signed = new Map<string, string>()
  const paths: string[] = []
  const pathToOriginal = new Map<string, string[]>()

  for (const original of unique) {
    const path = avatarObjectPath(original)
    if (!path) {
      signed.set(original, original)
      continue
    }
    paths.push(path)
    const list = pathToOriginal.get(path) ?? []
    list.push(original)
    pathToOriginal.set(path, list)
  }

  if (paths.length === 0) return signed

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrls([...new Set(paths)], expiresIn)

  if (error || !data) {
    for (const original of unique) {
      if (!signed.has(original)) signed.set(original, original)
    }
    return signed
  }

  for (const item of data) {
    const originals = item.path ? pathToOriginal.get(item.path) : undefined
    if (!originals) continue
    for (const original of originals) {
      signed.set(original, item.signedUrl || original)
    }
  }

  for (const original of unique) {
    if (!signed.has(original)) signed.set(original, original)
  }
  return signed
}
