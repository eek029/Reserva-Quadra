'use client';

import { useState, useEffect } from 'react';
import { User as UserIcon, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Usuario {
    id: string;
    nome_completo: string;
    telefone: string;
    cargo: string;
    torre: string;
    apartamento: string;
    status: string;
    nome?: string;
    apto?: string;
}

export default function ProfilePage() {
    const [user, setUser] = useState<Usuario | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);

    // Editable fields
    const [telefone, setTelefone] = useState('');
    const [nomeReal, setNomeReal] = useState('');
    // Pending requests
    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // Fetch real user data
                try {
                    const res = await fetch(`/api/usuarios/${session.user.id}`, {
                        headers: { 'requester-id': session.user.id }
                    });
                    if (res.ok) {
                        const userData = await res.json();
                        setUser(userData);
                        setTelefone(userData.telefone || '');
                        setNomeReal(userData.nome_completo || userData.nome || '');
                    } else {
                        // Fallback
                        const { data } = await supabase
                            .from('usuarios')
                            .select('*')
                            .eq('id', session.user.id)
                            .single();
                        if (data) {
                            setUser(data);
                            setTelefone(data.telefone || '');
                            setNomeReal(data.nome_completo || data.nome || '');
                        }
                    }

                    // Check for pending requests
                    const { data: requestList } = await supabase
                        .from('profile_update_requests')
                        .select('*')
                        .eq('usuario_id', session.user.id)
                        .eq('status', 'pendente');

                    if (requestList && requestList.length > 0) {
                        setHasPendingRequest(true);
                    }
                } catch (err) {
                    console.error("Error fetching user data", err);
                }
            }
            setLoading(false);
        };

        fetchUserData();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });

        if (!user) return;

        try {
            // Se o nome foi alterado, enviamos solicitação pendente
            const originalNome = user.nome_completo || user.nome;
            const nomeChanged = nomeReal.trim() !== originalNome?.trim();
            const telefoneChanged = telefone.trim() !== user.telefone?.trim();

            if (!nomeChanged && !telefoneChanged) {
                setEditing(false);
                return;
            }

            // Normal update for non-sensitive fields like phone
            if (telefoneChanged) {
                const { error } = await supabase
                    .from('usuarios')
                    .update({ telefone })
                    .eq('id', user.id);

                if (error) throw error;
                setUser({ ...user, telefone });
            }

            // Sensitive fields update request (Name, etc)
            if (nomeChanged) {
                const { error: reqError } = await supabase
                    .from('profile_update_requests')
                    .insert([{
                        usuario_id: user.id,
                        novo_nome_completo: nomeReal,
                        status: 'pendente'
                    }]);

                if (reqError) throw reqError;
                setHasPendingRequest(true);
            }

            setMessage({
                text: nomeChanged
                    ? 'Suas alterações sensíveis (Nome) foram enviadas para aprovação. O telefone foi atualizado.'
                    : 'Perfil atualizado com sucesso.',
                type: 'success'
            });
            setEditing(false);

            if (nomeChanged) {
                // Revert visual change until approved
                setNomeReal(originalNome || '');
            }
        } catch (error: unknown) {
            console.error("Error updating profile:", error);
            setMessage({ text: error instanceof Error ? error.message : 'Erro ao atualizar perfil.', type: 'error' });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-600"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p>Usuário não encontrado.</p>
            </div>
        );
    }

    return (
        <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="bg-violet-600 px-8 py-8 text-white flex flex-col items-center">
                        <div className="relative w-24 h-24 mb-4 rounded-full overflow-hidden shadow-md border-4 border-white bg-white flex items-center justify-center text-violet-600">
                            <UserIcon className="w-12 h-12" />
                        </div>
                        <h1 className="text-2xl font-bold">{user.nome_completo || user.nome}</h1>
                        <p className="text-violet-100 mt-1">{user.cargo} - Torre {user.torre}, Apto {user.apartamento || user.apto}</p>
                    </div>

                    <div className="p-8">
                        {message.text && (
                            <div className={`mb-6 p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {message.text}
                            </div>
                        )}

                        {hasPendingRequest && (
                            <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-semibold text-amber-800 text-sm">Atualização Pendente</h4>
                                    <p className="text-xs text-amber-700 mt-1">
                                        Você tem uma solicitação de alteração de dados sensíveis (Nome, CPF ou Foto) aguardando aprovação do Síndico ou Subsíndico.
                                    </p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSave} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                                <div className="mt-1 relative">
                                    <input
                                        type="text"
                                        disabled={!editing}
                                        value={nomeReal}
                                        onChange={(e) => setNomeReal(e.target.value)}
                                        className="block w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 disabled:opacity-75 disabled:cursor-not-allowed sm:text-sm transition-colors"
                                    />
                                    {editing && <p className="text-xs text-amber-600 mt-1">Alterações no nome requerem aprovação da administração.</p>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Telefone</label>
                                <input
                                    type="tel"
                                    disabled={!editing}
                                    value={telefone}
                                    onChange={(e) => setTelefone(e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 disabled:opacity-75 disabled:cursor-not-allowed sm:text-sm transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500">Torre</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={user.torre || ''}
                                        className="mt-1 block w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed sm:text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500">Apartamento</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={user.apartamento || user.apto || ''}
                                        className="mt-1 block w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed sm:text-sm"
                                    />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                                {editing ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditing(false);
                                                setNomeReal(user.nome_completo || user.nome || '');
                                                setTelefone(user.telefone || '');
                                            }}
                                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                                        >
                                            Salvar Alterações
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setEditing(true)}
                                        className="px-6 py-2 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg font-medium transition-colors"
                                    >
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
