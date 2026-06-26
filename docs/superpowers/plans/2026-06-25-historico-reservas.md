# Histórico de Reservas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que Síndico Geral e Subsíndicos auditem o histórico de reservas da quadra.

**Architecture:** Nova rota `GET /api/reservas/historico` com service dedicado `listarHistoricoReservas`; nova página `/dashboard/historico` com tabela expansível + filtros. Migration adiciona coluna `cancelado_por` em `reservas`.

**Tech Stack:** Next.js 16, Supabase, Zod

---

### Task 1: Migration — coluna `cancelado_por`

**Files:**
- Create: `supabase/migrations/202606250001_add_cancelado_por.sql`

- [ ] **Step 1: Criar migration file**

```sql
-- Adiciona coluna para registrar quem cancelou a reserva
ALTER TABLE public.reservas
  ADD COLUMN cancelado_por uuid REFERENCES public.usuarios(id);
```

- [ ] **Step 2: Aplicar migration**

```bash
npx supabase migration up --project-ref bgkedrkyeofuwctiteuf
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202606250001_add_cancelado_por.sql
git commit -m "feat: migration cancelado_por em reservas"
```

---

### Task 2: Schema de query params (validators)

**Files:**
- Modify: `src/lib/validators.ts`

- [ ] **Step 1: Adicionar schema do filtro de histórico**

```typescript
export const historicoQuerySchema = z.object({
  inicio: z.string().regex(dateRegex, 'Formato deve ser YYYY-MM-DD').optional(),
  fim: z.string().regex(dateRegex, 'Formato deve ser YYYY-MM-DD').optional(),
  status: z.enum(['ativa', 'cancelada', 'todas']).optional().default('todas'),
  morador: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
})
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validators.ts
git commit -m "feat: schema historicoQuerySchema"
```

---

### Task 3: Service `listarHistoricoReservas` + atualizar `cancelarReserva`

**Files:**
- Modify: `src/lib/services/reserva.ts`

- [ ] **Step 1: Adicionar função `listarHistoricoReservas` em `reserva.ts`**

```typescript
import { historicoQuerySchema } from '@/lib/validators'

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
      cancelado_por!cancelado_por(nome_completo, torre, apartamento)
    `, { count: 'exact' })
    .gte('data_reserva', dataInicio)
    .lte('data_reserva', dataFim)
    .order('data_reserva', { ascending: false })
    .order('hora_inicio', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (status !== 'todas') query = query.eq('status', status)
  if (callerCargo === 'Subsíndico' && callerTorre) {
    query = query.not('status', 'eq', 'ativa') // Subsíndico vê histórico (não ativas de outras torres via o join)
    // Filtra pela torre do morador via subquery
    const { data: torreUserIds } = await supabase
      .from('usuarios').select('id').eq('torre', callerTorre)
    const ids = torreUserIds?.map(u => u.id) ?? []
    query = query.in('usuario_id', ids)
  }
  if (morador) {
    const { data: matchingUsers } = await supabase
      .from('usuarios').select('id').ilike('nome_completo', `%${morador}%`)
    const ids = matchingUsers?.map(u => u.id) ?? []
    query = query.in('usuario_id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'])
  }

  const { data, error, count } = await query
  if (error) throw new AppError(error.message, 500)

  return { data: data ?? [], total: count ?? 0, page }
}
```

- [ ] **Step 2: Atualizar `cancelarReserva` para registrar `cancelado_por`**

```typescript
export async function cancelarReserva(supabase: SupabaseClient, id: string, body: unknown, canceladoPor: string) {
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
    .update({
      status: 'cancelada',
      motivo_cancelamento: parsed.data.motivo_cancelamento,
      cancelado_por: canceladoPor,
    })
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
```

- [ ] **Step 3: Atualizar chamada de `cancelarReserva` no handler da PATCH**

```typescript
await cancelarReserva(supabase, id, body, user.id)
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/reserva.ts
git commit -m "feat: listarHistoricoReservas + cancelado_por"
```

---

### Task 4: Rota `GET /api/reservas/historico`

**Files:**
- Create: `src/app/api/reservas/historico/route.ts`

- [ ] **Step 1: Criar o handler da rota**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { listarHistoricoReservas, AppError } from '@/lib/services/reserva';
import { createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const normalLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export async function GET(request: NextRequest) {
  try {
    const rl = normalLimiter.check(request);
    if (rl) return rl;

    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

    const { data: caller } = await supabase
      .from('usuarios').select('id, cargo, torre').eq('id', user.id).maybeSingle();
    if (!caller) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 401 });

    const filters = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await listarHistoricoReservas(
      supabase, caller.id, caller.cargo, caller.torre, filters
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[api/reservas/historico]', e);
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/reservas/historico/route.ts
git commit -m "feat: rota GET /api/reservas/historico"
```

---

### Task 5: Card "Histórico de Reservas" no Dashboard

**Files:**
- Modify: `src/app/(authenticated)/dashboard/page.tsx`

- [ ] **Step 1: Adicionar import do ícone `ClipboardList` (ou usar `History`)**

Na seção de imports, adicionar `History` de `lucide-react`.

- [ ] **Step 2: Adicionar card na grade admin (após Gestão de Usuários)**

```tsx
{isAdmin && (
  <Link
    href="/dashboard/historico"
    className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4 hover:border-violet-300 hover:shadow-md transition-all group"
  >
    <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
      <History className="w-6 h-6 text-emerald-600" />
    </div>
    <div className="flex-1">
      <h2 className="text-sm font-semibold text-gray-700 group-hover:text-emerald-700 transition-colors">
        Histórico de Reservas
      </h2>
      <p className="text-xs text-gray-400 mt-0.5">
        Visualizar reservas passadas e cancelamentos
      </p>
    </div>
    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-400 transition-colors" />
  </Link>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authenticated\)/dashboard/page.tsx
git commit -m "feat: card Historico de Reservas no dashboard"
```

---

### Task 6: Página `/dashboard/historico`

**Files:**
- Create: `src/app/(authenticated)/dashboard/historico/page.tsx`

- [ ] **Step 1: Criar página com tabela + filtros + paginação + linha expansível**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  History, Search, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Loader2, XCircle, Calendar
} from 'lucide-react'
import Link from 'next/link'

interface ReservaHistorico {
  id: string
  data_reserva: string
  hora_inicio: string
  hora_fim: string
  status: string
  motivo_cancelamento: string | null
  observacao: string | null
  telefone_contato: string | null
  status_chave: string | null
  usuarios: {
    nome_completo: string
    foto_url: string | null
    torre: string | null
    apartamento: string | null
  } | null
  cancelado_por: {
    nome_completo: string
    torre: string | null
    apartamento: string | null
  } | null
}

const STATUS_OPCOES = ['todas', 'ativa', 'cancelada'] as const

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatTime(t: string) {
  return t.slice(0, 5)
}

export default function HistoricoPage() {
  const [currentUser, setCurrentUser] = useState<{ cargo: string; torre: string } | null>(null)
  const [token, setToken] = useState('')
  const [data, setData] = useState<ReservaHistorico[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filters
  const [periodoInicio, setPeriodoInicio] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 6)
    return d.toISOString().split('T')[0]
  })
  const [periodoFim, setPeriodoFim] = useState(() => new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState<string>('todas')
  const [busca, setBusca] = useState('')

  const pageSize = 20

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setToken(session.access_token)
        supabase.from('usuarios').select('cargo, torre').eq('id', session.user.id).single()
          .then(({ data }) => { if (data) setCurrentUser(data) })
      }
    })
  }, [])

  const fetchHistorico = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        inicio: periodoInicio, fim: periodoFim,
        status: statusFilter, page: String(page), pageSize: String(pageSize),
      })
      if (busca.trim()) params.set('morador', busca.trim())

      const res = await fetch(`/api/reservas/historico?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Erro ao carregar histórico')
      const json = await res.json()
      setData(json.data)
      setTotal(json.total)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [token, periodoInicio, periodoFim, statusFilter, busca, page])

  useEffect(() => { if (token) fetchHistorico() }, [token, fetchHistorico])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard" className="text-xs text-violet-500 hover:text-violet-700 font-semibold">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-black text-gray-800 mt-1 flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-600" />
            Histórico de Reservas
          </h1>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">De</label>
            <input type="date" value={periodoInicio} onChange={e => { setPeriodoInicio(e.target.value); setPage(1) }}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Até</label>
            <input type="date" value={periodoFim} onChange={e => { setPeriodoFim(e.target.value); setPage(1) }}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Status</label>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm">
              {STATUS_OPCOES.map(s => (
                <option key={s} value={s}>{s === 'todas' ? 'Todas' : s === 'ativa' ? 'Ativa' : 'Cancelada'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Buscar morador</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
              <input type="text" value={busca} onChange={e => { setBusca(e.target.value); setPage(1) }}
                placeholder="Nome..."
                className="w-full border border-gray-200 rounded-lg p-2 pl-8 text-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-400 font-semibold">Nenhuma reserva encontrada.</div>
      ) : (
        <div className="space-y-2">
          {data.map(reserva => {
            const isExpanded = expandedId === reserva.id
            return (
              <div key={reserva.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-sm">
                {/* Linha principal */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : reserva.id)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                        {formatDate(reserva.data_reserva)}
                      </span>
                      <span className="text-sm text-gray-500 whitespace-nowrap">
                        {formatTime(reserva.hora_inicio)} - {formatTime(reserva.hora_fim)}
                      </span>
                    </div>
                    {reserva.usuarios && (
                      <span className="text-sm text-gray-600 truncate hidden sm:block">
                        {reserva.usuarios.nome_completo}
                        {reserva.usuarios.torre && ` • T${reserva.usuarios.torre}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                      reserva.status === 'ativa'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-red-50 text-red-600'
                    }`}>
                      {reserva.status === 'ativa' ? 'Ativa' : 'Cancelada'}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>
                {/* Detalhes expandidos */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2 text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <span className="text-gray-400 font-semibold text-xs">Morador</span>
                        <p className="text-gray-700">
                          {reserva.usuarios?.nome_completo ?? '—'}
                          {reserva.usuarios?.torre && ` (T${reserva.usuarios.torre}`}
                          {reserva.usuarios?.apartamento ? `, Apto ${reserva.usuarios.apartamento})` : reserva.usuarios?.torre ? ')' : ''}
                        </p>
                      </div>
                      {reserva.telefone_contato && (
                        <div>
                          <span className="text-gray-400 font-semibold text-xs">Telefone</span>
                          <p className="text-gray-700">{reserva.telefone_contato}</p>
                        </div>
                      )}
                      {reserva.observacao && (
                        <div>
                          <span className="text-gray-400 font-semibold text-xs">Observação</span>
                          <p className="text-gray-700">{reserva.observacao}</p>
                        </div>
                      )}
                      {reserva.status === 'cancelada' && (
                        <>
                          <div>
                            <span className="text-gray-400 font-semibold text-xs flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-red-400" /> Motivo do cancelamento
                            </span>
                            <p className="text-gray-700">{reserva.motivo_cancelamento ?? '—'}</p>
                          </div>
                          {reserva.cancelado_por && (
                            <div>
                              <span className="text-gray-400 font-semibold text-xs">Cancelado por</span>
                              <p className="text-gray-700">
                                {reserva.cancelado_por.nome_completo}
                                {reserva.cancelado_por.torre && ` (T${reserva.cancelado_por.torre})`}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                      {reserva.status_chave && reserva.status_chave !== 'aguardando' && (
                        <div>
                          <span className="text-gray-400 font-semibold text-xs">Chave</span>
                          <p className="text-gray-700 capitalize">{reserva.status_chave}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 text-gray-400 hover:text-violet-600 disabled:opacity-30">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-500 font-semibold">
            Página {page} de {totalPages} ({total} registros)
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-2 text-gray-400 hover:text-violet-600 disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(authenticated\)/dashboard/historico/page.tsx
git commit -m "feat: pagina /dashboard/historico"
```

---

### Task 7: Build + Deploy

- [ ] **Step 1: Build para verificar erros**

```bash
npm run build 2>&1
```

Expected: 0 errors, page `○ /dashboard/historico` aparece no output.

- [ ] **Step 2: Push para GitHub**

```bash
git push
```

Vercel auto-deploy.
