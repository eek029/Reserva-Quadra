import { z, ZodError } from 'zod'

export function zodMsg(result: { success: boolean; error?: ZodError }): string | null {
  if (result.success) return null
  return result.error!.issues[0]?.message ?? 'Dados inválidos'
}

export const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/
export const dateRegex = /^\d{4}-\d{2}-\d{2}$/
export const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/
export const rgRegex = /^\d{1,2}\.\d{3}\.\d{3}-[\dX]$/
export const telefoneRegex = /^\(\d{2}\) (?:\d{4}-\d{4}|\d{5}-\d{4})$/

export const criarReservaSchema = z.object({
  data_reserva: z.string().regex(dateRegex, 'Formato deve ser YYYY-MM-DD'),
  hora_inicio: z.string().regex(timeRegex, 'Formato deve ser HH:MM'),
  hora_fim: z.string().regex(timeRegex, 'Formato deve ser HH:MM'),
  aceite_termos: z.boolean().optional().default(true),
  usuario_id: z.string().uuid('usuario_id deve ser um UUID válido'),
})

export const reservaPresencialSchema = z.object({
  observacao: z.string().min(1, 'Observação é obrigatória'),
  telefone_contato: z.string().regex(telefoneRegex, 'Telefone deve estar no formato (XX) XXXXX-XXXX ou (XX) XXXX-XXXX'),
  hora_inicio: z.string().regex(timeRegex, 'Formato deve ser HH:MM'),
  hora_fim: z.string().regex(timeRegex, 'Formato deve ser HH:MM'),
})

export const cancelarReservaSchema = z.object({
  motivo_cancelamento: z.string().min(1, 'Motivo é obrigatório'),
})

export const chaveSchema = z.object({
  acao: z.enum(['entregar', 'receber'], { message: "Ação deve ser 'entregar' ou 'receber'" }),
  ocorrencia_texto: z.string().optional(),
})

export const criarBloqueioSchema = z.object({
  data: z.string().regex(dateRegex, 'Formato deve ser YYYY-MM-DD'),
  slots: z.array(z.object({
    hora_inicio: z.string().regex(timeRegex),
    hora_fim: z.string().regex(timeRegex),
  })).min(1, 'Pelo menos um slot é obrigatório'),
  motivo: z.enum(['Chuva', 'Manutenção'], { message: "Motivo deve ser 'Chuva' ou 'Manutenção'" }),
})

export const criarUsuarioSchema = z.object({
  nome_completo: z.string().min(1, 'Nome é obrigatório'),
  data_nascimento: z.string().regex(dateRegex, 'Formato deve ser YYYY-MM-DD'),
  telefone: z.string().regex(telefoneRegex, 'Telefone deve estar no formato (XX) XXXXX-XXXX ou (XX) XXXX-XXXX'),
  apartamento: z.string().nullable().optional(),
  torre: z.string().nullable().optional(),
  bloco: z.string().nullable().optional(),
  foto_url: z.string().nullable().optional(),
  cargo: z.string().optional(),
  rg: z.string().regex(rgRegex, 'RG deve estar no formato XX.XXX.XXX-X'),
  cpf: z.string().regex(cpfRegex, 'CPF deve estar no formato XXX.XXX.XXX-XX'),
})

export const atualizarUsuarioSchema = z.object({
  status: z.enum(['aprovado', 'rejeitado', 'pendente']).optional(),
  suspenso_ate: z.string().nullable().optional(),
})

export const dataQuerySchema = z.string().regex(dateRegex, 'Formato deve ser YYYY-MM-DD').optional()
export const statusQuerySchema = z.enum(['pendente', 'aprovado', 'rejeitado']).optional()

export const validateReservaSchema = z.object({
  usuario_id: z.string().uuid(),
  data_reserva: z.string().regex(dateRegex, 'Formato deve ser YYYY-MM-DD'),
  hora_inicio: z.string().regex(timeRegex, 'Formato deve ser HH:MM'),
  hora_fim: z.string().regex(timeRegex, 'Formato deve ser HH:MM'),
})

export const historicoQuerySchema = z.object({
  inicio: z.string().regex(dateRegex, 'Formato deve ser YYYY-MM-DD').optional(),
  fim: z.string().regex(dateRegex, 'Formato deve ser YYYY-MM-DD').optional(),
  status: z.enum(['ativa', 'cancelada', 'todas']).optional().default('todas'),
  morador: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// UUID Validation Helper
export const uuidSchema = z.string().uuid('ID deve ser um UUID válido')

export function validateUUID(id: string): { valid: boolean; error?: string } {
  const result = uuidSchema.safeParse(id)
  if (!result.success) {
    return { valid: false, error: result.error.issues[0]?.message }
  }
  return { valid: true }
}
