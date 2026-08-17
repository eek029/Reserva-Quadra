'use client';

import { useState } from 'react';
import { ArrowLeft, Camera, Upload, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { getCsrfToken } from '@/lib/csrf-client';

// Google 'G' SVG inline — official brand colors
const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

export default function RegisterPage() {
    const [cargo, setCargo] = useState('Morador');
    const [torre, setTorre] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [nomeCompleto, setNomeCompleto] = useState('');
    const [rg, setRg] = useState('');
    const [cpf, setCpf] = useState('');
    const [dataNascimento, setDataNascimento] = useState('');
    const [telefone, setTelefone] = useState('');
    const [apartamento, setApartamento] = useState('');
    const [bloco, setBloco] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleGoogleLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
    };

    // --- Masks ---
    const maskCpf = (value: string) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
            .slice(0, 14);
    };

    const maskPhone = (value: string) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
            .slice(0, 15);
    };

    const validateCpf = (cpf: string): boolean => {
        const nums = cpf.replace(/\D/g, '');
        if (nums.length !== 11 || /^(\d)\1{10}$/.test(nums)) return false;
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(nums[i]) * (10 - i);
        let rest = (sum * 10) % 11;
        if (rest === 10 || rest === 11) rest = 0;
        if (rest !== parseInt(nums[9])) return false;
        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(nums[i]) * (11 - i);
        rest = (sum * 10) % 11;
        if (rest === 10 || rest === 11) rest = 0;
        return rest === parseInt(nums[10]);
    };

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new window.Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 512;
                    const MAX_HEIGHT = 512;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const compressed = await compressImage(file);
            setPreviewImage(compressed);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        if (!validateCpf(cpf)) {
            setError('CPF inválido. Por favor, verifique o número digitado.');
            return;
        }

        const phoneDigits = telefone.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
            setError('Celular incompleto. Por favor, verifique o número.');
            return;
        }

        if (!previewImage) {
            setError('A foto de perfil é obrigatória para a validação pelo Síndico. Por favor, adicione uma foto.');
            return;
        }

        setLoading(true);

        try {
            const { data, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) throw authError;

            // Extra checks to make sure we have the user
            if (!data.user?.id) throw new Error("Falha ao criar usuário na autenticação.");

            // Gravar na API — autenticar com token da sessão recém-criada
            const sessionToken = data.session?.access_token || '';
            const csrf = getCsrfToken();
            const response = await fetch(`/api/usuarios?auth_id=${data.user.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`,
                    'x-csrf-token': csrf || '',
                },
                body: JSON.stringify({
                    nome_completo: nomeCompleto,
                    rg: rg || 'Não informado', // Backend requires a string, can't be null
                    cpf: cpf,
                    data_nascimento: dataNascimento,
                    telefone: telefone,
                    apartamento: apartamento,
                    torre: torre,
                    bloco: bloco,
                    foto_url: previewImage || null,
                    cargo: cargo
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erro ao salvar os dados complementares.');
            }

            setSuccess(true);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao realizar cadastro.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center mb-8">
                    <Link href="/" className="flex items-center text-violet-600 hover:text-violet-500 font-medium transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar para Login
                    </Link>
                </div>

                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="bg-violet-600 px-8 py-8 text-white text-center flex flex-col items-center">
                        <div className="relative w-20 h-20 mb-4 rounded-full overflow-hidden shadow-md border-2 border-white">
                            <Image
                                src="/Complexo.jpeg"
                                alt="Logo do Complexo"
                                fill
                                className="object-cover"
                                priority
                            />
                        </div>
                        <h1 className="text-2xl font-bold">Cadastro de Usuário</h1>
                        <p className="text-violet-100 mt-1">Preencha seus dados para acessar o sistema.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        {/* Google sign-in option */}
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            className="w-full inline-flex items-center justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <GoogleIcon />
                            Cadastrar com Google
                        </button>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                            <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-400">ou preencha o formulário</span></div>
                        </div>
                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm text-center">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="bg-green-50 text-green-600 p-4 rounded-lg text-sm text-center font-semibold">
                                Cadastro realizado com sucesso! Aguarde a aprovação da administração.
                            </div>
                        )}
                        {/* Foto Upload Section */}
                        <div className="flex flex-col items-center space-y-4">
                            <div className="relative w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden group">
                                {previewImage ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <Camera className="w-10 h-10 text-gray-400" />
                                )}
                                <label className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                    <Upload className="text-white w-6 h-6" />
                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                </label>
                            </div>
                            <span className="text-sm font-medium text-gray-700">Sua Foto <span className="text-red-500">*</span></span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Dados de Acesso */}
                            <div className="md:col-span-2">
                                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-2">Dados de Acesso</h3>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">E-mail</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                    placeholder="seu@email.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Senha</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm pr-10"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 mt-1"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Confirmar Senha</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm pr-10"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 mt-1"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Dados Pessoais */}
                            <div className="md:col-span-2 mt-4">
                                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-2">Dados Pessoais</h3>
                            </div>

                            {/* Nome Completo */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                                <input
                                    type="text"
                                    required
                                    value={nomeCompleto}
                                    onChange={(e) => setNomeCompleto(e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                    placeholder="Seu nome completo"
                                />
                            </div>

                            {/* RG & CPF */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">RG (Opcional)</label>
                                <input
                                    type="text"
                                    value={rg}
                                    onChange={(e) => setRg(e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                    placeholder="00.000.000-0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">CPF</label>
                                <input
                                    type="text"
                                    required
                                    value={cpf}
                                    onChange={(e) => setCpf(maskCpf(e.target.value))}
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                    placeholder="000.000.000-00"
                                    maxLength={14}
                                />
                            </div>

                            {/* Data Nasc & Telefone */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Data de Nascimento</label>
                                <input
                                    type="date"
                                    required
                                    value={dataNascimento}
                                    onChange={(e) => setDataNascimento(e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Telefone Celular</label>
                                <input
                                    type="tel"
                                    required
                                    value={telefone}
                                    onChange={(e) => setTelefone(maskPhone(e.target.value))}
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                    placeholder="(11) 90000-0000"
                                    maxLength={15}
                                />
                            </div>

                            {/* Cargo - Selection Boxes */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Seu Cargo</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {['Morador', 'Porteiro', 'Subsíndico', 'Síndico Geral'].map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => { setCargo(item); setTorre(''); setApartamento(''); setBloco(''); }}
                                            className={`px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${cargo === item
                                                ? 'border-violet-600 bg-violet-50 text-violet-700'
                                                : 'border-gray-200 text-gray-500 hover:border-violet-200'
                                                }`}
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Conditional Tower and Apt Section */}
                            {/* ── Torre: visível para todos exceto SysAdmin ── */}
                            {cargo !== 'SysAdmin' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Torre</label>
                                    <select
                                        required
                                        value={torre}
                                        onChange={(e) => { setTorre(e.target.value); setBloco(''); }}
                                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                    >
                                        <option value="">Selecione a Torre</option>
                                        {[1, 2, 3, 4, 5].map((num) => (
                                            <option key={num} value={num}>Torre {num}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* ── Apartamento: só para residentes (Morador, Subsíndico, Síndico Geral) ── */}
                            {['Morador', 'Subsíndico', 'Síndico Geral'].includes(cargo) && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Apartamento</label>
                                    <input
                                        type="text"
                                        required
                                        value={apartamento}
                                        onChange={(e) => setApartamento(e.target.value)}
                                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                        placeholder="00"
                                    />
                                </div>
                            )}

                            {/* ── Bloco: só para residentes na Torre 5 ── */}
                            {['Morador', 'Subsíndico', 'Síndico Geral'].includes(cargo) && torre === '5' && (
                                <div className="md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="block text-sm font-medium text-gray-700">Bloco (Torre 5)</label>
                                    <div className="mt-2 flex space-x-4">
                                        {['A', 'B'].map((b) => (
                                            <label key={b} className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    name="bloco"
                                                    value={b}
                                                    checked={bloco === b}
                                                    onChange={(e) => setBloco(e.target.value)}
                                                    className="form-radio h-4 w-4 text-violet-600 border-gray-300 focus:ring-violet-500"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">Bloco {b}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-4 px-4 border border-transparent text-base font-bold rounded-lg text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 transition-all shadow-lg hover:shadow-violet-200 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Cadastrando...' : 'Finalizar Cadastro'}
                            </button>
                        </div>
                    </form>

                    <div className="px-8 pb-8 text-center">
                        <p className="text-xs text-gray-400">
                            Ao se cadastrar, você concorda com nossos termos de uso e política de privacidade sob as diretrizes da LGPD (2026).
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
