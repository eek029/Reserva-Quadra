'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Bell, Mail, MailOpen, ArrowLeft, Loader2, User, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Notificacao {
    id: string;
    mensagem: string;
    lida: boolean;
    created_at: string;
}

const ADMIN_CARGOS = ['SysAdmin', 'Síndico Geral', 'Subsíndico'];

export default function MensagensPage() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notificacao[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userCargo, setUserCargo] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.replace('/'); return; }

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

    const isAdmin = userCargo && ADMIN_CARGOS.includes(userCargo);

    return (
        <div className="flex-1 max-w-4xl mx-auto w-full p-4 pb-24">
            <div className="mb-6">
                <Link href={isAdmin ? '/dashboard' : '/'} className="text-sm text-violet-600 font-semibold hover:underline inline-flex items-center gap-1 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </Link>
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Bell className="w-6 h-6 text-violet-600" /> Mensagens
                    </h1>
                    {notifications.filter(n => !n.lida).length > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Marcar todas como lidas
                        </button>
                    )}
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
                <div className="space-y-2">
                    {notifications.map(notif => (
                        <div
                            key={notif.id}
                            onClick={() => markAsRead(notif.id)}
                            className={`bg-white rounded-xl border transition-colors p-4 flex items-start gap-4 cursor-pointer ${
                                notif.lida
                                    ? 'border-gray-100 hover:border-gray-200'
                                    : 'border-violet-200 bg-violet-50/30 hover:bg-violet-50'
                            }`}
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
                    ))}
                </div>
            )}
        </div>
    );
}
