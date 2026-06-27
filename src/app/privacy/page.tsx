'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, ShieldAlert, Trash2, Download, Eye, EyeOff,
  CheckCircle, XCircle, Clock, AlertTriangle, Loader2, FileJson, History
} from 'lucide-react';

interface DadosUsuario {
  nome_completo: string;
  data_nascimento: string;
  telefone: string;
  apartamento: string;
  torre: string;
  bloco?: string;
  cargo: string;
  status: string;
  cpf: string;
  rg: string;
}

interface Solicitacao {
  id: string;
  status: string;
  created_at: string;
  motivo?: string;
}

interface SolicitacaoAdmin extends Solicitacao {
  usuarios: { nome_completo: string; torre: string; apartamento: string };
}

export default function PrivacyPage() {
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<DadosUsuario | null>(null);
  const [dadosError, setDadosError] = useState('');
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [showCpfRg, setShowCpfRg] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });
  }, []);

  const getAuthHeaders = useCallback(() => {
    if (!session) return {};
    const csrf = document.cookie
      .split('; ')
      .find(c => c.startsWith('csrf-token='))
      ?.split('=')[1];
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;

    fetch('/api/privacy/dados', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setDados)
      .catch(() => setDadosError('Erro ao carregar dados.'));

    fetch('/api/privacy/solicitacoes', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    })
      .then(r => r.ok ? r.json() : [])
      .then(setSolicitacoes)
      .catch(() => {});
  }, [session]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const csrf = document.cookie
        .split('; ')
        .find(c => c.startsWith('csrf-token='))
        ?.split('=')[1];

      const res = await fetch('/api/privacy/download', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: '{}',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao baixar dados.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meus-dados-reserva-quadra-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setDadosError(e instanceof Error ? e.message : 'Erro ao baixar dados.');
    }
    setIsDownloading(false);
  };

  const handleDeleteRequest = async () => {
    if (!session) return;
    setIsDeleting(true);
    setDeleteError('');

    try {
      const csrf = document.cookie
        .split('; ')
        .find(c => c.startsWith('csrf-token='))
        ?.split('=')[1];

      const res = await fetch('/api/privacy/excluir', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify({ motivo: 'Solicitação via portal de privacidade.' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao solicitar exclusão.');
      }

      setDeleteSuccess(true);
      setShowDeleteConfirm(false);

      const r = await fetch('/api/privacy/solicitacoes', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (r.ok) setSolicitacoes(await r.json());
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Erro ao solicitar exclusão.');
    }
    setIsDeleting(false);
  };

  const maskCpf = (cpf: string) => cpf ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}` : '';
  const maskRg = (rg: string) => rg ? `${rg.slice(0, 2)}.***.***-${rg.slice(-1)}` : '';

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pendente': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'aprovado': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejeitado': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pendente': return 'Pendente';
      case 'aprovado': return 'Aprovado';
      case 'rejeitado': return 'Rejeitado';
      default: return status;
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link
            href={session ? '/dashboard' : '/'}
            className="flex items-center text-violet-600 hover:text-violet-500 font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Privacidade & LGPD</h1>
        </div>

        {dadosError && (
          <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-sm text-red-700">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {dadosError}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="p-6 md:p-8 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2 text-violet-600" />
                Como tratamos seus dados
              </h2>
              <div className="text-sm text-gray-600 space-y-3 leading-relaxed">
                <p>
                  O aplicativo <strong>Reserva Quadra - Condomínio Júlio Prestes</strong> coleta as seguintes informações
                  obrigatoriamente para fins de segurança e organização do condomínio: Nome, Data de Nascimento,
                  Telefone, RG, CPF, Torre e Apartamento.
                </p>
                <p>
                  Seus dados sensíveis (como RG e CPF) são armazenados sob <strong>criptografia AES-256</strong> em nossos servidores
                  e só podem ser acessados por autoridade administrativa (Síndico Geral) mediante necessidades específicas.
                  Todo acesso a esses dados gera um log de auditoria inalterável.
                </p>
              </div>
            </section>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
          </div>
        )}

        {session && dados && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
              <div className="p-6 md:p-8 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Eye className="w-5 h-5 mr-2 text-violet-600" />
                  Meus Dados Armazenados
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="text-gray-500 text-xs">Nome Completo</span>
                    <p className="font-medium text-gray-900 mt-0.5">{dados.nome_completo}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="text-gray-500 text-xs">Data de Nascimento</span>
                    <p className="font-medium text-gray-900 mt-0.5">
                      {dados.data_nascimento ? new Date(dados.data_nascimento).toLocaleDateString('pt-BR') : '-'}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="text-gray-500 text-xs">Telefone</span>
                    <p className="font-medium text-gray-900 mt-0.5">{dados.telefone}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="text-gray-500 text-xs">Torre / Apartamento</span>
                    <p className="font-medium text-gray-900 mt-0.5">Torre {dados.torre}, Apto {dados.apartamento}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="text-gray-500 text-xs">Cargo</span>
                    <p className="font-medium text-gray-900 mt-0.5">{dados.cargo}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="text-gray-500 text-xs">Status do Cadastro</span>
                    <p className="font-medium text-gray-900 mt-0.5 capitalize">{dados.status}</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-amber-800">Documentos (CPF / RG)</span>
                      <p className="text-xs text-amber-600 mt-0.5">
                        {showCpfRg
                          ? 'Dados visíveis apenas para você. Não compartilhe.'
                          : 'Clique para revelar seus documentos'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCpfRg(!showCpfRg)}
                      className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-800 font-medium"
                    >
                      {showCpfRg ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showCpfRg ? 'Ocultar' : 'Revelar'}
                    </button>
                  </div>
                  {showCpfRg && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="bg-white p-2 rounded border border-amber-100">
                        <span className="text-xs text-gray-500">CPF</span>
                        <p className="font-mono text-sm font-medium">{dados.cpf || maskCpf('00000000000')}</p>
                      </div>
                      <div className="bg-white p-2 rounded border border-amber-100">
                        <span className="text-xs text-gray-500">RG</span>
                        <p className="font-mono text-sm font-medium">{dados.rg || maskRg('000000000')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
              <div className="p-6 md:p-8 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FileJson className="w-5 h-5 mr-2 text-violet-600" />
                  Portabilidade de Dados (LGPD Art. 18)
                </h2>
                <p className="text-sm text-gray-600">
                  Você tem o direito de solicitar a exportação de todos os seus dados armazenados
                  em formato JSON estruturado, incluindo: dados cadastrais, histórico de reservas e
                  solicitações.
                </p>
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white py-2 px-6 rounded-lg font-medium transition-colors text-sm disabled:opacity-50"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isDownloading ? 'Gerando...' : 'Baixar Meus Dados (JSON)'}
                </button>
              </div>
            </div>

            {solicitacoes.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
                <div className="p-6 md:p-8 space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <History className="w-5 h-5 mr-2 text-violet-600" />
                    Histórico de Solicitações
                  </h2>
                  <div className="space-y-3">
                    {solicitacoes.map(s => (
                      <div key={s.id} className="flex items-start gap-3 bg-gray-50 p-4 rounded-xl">
                        <div className="mt-0.5">{statusIcon(s.status)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              s.status === 'pendente' ? 'bg-amber-100 text-amber-700' :
                              s.status === 'aprovado' ? 'bg-green-100 text-green-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {statusLabel(s.status)}
                            </span>
                          </div>
                          {s.motivo && (
                            <p className="text-xs text-gray-500 mt-1">Motivo: {s.motivo}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(s.created_at).toLocaleDateString('pt-BR')} às {new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
              <div className="bg-red-50 p-6 md:p-8">
                <h2 className="text-lg font-semibold text-red-700 mb-2 flex items-center">
                  <Trash2 className="w-5 h-5 mr-2" />
                  Excluir ou Anonimizar Dados
                </h2>
                <p className="text-sm text-red-600 mb-6">
                  Em conformidade com a LGPD, você tem o direito de solicitar a exclusão da sua conta e
                  anonimização dos seus dados pessoais. Note que isso o impedirá de acessar o sistema de
                  reservas permanentemente.
                </p>

                {deleteSuccess ? (
                  <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-800 text-sm">Solicitação enviada com sucesso!</p>
                      <p className="text-xs text-green-700 mt-1">
                        A administração analisará seu pedido. Você receberá uma notificação com o resultado.
                      </p>
                    </div>
                  </div>
                ) : !showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="bg-white text-red-600 border border-red-200 hover:bg-red-100 py-2 px-6 rounded-lg font-medium transition-colors text-sm"
                  >
                    Solicitar Exclusão de Conta
                  </button>
                ) : (
                  <div className="bg-white p-4 rounded-lg border border-red-200 animate-in fade-in slide-in-from-top-2">
                    <p className="font-semibold text-gray-800 text-sm mb-3">
                      Tem certeza que deseja solicitar a exclusão dos seus dados?
                    </p>
                    <p className="text-xs text-gray-500 mb-4">
                      Esta ação é irreversível. Sua conta será removida permanentemente após aprovação da administração.
                      Todas as suas reservas serão anonimizadas.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleDeleteRequest}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700 text-white py-2 px-6 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
                      >
                        {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isDeleting ? 'Enviando...' : 'Confirmar Solicitação'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isDeleting}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-medium transition-colors text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {deleteError && (
                  <div className="mt-4 bg-red-50 border border-red-200 p-3 rounded-lg flex items-start gap-2 text-sm text-red-700">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {deleteError}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
