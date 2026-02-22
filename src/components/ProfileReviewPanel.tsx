'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ClipboardList, Check, X, Loader2, User, ChevronDown, ChevronUp } from 'lucide-react';

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

    const fetchRequests = async () => {
        setIsLoading(true);
        let query = supabase
            .from('solicitacoes_perfil')
            .select('*, usuarios(nome_completo, cargo, torre, apartamento)')
            .eq('status', 'pendente')
            .order('created_at', { ascending: true });

        // Subsíndico: only see requests from users in their own torre
        if (currentUserRole === 'Subsíndico') {
            query = query.eq('usuarios.torre', currentUserTorre);
        }

        const { data } = await query;
        if (data) {
            // Filter out nulls that can happen with joined filters
            const filtered = data.filter((d: Solicitacao) => d.usuarios !== null);
            setRequests(filtered);
        }
        setIsLoading(false);
    };

    useEffect(() => { fetchRequests(); }, []);

    const handleApprove = async (req: Solicitacao) => {
        setProcessingId(req.id);

        // Update the user's data with the requested changes
        const updates: Record<string, string> = {};
        if (req.novo_nome) updates.nome_completo = req.novo_nome;
        if (req.novo_cpf) updates.cpf = req.novo_cpf;
        if (req.nova_foto_url) updates.foto_url = req.nova_foto_url;

        if (Object.keys(updates).length > 0) {
            await supabase.from('usuarios').update(updates).eq('id', req.usuario_id);
        }

        // Mark request as approved
        await supabase.from('solicitacoes_perfil')
            .update({ status: 'aprovado', revisado_por: currentUserId })
            .eq('id', req.id);

        // Notify the user
        await supabase.from('notificacoes').insert([{
            mensagem: 'Sua solicitação de alteração de perfil foi aprovada pela administração.',
            destinatario_id: req.usuario_id
        }]);

        setRequests(prev => prev.filter(r => r.id !== req.id));
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
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full bg-amber-50 px-4 py-3 border-b border-amber-100 flex items-center justify-between"
                >
                    <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-amber-700" />
                        <h2 className="text-sm font-semibold text-amber-800">Revisão de Perfis</h2>
                        {requests.length > 0 && (
                            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{requests.length}</span>
                        )}
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
                </button>

                {isExpanded && (
                    <div className="divide-y divide-gray-50">
                        {isLoading ? (
                            <div className="p-6 flex justify-center text-gray-400">
                                <Loader2 className="w-5 h-5 animate-spin" />
                            </div>
                        ) : requests.map(req => (
                            <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-4">
                                {/* User info */}
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                                        <User className="w-5 h-5 text-violet-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">{req.usuarios.nome_completo}</p>
                                        <p className="text-xs text-gray-500">{req.usuarios.cargo} · T{req.usuarios.torre} · Apto {req.usuarios.apartamento}</p>
                                    </div>
                                </div>

                                {/* Changes requested */}
                                <div className="flex-1 space-y-1">
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Alterações Solicitadas</p>
                                    {req.novo_nome && (
                                        <div className="text-xs bg-gray-50 rounded-lg px-3 py-1.5 text-gray-700">
                                            <span className="font-semibold">Nome:</span> {req.novo_nome}
                                        </div>
                                    )}
                                    {req.novo_cpf && (
                                        <div className="text-xs bg-gray-50 rounded-lg px-3 py-1.5 text-gray-700">
                                            <span className="font-semibold">CPF:</span> {req.novo_cpf}
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
                                                Visualizar nova foto
                                            </button>
                                        </div>
                                    )}
                                    <p className="text-[10px] text-gray-400 pt-1">
                                        Enviado em {new Date(req.created_at).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleReject(req)}
                                        disabled={processingId === req.id}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                                    >
                                        {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Rejeitar
                                    </button>
                                    <button
                                        onClick={() => handleApprove(req)}
                                        disabled={processingId === req.id}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                                    >
                                        {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Aprovar
                                    </button>
                                </div>
                            </div>
                        ))}
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
