'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  History, Search, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Loader2, XCircle, Calendar, X
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
  retirada_em: string | null
  devolvida_em: string | null
  ocorrencia_texto: string | null
  turno_registro: string | null
  created_at: string
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
  porteiro_entrega: { nome_completo: string } | null
  porteiro_recebimento: { nome_completo: string } | null
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
  const [token, setToken] = useState('')
  const [data, setData] = useState<ReservaHistorico[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [periodoInicio, setPeriodoInicio] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 6)
    return d.toISOString().split('T')[0]
  })
  const [periodoFim, setPeriodoFim] = useState(() => new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState<string>('todas')
  const [buscaInput, setBuscaInput] = useState('')
  const [busca, setBusca] = useState('')

  const pageSize = 20

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token)
    })
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setBusca(buscaInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [buscaInput])

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
              <input type="text" value={buscaInput}
                onChange={e => setBuscaInput(e.target.value)}
                placeholder="Nome..."
                className="w-full border border-gray-200 rounded-lg p-2 pl-8 pr-8 text-sm" />
              {buscaInput && (
                <button onClick={() => { setBuscaInput(''); setBusca(''); setPage(1) }}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

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
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3 text-sm">
                    {/* Morador + Contato */}
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
                    </div>

                    {/* Timeline da reserva */}
                    <div className="space-y-1.5">
                      <span className="text-gray-400 font-semibold text-xs block">Timeline</span>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                          <span className="text-gray-500">Reserva criada</span>
                          <span className="text-gray-400 ml-auto">
                            {new Date(reserva.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {reserva.retirada_em && (
                          <div className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                            <span className="text-gray-500">Chave retirada</span>
                            <span className="text-gray-400 ml-auto">
                              {new Date(reserva.retirada_em).toLocaleString('pt-BR')}
                            </span>
                            {reserva.porteiro_entrega && (
                              <span className="text-gray-400">• {reserva.porteiro_entrega.nome_completo}</span>
                            )}
                          </div>
                        )}
                        {reserva.devolvida_em && (
                          <div className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                            <span className="text-gray-500">Chave devolvida</span>
                            <span className="text-gray-400 ml-auto">
                              {new Date(reserva.devolvida_em).toLocaleString('pt-BR')}
                            </span>
                            {reserva.porteiro_recebimento && (
                              <span className="text-gray-400">• {reserva.porteiro_recebimento.nome_completo}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ocorrência */}
                    {reserva.ocorrencia_texto && (
                      <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        <span className="text-red-500 font-semibold text-xs">Ocorrência</span>
                        <p className="text-red-700 text-xs mt-0.5">{reserva.ocorrencia_texto}</p>
                      </div>
                    )}

                    {/* Cancelamento */}
                    {reserva.status === 'cancelada' && (
                      <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 space-y-1">
                        <div className="flex items-center gap-1 text-xs text-red-500 font-semibold">
                          <XCircle className="w-3 h-3" /> Cancelada
                        </div>
                        <p className="text-red-700 text-xs">
                          <strong>Motivo:</strong> {reserva.motivo_cancelamento ?? '—'}
                        </p>
                        <p className="text-red-700 text-xs">
                          <strong>Por:</strong> {reserva.cancelado_por
                            ? `${reserva.cancelado_por.nome_completo}${reserva.cancelado_por.torre ? ` (T${reserva.cancelado_por.torre})` : ''} (administração)`
                            : 'Morador (auto-cancelamento)'}
                        </p>
                      </div>
                    )}

                    {/* Detalhes extras */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {reserva.observacao && (
                        <div>
                          <span className="text-gray-400 font-semibold text-xs">Observação</span>
                          <p className="text-gray-700">{reserva.observacao}</p>
                        </div>
                      )}
                      {reserva.turno_registro && (
                        <div>
                          <span className="text-gray-400 font-semibold text-xs">Turno de registro</span>
                          <p className="text-gray-700">{reserva.turno_registro}</p>
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
