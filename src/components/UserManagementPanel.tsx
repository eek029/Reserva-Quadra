'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Trash2, Loader2, ShieldAlert } from 'lucide-react';

interface Usuario {
    id: string;
    nome_completo: string;
    cargo: string;
    torre: string;
    apartamento: string;
    status: string;
}

interface Props {
    currentUserId: string;
    currentUserRole: string;
}

const DELETABLE_BY_SINDICO = ['Morador', 'Porteiro', 'Subsíndico'];

export default function UserManagementPanel({ currentUserId, currentUserRole }: Props) {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [confirmTarget, setConfirmTarget] = useState<Usuario | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchUsuarios = useCallback(async () => {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';
        const res = await fetch(`/api/usuarios?status=aprovado&visao=gestao&exclude_id=${currentUserId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
            const payload = await res.json();
            const data: Usuario[] = payload.usuarios ?? [];
            const filtered = currentUserRole === 'SysAdmin'
                ? data
                : data.filter(u => DELETABLE_BY_SINDICO.includes(u.cargo));
            setUsuarios(filtered);
        }
        setIsLoading(false);
    }, [currentUserId, currentUserRole]);

    useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

    const handleDelete = async () => {
        if (!confirmTarget) return;
        setIsDeleting(true);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';
        const { getCsrfToken } = await import('@/lib/csrf-client');
        const res = await fetch(`/api/usuarios/${confirmTarget.id}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
                'x-csrf-token': getCsrfToken() || '',
            },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert(`Erro ao excluir: ${err.error || 'Falha na requisição'}`);
        } else {
            setUsuarios(prev => prev.filter(u => u.id !== confirmTarget.id));
            alert(`Usuário ${confirmTarget.nome_completo} excluído com sucesso.`);
        }
        setConfirmTarget(null);
        setIsDeleting(false);
    };

    const canDelete = (targetRole: string) => {
        if (currentUserRole === 'SysAdmin') return true;
        return DELETABLE_BY_SINDICO.includes(targetRole);
    };

    if (!['SysAdmin', 'Síndico Geral'].includes(currentUserRole)) return null;

    return (
        <>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-600" />
                    <h2 className="text-sm font-semibold text-gray-700">Gestão de Usuários</h2>
                </div>

                {isLoading ? (
                    <div className="p-6 flex justify-center text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                ) : usuarios.length === 0 ? (
                    <p className="p-4 text-sm text-gray-400 text-center">Nenhum usuário encontrado.</p>
                ) : (
                    <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                        {usuarios.map(u => (
                            <div key={u.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">{u.nome_completo}</p>
                                    <p className="text-xs text-gray-500">{u.cargo} · T{u.torre}{u.apartamento ? ` · Apto ${u.apartamento}` : ''}</p>
                                </div>
                                {canDelete(u.cargo) && (
                                    <button
                                        onClick={() => setConfirmTarget(u)}
                                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                        title="Excluir usuário"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {confirmTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="p-2 bg-red-50 rounded-full flex-shrink-0">
                                <ShieldAlert className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">Excluir usuário permanentemente</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Tem certeza que deseja excluir permanentemente o usuário <strong>{confirmTarget.nome_completo}</strong>?
                                    Esta ação não pode ser desfeita.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => setConfirmTarget(null)}
                                disabled={isDeleting}
                                className="flex-1 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
