'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Usuario {
    id: string;
    nome_completo?: string;
    nome?: string;
    torre?: string;
    apartamento?: string;
    apto?: string;
    cargo?: string;
    status?: string;
}

interface Props {
    currentUserRole: string | undefined;
}

export default function AdminApprovalPanel({ currentUserRole }: Props) {
    const [pendingUsers, setPendingUsers] = useState<Usuario[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPending = async () => {
            try {
                setIsLoading(true);
                const { data } = await supabase
                    .from('usuarios')
                    .select('*')
                    .eq('status', 'pendente');
                if (data) {
                    // Síndico/Subsíndico só não pode ver SysAdmin/Outros Síndicos aguardando, mas deixaremos a query trazer
                    // e filtraremos localmente se precisarmos
                    setPendingUsers(data.filter(u =>
                        currentUserRole === 'SysAdmin' || (u.cargo !== 'SysAdmin' && u.cargo !== 'Síndico Geral')
                    ));
                }
            } catch (err) {
                console.error('Error fetching pending users', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPending();
    }, [currentUserRole]);

    const handleApprove = async (id: string) => {
        try {
            const { error } = await supabase.from('usuarios').update({ status: 'aprovado' }).eq('id', id);
            if (error) throw error;
            setPendingUsers(pendingUsers.filter(u => u.id !== id));
            alert("Usuário aprovado com sucesso!");
        } catch (err) {
            console.error("Erro ao aprovar:", err);
            alert("Falha ao aprovar usuário.");
        }
    };

    const handleReject = async (id: string) => {
        try {
            const { error } = await supabase.from('usuarios').update({ status: 'rejeitado' }).eq('id', id);
            if (error) throw error;
            setPendingUsers(pendingUsers.filter(u => u.id !== id));
            alert("Usuário rejeitado.");
        } catch (err) {
            console.error("Erro ao rejeitar:", err);
            alert("Falha ao rejeitar usuário.");
        }
    };

    return (
        <div className="mb-6 bg-white rounded-xl border border-violet-200 shadow-sm overflow-hidden">
            <div className="bg-violet-50 px-4 py-3 border-b border-violet-100 flex items-center justify-between">
                <h2 className="text-violet-800 font-semibold flex items-center text-sm">
                    <ShieldCheck className="w-5 h-5 mr-2" />
                    Cadastros Pendentes ({pendingUsers.length})
                </h2>
            </div>
            <div className="divide-y divide-gray-100 p-2">
                {isLoading ? (
                    <div className="p-4 text-center text-gray-500 text-sm">Carregando fila...</div>
                ) : pendingUsers.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm">Nenhuma aprovação pendente no momento. 🎉</div>
                ) : (
                    pendingUsers.map(pending => (
                        <div key={pending.id} className="p-2 flex items-center justify-between hover:bg-gray-50 rounded-lg">
                            <div className="px-2">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900 text-sm">{pending.nome_completo || pending.nome}</p>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{pending.cargo}</span>
                                </div>
                                <p className="text-xs text-gray-500">Torre {pending.torre}, Apto {pending.apartamento || pending.apto}</p>
                            </div>
                            <div className="flex gap-2 pr-2">
                                <button onClick={() => handleApprove(pending.id)} className="p-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200" title="Aprovar Modador">
                                    <CheckCircle2 className="w-5 h-5" />
                                </button>
                                <button onClick={() => handleReject(pending.id)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200" title="Rejeitar Cadastro">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
