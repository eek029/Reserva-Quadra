import type { SupabaseClient } from '@supabase/supabase-js'
import { criarUsuarioSchema, atualizarUsuarioSchema, statusQuerySchema, temFotoPerfil } from '@/lib/validators'
import { assinarFotoUrl, assinarFotoUrls } from '@/lib/avatar'
import { AppError, ValidationError, ForbiddenError, NotFoundError } from './reserva'
export { AppError, ValidationError, ForbiddenError }

const ALLOWED_AVATAR_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const MAX_AVATAR_BYTES = 1_048_576

function nullifyEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

async function uploadAvatar(supabase: SupabaseClient, userId: string, dataUri: string): Promise<string> {
  if (!dataUri.startsWith('data:')) {
    if (!dataUri.startsWith('https://')) throw new ValidationError('URL da foto inválida.')
    return dataUri
  }

  const [meta, base64Data] = dataUri.split(',')
  if (!base64Data) throw new ValidationError('A foto de perfil é obrigatória.')

  const mimeMatch = meta.match(/data:([^;]+);/)
  const mimeType = mimeMatch?.[1] ?? ''
  if (!ALLOWED_AVATAR_MIMES.has(mimeType)) {
    throw new ValidationError('Envie uma foto válida (JPEG, PNG ou WebP).')
  }

  const buffer = Buffer.from(base64Data, 'base64')
  if (buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES) {
    throw new ValidationError('A foto deve ter no máximo 1 MB.')
  }

  const ext = mimeType.split('/')[1]?.split('+')[0] ?? 'jpg'
  const filePath = `avatars/${userId}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('avatars').upload(filePath, buffer, { contentType: mimeType, upsert: true })

  if (uploadError) throw new ValidationError('Falha ao enviar a foto. Tente novamente.')

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
  if (!urlData?.publicUrl) throw new ValidationError('Falha ao enviar a foto. Tente novamente.')
  return urlData.publicUrl
}

const ALLOWED_CARGOS = ['SysAdmin', 'Síndico Geral', 'Subsíndico', 'Porteiro'] as const
const DELETABLE_BY_SINDICO = ['Morador', 'Porteiro', 'Subsíndico'] as const

type ListarUsuariosOpts = {
  status?: string
  callerId?: string
  callerCargo?: string
  callerTorre?: string
  search?: string
  torre?: string
  page?: number
  pageSize?: number
  excludeId?: string
  visao?: string
}

export async function listarUsuarios(supabase: SupabaseClient, opts: ListarUsuariosOpts = {}) {
  const {
    status, callerId, callerCargo, callerTorre,
    search, torre, page, pageSize, excludeId, visao,
  } = opts

  if (!callerId || !callerCargo) throw new AppError('Não autorizado.', 401)

  if (!(ALLOWED_CARGOS as readonly string[]).includes(callerCargo))
    throw new ForbiddenError('Acesso negado.')

  const s = statusQuerySchema.safeParse(status)
  const statusFilter = s.success ? s.data : 'pendente'
  const paginar = Number.isInteger(page) && Number.isInteger(pageSize) && (page ?? 0) > 0 && (pageSize ?? 0) > 0
  const from = paginar ? ((page as number) - 1) * (pageSize as number) : 0
  const to = paginar ? from + (pageSize as number) - 1 : undefined

  let query = supabase
    .from('usuarios')
    .select('id, nome_completo, torre, apartamento, bloco, cargo, status, telefone, foto_url, cpf_encrypted, rg_encrypted', { count: 'exact' })
    .order('nome_completo', { ascending: true })

  if (statusFilter && statusFilter !== 'todos') query = query.eq('status', statusFilter)
  if (excludeId) query = query.neq('id', excludeId)

  if (callerCargo === 'Subsíndico' || callerCargo === 'Porteiro') {
    if (callerTorre) query = query.eq('torre', callerTorre)
  } else if (torre) {
    query = query.eq('torre', torre)
  }

  if (callerCargo === 'Síndico Geral') {
    query = query.neq('cargo', 'SysAdmin')
  }

  if (visao === 'gestao' && callerCargo === 'Subsíndico') {
    query = query.in('cargo', [...DELETABLE_BY_SINDICO])
  }

  if (search?.trim()) {
    const q = search.trim().replace(/[,()]/g, '')
    query = query.or(`nome_completo.ilike.%${q}%,apartamento.ilike.%${q}%`)
  }

  if (paginar && to !== undefined) query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw new AppError(error.message, 500)

  const rows = data ?? []
  const signed = await assinarFotoUrls(supabase, rows.map(u => u.foto_url))

  const usuarios = rows.map(u => ({
    id: u.id,
    nome_completo: u.nome_completo,
    torre: u.torre,
    apartamento: u.apartamento,
    bloco: u.bloco,
    cargo: u.cargo,
    status: u.status,
    telefone: u.telefone,
    foto_url: u.foto_url ? (signed.get(u.foto_url) ?? u.foto_url) : null,
    tem_cpf: Boolean(u.cpf_encrypted),
    tem_rg: Boolean(u.rg_encrypted),
  }))

  return { usuarios, total: count ?? usuarios.length }
}

export async function criarUsuario(supabase: SupabaseClient, authId: string, body: unknown) {
  const parsed = criarUsuarioSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const b = parsed.data

  const fotoUrl = await uploadAvatar(supabase, authId, b.foto_url)

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
  const row = data[0] as Record<string, unknown>
  row.foto_url = await assinarFotoUrl(supabase, typeof row.foto_url === 'string' ? row.foto_url : null)
  return row
}

export async function excluirUsuario(
  supabase: SupabaseClient,
  targetId: string,
  callerId: string,
  callerCargo: string,
  callerTorre?: string,
) {
  if (targetId === callerId) throw new ValidationError('Você não pode excluir a si mesmo.')
  if (!['SysAdmin', 'Síndico Geral', 'Subsíndico'].includes(callerCargo)) {
    throw new ForbiddenError('Acesso negado.')
  }

  const { data: target, error: targetError } = await supabase
    .from('usuarios')
    .select('id, cargo, torre')
    .eq('id', targetId)
    .maybeSingle()
  if (targetError) throw new AppError(targetError.message, 500)
  if (!target) throw new NotFoundError('Usuário não encontrado.')

  if (target.cargo === 'SysAdmin' && callerCargo !== 'SysAdmin') {
    throw new ForbiddenError('Acesso negado.')
  }
  if (callerCargo !== 'SysAdmin' && !(DELETABLE_BY_SINDICO as readonly string[]).includes(target.cargo)) {
    throw new ForbiddenError('Acesso negado.')
  }
  if (callerCargo === 'Subsíndico' && callerTorre && target.torre !== callerTorre) {
    throw new ForbiddenError('Acesso negado.')
  }

  const { error } = await supabase.from('usuarios').delete().eq('id', targetId)
  if (error) throw new AppError(error.message, 500)

  supabase.from('audit_logs').insert({
    perfil_id: callerId,
    acao: 'excluiu_usuario',
    detalhes: { alvo_usuario_id: targetId, cargo: target.cargo },
  }).then(() => {})
}

export async function atualizarUsuario(supabase: SupabaseClient, id: string, callerId: string, body: unknown) {
  const parsed = atualizarUsuarioSchema.partial().safeParse(body)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)

  const update = parsed.data as Record<string, string | null | undefined>
  Object.keys(update).forEach(k => { if (update[k] === undefined) delete update[k] })
  if (Object.keys(update).length === 0) throw new ValidationError('Nenhum campo válido para atualizar.')

  if (update.status === 'aprovado') {
    const { data: target, error: targetError } = await supabase
      .from('usuarios').select('foto_url, cargo').eq('id', id).maybeSingle()
    if (targetError) throw new AppError(targetError.message, 500)
    if (target?.cargo !== 'SysAdmin' && !temFotoPerfil(target?.foto_url)) {
      throw new ValidationError('Não é possível aprovar cadastro sem foto de perfil.')
    }
  }

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
