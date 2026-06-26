'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCsrfToken } from '@/lib/csrf-client';
import { ClipboardList, Check, X, Loader2, User, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Solicitacao {
    id: string;
    usuario_id: string;
    novo_nome: string | null;
    novo_cpf: string | null;
    nova_foto_url: string | null;
    status: string;
    created_at: string;
    usuarios: {
        nome_completo: string;
        cargo: string;
        torre: string;
        apartamento: string;
    };
}

interface Props {
    currentUserId: string;
    currentUserRole: string;
    currentUserTorre: string;
}

export default function ProfileReviewPanel({ currentUserId, currentUserRole, currentUserTorre }: Props) {
    const [requests, setRequests] = useState<Solicitacao[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [previewFoto, setPreviewFoto] = useState<string | null>(null);

    const fetchRequests = useCallback(async () => {
        setIsLoading(true);
        let query = supabase
            .from('solicitacoes_perfil')
            .select('*, usuarios(nome_completo, cargo, torre, apartamento)')
            .eq('status', 'pendente')
            .order('created_at', { ascending: true });

        if (currentUserRole === 'Subsíndico') {
            query = query.eq('usuarios.torre', currentUserTorre);
        }

        const { data } = await query;
        if (data) {
            const filtered = data.filter((d: Solicitacao) => d.usuarios !== null);
            setRequests(filtered);
        }
        setIsLoading(false);
    }, [currentUserRole, currentUserTorre]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const handleApprove = async (req: Solicitacao) => {
        setProcessingId(req.id);

        try {
            const csrfToken = getCsrfToken();
            if (!csrfToken) {
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
                    console.error('Approve failed:', err);
                    setProcessingId(null);
                    return;
                }
            }

            await supabase.from('solicitacoes_perfil')
                .update({ status: 'aprovado', revisado_por: currentUserId })
                .eq('id', req.id);

            await supabase.from('notificacoes').insert([{
                mensagem: 'Sua solicitação de alteração de perfil foi aprovada pela administração.',
                destinatario_id: req.usuario_id
            }]);

            setRequests(prev => prev.filter(r => r.id !== req.id));
        } catch (err) {
            console.error('Approve error:', err);
        }
        setProcessingId(null);
    };

    const handleReject = async (req: Solicitacao) => {
        setProcessingId(req.id);

        await supabase.from('solicitacoes_perfil')
            .update({ status: 'rejeitado', revisado_por: currentUserId })
            .eq('id', req.id);

        await supabase.from('notificacoes').insert([{
            mensagem: 'Sua solicitação de alteração de perfil foi recusada pela administração.',
            destinatario_id: req.usuario_id
        }]);

        setRequests(prev => prev.filter(r => r.id !== req.id));
        setProcessingId(null);
    };

    if (!isLoading && requests.length === 0) return null;

    return (
        <>
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden mb-6">
                <Link
                    href="/dashboard/revisao-perfil"
                    className="w-full bg-amber-50 px-4 py-3 border-b border-amber-100 flex items-center justify-between hover:bg-amber-100 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-amber-700" />
                        <h2 className="text-sm font-semibold text-amber-800">Revisão de Perfis</h2>
                        {requests.length > 0 && (
                            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{requests.length}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-amber-700 font-medium">
                        <span>Ir para revisão</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                </Link>

                {requests.length > 0 && (
                    <div className="divide-y divide-gray-50">
                        {isLoading ? (
                            <div className="p-6 flex justify-center text-gray-400">
                                <Loader2 className="w-5 h-5 animate-spin" />
                            </div>
                        ) : requests.slice(0, 3).map(req => (
                            <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-4">
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                                        <User className="w-5 h-5 text-violet-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">{req.usuarios.nome_completo}</p>
                                        <p className="text-xs text-gray-500">{req.usuarios.cargo} &middot; T{req.usuarios.torre} &middot; Apto {req.usuarios.apartamento}</p>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-1">
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Alterações Solicitadas</p>
                                    {req.novo_nome && (
                                        <div className="text-xs bg-gray-50 rounded-lg px-3 py-1.5 text-gray-700">
                                            <span className="font-semibold">Nome:</span> {req.novo_nome}
                                        </div>
                                    )}
                                    {req.novo_cpf && (
                                        <div className="text-xs bg-gray-50 rounded-lg px-3 py-1.5 text-gray-700">
                                            <span className="font-semibold">CPF:</span> {req.novo_cpf.slice(0, 3)}*****{req.novo_cpf.slice(-2)}
                                        </div>
                                    )}
                                    {req.nova_foto_url && (
                                        <div className="text-xs bg-gray-50 rounded-lg px-3 py-1.5 text-gray-700 flex items-center gap-2">
                                            <span className="font-semibold">Foto:</span>
                                            <button
                                                type="button"
                                                onClick={() => setPreviewFoto(req.nova_foto_url)}
                                                className="text-violet-600 underline"
                                            >
                                                Visualizar
                                            </button>
                                        </div>
                                    )}
                                    <p className="text-[10px] text-gray-400 pt-1">
                                        Enviado em {new Date(req.created_at).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {requests.length > 3 && (
                            <Link
                                href="/dashboard/revisao-perfil"
                                className="block text-center py-2 text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-colors"
                            >
                                Ver todas as {requests.length} solicitações
                            </Link>
                        )}
                    </div>
                )}
            </div>

            {/* Photo preview overlay */}
            {previewFoto && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 px-4"
                    onClick={() => setPreviewFoto(null)}
                >
                    <div className="bg-white rounded-2xl overflow-hidden shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewFoto} alt="Nova foto" className="w-full object-contain max-h-96" />
                        <button onClick={() => setPreviewFoto(null)} className="w-full py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
