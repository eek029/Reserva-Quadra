import type { SupabaseClient } from '@supabase/supabase-js'
import { criarUsuarioSchema, atualizarUsuarioSchema, statusQuerySchema } from '@/lib/validators'
import { AppError, ValidationError, ForbiddenError } from './reserva'
export { AppError, ValidationError, ForbiddenError }

function nullifyEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

async function uploadAvatar(supabase: SupabaseClient, userId: string, dataUri: string): Promise<string | null> {
  if (!dataUri.startsWith('data:')) return dataUri
  try {
    const [meta, base64Data] = dataUri.split(',')
    if (!base64Data) return null
    const mimeMatch = meta.match(/data:([^;]+);/)
    const mimeType = mimeMatch?.[1] ?? 'image/jpeg'
    const ext = mimeType.split('/')[1]?.split('+')[0] ?? 'jpg'
    const buffer = Buffer.from(base64Data, 'base64')
    const filePath = `avatars/${userId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars').upload(filePath, buffer, { contentType: mimeType, upsert: true })

    if (uploadError) return dataUri
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
    return urlData?.publicUrl ?? dataUri
  } catch {
    return dataUri
  }
}

const ALLOWED_CARGOS = ['SysAdmin', 'Síndico Geral', 'Subsíndico', 'Porteiro'] as const

export async function listarUsuarios(supabase: SupabaseClient, status?: string, callerId?: string, callerCargo?: string, callerTorre?: string) {
  if (!callerId || !callerCargo) throw new AppError('Não autorizado.', 401)

  if (!(ALLOWED_CARGOS as readonly string[]).includes(callerCargo))
    throw new ForbiddenError('Acesso negado.')

  const s = statusQuerySchema.safeParse(status)
  const statusFilter = s.success ? s.data : 'pendente'

  let query = supabase
    .from('usuarios')
    .select('id, nome_completo, torre, apartamento, cargo, status, foto_url, cpf_encrypted, rg_encrypted')
    .eq('status', statusFilter)
    .order('nome_completo', { ascending: true })

  if (callerCargo === 'Subsíndico' || callerCargo === 'Porteiro') {
    if (callerTorre) query = query.eq('torre', callerTorre)
  } else if (callerCargo === 'Síndico Geral') {
    query = query.neq('cargo', 'SysAdmin')
  }

  const { data, error } = await query
  if (error) throw new AppError(error.message, 500)
  return data ?? []
}

export async function criarUsuario(supabase: SupabaseClient, authId: string, body: unknown) {
  const parsed = criarUsuarioSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const b = parsed.data

  const fotoUrl = b.foto_url ? await uploadAvatar(supabase, authId, b.foto_url) : null

  const { data, error } = await supabase.rpc('create_usuario_encrypted', {
    p_id: authId,
    p_nome_completo: b.nome_completo,
    p_data_nascimento: b.data_nascimento,
    p_telefone: b.telefone,
    p_apartamento: nullifyEmpty(b.apartamento),
    p_torre: nullifyEmpty(b.torre),
    p_bloco: nullifyEmpty(b.bloco),
    p_foto_url: fotoUrl,
    p_cargo: b.cargo || 'Morador',
    p_rg: b.rg,
    p_cpf: b.cpf,
  })

  if (error) throw new AppError(error.message, 500)
  return { id: data, status: 'ok' }
}

export async function getUsuarioDecrypted(supabase: SupabaseClient, targetId: string) {
  const { data, error } = await supabase.rpc('get_usuario_decrypted', { target_id: targetId })
  if (error) throw new AppError(error.message, 500)
  if (!data || data.length === 0) throw new AppError('Usuário não encontrado.', 404)
  return data[0]
}

export async function atualizarUsuario(supabase: SupabaseClient, id: string, callerId: string, body: unknown) {
  const parsed = atualizarUsuarioSchema.partial().safeParse(body)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)

  const update = parsed.data as Record<string, string | null | undefined>
  Object.keys(update).forEach(k => { if (update[k] === undefined) delete update[k] })
  if (Object.keys(update).length === 0) throw new ValidationError('Nenhum campo válido para atualizar.')

  // Extract encrypted fields (CPF, RG) and handle them via RPC
  const cpf = update.cpf ?? undefined
  const rg = update.rg ?? undefined
  delete update.cpf
  delete update.rg

  // Update plain fields directly
  const plainKeys = Object.keys(update)
  if (plainKeys.length > 0) {
    const { error } = await supabase.from('usuarios').update(update).eq('id', id)
    if (error) throw new AppError(error.message, 500)
  }

  // Update encrypted fields via RPC
  if (cpf || rg) {
    const { error } = await supabase.rpc('update_usuario_encrypted_fields', {
      p_user_id: id,
      p_nome_completo: null,
      p_cpf: cpf ?? null,
      p_rg: rg ?? null,
      p_foto_url: null,
    })
    if (error) throw new AppError(error.message, 500)
  }

  supabase.from('audit_logs').insert({
    perfil_id: callerId, acao: 'atualizou_usuario', detalhes: { alvo_usuario_id: id, campos: { ...update, cpf: cpf ? '(encrypted)' : undefined, rg: rg ? '(encrypted)' : undefined } }
  }).then(() => {})
}
