'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCsrfToken } from '@/lib/csrf-client';
import { ShieldCheck, Check, X, User, Eye, EyeOff, Loader2, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

interface UsuarioInfo {
    id: string;
    nome_completo: string;
    cargo: string;
    torre: string;
    apartamento: string;
    foto_url?: string;
}

interface Solicitacao {
    id: string;
    usuario_id: string;
    novo_nome: string | null;
    novo_cpf: string | null;
    nova_foto_url: string | null;
    status: string;
    created_at: string;
    usuarios: UsuarioInfo | null;
}

interface CurrentUser {
    id: string;
    cargo: string;
    torre: string;
}

interface RequestState {
    id: string;
    currentNome: string;
    currentCpf: string | null;
    showCurrentCpf: boolean;
    showNewCpf: boolean;
}

const ADMIN_CARGOS = ['SysAdmin', 'Síndico Geral', 'Subsíndico'];

function maskCpf(cpf: string): string {
    const nums = cpf.replace(/\D/g, '');
    if (nums.length !== 11) return '•••.•••.•••-••';
    return `•••.${nums.slice(3, 6)}.${nums.slice(6, 9)}-••`;
}

export default function RevisaoPerfilPage() {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [requests, setRequests] = useState<Solicitacao[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [decryptedCpfs, setDecryptedCpfs] = useState<Record<string, string>>({});
    const [visibleCpfCurrent, setVisibleCpfCurrent] = useState<Record<string, boolean>>({});
    const [visibleCpfNew, setVisibleCpfNew] = useState<Record<string, boolean>>({});
    const [expandedCard, setExpandedCard] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: me } = await supabase
            .from('usuarios')
            .select('id, cargo, torre')
            .eq('id', session.user.id)
            .single();

        if (!me || !ADMIN_CARGOS.includes(me.cargo)) {
            setIsLoading(false);
            return;
        }

        setCurrentUser(me);

        let query = supabase
            .from('solicitacoes_perfil')
            .select('*, usuarios(nome_completo, cargo, torre, apartamento, foto_url)')
            .eq('status', 'pendente')
            .order('created_at', { ascending: true });

        if (me.cargo === 'Subsíndico') {
            query = query.eq('usuarios.torre', me.torre);
        }

        const { data } = await query;
        if (data) {
            setRequests(data.filter((d: Solicitacao) => d.usuarios !== null));
        }
        setIsLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const toggleCurrentCpf = async (solicitacaoId: string, usuarioId: string) => {
        if (visibleCpfCurrent[solicitacaoId]) {
            setVisibleCpfCurrent(prev => ({ ...prev, [solicitacaoId]: false }));
            return;
        }

        if (decryptedCpfs[usuarioId]) {
            setVisibleCpfCurrent(prev => ({ ...prev, [solicitacaoId]: true }));
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || '';
            const res = await fetch(`/api/usuarios/${usuarioId}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (!res.ok) return;
            const data = await res.json();

            setDecryptedCpfs(prev => ({ ...prev, [usuarioId]: data.cpf || '' }));
            setVisibleCpfCurrent(prev => ({ ...prev, [solicitacaoId]: true }));
        } catch {
            // silent
        }
    };

    const handleApprove = async (req: Solicitacao) => {
        if (!currentUser) return;
        setProcessingId(req.id);

        try {
            const csrfToken = getCsrfToken();
            if (!csrfToken) {
                alert('Erro: token CSRF não disponível. Recarregue a página.');
                setProcessingId(null);
                return;
            }
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || '';

            const updates: Record<string, string> = {};
            if (req.novo_nome) updates.nome_completo = req.novo_nome;
            if (req.novo_cpf) updates.cpf = req.novo_cpf;
            if (req.nova_foto_url) updates.foto_url = req.nova_foto_url;

            if (Object.keys(updates).length > 0) {
                const res = await fetch(`/api/usuarios/${req.usuario_id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json',
                        'x-csrf-token': csrfToken,
                    },
                    body: JSON.stringify(updates),
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    alert('Erro ao aprovar: ' + (err.error || 'Falha na requisição'));
                    setProcessingId(null);
                    return;
                }
            }

            await supabase.from('solicitacoes_perfil')
                .update({ status: 'aprovado', revisado_por: currentUser.id })
                .eq('id', req.id);

            await supabase.from('notificacoes').insert([{
                mensagem: 'Sua solicitação de alteração de perfil foi aprovada pela administração.',
                destinatario_id: req.usuario_id,
            }]);

            setRequests(prev => prev.filter(r => r.id !== req.id));
        } catch {
            alert('Erro ao aprovar solicitação.');
        }
        setProcessingId(null);
    };

    const handleReject = async (req: Solicitacao) => {
        if (!currentUser) return;
        setProcessingId(req.id);

        await supabase.from('solicitacoes_perfil')
            .update({ status: 'rejeitado', revisado_por: currentUser.id })
            .eq('id', req.id);

        await supabase.from('notificacoes').insert([{
            mensagem: 'Sua solicitação de alteração de perfil foi recusada pela administração.',
            destinatario_id: req.usuario_id,
        }]);

        setRequests(prev => prev.filter(r => r.id !== req.id));
        setProcessingId(null);
    };

    if (!currentUser) {
        return (
            <div className="max-w-2xl mx-auto p-8 text-center">
                <ShieldCheck className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h1 className="text-xl font-bold text-gray-800">Acesso Negado</h1>
                <p className="text-gray-500 mt-2">Você não tem permissão para revisar perfis.</p>
                <Link href="/dashboard" className="text-violet-600 font-semibold underline mt-4 inline-block">Voltar</Link>
            </div>
        );
    }

    return (
        <div className="flex-1 max-w-4xl mx-auto w-full p-4 pb-24">
            <div className="mb-6">
                <Link href="/dashboard" className="text-sm text-violet-600 font-semibold hover:underline inline-flex items-center gap-1 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
                </Link>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-violet-600" /> Revisão de Perfis
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    {requests.length} solicitação(ões) de alteração de perfil aguardando revisão.
                </p>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
            ) : requests.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                    <Check className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <h2 className="text-lg font-semibold text-gray-700">Nenhuma solicitação pendente</h2>
                    <p className="text-sm text-gray-400 mt-1">Todas as alterações de perfil foram revisadas.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {requests.map(req => {
                        const user = req.usuarios!;
                        const currentCpf = decryptedCpfs[user.id] || null;
                        const isExpanded = expandedCard === req.id;

                        return (
                            <div key={req.id} className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
                                {/* Summary bar */}
                                <button
                                    onClick={() => setExpandedCard(isExpanded ? null : req.id)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-amber-50/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                                            <User className="w-5 h-5 text-violet-600" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-semibold text-gray-800">{user.nome_completo}</p>
                                            <p className="text-xs text-gray-500">
                                                {user.cargo} &middot; T{user.torre} &middot; Apto {user.apartamento}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                            {[
                                                req.novo_nome && 'Nome',
                                                req.novo_cpf && 'CPF',
                                                req.nova_foto_url && 'Foto',
                                            ].filter(Boolean).join(', ')}
                                        </span>
                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-gray-100 p-4 space-y-4">
                                        {/* Changes table */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-gray-100">
                                                        <th className="text-left py-2 pr-4 font-semibold text-gray-600 text-xs uppercase">Campo</th>
                                                        <th className="text-left py-2 pr-4 font-semibold text-gray-400 text-xs uppercase">Valor Atual</th>
                                                        <th className="text-left py-2 font-semibold text-violet-600 text-xs uppercase">Novo Valor Solicitado</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {req.novo_nome && (
                                                        <tr>
                                                            <td className="py-3 pr-4 font-medium text-gray-700 whitespace-nowrap">Nome</td>
                                                            <td className="py-3 pr-4 text-gray-500">{user.nome_completo}</td>
                                                            <td className="py-3 font-semibold text-gray-800">{req.novo_nome}</td>
                                                        </tr>
                                                    )}
                                                    {req.novo_cpf && (
                                                        <tr>
                                                            <td className="py-3 pr-4 font-medium text-gray-700 whitespace-nowrap">CPF</td>
                                                            <td className="py-3 pr-4">
                                                                <span className="inline-flex items-center gap-2">
                                                                    <span className="text-gray-500 font-mono text-xs">
                                                                        {currentCpf && visibleCpfCurrent[req.id]
                                                                            ? currentCpf
                                                                            : currentCpf
                                                                                ? maskCpf(currentCpf)
                                                                                : '•••.•••.•••-••'}
                                                                    </span>
                                                                    {currentCpf !== null && (
                                                                        <button
                                                                            onClick={() => toggleCurrentCpf(req.id, user.id)}
                                                                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-violet-600 transition-colors"
                                                                            title={visibleCpfCurrent[req.id] ? 'Ocultar CPF atual' : 'Revelar CPF atual'}
                                                                        >
                                                                            {visibleCpfCurrent[req.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                                        </button>
                                                                    )}
                                                                </span>
                                                            </td>
                                                            <td className="py-3">
                                                                <span className="inline-flex items-center gap-2">
                                                                    <span className="font-mono text-xs text-gray-800">
                                                                        {visibleCpfNew[req.id]
                                                                            ? req.novo_cpf
                                                                            : maskCpf(req.novo_cpf)}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => setVisibleCpfNew(prev => ({ ...prev, [req.id]: !prev[req.id] }))}
                                                                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-violet-600 transition-colors"
                                                                        title={visibleCpfNew[req.id] ? 'Ocultar novo CPF' : 'Revelar novo CPF'}
                                                                    >
                                                                        {visibleCpfNew[req.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {req.nova_foto_url && (
                                                        <tr>
                                                            <td className="py-3 pr-4 font-medium text-gray-700 whitespace-nowrap">Foto</td>
                                                            <td className="py-3 pr-4">
                                                                {user.foto_url ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={user.foto_url} alt="Atual" className="w-12 h-12 rounded-lg object-cover border" />
                                                                ) : (
                                                                    <span className="text-gray-400 italic text-xs">Sem foto</span>
                                                                )}
                                                            </td>
                                                        <td className="py-3">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={req.nova_foto_url} alt="Nova" className="w-12 h-12 rounded-lg object-cover border" />
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="text-[10px] text-gray-400">
                                            Solicitado em {new Date(req.created_at).toLocaleDateString('pt-BR')} às {new Date(req.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={() => handleReject(req)}
                                                disabled={processingId === req.id}
                                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                                            >
                                                {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Rejeitar
                                            </button>
                                            <button
                                                onClick={() => handleApprove(req)}
                                                disabled={processingId === req.id}
                                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                                            >
                                                {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aprovar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
