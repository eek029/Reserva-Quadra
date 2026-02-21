'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chrome as Google } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="flex flex-col items-center">
          <div className="relative w-24 h-24 mb-4 rounded-full overflow-hidden shadow-md">
            <Image
              src="/Complexo.jpeg"
              alt="Logo do Complexo Júlio Prestes"
              fill
              className="object-cover"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900">
            Reserva Quadra Complexo Júlio Prestes
          </h1>
          <p className="mt-2 text-sm text-gray-600 text-center">
            Agende seu horário, gerencie reservas e receba notificações.
          </p>
          <div className="mt-4 px-3 py-1 bg-violet-50 rounded-full text-xs text-violet-700 font-medium">
            Acesso restrito a moradores e administração
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                placeholder="exemplo@email.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                Lembrar-me
              </label>
            </div>

            <div className="text-sm">
              <a href="#" className="font-medium text-violet-600 hover:text-violet-500">
                Esqueceu a senha?
              </a>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar na Conta'}
            </button>
          </div>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">ou</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button className="w-full inline-flex justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Google className="w-5 h-5 mr-2 text-red-500" />
            Google
          </button>
        </div>

        <p className="mt-8 text-center text-sm text-gray-600">
          Não tem uma conta?{' '}
          <Link href="/register" className="font-semibold text-violet-600 hover:text-violet-500">
            Cadastre-se aqui
          </Link>
        </p>

        <footer className="mt-8 pt-6 border-t border-gray-100">
          <div className="text-center text-xs text-gray-500 space-y-2">
            <p>2026 eek029 Sistemas e Automação</p>
            <div className="flex justify-center space-x-4">
              <Link href="https://t.me/eek029" target="_blank" className="hover:text-violet-600 transition-colors">
                Telegram
              </Link>
              <Link href="https://x.com/eek029" target="_blank" className="hover:text-violet-600 transition-colors">
                X (Twitter)
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
