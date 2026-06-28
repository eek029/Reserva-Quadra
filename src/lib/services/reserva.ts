import type { SupabaseClient } from '@supabase/supabase-js'
import { criarReservaSchema, cancelarReservaSchema, chaveSchema, validateReservaSchema, reservaPresencialSchema, historicoQuerySchema } from '@/lib/validators'

export class AppError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
export class ValidationError extends AppError { constructor(m: string) { super(m, 400) } }
export class ForbiddenError extends AppError { constructor(m: string) { super(m, 403) } }
export class NotFoundError extends AppError { constructor(m: string) { super(m, 404) } }
export class ConflictError extends AppError { constructor(m: string) { super(m, 409) } }

export async function listarReservas(supabase: SupabaseClient, data?: string, callerId?: string, callerCargo?: string, callerTorre?: string) {
  const canViewAll = ['SysAdmin', 'Síndico Geral', 'Porteiro'].includes(callerCargo ?? '')

  let query = supabase
    .from('reservas')
    .select(`*,
      usuarios!usuario_id(nome_completo, foto_url, torre, apartamento, cargo),
      porteiro_entrega:entregue_por(nome_completo),
      porteiro_recebimento:recebida_por(nome_completo)
    `)
    .eq('status', 'ativa')

  if (data) query = query.eq('data_reserva', data)

  const podeOrdenar = callerCargo === 'Síndico Geral' || callerCargo === 'SysAdmin'
  if (podeOrdenar) query = query.order('hora_inicio', { ascending: true })

  let torreUserIds: string[] = []
  if (callerCargo === 'Subsíndico' && callerTorre) {
    const { data: users } = await supabase
      .from('usuarios').select('id').eq('torre', callerTorre)
    torreUserIds = users?.map(u => u.id) ?? []
  }

  const { data: result, error } = await query
  if (error) throw new AppError(error.message, 500)

  return (result ?? []).map(r => {
    if (canViewAll) return r

    if (callerCargo === 'Subsíndico' && callerTorre) {
      const pertenceTorre = torreUserIds.includes(r.usuario_id)
      const presencialTorre = r.presencial_torre === callerTorre
      if (pertenceTorre || presencialTorre) return r
    }

    return {
      id: r.id, data_reserva: r.data_reserva,
      hora_inicio: r.hora_inicio, hora_fim: r.hora_fim,
      status: r.status, usuario_id: r.usuario_id,
      status_chave: r.status_chave,
      usuarios: null,
      observacao: null, telefone_contato: null,
      presencial_nome: null, presencial_torre: null,
      presencial_apt: null, presencial_bloco: null, presencial_documento: null,
    }
  })
}

export async function criarReserva(supabase: SupabaseClient, body: unknown) {
  const parsed = criarReservaSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { data_reserva, hora_inicio, hora_fim, aceite_termos, usuario_id } = parsed.data

  await validarReserva(supabase, { usuario_id, data_reserva, hora_inicio, hora_fim })

  const { data: existente } = await supabase
    .from('reservas').select('id')
    .eq('data_reserva', data_reserva).eq('hora_inicio', hora_inicio).eq('status', 'ativa')
    .limit(1)

  if (existente?.length) throw new ConflictError('Este horário já está reservado.')

  const { data, error } = await supabase
    .from('reservas')
    .insert([{ data_reserva, hora_inicio, hora_fim, aceite_termos, usuario_id, status: 'ativa' }])
    .select().single()

  if (error) throw new AppError(error.message, 500)
  return data
}

export async function cancelarReserva(supabase: SupabaseClient, id: string, body: unknown, canceladoPor?: string) {
  const parsed = cancelarReservaSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)

  const { data: reserva, error: fetchError } = await supabase
    .from('reservas')
    .select('usuario_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) throw new AppError(fetchError.message, 500)
  if (!reserva) throw new AppError('Reserva não encontrada.', 404)

  const { error } = await supabase
    .from('reservas')
    .update({ status: 'cancelada', motivo_cancelamento: parsed.data.motivo_cancelamento, cancelado_por: canceladoPor })
    .eq('id', id)

  if (error) throw new AppError(error.message, 500)

  if (reserva.usuario_id) {
    const { error: notifError } = await supabase
      .from('notificacoes')
      .insert({
        destinatario_id: reserva.usuario_id,
        mensagem: `Sua reserva foi cancelada. Motivo: ${parsed.data.motivo_cancelamento}`,
        lida: false,
      })

    if (notifError) console.error('[notificacao] erro ao inserir:', notifError.message)
  }
}

export async function listarHistoricoReservas(
  supabase: SupabaseClient,
  callerId: string,
  callerCargo: string,
  callerTorre: string | undefined,
  filters: unknown
) {
  if (!['SysAdmin', 'Síndico Geral', 'Subsíndico'].includes(callerCargo))
    throw new ForbiddenError('Acesso negado.')

  const parsed = historicoQuerySchema.safeParse(filters)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { inicio, fim, status, morador, page, pageSize } = parsed.data

  const seisMesesAtras = new Date()
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6)
  const dataInicio = inicio ?? seisMesesAtras.toISOString().split('T')[0]
  const dataFim = fim ?? new Date().toISOString().split('T')[0]

  let query = supabase
    .from('reservas')
    .select(`*,
      usuarios!usuario_id(nome_completo, foto_url, torre, apartamento),
      cancelado_por(nome_completo, torre, apartamento),
      porteiro_entrega:entregue_por(nome_completo),
      porteiro_recebimento:recebida_por(nome_completo)
    `, { count: 'exact' })
    .gte('data_reserva', dataInicio)
    .lte('data_reserva', dataFim)
    .order('data_reserva', { ascending: false })
    .order('hora_inicio', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (status !== 'todas') query = query.eq('status', status)
  if (callerCargo === 'Subsíndico' && callerTorre) {
    const { data: torreUserIds } = await supabase
      .from('usuarios').select('id').eq('torre', callerTorre)
    const ids = torreUserIds?.map(u => u.id) ?? []
    query = query.or(`usuario_id.in.(${ids.length > 0 ? ids.join(',') : '00000000-0000-0000-0000-000000000000'}),presencial_torre.eq.${callerTorre}`)
  }
  if (morador) {
    const { data: matchingUsers } = await supabase
      .from('usuarios').select('id').ilike('nome_completo', `%${morador}%`)
    const ids = matchingUsers?.map(u => u.id) ?? []
    if (ids.length === 0) return { data: [], total: 0, page }
    query = query.in('usuario_id', ids)
  }

  const { data, error, count } = await query
  if (error) throw new AppError(error.message, 500)

  return { data: data ?? [], total: count ?? 0, page }
}

export async function registrarChave(supabase: SupabaseClient, id: string, body: unknown, requesterId: string) {
  const parsed = chaveSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { acao, ocorrencia_texto } = parsed.data

  const { getTurnoAtual } = await import('@/lib/turno')
  const agora = new Date()
  const turno = getTurnoAtual()
  const novaTimestamp = agora.toISOString()

  const updatePayload: Record<string, string> = { turno_registro: turno }

  if (acao === 'entregar') {
    Object.assign(updatePayload, { status_chave: 'em_uso', retirada_em: novaTimestamp, entregue_por: requesterId })
  } else {
    Object.assign(updatePayload, { status_chave: 'concluida', devolvida_em: novaTimestamp, recebida_por: requesterId })
    if (ocorrencia_texto) updatePayload.ocorrencia_texto = ocorrencia_texto
  }

  const { data, error } = await supabase
    .from('reservas').update(updatePayload).eq('id', id).select('id, usuario_id, data_reserva, hora_inicio, hora_fim, status_chave').maybeSingle()

  if (error || !data) throw new NotFoundError('Reserva não encontrada.')

  // Notify the reservation owner
  const dataFormatada = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const horaFormatada = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  const notifMsg = acao === 'entregar'
    ? `Sua chave foi retirada na portaria em ${dataFormatada} às ${horaFormatada}.`
    : `Sua chave foi devolvida na portaria em ${dataFormatada} às ${horaFormatada}.${ocorrencia_texto ? ` Ocorrência registrada: ${ocorrencia_texto}` : ''}`

  await supabase.from('notificacoes').insert({
    mensagem: notifMsg,
    destinatario_id: data.usuario_id,
  })

  // Audit log
  await supabase.from('audit_logs').insert({
    perfil_id: requesterId,
    acao: `${acao}_chave`,
    detalhes: { reserva_id: id, usuario_id: data.usuario_id, horario: novaTimestamp, ocorrencia: ocorrencia_texto || null },
  })

  return data
}

export async function criarReservaPresencial(supabase: SupabaseClient, body: unknown, requesterId: string) {
  const parsed = reservaPresencialSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { presencial_nome, telefone_contato, presencial_torre, presencial_apt, presencial_bloco, presencial_documento, hora_inicio, hora_fim } = parsed.data

  const brtDate = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  const data_reserva = new Date(brtDate).toISOString().split('T')[0]

  await validarReserva(supabase, { usuario_id: requesterId, data_reserva, hora_inicio, hora_fim })

  const { data: conflitosReserva } = await supabase
    .from('reservas').select('hora_inicio, hora_fim')
    .eq('data_reserva', data_reserva).eq('status', 'ativa')

  for (const r of (conflitosReserva || [])) {
    if (hora_inicio < r.hora_fim && hora_fim > r.hora_inicio)
      throw new ConflictError('Horário já está ocupado.')
  }

  const { data: conflitosBloqueio } = await supabase
    .from('bloqueios').select('hora_inicio, hora_fim')
    .eq('data', data_reserva)

  for (const b of (conflitosBloqueio || [])) {
    if (hora_inicio < b.hora_fim && hora_fim > b.hora_inicio)
      throw new ConflictError('Horário está bloqueado.')
  }

  const { data, error } = await supabase
    .from('reservas')
    .insert([{
      usuario_id: requesterId, data_reserva, hora_inicio, hora_fim,
      status: 'ativa', status_chave: 'aguardando', aceite_termos: true,
      presencial_nome, telefone_contato, presencial_torre, presencial_apt, presencial_bloco, presencial_documento,
    }])
    .select().maybeSingle()

  if (error || !data) throw new AppError(error?.message || 'Erro ao criar reserva.', 500)
  return data
}

export async function validarReserva(supabase: SupabaseClient, body: unknown) {
  const parsed = validateReservaSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { usuario_id, data_reserva, hora_inicio, hora_fim } = parsed.data

  const [h1, m1] = hora_inicio.split(':').map(Number)
  const [h2, m2] = hora_fim.split(':').map(Number)
  const startMins = h1 * 60 + m1
  const endMins = h2 * 60 + m2

  if (startMins < 9 * 60 || endMins > 22 * 60) throw new ValidationError('A quadra só funciona das 09h às 22h.')
  if (startMins >= endMins) throw new ValidationError('Horário de início deve ser anterior ao fim.')

  const duracao = (endMins - startMins) / 60
  if (duracao > 2) throw new ValidationError('Uma única reserva não pode exceder 2 horas.')

  const { data: reservasDia } = await supabase
    .from('reservas').select('hora_inicio, hora_fim')
    .eq('usuario_id', usuario_id).eq('data_reserva', data_reserva).eq('status', 'ativa')

  let totalHoras = duracao
  for (const r of (reservasDia || [])) {
    const [rh1, rm1] = r.hora_inicio.split(':').map(Number)
    const [rh2, rm2] = r.hora_fim.split(':').map(Number)
    totalHoras += ((rh2 * 60 + rm2) - (rh1 * 60 + rm1)) / 60
  }
  if (totalHoras > 2.001) throw new ValidationError('Limite de 2 horas por dia por unidade excedido.')

  const { data: overlap } = await supabase
    .from('reservas').select('hora_inicio, hora_fim')
    .eq('data_reserva', data_reserva).eq('status', 'ativa')

  for (const r of (overlap || [])) {
    if (hora_inicio < r.hora_fim && hora_fim > r.hora_inicio)
      throw new ValidationError('Já existe uma reserva para este horário.')
  }

  return { status: 'valid' }
}
