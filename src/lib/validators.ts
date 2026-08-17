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
  presencial_nome: z.string().min(3, 'Nome do morador e obrigatorio'),
  telefone_contato: z.string().regex(telefoneRegex, 'Telefone deve estar no formato (XX) XXXXX-XXXX ou (XX) XXXX-XXXX'),
  presencial_torre: z.enum(['1', '2', '3', '4', '5'], { message: 'Torre invalida' }),
  presencial_apt: z.string().min(1, 'Apartamento e obrigatorio'),
  presencial_bloco: z.enum(['A', 'B']).optional().nullable(),
  presencial_documento: z.string().min(3, 'Documento deve ter ao menos 3 caracteres').optional().nullable(),
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

const FOTO_DATA_URI_MAX = 1_500_000
const FOTO_DATA_URI_RE = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/

export const fotoPerfilSchema = z.string().min(1, 'A foto de perfil é obrigatória.').refine((value) => {
  if (FOTO_DATA_URI_RE.test(value)) {
    return value.length >= 100 && value.length <= FOTO_DATA_URI_MAX
  }
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && value.length <= 2048
  } catch {
    return false
  }
}, 'Envie uma foto válida (JPEG, PNG ou WebP).')

export function temFotoPerfil(foto?: string | null): boolean {
  return typeof foto === 'string' && foto.trim().length > 0
}

export const criarUsuarioSchema = z.object({
  nome_completo: z.string().min(1, 'Nome é obrigatório'),
  data_nascimento: z.string().regex(dateRegex, 'Formato deve ser YYYY-MM-DD'),
  telefone: z.string().regex(telefoneRegex, 'Telefone deve estar no formato (XX) XXXXX-XXXX ou (XX) XXXX-XXXX'),
  apartamento: z.string().nullable().optional(),
  torre: z.string().nullable().optional(),
  bloco: z.string().nullable().optional(),
  foto_url: fotoPerfilSchema,
  cargo: z.string().optional(),
  rg: z.string().regex(rgRegex, 'RG deve estar no formato XX.XXX.XXX-X'),
  cpf: z.string().regex(cpfRegex, 'CPF deve estar no formato XXX.XXX.XXX-XX'),
})

export const atualizarUsuarioSchema = z.object({
  status: z.enum(['aprovado', 'rejeitado', 'pendente']).optional(),
  suspenso_ate: z.string().nullable().optional(),
  nome_completo: z.string().min(3).optional(),
  cpf: z.string().regex(cpfRegex, 'CPF deve estar no formato XXX.XXX.XXX-XX').optional(),
  rg: z.string().regex(rgRegex, 'RG deve estar no formato XX.XXX.XXX-X').optional(),
  foto_url: z.string().url().optional(),
})

export const dataQuerySchema = z.string().regex(dateRegex, 'Formato deve ser YYYY-MM-DD').optional()
export const statusQuerySchema = z.enum(['pendente', 'aprovado', 'rejeitado', 'todos']).optional()

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
