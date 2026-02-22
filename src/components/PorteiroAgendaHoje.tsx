'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { KeyRound, CheckCircle2, ShieldAlert, Key } from 'lucide-react';

interface Reserva {
    id: string;
    data_reserva: string;
    hora_inicio: string;
    hora_fim: string;
    status: string;
    usuario_id: string;
    status_chave: string;
    usuarios: {
        nome_completo: string;
        torre: string;
        apartamento: string;
        foto_url?: string;
    };
}

export default function PorteiroAgendaHoje() {
    const [reservasHoje, setReservasHoje] = useState<Reserva[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [ocorrencia, setOcorrencia] = useState('');
    const [isDevolucaoModalOpen, setIsDevolucaoModalOpen] = useState(false);
    const [reservaSelecionada, setReservaSelecionada] = useState<Reserva | null>(null);

    const fetchReservasHoje = async () => {
        setIsLoading(true);
        const brtDate = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
        const dateStr = new Date(brtDate).toISOString().split('T')[0];

        try {
            // Fetch reservas along with User details linked to it
            const { data, error } = await supabase
                .from('reservas')
                .select(`
                    *,
                    usuarios:usuario_id (nome_completo, torre, apartamento, foto_url)
                `)
                .eq('data_reserva', dateStr)
                .eq('status', 'ativa')
                .order('hora_inicio', { ascending: true });

            if (error) throw error;
            setReservasHoje(data || []);
        } catch (error) {
            console.error("Erro ao buscar reservas de hoje:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReservasHoje();
    }, []);

    const processarChave = async (res: Reserva, acao: 'entregar' | 'receber') => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const payload = {
                acao,
                ocorrencia_texto: ocorrencia || null
            };

            const response = await fetch(`/api/reservas/${res.id}/chave`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'requester-id': session.user.id
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alert(`Chave registrada como ${acao === 'entregar' ? 'Entregue' : 'Recebida'}!`);
                setOcorrencia('');
                setIsDevolucaoModalOpen(false);
                setReservaSelecionada(null);
                fetchReservasHoje();
            } else {
                const errData = await response.json();
                alert(`Erro: ${errData.detail}`);
            }
        } catch (error) {
            console.error("Erro na operação de chaves", error);
        }
    };

    if (isLoading) return <div className="text-center p-8 text-gray-500">Carregando Prancheta...</div>;

    return (
        <div className="w-full">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Prancheta Operacional</h2>
                    <p className="text-sm text-gray-500">Controle de Chaves da Quadra Poliesportiva</p>
                </div>
            </div>

            {reservasHoje.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center shadow-sm">
                    <p className="text-gray-500 font-medium">Nenhuma reserva confirmada para hoje.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {reservasHoje.map((res) => (
                        <div key={res.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
                            <div className="p-4 flex items-center gap-4 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50">
                                <div className="w-14 h-14 rounded-full bg-gray-300 border-2 border-white shadow-sm overflow-hidden flex-shrink-0 relative">
                                    {res.usuarios?.foto_url ? (
                                        <img src={res.usuarios.foto_url} alt="Morador" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-500 text-xl font-bold">
                                            {res.usuarios?.nome_completo?.charAt(0) || '?'}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 leading-tight">{res.usuarios?.nome_completo}</p>
                                    <p className="text-xs font-semibold text-violet-700 bg-violet-100 inline-block px-2 py-0.5 rounded-full mt-1">
                                        Torre {res.usuarios?.torre} - Apto {res.usuarios?.apartamento}
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 flex-1 flex flex-col justify-center">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700 font-semibold text-sm">
                                            {res.hora_inicio.slice(0, 5)} - {res.hora_fim.slice(0, 5)}
                                        </span>
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${res.status_chave === 'em_uso' ? 'bg-amber-100 text-amber-700' :
                                            res.status_chave === 'concluida' ? 'bg-green-100 text-green-700' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>
                                        {res.status_chave.replace('_', ' ')}
                                    </span>
                                </div>

                                <div className="flex gap-2 mt-2">
                                    {res.status_chave === 'aguardando' && (
                                        <button
                                            onClick={() => processarChave(res, 'entregar')}
                                            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <Key className="w-4 h-4" /> Entregar Chave
                                        </button>
                                    )}

                                    {res.status_chave === 'em_uso' && (
                                        <button
                                            onClick={() => { setReservaSelecionada(res); setIsDevolucaoModalOpen(true); }}
                                            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <CheckCircle2 className="w-4 h-4" /> Receber Chave
                                        </button>
                                    )}

                                    {res.status_chave === 'concluida' && (
                                        <div className="flex-1 bg-gray-50 text-gray-400 py-2 rounded-lg font-semibold text-sm flex items-center justify-center text-center border border-gray-100">
                                            Turno Concluído
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Ocorrencia na Devolucao */}
            {isDevolucaoModalOpen && reservaSelecionada && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h3 className="font-bold text-lg text-gray-900 mb-2 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-teal-600" /> Registrar Devolução
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">A chave está sendo devolvida por {reservaSelecionada.usuarios.nome_completo}. Houve alguma ocorrência durante o uso da quadra?</p>

                        <textarea
                            rows={3}
                            value={ocorrencia}
                            onChange={(e) => setOcorrencia(e.target.value)}
                            className="w-full text-sm border-gray-300 rounded-lg p-3 bg-gray-50 mb-4 focus:ring-teal-500 focus:border-teal-500"
                            placeholder="Opcional. Exemplo: Rede do gol rasgada, barulho após horário..."
                        />

                        <div className="flex gap-3">
                            <button onClick={() => { setIsDevolucaoModalOpen(false); setOcorrencia(''); }} className="flex-1 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
                                Cancelar
                            </button>
                            <button onClick={() => processarChave(reservaSelecionada, 'receber')} className="flex-1 py-2 font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm">
                                Confirmar Recebimento
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
