'use client';

import { Bell, User, ArrowLeft, BookOpen, LogOut } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const isDashboard = pathname === '/dashboard';

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
                            src="/Complexo.jpeg"
                            alt="Logo Reserva Quadra"
                            fill
                            className="object-cover"
                        />
                    </div>
                    <Link href="/dashboard" className="text-lg font-bold hover:opacity-90 transition-opacity">
                        Reserva Quadra
                    </Link>
                </div>

                <div className="flex items-center gap-4">
                    {isDashboard ? (
                        <>
                            <div className="relative group p-2 hover:bg-violet-500 rounded-full transition-colors cursor-pointer" title="Notificações">
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-violet-600"></span>
                                {/* Dropdown Notificações */}
                                <div className="absolute right-0 mt-3 w-72 bg-white rounded-xl shadow-xl border border-gray-100 hidden group-hover:block transition-all z-50 overflow-hidden text-gray-900">
                                    <div className="p-3 border-b border-gray-100 font-semibold text-sm text-gray-800 bg-gray-50">
                                        Notificações
                                    </div>
                                    <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                                        <div className="p-3 text-sm text-gray-600 hover:bg-violet-50 transition-colors flex items-start gap-3">
                                            <div className="w-2 h-2 rounded-full bg-violet-600 mt-1.5 flex-shrink-0"></div>
                                            <p><strong>Lembrete:</strong> Faltam 15 min para sua reserva da Quadra Poliesportiva.</p>
                                        </div>
                                        <div className="p-3 text-sm text-gray-400 hover:bg-violet-50 transition-colors text-center italic">
                                            Nenhuma nova mensagem da administração.
                                        </div>
                                    </div>
                                </div>
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
