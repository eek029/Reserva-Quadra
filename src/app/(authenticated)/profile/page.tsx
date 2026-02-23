'use client';

import { useState, useEffect, useRef } from 'react';
import { Camera, ShieldAlert, Upload, Loader2, CheckCircle } from 'lucide-react';

import { supabase } from '@/lib/supabase';

interface Usuario {
    id: string;
    nome_completo: string;
    telefone: string;
    cargo: string;
    torre: string;
    apartamento: string;
    bloco?: string;
    status: string;
    foto_url?: string;
    cpf_encrypted?: string;
}

// Same masks as /register
const maskPhone = (value: string) =>
    value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2').slice(0, 15);

export default function ProfilePage() {
    const [user, setUser] = useState<Usuario | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // Editable fields
    const [telefone, setTelefone] = useState('');
    const [nomeReal, setNomeReal] = useState('');
    const [novoNome, setNovoNome] = useState('');
    const [novoCpf, setNovoCpf] = useState('');
    const [novaFotoUrl, setNovaFotoUrl] = useState('');
    const [novaFotoPreview, setNovaFotoPreview] = useState<string | null>(null);
    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { setLoading(false); return; }

            const { data } = await supabase
                .from('usuarios')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (data) {
                setUser(data);
                setTelefone(maskPhone(data.telefone || ''));
                setNomeReal(data.nome_completo || '');
                setNovoNome(data.nome_completo || '');
            }

            // Check pending requests
            const { data: pending } = await supabase
                .from('solicitacoes_perfil')
                .select('id')
                .eq('usuario_id', session.user.id)
                .eq('status', 'pendente');
            if (pending && pending.length > 0) setHasPendingRequest(true);

            setLoading(false);
        };
        fetchUserData();
    }, []);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            setNovaFotoPreview(result);
            setNovaFotoUrl(result);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSaving(true);
        setMessage({ text: '', type: '' });

        try {
            const telefoneChanged = telefone.trim() !== (user.telefone || '').trim();
            const nomeChanged = novoNome.trim() !== nomeReal.trim();
            const cpfChanged = novoCpf.trim().length > 0;
            const fotoChanged = novaFotoUrl.length > 0;

            if (!telefoneChanged && !nomeChanged && !cpfChanged && !fotoChanged) {
                setEditing(false);
                setSaving(false);
                return;
            }

            // ─── Safe fields: direct UPDATE ───
            if (telefoneChanged) {
                const { error } = await supabase
                    .from('usuarios')
                    .update({ telefone })
                    .eq('id', user.id);
                if (error) throw error;
                setUser({ ...user, telefone });
            }

            // ─── Sensitive fields: INSERT into solicitacoes_perfil ───
            if (nomeChanged || cpfChanged || fotoChanged) {
                const payload: Record<string, string> = { usuario_id: user.id };
                if (nomeChanged) payload.novo_nome = novoNome.trim();
                if (cpfChanged) payload.novo_cpf = novoCpf.trim();
                if (fotoChanged) payload.nova_foto_url = novaFotoUrl;

                const { error } = await supabase
                    .from('solicitacoes_perfil')
                    .insert([payload]);
                if (error) throw error;

                setHasPendingRequest(true);
                // Revert visual name until approved
                if (nomeChanged) setNovoNome(nomeReal);
                setNovoCpf('');
                setNovaFotoPreview(null);
                setNovaFotoUrl('');
            }

            setMessage({
                text: (nomeChanged || cpfChanged || fotoChanged)
                    ? 'Sua solicitação de alteração de dados sensíveis foi enviada para análise.'
                    : 'Perfil atualizado com sucesso.',
                type: 'success'
            });
            setEditing(false);
        } catch (err: unknown) {
            setMessage({ text: err instanceof Error ? err.message : 'Erro ao salvar.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
        );
    }

    if (!user) {
        return <div className="min-h-screen flex items-center justify-center"><p>Usuário não encontrado.</p></div>;
    }

    const displayName = user.nome_completo || '';
    const initials = displayName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

    return (
        <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">

                    {/* Header with avatar */}
                    <div className="bg-violet-600 px-8 py-8 text-white flex flex-col items-center">
                        <div className="relative w-24 h-24 mb-4 group">
                            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-violet-500 flex items-center justify-center">
                                {(novaFotoPreview || user.foto_url) ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={novaFotoPreview || user.foto_url}
                                        alt="Foto do Perfil"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-white text-2xl font-bold">{initials || '?'}</span>
                                )}
                            </div>
                            {editing && (
                                <label className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="w-6 h-6 text-white" />
                                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                </label>
                            )}
                        </div>
                        {editing && (
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 text-xs text-violet-200 hover:text-white mb-2">
                                <Upload className="w-3 h-3" /> Alterar foto
                            </button>
                        )}
                        <h1 className="text-2xl font-bold">{displayName}</h1>
                        <p className="text-violet-100 mt-1 text-sm">{user.cargo} — Torre {user.torre}, Apto {user.apartamento}</p>
                    </div>

                    <div className="p-8">
                        {/* Messages */}
                        {message.text && (
                            <div className={`mb-6 p-4 rounded-xl text-sm flex items-start gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {message.type === 'success' && <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                                {message.text}
                            </div>
                        )}

                        {/* Pending request warning */}
                        {hasPendingRequest && (
                            <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-semibold text-amber-800 text-sm">Atualização Pendente</h4>
                                    <p className="text-xs text-amber-700 mt-1">
                                        Você tem uma solicitação de alteração de dados sensíveis (Nome, CPF ou Foto) aguardando aprovação da administração.
                                    </p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSave} className="space-y-6">

                            {/* Sensitive fields notice */}
                            {editing && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                                    🔒 <strong>Campos seguros</strong> (Telefone) são atualizados imediatamente. <strong>Campos sensíveis</strong> (Nome, CPF, Foto) são enviados para aprovação da administração.
                                </div>
                            )}

                            {/* Nome */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nome Completo
                                    {editing && <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-semibold">⏳ Requer aprovação</span>}
                                </label>
                                <input
                                    type="text"
                                    disabled={!editing}
                                    value={editing ? novoNome : nomeReal}
                                    onChange={(e) => setNovoNome(e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 disabled:opacity-75 disabled:cursor-not-allowed sm:text-sm transition-colors"
                                />
                            </div>

                            {/* CPF (only in edit mode) */}
                            {editing && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Novo CPF
                                        <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-semibold">⏳ Requer aprovação</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={novoCpf}
                                        onChange={(e) => {
                                            const v = e.target.value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14);
                                            setNovoCpf(v);
                                        }}
                                        placeholder="000.000.000-00 (deixe em branco para não alterar)"
                                        className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                                        maxLength={14}
                                    />
                                </div>
                            )}

                            {/* Telefone - safe field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Telefone Celular
                                    {editing && <span className="ml-2 text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded font-semibold">✓ Atualização imediata</span>}
                                </label>
                                <input
                                    type="tel"
                                    disabled={!editing}
                                    value={telefone}
                                    onChange={(e) => setTelefone(maskPhone(e.target.value))}
                                    className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 disabled:opacity-75 disabled:cursor-not-allowed sm:text-sm transition-colors"
                                    placeholder="(11) 90000-0000"
                                    maxLength={15}
                                />
                            </div>

                            {/* Torre and Apto (read-only) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500">Torre</label>
                                    <input disabled value={user.torre || ''} className="mt-1 block w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500">Apartamento</label>
                                    <input disabled value={user.apartamento || ''} className="mt-1 block w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed sm:text-sm" />
                                </div>
                            </div>

                            {/* Role (read-only always) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-500">Cargo</label>
                                <input disabled value={user.cargo || ''} className="mt-1 block w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed sm:text-sm" />
                            </div>

                            <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                                {editing ? (
                                    <>
                                        <button type="button" onClick={() => { setEditing(false); setNovoNome(nomeReal); setTelefone(maskPhone(user.telefone || '')); setNovoCpf(''); setNovaFotoPreview(null); setNovaFotoUrl(''); }} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors">
                                            Cancelar
                                        </button>
                                        <button type="submit" disabled={saving} className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70">
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Salvar Alterações
                                        </button>
                                    </>
                                ) : (
                                    <button type="button" onClick={() => setEditing(true)} className="px-6 py-2 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg font-medium transition-colors">
                                        Editar Perfil
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </main>
    );
}
