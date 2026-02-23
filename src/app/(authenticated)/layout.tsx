'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, LogOut } from 'lucide-react';
import Header from '@/components/Header';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, setIsPending] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    router.replace('/');
                    return;
                }

                const { data: userData } = await supabase
                    .from('usuarios')
                    .select('status, cpf_encrypted, cargo')
                    .eq('id', session.user.id)
                    .maybeSingle();

                // Only redirect if the profile is TRULY incomplete:
                // missing CPF (stored as cpf_encrypted) or missing cargo.
                // Porteiro/SysAdmin have no apartment — that is expected, NOT a reason to redirect.
                if (!userData || !userData.cpf_encrypted || !userData.cargo) {
                    router.replace('/completar-cadastro');
                    return;
                }

                // Profile complete but awaiting admin approval
                if (userData.status?.toLowerCase() !== 'aprovado') {
                    setIsPending(true);
                }

                setIsLoading(false);
            } catch (error) {
                console.error("Auth error:", error);
                router.replace('/');
            }
        };

        checkAuth();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'SIGNED_OUT' || !session) {
                    router.replace('/');
                }
            }
        );

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [router]);


    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-600"></div>
            </div>
        );
    }

    if (isPending) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col font-sans items-center justify-center p-4">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-amber-100 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                        <ShieldAlert className="w-8 h-8 text-amber-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Restrito</h1>
                    <p className="text-gray-600 mb-8">
                        Seu cadastro foi realizado, mas você está <strong>aguardando a aprovação da administração</strong>. Funcionalidades do sistema estarão liberadas após essa etapa.
                    </p>
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut();
                            router.replace('/');
                        }}
                        className="flex items-center justify-center w-full py-3 px-4 rounded-xl text-amber-700 bg-amber-50 hover:bg-amber-100 font-semibold transition-colors border border-amber-200"
                    >
                        <LogOut className="w-5 h-5 mr-2" />
                        Sair da Conta
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <Header />
            {children}
        </div>
    );
}
