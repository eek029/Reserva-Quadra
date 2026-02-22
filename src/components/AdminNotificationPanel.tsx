'use client';

import { useState, useEffect } from 'react';
import { Megaphone, Send, Users, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UsuarioBusca {
    id: string;
    nome_completo: string;
    torre: string;
    apartamento: string;
}

export default function AdminNotificationPanel() {
    const [target, setTarget] = useState('todos');
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // States for specific target dropdown
    const [usuariosOptions, setUsuariosOptions] = useState<UsuarioBusca[]>([]);
    const [selectedUserId, setSelectedUserId] = useState('');

    useEffect(() => {
        const fetchUsuarios = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Get logged-in user's role and torre to enforce Subsíndico isolation
            const { data: meData } = await supabase
                .from('usuarios')
                .select('cargo, torre')
                .eq('id', session.user.id)
                .single();

            let query = supabase
                .from('usuarios')
                .select('id, nome_completo, torre, apartamento')
                .eq('status', 'aprovado')
                .neq('id', session.user.id)
                .order('nome_completo', { ascending: true });

            // Subsíndico only sees users from their own torre
            if (meData?.cargo === 'Subsíndico' && meData.torre) {
                query = query.eq('torre', meData.torre);
            }

            const { data } = await query;
            if (data) setUsuariosOptions(data);
        };
        fetchUsuarios();
    }, []);

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;
        if (target === 'especifico' && !selectedUserId) {
            alert('Por favor, selecione um morador.');
            return;
        }

        try {
            setIsLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const payload = {
                mensagem: text,
                destinatario_id: target === 'especifico' ? selectedUserId : null
            };

            const { error: dbError } = await supabase
                .from('notificacoes')
                .insert([payload]);

            if (dbError) {
                console.error("Erro real na inserção (Supabase RLS/DB):", dbError);
                alert(`Erro ao enviar: ${dbError.message || 'Falha no banco de dados.'}`);
                return;
            }

            alert(target === 'especifico' ? "Mensagem enviada." : "Notificação enviada com sucesso para todos os moradores!");
            setText('');
            setSelectedUserId('');
        } catch (error) {
            console.error("Erro fatal/inesperado no envio:", error);
            alert("Erro de conexão ao enviar notificação.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mb-6 bg-white rounded-xl border border-violet-200 shadow-sm overflow-hidden">
            <div className="bg-violet-600 px-4 py-3 border-b flex items-center justify-between text-white">
                <h2 className="font-semibold flex items-center text-sm gap-2">
                    <Megaphone className="w-5 h-5" /> Mural e Comunicação
                </h2>
            </div>
            <form onSubmit={handleSendNotification} className="p-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Destinatário</label>
                    <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="target"
                                value="todos"
                                checked={target === 'todos'}
                                onChange={() => setTarget('todos')}
                                className="text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
                            />
                            <span className="text-sm font-medium flex items-center gap-1"><Users className="w-4 h-4 text-violet-500" /> Todos os Moradores</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="target"
                                value="especifico"
                                checked={target === 'especifico'}
                                onChange={() => setTarget('especifico')}
                                className="text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
                            />
                            <span className="text-sm font-medium text-gray-700">Morador Específico</span>
                        </label>
                    </div>
                    {target === 'especifico' && (
                        <div className="mt-3 relative">
                            <select
                                required
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-violet-500 focus:border-violet-500 appearance-none bg-white font-medium text-gray-700"
                            >
                                <option value="" disabled>Selecione um Morador...</option>
                                {usuariosOptions.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.nome_completo} (T{u.torre} - {u.apartamento})
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-3 pointer-events-none" />
                        </div>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo da Mensagem</label>
                    <textarea
                        rows={3}
                        required
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-violet-500 focus:border-violet-500 resize-none"
                        placeholder="Escreva a notificação (ex: Manutenção na bomba de água em 2 dias...)"
                    ></textarea>
                </div>
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`flex items-center py-2 px-6 rounded-xl font-bold shadow-md transition-colors gap-2 text-sm ${isLoading ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-violet-600 text-white hover:bg-violet-700'}`}
                    >
                        {isLoading ? 'Enviando...' : 'Disparar'} <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    );
}
