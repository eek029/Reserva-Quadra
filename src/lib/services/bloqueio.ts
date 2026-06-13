import type { SupabaseClient } from '@supabase/supabase-js'
import { criarBloqueioSchema } from '@/lib/validators'
import { AppError, ValidationError } from './reserva'
export { AppError, ValidationError }

export async function listarBloqueios(supabase: SupabaseClient, data?: string) {
  let query = supabase.from('bloqueios').select('*').order('hora_inicio', { ascending: true })
  if (data) query = query.eq('data', data)
  const { data: result, error } = await query
  if (error) throw new AppError(error.message, 500)
  return result || []
}

export async function criarBloqueio(supabase: SupabaseClient, userId: string, body: unknown) {
  const parsed = criarBloqueioSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { data, slots, motivo } = parsed.data

  const bloqueios = slots.map(s => ({
    data, hora_inicio: s.hora_inicio, hora_fim: s.hora_fim, motivo, criado_por: userId,
  }))

  const { error: insertError } = await supabase.from('bloqueios').insert(bloqueios)
  if (insertError) throw new AppError(insertError.message, 500)

  for (const slot of slots) {
    const { data: conflitos } = await supabase
      .from('reservas').select('id')
      .eq('data_reserva', data).eq('hora_inicio', slot.hora_inicio).eq('status', 'ativa')

    if (conflitos?.length) {
      await supabase.from('reservas')
        .update({ status: 'cancelada', motivo_cancelamento: `Bloqueado — ${motivo}` })
        .in('id', conflitos.map(r => r.id))
    }
  }

  return { ok: true }
}

export async function removerBloqueio(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('bloqueios').delete().eq('id', id)
  if (error) throw new AppError(error.message, 500)
}
