'use client';

import { useState, useEffect } from 'react';
import { Bell, User, ArrowLeft, BookOpen, LogOut, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Usuario {
    id: string;
    nome_completo: string;
    cargo: string;
    foto_url?: string;
}

interface Notificacao {
    id: string;
    mensagem: string;
    lida: boolean;
    created_at: string;
}

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const isDashboard = pathname === '/dashboard' || pathname === '/dashboard/auditoria';

    const [user, setUser] = useState<Usuario | null>(null);
    const [notifications, setNotifications] = useState<Notificacao[]>([]);
    const [loadingUser, setLoadingUser] = useState(true);
    const [showNotifications, setShowNotifications] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // Fetch role directly from db
                const { data: userData } = await supabase
                    .from('usuarios')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (userData) setUser(userData);

                // Fetch notifications via Supabase using RLS correctly
                try {
                    const { data: notifs, error } = await supabase
                        .from('notificacoes')
                        .select('*')
                        .or(`destinatario_id.eq.${session.user.id},destinatario_id.is.null`)
                        .order('created_at', { ascending: false });

                    if (error) {
                        console.error("Erro ao buscar notificações via Supabase:", error);
                    } else if (notifs) {
                        setNotifications(notifs);
                    }
                } catch (err) {
                    console.error("Erro fatal na busca de notificações:", err);
                }
            }
            setLoadingUser(false);
        };
        fetchUserData();
    }, []);

    const markAsRead = async (notifId: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { error } = await supabase
                .from('notificacoes')
                .update({ lida: true })
                .eq('id', notifId);

            if (!error) {
                setNotifications(notifications.map(n => n.id === notifId ? { ...n, lida: true } : n));
            } else {
                console.error("Erro ao marcar como lida:", error);
            }
        } catch (err) {
            console.error("Erro fatal marcando notificação", err);
        }
    }

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            router.replace('/');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    return (
        <header className="bg-violet-600 text-white p-4 shadow-md sticky top-0 z-50 w-full">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm bg-white">
                        <Image
                            src={user?.foto_url || "/Complexo.jpeg"}
                            alt="Foto do Perfil"
                            fill
                            className="object-cover"
                        />
                    </div>
                    {loadingUser ? (
                        <div className="flex items-center text-sm font-medium"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando...</div>
                    ) : user ? (
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-violet-200 uppercase tracking-wider">{user.cargo}</span>
                            <span className="text-sm font-semibold truncate max-w-[150px] sm:max-w-[200px] leading-tight">
                                {user.nome_completo.split(' ')[0]} {user.nome_completo.split(' ')[1] || ''}
                            </span>
                        </div>
                    ) : (
                        <Link href="/dashboard" className="text-lg font-bold hover:opacity-90 transition-opacity">
                            Reserva Quadra
                        </Link>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {isDashboard ? (
                        <>
                            <div className="relative group" title="Notificações">
                                <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 hover:bg-violet-500 rounded-full transition-colors relative">
                                    <Bell className="w-5 h-5" />
                                    {notifications.filter(n => !n.lida).length > 0 && (
                                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-violet-600"></span>
                                    )}
                                </button>

                                {/* Dropdown Notificações */}
                                {showNotifications && (
                                    <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden text-gray-900 animate-in fade-in slide-in-from-top-2">
                                        <div className="p-3 border-b border-gray-100 font-semibold text-sm text-gray-800 bg-gray-50 flex justify-between items-center">
                                            <span>Notificações da Administração</span>
                                            <span className="bg-violet-100 text-violet-700 text-xs px-2 py-0.5 rounded-full">{notifications.filter(n => !n.lida).length} novas</span>
                                        </div>
                                        <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="p-4 text-sm text-gray-400 text-center italic flex flex-col items-center">
                                                    <Bell className="w-6 h-6 mb-2 opacity-20" />
                                                    Nenhuma nova mensagem da administração.
                                                </div>
                                            ) : (
                                                notifications.map(notif => (
                                                    <div key={notif.id} onClick={() => markAsRead(notif.id)} className={`p-4 text-sm transition-colors flex items-start gap-3 cursor-pointer ${notif.lida ? 'bg-white text-gray-500 hover:bg-gray-50' : 'bg-violet-50/50 text-gray-800 hover:bg-violet-50'}`}>
                                                        {!notif.lida ? (
                                                            <div className="w-2 h-2 rounded-full bg-violet-600 mt-1.5 flex-shrink-0 shadow-[0_0_5px_rgba(124,58,237,0.5)]"></div>
                                                        ) : (
                                                            <div className="w-2 h-2 rounded-full bg-transparent border border-gray-300 mt-1.5 flex-shrink-0"></div>
                                                        )}
                                                        <div className="flex-1">
                                                            <p className="leading-snug">{notif.mensagem}</p>
                                                            <span className="text-[10px] text-gray-400 mt-1 block">
                                                                {new Date(notif.created_at).toLocaleDateString('pt-BR')} às {new Date(notif.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <Link href="/regras" className="p-2 hover:bg-violet-500 rounded-full transition-colors flex flex-col items-center" title="Regras de Utilização da Quadra">
                                <BookOpen className="w-5 h-5" />
                            </Link>
                            <Link href="/profile" className="p-2 hover:bg-violet-500 rounded-full transition-colors flex flex-col items-center" title="Perfil">
                                <User className="w-5 h-5" />
                            </Link>
                            <button onClick={handleLogout} className="p-2 hover:bg-red-500 rounded-full transition-colors flex flex-col items-center ml-2" title="Sair da Conta">
                                <LogOut className="w-5 h-5" />
                            </button>
                        </>
                    ) : (
                        <Link href="/dashboard" className="flex items-center text-sm font-medium hover:text-violet-200 transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Voltar
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
