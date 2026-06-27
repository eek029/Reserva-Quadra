'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Trash2, ShieldAlert, Loader2, CheckCircle, XCircle,
  Clock, Search, AlertTriangle
} from 'lucide-react';

interface Solicitacao {
  id: string;
  usuario_id: string;
  motivo: string;
  status: string;
  created_at: string;
  usuarios: {
    nome_completo: string;
    torre: string;
    apartamento: string;
  };
}

type Tab = 'pendente' | 'aprovado' | 'rejeitado';

export default function SolicitacoesExclusaoPage() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('pendente');
  const [processing, setProcessing] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; nome: string } | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setCurrentUser({ id: session.user.id });
    });
  }, []);

  const getAuthHeaders = useCallback(() => {
    const csrf = document.cookie
      .split('; ')
      .find(c => c.startsWith('csrf-token='))
      ?.split('=')[1];
    return {
      'Content-Type': 'application/json',
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    };
  }, []);

  const fetchSolicitacoes = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/privacy/solicitacoes', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    });

    if (res.ok) {
      const data = await res.json();
      setSolicitacoes(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchSolicitacoes();
  }, [fetchSolicitacoes]);

  const handleAprovar = async (id: string) => {
    setProcessing(id);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/privacy/${id}/aprovar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          ...getAuthHeaders(),
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao aprovar.');
      }

      setSolicitacoes(prev => prev.map(s =>
        s.id === id ? { ...s, status: 'aprovado' } : s
      ));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao aprovar solicitação.');
    }
    setProcessing(null);
  };

  const handleRejeitar = async () => {
    if (!rejectModal) return;
    setProcessing(rejectModal.id);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/privacy/${rejectModal.id}/rejeitar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ motivo: rejectMotivo || 'Solicitação rejeitada pela administração.' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao rejeitar.');
      }

      setSolicitacoes(prev => prev.map(s =>
        s.id === rejectModal.id ? { ...s, status: 'rejeitado' } : s
      ));
      setRejectModal(null);
      setRejectMotivo('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao rejeitar solicitação.');
    }
    setProcessing(null);
  };

  const filtered = solicitacoes.filter(s => s.status === activeTab);

  const tabCounts = {
    pendente: solicitacoes.filter(s => s.status === 'pendente').length,
    aprovado: solicitacoes.filter(s => s.status === 'aprovado').length,
    rejeitado: solicitacoes.filter(s => s.status === 'rejeitado').length,
  };

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <ShieldAlert className="w-6 h-6 text-violet-600" />
          <h1 className="text-2xl font-bold text-gray-900">Solicitações de Exclusão (LGPD)</h1>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-sm text-red-700">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-100">
            <div className="flex">
              {(['pendente', 'aprovado', 'rejeitado'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
                    activeTab === tab
                      ? 'text-violet-700 bg-violet-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    {tab === 'pendente' && <Clock className="w-4 h-4" />}
                    {tab === 'aprovado' && <CheckCircle className="w-4 h-4" />}
                    {tab === 'rejeitado' && <XCircle className="w-4 h-4" />}
                    {tab === 'pendente' ? 'Pendentes' : tab === 'aprovado' ? 'Aprovadas' : 'Rejeitadas'}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      tab === 'pendente' ? 'bg-amber-100 text-amber-700' :
                      tab === 'aprovado' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {tabCounts[tab]}
                    </span>
                  </span>
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">
                  {activeTab === 'pendente'
                    ? 'Nenhuma solicitação pendente.'
                    : activeTab === 'aprovado'
                    ? 'Nenhuma solicitação aprovada.'
                    : 'Nenhuma solicitação rejeitada.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map(s => (
                  <div
                    key={s.id}
                    className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">
                            {s.usuarios?.nome_completo || 'Usuário'}
                          </h3>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            s.status === 'pendente' ? 'bg-amber-100 text-amber-700' :
                            s.status === 'aprovado' ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {s.status === 'pendente' ? 'Pendente' :
                             s.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}
                          </span>
                        </div>
                        {s.usuarios && (
                          <p className="text-xs text-gray-500 mb-2">
                            Torre {s.usuarios.torre}, Apto {s.usuarios.apartamento}
                          </p>
                        )}
                        {s.motivo && (
                          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded-lg mb-2">
                            "{s.motivo}"
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          Solicitado em {new Date(s.created_at).toLocaleDateString('pt-BR')} às {new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {s.status === 'pendente' && (
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleAprovar(s.id)}
                            disabled={processing === s.id}
                            className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors text-sm disabled:opacity-50"
                          >
                            {processing === s.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Aprovar
                          </button>
                          <button
                            onClick={() => setRejectModal({ id: s.id, nome: s.usuarios?.nome_completo || 'Usuário' })}
                            disabled={processing === s.id}
                            className="flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-700 py-2 px-4 rounded-lg font-medium transition-colors text-sm disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Rejeitar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="font-semibold text-gray-900 text-lg mb-2">Rejeitar Solicitação</h3>
            <p className="text-sm text-gray-600 mb-4">
              Tem certeza que deseja rejeitar a solicitação de <strong>{rejectModal.nome}</strong>?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo da rejeição (opcional)
              </label>
              <textarea
                value={rejectMotivo}
                onChange={e => setRejectMotivo(e.target.value)}
                placeholder="Ex: Dados necessários para auditoria em andamento..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 text-sm"
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setRejectModal(null); setRejectMotivo(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleRejeitar}
                disabled={processing === rejectModal.id}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
              >
                {processing === rejectModal.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
