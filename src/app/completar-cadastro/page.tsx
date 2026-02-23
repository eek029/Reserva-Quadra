'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Camera, Upload, Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function CompletarCadastroPage() {
    const router = useRouter();

    // Auth data (pre-filled)
    const [authEmail, setAuthEmail] = useState('');
    const [authUserId, setAuthUserId] = useState('');

    // Form fields
    const [nomeCompleto, setNomeCompleto] = useState('');
    const [cargo, setCargo] = useState('Morador');
    const [torre, setTorre] = useState('');
    const [apartamento, setApartamento] = useState('');
    const [bloco, setBloco] = useState('');
    const [cpf, setCpf] = useState('');
    const [rg, setRg] = useState('');
    const [dataNascimento, setDataNascimento] = useState('');
    const [telefone, setTelefone] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Address visibility rules
    // SysAdmin  → no address fields
    // Porteiro  → Torre only
    // Others    → Torre + Apto + Bloco(if T5)
    const isResident = ['Morador', 'Subsíndico', 'Síndico Geral'].includes(cargo);
    const showTorre = cargo !== 'SysAdmin';
    const showApto = isResident;
    const showBloco = isResident && torre === '5';

    // --- Masks ---
    const maskCpf = (value: string) =>
        value.replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
            .slice(0, 14);

    const maskPhone = (value: string) =>
        value.replace(/\D/g, '')
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
            .slice(0, 15);

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

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setPreviewImage(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    // Load auth user on mount; redirect to / if not logged in
    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.replace('/');
                return;
            }

            setAuthUserId(session.user.id);
            setAuthEmail(session.user.email || '');
            // Pre-fill name from OAuth metadata if available
            const metaName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
            if (metaName) setNomeCompleto(metaName);

            // If profile is already complete, go to dashboard
            const { data: profile } = await supabase
                .from('usuarios')
                .select('cpf_encrypted, cargo')
                .eq('id', session.user.id)
                .maybeSingle();

            if (profile?.cpf_encrypted && profile?.cargo) {
                router.replace('/dashboard');
                return;
            }

            setPageLoading(false);
        };
        init();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        if (!validateCpf(cpf)) {
            setError('CPF inválido. Por favor, verifique o número digitado.');
            return;
        }
        const phoneDigits = telefone.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
            setError('Celular incompleto. Por favor, verifique o número.');
            return;
        }
        if (showTorre && !torre) {
            setError('Selecione a sua Torre.');
            return;
        }
        if (showApto && !apartamento) {
            setError('Informe o seu Apartamento.');
            return;
        }

        setLoading(true);
        try {
            const updatePayload: Record<string, string | null> = {
                nome_completo: nomeCompleto,
                cpf,
                rg: rg || 'Não informado',
                data_nascimento: dataNascimento,
                telefone,
                cargo,
                torre: showTorre ? torre : null,
                apartamento: showApto ? apartamento : null,
                bloco: showBloco ? bloco : null,
                foto_url: previewImage || null,
                status: 'pendente',
            };

            const { error: dbError } = await supabase
                .from('usuarios')
                .update(updatePayload)
                .eq('id', authUserId);

            if (dbError) throw dbError;

            router.replace('/dashboard');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar dados.');
        } finally {
            setLoading(false);
        }
    };

    if (pageLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    {/* Header */}
                    <div className="bg-violet-600 px-8 py-8 text-white text-center flex flex-col items-center">
                        <div className="relative w-20 h-20 mb-4 rounded-full overflow-hidden shadow-md border-2 border-white">
                            <Image src="/Complexo.jpeg" alt="Logo do Complexo" fill className="object-cover" priority />
                        </div>
                        <h1 className="text-2xl font-bold">Complete seu Cadastro</h1>
                        <p className="text-violet-100 mt-1">Preencha os dados abaixo para continuar.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm text-center">{error}</div>
                        )}

                        {/* Foto */}
                        <div className="flex flex-col items-center space-y-4">
                            <div className="relative w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden group">
                                {previewImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <Camera className="w-10 h-10 text-gray-400" />
                                )}
                                <label className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                    <Upload className="text-white w-6 h-6" />
                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                </label>
                            </div>
                            <span className="text-sm font-medium text-gray-700">Sua Foto</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Dados de Acesso */}
                            <div className="md:col-span-2">
                                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-2">Dados de Acesso</h3>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">E-mail (não editável)</label>
                                <input
                                    type="email"
                                    value={authEmail}
                                    disabled
                                    className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 sm:text-sm cursor-not-allowed"
                                />
                            </div>

                            {/* Dados Pessoais */}
                            <div className="md:col-span-2 mt-2">
                                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-2">Dados Pessoais</h3>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                                <input
                                    type="text"
                                    required
                                    value={nomeCompleto}
                                    onChange={e => setNomeCompleto(e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                                    placeholder="Seu nome completo"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">RG (Opcional)</label>
                                <input
                                    type="text"
                                    value={rg}
                                    onChange={e => setRg(e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                                    placeholder="00.000.000-0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">CPF</label>
                                <input
                                    type="text"
                                    required
                                    value={cpf}
                                    onChange={e => setCpf(maskCpf(e.target.value))}
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                                    placeholder="000.000.000-00"
                                    maxLength={14}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Data de Nascimento</label>
                                <input
                                    type="date"
                                    required
                                    value={dataNascimento}
                                    onChange={e => setDataNascimento(e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Telefone Celular</label>
                                <input
                                    type="tel"
                                    required
                                    value={telefone}
                                    onChange={e => setTelefone(maskPhone(e.target.value))}
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                                    placeholder="(11) 90000-0000"
                                    maxLength={15}
                                />
                            </div>

                            {/* Cargo */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Seu Cargo</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {['Morador', 'Porteiro', 'Subsíndico', 'Síndico Geral'].map(item => (
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

                            {/* ── Torre: todos exceto SysAdmin ── */}
                            {showTorre && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Torre</label>
                                    <select
                                        required
                                        value={torre}
                                        onChange={e => { setTorre(e.target.value); setBloco(''); }}
                                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                                    >
                                        <option value="">Selecione a Torre</option>
                                        {[1, 2, 3, 4, 5].map(num => (
                                            <option key={num} value={num}>Torre {num}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* ── Apartamento: só residentes ── */}
                            {showApto && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Apartamento</label>
                                    <input
                                        type="text"
                                        required
                                        value={apartamento}
                                        onChange={e => setApartamento(e.target.value)}
                                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                                        placeholder="00"
                                    />
                                </div>
                            )}

                            {/* ── Bloco: residentes na Torre 5 ── */}
                            {showBloco && (
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Bloco (Torre 5)</label>
                                    <div className="mt-2 flex space-x-4">
                                        {['A', 'B'].map(b => (
                                            <label key={b} className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    name="bloco"
                                                    value={b}
                                                    checked={bloco === b}
                                                    onChange={e => setBloco(e.target.value)}
                                                    className="form-radio h-4 w-4 text-violet-600 border-gray-300"
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
                                {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Salvando...</> : 'Concluir Cadastro'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}
