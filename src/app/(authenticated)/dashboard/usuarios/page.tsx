'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Users, Search, ChevronLeft, ChevronRight, Trash2, Shield,
    ShieldAlert, Loader2, Filter, CheckCircle, Clock, XCircle
} from 'lucide-react';
import Link from 'next/link';
import ProfileReviewPanel from '@/components/ProfileReviewPanel';
import AlterarCargoModal from '@/components/AlterarCargoModal';

interface Usuario {
    id: string;
    nome_completo: string;
    cargo: string;
    torre: string;
    apartamento: string;
    bloco?: string;
    status: string;
    telefone?: string;
    foto_url?: string | null;
}

interface CurrentUser {
    id: string;
    cargo: string;
    torre: string;
}

const DELETABLE_BY_SINDICO = ['Morador', 'Porteiro', 'Subsíndico'];
const PAGE_SIZE = 10;

export default function UsuariosPage() {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [confirmTarget, setConfirmTarget] = useState<Usuario | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [cargoTarget, setCargoTarget] = useState<Usuario | null>(null);

    // Filters & Pagination
    const [search, setSearch] = useState('');
    const [torreFilter, setTorreFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('aprovado');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchCurrentUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
            .from('usuarios')
            .select('id, cargo, torre')
            .eq('id', session.user.id)
            .single();
        if (data) setCurrentUser(data);
    };

    const fetchUsuarios = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);

        let query = supabase
            .from('usuarios')
            .select('id, nome_completo, cargo, torre, apartamento, bloco, status, telefone, foto_url', { count: 'exact' })
            .neq('id', currentUser.id)
            .eq('status', statusFilter)
            .order('nome_completo', { ascending: true })
            .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

        // Subsídico can only see their own torre
        if (currentUser.cargo === 'Subsíndico') {
            query = query.eq('torre', currentUser.torre);
        } else if (torreFilter) {
            query = query.eq('torre', torreFilter);
        }

        // Filter by name or apto (case insensitive)
        if (search.trim()) {
            query = query.or(`nome_completo.ilike.%${search.trim()}%,apartamento.ilike.%${search.trim()}%`);
        }

        // Role visibility: SysAdmin sees all, Síndico Geral sees non-SysAdmin, Subsídico sees limited roles
        if (currentUser.cargo === 'Síndico Geral') {
            query = query.neq('cargo', 'SysAdmin');
        } else if (currentUser.cargo === 'Subsíndico') {
            query = query.in('cargo', DELETABLE_BY_SINDICO);
        }

        const { data, count, error } = await query;
        if (!error && data) {
            setUsuarios(data);
            setTotal(count || 0);
        }
        setIsLoading(false);
    }, [currentUser, page, search, torreFilter, statusFilter]);

    useEffect(() => { fetchCurrentUser(); }, []);
    useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

    // Reset to page 1 when filters change
    useEffect(() => { setPage(1); }, [search, torreFilter, statusFilter]);

    const handleApprove = async (userId: string) => {
        const target = usuarios.find(u => u.id === userId);
        if (target?.cargo !== 'SysAdmin' && !target?.foto_url) {
            alert('Não é possível aprovar cadastro sem foto de perfil.');
            return;
        }
        const { error } = await supabase.from('usuarios').update({ status: 'aprovado' }).eq('id', userId);
        if (error) {
            alert(error.message || 'Falha ao aprovar usuário.');
            return;
        }
        fetchUsuarios();
    };

    const handleReject = async (userId: string) => {
        const { error } = await supabase.from('usuarios').update({ status: 'rejeitado' }).eq('id', userId);
        if (!error) fetchUsuarios();
    };

    const handleDelete = async () => {
        if (!confirmTarget) return;
        setIsDeleting(true);
        const { error } = await supabase.from('usuarios').delete().eq('id', confirmTarget.id);
        if (error) {
            alert(`Erro ao excluir: ${error.message}`);
        } else {
            setUsuarios(prev => prev.filter(u => u.id !== confirmTarget.id));
            setTotal(t => t - 1);
        }
        setConfirmTarget(null);
        setIsDeleting(false);
    };

    const canDelete = (targetRole: string) => {
        if (!currentUser) return false;
        if (currentUser.cargo === 'SysAdmin') return true;
        return DELETABLE_BY_SINDICO.includes(targetRole);
    };

    const isAdmin = currentUser && ['SysAdmin', 'Síndico Geral', 'Subsíndico'].includes(currentUser.cargo);
    const podeAlterarCargo = currentUser && ['SysAdmin', 'Síndico Geral'].includes(currentUser.cargo);
    const allowChangeTo = currentUser?.cargo === 'SysAdmin'
      ? ['Morador', 'Porteiro', 'Subsíndico', 'Síndico Geral']
      : currentUser?.cargo === 'Síndico Geral'
        ? ['Morador', 'Porteiro', 'Subsíndico']
        : [];
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const statusBadge = (s: string) => {
        if (s === 'aprovado') return <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" />Aprovado</span>;
        if (s === 'pendente') return <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />Pendente</span>;
        return <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" />Rejeitado</span>;
    };

    if (!isAdmin) {
        return (
            <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl max-w-2xl mx-auto mt-10 border border-red-200">
                <h2 className="text-xl font-bold flex items-center justify-center gap-2 mb-2"><ShieldAlert className="w-6 h-6" /> Acesso Negado</h2>
                <Link href="/dashboard" className="text-violet-600 underline mt-4 block font-semibold">Voltar ao Início</Link>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto w-full p-4 pb-12">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Users className="text-violet-600 w-6 h-6" /> Gestão de Usuários
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {currentUser?.cargo === 'Subsíndico' ? `Você gerencia apenas moradores da Torre ${currentUser.torre}.` : 'Gerencie todos os moradores e funcionários.'}
                    </p>
                </div>
                <Link href="/dashboard" className="text-sm text-violet-600 font-semibold hover:underline">← Voltar</Link>
            </div>

            {/* Profile change requests review panel */}
            {currentUser && (
                <ProfileReviewPanel
                    currentUserId={currentUser.id}
                    currentUserRole={currentUser.cargo}
                    currentUserTorre={currentUser.torre}
                />
            )}

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou apartamento..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500"
                    />
                </div>

                {/* Torre filter – hidden for Subsíndico (fixed to their torre) */}
                {currentUser?.cargo !== 'Subsíndico' && (
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                            value={torreFilter}
                            onChange={e => setTorreFilter(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 appearance-none bg-white"
                        >
                            <option value="">Todas as Torres</option>
                            {[1, 2, 3, 4, 5].map(t => <option key={t} value={t}>Torre {t}</option>)}
                        </select>
                    </div>
                )}

                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 bg-white"
                >
                    <option value="aprovado">Aprovados</option>
                    <option value="pendente">Pendentes</option>
                    <option value="rejeitado">Rejeitados</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left min-w-[640px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                        <tr>
                            <th className="px-4 py-3 font-semibold">Morador</th>
                            <th className="px-4 py-3 font-semibold">Cargo</th>
                            <th className="px-4 py-3 font-semibold">Torre / Apto</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {isLoading ? (
                            <tr><td colSpan={5} className="py-10 text-center text-gray-400">
                                <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando...
                            </td></tr>
                        ) : usuarios.length === 0 ? (
                            <tr><td colSpan={5} className="py-10 text-center text-gray-400 italic">
                                Nenhum usuário encontrado para os filtros selecionados.
                            </td></tr>
                        ) : usuarios.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3">
                                    <p className="font-semibold text-gray-800 text-sm">{u.nome_completo}</p>
                                    {u.telefone && <p className="text-xs text-gray-400">{u.telefone}</p>}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">{u.cargo}</span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                    T{u.torre}{u.apartamento ? ` · ${u.apartamento}` : ''}{u.bloco ? ` · Bloco ${u.bloco}` : ''}
                                </td>
                                <td className="px-4 py-3">{statusBadge(u.status)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-2">
                                        {u.status === 'pendente' && (
                                            <>
                                                <button
                                                    onClick={() => handleApprove(u.id)}
                                                    disabled={u.cargo !== 'SysAdmin' && !u.foto_url}
                                                    title={u.cargo !== 'SysAdmin' && !u.foto_url ? 'Cadastro sem foto não pode ser aprovado' : undefined}
                                                    className="text-xs font-bold px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                >✓ Aprovar</button>
                                                <button onClick={() => handleReject(u.id)} className="text-xs font-bold px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">✗ Rejeitar</button>
                                            </>
                                        )}
                                        {canDelete(u.cargo) && (
                                            <button
                                                onClick={() => setConfirmTarget(u)}
                                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        {podeAlterarCargo && u.cargo !== 'SysAdmin' && u.status === 'aprovado' && (
                                            <button
                                                onClick={() => setCargoTarget(u)}
                                                className="p-1.5 rounded-lg text-violet-400 hover:bg-violet-50 hover:text-violet-600 transition-colors"
                                                title="Alterar Cargo"
                                            >
                                                <Shield className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                    <p>{total} usuário{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="font-semibold">Página {page} de {totalPages}</span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {confirmTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="p-2 bg-red-50 rounded-full flex-shrink-0">
                                <ShieldAlert className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">Excluir permanentemente?</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Tem certeza que deseja excluir <strong>{confirmTarget.nome_completo}</strong>? Esta ação não pode ser desfeita.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmTarget(null)} disabled={isDeleting} className="flex-1 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
                                Cancelar
                            </button>
                            <button onClick={handleDelete} disabled={isDeleting} className="flex-1 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center justify-center gap-2">
                                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Alterar Cargo Modal */}
            {cargoTarget && (
                <AlterarCargoModal
                    usuario={cargoTarget}
                    allowChangeTo={allowChangeTo}
                    onClose={() => setCargoTarget(null)}
                    onSuccess={() => { setCargoTarget(null); fetchUsuarios(); }}
                />
            )}
        </div>
    );
}
