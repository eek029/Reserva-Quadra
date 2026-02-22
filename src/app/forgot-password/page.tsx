'use client';

import { useState } from 'react';
import { ArrowLeft, KeyRound } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatus('loading');
        setErrorMessage('');

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (error) throw error;

            setStatus('success');
        } catch (err: unknown) {
            setStatus('error');
            setErrorMessage(err instanceof Error ? err.message : 'Erro ao solicitar recuperação de senha.');
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                <div className="flex flex-col items-center">
                    <div className="relative w-20 h-20 mb-4 rounded-full overflow-hidden shadow-md">
                        <Image
                            src="/Complexo.jpeg"
                            alt="Logo do Complexo"
                            fill
                            className="object-cover"
                            priority
                        />
                    </div>
                    <div className="w-12 h-12 bg-violet-50 rounded-full flex items-center justify-center mb-2">
                        <KeyRound className="w-6 h-6 text-violet-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-center text-gray-900">
                        Recuperar Senha
                    </h1>
                    <p className="mt-2 text-sm text-gray-600 text-center">
                        Insira seu e-mail para receber as instruções de recuperação.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {status === 'error' && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm text-center">
                            {errorMessage}
                        </div>
                    )}
                    {status === 'success' && (
                        <div className="bg-green-50 text-green-600 p-4 rounded-lg text-sm text-center">
                            Instruções enviadas! Verifique sua caixa de entrada.
                        </div>
                    )}

                    <div>
                        <label htmlFor="email-address" className="block text-sm font-medium text-gray-700">
                            E-mail Cadastrado
                        </label>
                        <input
                            id="email-address"
                            type="email"
                            required
                            disabled={status === 'loading' || status === 'success'}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-violet-500 focus:border-violet-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                            placeholder="exemplo@email.com"
                        />
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={status === 'loading' || status === 'success'}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {status === 'loading' ? 'Enviando...' : 'Enviar Instruções'}
                        </button>
                    </div>
                </form>

                <div className="mt-6 text-center">
                    <Link href="/" className="inline-flex items-center text-sm font-medium text-violet-600 hover:text-violet-500 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar para Login
                    </Link>
                </div>
            </div>
        </main>
    );
}
