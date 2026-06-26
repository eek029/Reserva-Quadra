'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Bell, Mail, MailOpen, ArrowLeft, Loader2, Trash2, CheckSquare, Square,
    Trash2 as DeleteIcon
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCsrfToken } from '@/lib/csrf-client';

interface Notificacao {
    id: string;
    mensagem: string;
    lida: boolean;
    created_at: string;
    destinatario_id: string | null;
}

const ADMIN_CARGOS = ['SysAdmin', 'Síndico Geral', 'Subsíndico'];

function isProfileChange(mensagem: string): boolean {
    return /perfil/i.test(mensagem) && /solicitou|solicitação|alterac?[aã]o/i.test(mensagem);
}

export default function MensagensPage() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notificacao[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userCargo, setUserCargo] = useState<string | null>(null);
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.replace('/'); return; }
            setSessionToken(session.access_token);

            const { data: me } = await supabase
                .from('usuarios')
                .select('cargo')
                .eq('id', session.user.id)
                .single();

            if (me) setUserCargo(me.cargo);

            const { data: notifs } = await supabase
                .from('notificacoes')
                .select('*')
                .or(`destinatario_id.eq.${session.user.id},destinatario_id.is.null`)
                .order('created_at', { ascending: false });

            if (notifs) setNotifications(notifs);
            setIsLoading(false);
        };
        fetchData();
    }, [router]);

    const isAdmin = userCargo && ADMIN_CARGOS.includes(userCargo);

    const markAsRead = async (notifId: string) => {
        await supabase.from('notificacoes').update({ lida: true }).eq('id', notifId);
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, lida: true } : n));
    };

    const markAllAsRead = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const unreadIds = notifications.filter(n => !n.lida).map(n => n.id);
        if (unreadIds.length === 0) return;

        await supabase.from('notificacoes').update({ lida: true }).in('id', unreadIds);
        setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
    };

    const handleClick = (notif: Notificacao) => {
        if (!notif.lida) markAsRead(notif.id);
        if (isAdmin && isProfileChange(notif.mensagem)) {
            router.push('/dashboard/revisao-perfil');
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === notifications.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(notifications.map(n => n.id)));
        }
    };

    const deleteSelected = useCallback(async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Remover ${selectedIds.size} notificação(ões)?`)) return;

        const csrf = await getCsrfToken();
        if (!csrf || !sessionToken) return;

        setIsDeleting(true);
        try {
            const res = await fetch('/api/notificacoes', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`,
                    'x-csrf-token': csrf,
                },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });

            if (res.ok) {
                const data = await res.json();
                setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
                setSelectedIds(new Set());
            } else {
                const err = await res.json();
                alert(`Erro: ${err.error || 'Falha ao remover.'}`);
            }
        } catch {
            alert('Erro de comunicação com o servidor.');
        } finally {
            setIsDeleting(false);
        }
    }, [selectedIds, sessionToken]);

    const deleteAll = useCallback(async () => {
        if (notifications.length === 0) return;
        if (!confirm(`Remover TODAS as ${notifications.length} notificação(ões)? Isso não afeta notificações de perfil pendentes.`)) return;

        const personalIds = notifications
            .filter(n => n.destinatario_id !== null)
            .map(n => n.id);
        if (personalIds.length === 0) return;

        const csrf = await getCsrfToken();
        if (!csrf || !sessionToken) return;

        setIsDeleting(true);
        try {
            const res = await fetch('/api/notificacoes', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`,
                    'x-csrf-token': csrf,
                },
                body: JSON.stringify({ ids: personalIds }),
            });

            if (res.ok) {
                setNotifications(prev => prev.filter(n => n.destinatario_id === null));
                setSelectedIds(new Set());
            } else {
                const err = await res.json();
                alert(`Erro: ${err.error || 'Falha ao remover.'}`);
            }
        } catch {
            alert('Erro de comunicação com o servidor.');
        } finally {
            setIsDeleting(false);
        }
    }, [notifications, sessionToken]);

    const hasSelection = selectedIds.size > 0;
    const allSelected = notifications.length > 0 && selectedIds.size === notifications.length;
    const personalCount = notifications.filter(n => n.destinatario_id !== null).length;

    return (
        <div className="flex-1 max-w-4xl mx-auto w-full p-4 pb-24">
            <div className="mb-6">
                <Link href={isAdmin ? '/dashboard' : '/'} className="text-sm text-violet-600 font-semibold hover:underline inline-flex items-center gap-1 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </Link>
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Bell className="w-6 h-6 text-violet-600" /> Mensagens
                    </h1>
                    <div className="flex items-center gap-2">
                        {personalCount > 0 && (
                            <button
                                onClick={deleteAll}
                                disabled={isDeleting}
                                className="text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Excluir todas
                            </button>
                        )}
                        {notifications.filter(n => !n.lida).length > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                Marcar todas como lidas
                            </button>
                        )}
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                    {notifications.filter(n => !n.lida).length} não lida(s) de {notifications.length} total
                </p>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
            ) : notifications.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                    <MailOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h2 className="text-lg font-semibold text-gray-700">Caixa de entrada vazia</h2>
                    <p className="text-sm text-gray-400 mt-1">Você não tem nenhuma mensagem.</p>
                </div>
            ) : (
                <>
                    {/* Select all bar */}
                    <div className="flex items-center gap-3 mb-3 px-1">
                        <button
                            onClick={toggleSelectAll}
                            className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-violet-600 transition-colors"
                        >
                            {allSelected ? <CheckSquare className="w-4 h-4 text-violet-600" /> : <Square className="w-4 h-4" />}
                            {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                        </button>
                        {hasSelection && (
                            <button
                                onClick={deleteSelected}
                                disabled={isDeleting}
                                className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                {isDeleting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <DeleteIcon className="w-3.5 h-3.5" />
                                )}
                                Excluir selecionadas ({selectedIds.size})
                            </button>
                        )}
                    </div>

                    <div className="space-y-2">
                        {notifications.map(notif => (
                            <div
                                key={notif.id}
                                className={`bg-white rounded-xl border transition-colors p-4 flex items-start gap-3 ${
                                    notif.lida
                                        ? 'border-gray-100 hover:border-gray-200'
                                        : 'border-violet-200 bg-violet-50/30 hover:bg-violet-50'
                                }`}
                            >
                                {/* Checkbox */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleSelect(notif.id); }}
                                    className="p-0.5 mt-0.5 flex-shrink-0 hover:text-violet-600 transition-colors text-gray-400"
                                >
                                    {selectedIds.has(notif.id)
                                        ? <CheckSquare className="w-4 h-4 text-violet-600" />
                                        : <Square className="w-4 h-4" />
                                    }
                                </button>

                                {/* Content (clickable) */}
                                <div
                                    onClick={() => handleClick(notif)}
                                    className="flex-1 min-w-0 flex items-start gap-3 cursor-pointer"
                                >
                                    <div className={`p-2 rounded-full flex-shrink-0 ${
                                        notif.lida ? 'bg-gray-100' : 'bg-violet-100'
                                    }`}>
                                        {notif.lida
                                            ? <MailOpen className="w-4 h-4 text-gray-400" />
                                            : <Mail className="w-4 h-4 text-violet-600" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {isAdmin && isProfileChange(notif.mensagem) && (
                                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 inline-block mb-1">
                                                Alteração de Perfil
                                            </span>
                                        )}
                                        <p className={`text-sm leading-snug ${notif.lida ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>
                                            {notif.mensagem}
                                        </p>
                                        <span className="text-[10px] text-gray-400 mt-1.5 block">
                                            {new Date(notif.created_at).toLocaleDateString('pt-BR')} às {new Date(notif.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    {!notif.lida && (
                                        <div className="w-2 h-2 rounded-full bg-violet-600 flex-shrink-0 mt-2 shadow-[0_0_5px_rgba(124,58,237,0.5)]" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
