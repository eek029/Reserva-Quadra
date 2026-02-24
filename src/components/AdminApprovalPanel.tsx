'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, CheckCircle2, X, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import Image from 'next/image';
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
    foto_url?: string;
    cpf_encrypted?: string;
    rg_encrypted?: string;
}

interface DecryptedData {
    cpf: string | null;
    rg: string | null;
}

interface Props {
    currentUserRole: string | undefined;
}

/** Masks a CPF like 123.456.789-00 → •••.456.789-•• */
function maskCpf(cpf: string): string {
    const nums = cpf.replace(/\D/g, '');
    if (nums.length !== 11) return '•••.•••.•••-••';
    return `•••.${nums.slice(3, 6)}.${nums.slice(6, 9)}-••`;
}

/** Masks an RG like 12.345.678-9 → ••.345.•••-• */
function maskRg(rg: string): string {
    if (rg.length < 4) return '•'.repeat(rg.length);
    const visible = rg.slice(Math.floor(rg.length * 0.3), Math.floor(rg.length * 0.6));
    return '•••' + visible + '•••';
}

// ─── Modal da Ficha de Auditoria ────────────────────────────────────────────
function AuditModal({
    user,
    onClose,
    onApprove,
    onReject,
    loading,
}: {
    user: Usuario;
    onClose: () => void;
    onApprove: (id: string) => Promise<void>;
    onReject: (id: string) => Promise<void>;
    loading: boolean;
}) {
    const [showSensitive, setShowSensitive] = useState(false);
    const [decrypted, setDecrypted] = useState<DecryptedData | null>(null);
    const [decryptLoading, setDecryptLoading] = useState(false);
    const [decryptError, setDecryptError] = useState<string | null>(null);
    const nome = user.nome_completo || user.nome || 'Sem nome';

    // Close on backdrop click
    const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    }, [onClose]);

    // Close on ESC
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // Lazy-fetch decrypted data from API when "Revelar" is clicked
    const handleToggleSensitive = async () => {
        if (showSensitive) {
            // Just hide — data is already cached
            setShowSensitive(false);
            return;
        }

        // If we already fetched, just show
        if (decrypted) {
            setShowSensitive(true);
            return;
        }

        // Fetch from API
        try {
            setDecryptLoading(true);
            setDecryptError(null);

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || '';

            const res = await fetch(`/api/usuarios/${user.id}`, {
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || err.detail || `Erro ${res.status}`);
            }

            const data = await res.json();
            setDecrypted({
                cpf: data.cpf || null,
                rg: data.rg || null,
            });
            setShowSensitive(true);
        } catch (err) {
            setDecryptError(err instanceof Error ? err.message : 'Erro ao descriptografar');
        } finally {
            setDecryptLoading(false);
        }
    };

    return (
        /* Overlay */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={handleBackdropClick}
        >
            {/* Card */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-[90%] max-w-md max-h-[90vh] overflow-y-auto flex flex-col">
                {/* Header roxo */}
                <div className="bg-violet-600 px-5 py-4 flex items-center justify-between rounded-t-2xl">
                    <h2 className="text-white font-bold text-base flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5" />
                        Ficha de Cadastro
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-violet-500 text-white transition-colors"
                        aria-label="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Foto em destaque */}
                <div className="flex flex-col items-center pt-6 pb-2 px-5">
                    <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-violet-200 shadow-md bg-violet-50">
                        {user.foto_url ? (
                            <Image src={user.foto_url} alt={nome} fill className="object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <User className="w-10 h-10 text-violet-300" />
                            </div>
                        )}
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-gray-900 text-center leading-tight">{nome}</h3>
                    <span className="mt-1 text-xs font-bold px-3 py-1 rounded-full bg-violet-100 text-violet-700">
                        {user.cargo || 'Morador'}
                    </span>
                </div>

                {/* Dados */}
                <div className="px-5 pb-4 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <DataRow label="Torre" value={user.torre ? `Torre ${user.torre}` : '—'} />
                        <DataRow label="Apartamento" value={user.apartamento || user.apto || '—'} />
                    </div>

                    {/* Campos sensíveis com toggle */}
                    <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Dados Sensíveis
                            </span>
                            <button
                                onClick={handleToggleSensitive}
                                disabled={decryptLoading}
                                className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 transition-colors disabled:opacity-50"
                            >
                                {decryptLoading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</>
                                ) : showSensitive ? (
                                    <><EyeOff className="w-4 h-4" /> Ocultar</>
                                ) : (
                                    <><Eye className="w-4 h-4" /> Revelar</>
                                )}
                            </button>
                        </div>

                        {decryptError && (
                            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-2 py-1">{decryptError}</p>
                        )}

                        <SensitiveRow
                            label="CPF"
                            show={showSensitive}
                            hasCrypt={!!user.cpf_encrypted}
                            rawValue={decrypted?.cpf ?? null}
                            maskFn={maskCpf}
                        />
                        <SensitiveRow
                            label="RG"
                            show={showSensitive}
                            hasCrypt={!!user.rg_encrypted}
                            rawValue={decrypted?.rg ?? null}
                            maskFn={maskRg}
                        />
                    </div>
                </div>

                {/* Botões */}
                <div className="px-5 pb-5 flex gap-3">
                    <button
                        disabled={loading}
                        onClick={() => onReject(user.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-red-200 text-red-600 bg-red-50 hover:bg-red-100 font-semibold text-sm transition-colors disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        Reprovar
                    </button>
                    <button
                        disabled={loading}
                        onClick={() => onApprove(user.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-green-200 text-green-700 bg-green-50 hover:bg-green-100 font-semibold text-sm transition-colors disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Aprovar
                    </button>
                </div>
            </div>
        </div>
    );
}

function DataRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide block">{label}</span>
            <span className="text-sm font-semibold text-gray-800">{value}</span>
        </div>
    );
}

function SensitiveRow({
    label,
    show,
    hasCrypt,
    rawValue,
    maskFn,
}: {
    label: string;
    show: boolean;
    hasCrypt: boolean;
    rawValue: string | null;
    maskFn: (v: string) => string;
}) {
    if (!hasCrypt) {
        return (
            <div className="flex justify-between items-center py-1">
                <span className="text-xs text-gray-500 font-medium">{label}</span>
                <span className="text-xs text-gray-400 italic">Não informado</span>
            </div>
        );
    }

    return (
        <div className="flex justify-between items-center py-1">
            <span className="text-xs text-gray-500 font-medium">{label}</span>
            <span className="text-xs font-mono text-gray-700">
                {show && rawValue ? rawValue : (rawValue ? maskFn(rawValue) : '•••••••••••')}
            </span>
        </div>
    );
}

// ─── Painel Principal ────────────────────────────────────────────────────────
export default function AdminApprovalPanel({ currentUserRole }: Props) {
    const [pendingUsers, setPendingUsers] = useState<Usuario[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        const fetchPending = async () => {
            try {
                setIsLoading(true);
                const { data } = await supabase
                    .from('usuarios')
                    .select('*')
                    .eq('status', 'pendente');
                if (data) {
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
            setActionLoading(true);
            const { error } = await supabase.from('usuarios').update({ status: 'aprovado' }).eq('id', id);
            if (error) throw error;
            setPendingUsers(prev => prev.filter(u => u.id !== id));
            setSelectedUser(null);
        } catch (err) {
            console.error('Erro ao aprovar:', err);
            alert('Falha ao aprovar usuário.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async (id: string) => {
        try {
            setActionLoading(true);
            const { error } = await supabase.from('usuarios').update({ status: 'rejeitado' }).eq('id', id);
            if (error) throw error;
            setPendingUsers(prev => prev.filter(u => u.id !== id));
            setSelectedUser(null);
        } catch (err) {
            console.error('Erro ao rejeitar:', err);
            alert('Falha ao rejeitar usuário.');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <>
            {/* Modal da ficha */}
            {selectedUser && (
                <AuditModal
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    loading={actionLoading}
                />
            )}

            <div className="mb-6 bg-white rounded-xl border border-violet-200 shadow-sm overflow-hidden">
                <div className="bg-violet-50 px-4 py-3 border-b border-violet-100 flex items-center justify-between">
                    <h2 className="text-violet-800 font-semibold flex items-center text-sm">
                        <ShieldCheck className="w-5 h-5 mr-2" />
                        Cadastros Pendentes ({pendingUsers.length})
                    </h2>
                </div>

                <div className="divide-y divide-gray-100 p-2">
                    {isLoading ? (
                        <div className="p-4 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Carregando fila...
                        </div>
                    ) : pendingUsers.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">Nenhuma aprovação pendente no momento. 🎉</div>
                    ) : (
                        pendingUsers.map(pending => (
                            <button
                                key={pending.id}
                                onClick={() => setSelectedUser(pending)}
                                className="w-full text-left p-3 flex items-center justify-between hover:bg-violet-50 rounded-lg transition-colors group"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="relative w-9 h-9 rounded-full overflow-hidden bg-violet-100 flex-shrink-0 border border-violet-200">
                                        {pending.foto_url ? (
                                            <Image src={pending.foto_url} alt="" fill className="object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <User className="w-4 h-4 text-violet-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-medium text-gray-900 text-sm truncate">{pending.nome_completo || pending.nome}</p>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 flex-shrink-0">{pending.cargo}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {pending.torre ? `Torre ${pending.torre}` : ''}{pending.apartamento ? `, Apto ${pending.apartamento}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs text-violet-500 font-medium ml-2 flex-shrink-0 group-hover:underline">Ver ficha →</span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
