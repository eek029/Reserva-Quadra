'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CalendarCheck2, Clock, X, CheckCircle, Loader2 } from 'lucide-react';

interface Reserva {
    id: string;
    data_reserva: string;
    hora_inicio: string;
    hora_fim: string;
    status: string;
}

export default function MinhasReservas() {
    const [reservas, setReservas] = useState<Reserva[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    const fetchMinhasReservas = async () => {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
            .from('reservas')
            .select('id, data_reserva, hora_inicio, hora_fim, status')
            .eq('usuario_id', session.user.id)
            .neq('status', 'cancelada')
            .order('data_reserva', { ascending: false })
            .order('hora_inicio', { ascending: false });

        if (!error && data) setReservas(data);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchMinhasReservas();
    }, []);

    const cancelarReserva = async (reservaId: string) => {
        if (!confirm('Confirma o cancelamento desta reserva?')) return;
        setCancellingId(reservaId);

        const { error } = await supabase
            .from('reservas')
            .update({ status: 'cancelada' })
            .eq('id', reservaId);

        if (!error) {
            setReservas(prev => prev.filter(r => r.id !== reservaId));
        } else {
            alert('Erro ao cancelar. Tente novamente.');
        }
        setCancellingId(null);
    };

    const isFutura = (reserva: Reserva) => {
        const dataHora = new Date(`${reserva.data_reserva}T${reserva.hora_fim}`);
        return dataHora > new Date();
    };

    const formatDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        return new Date(Number(year), Number(month) - 1, Number(day))
            .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando reservas...
            </div>
        );
    }

    if (reservas.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400">
                <CalendarCheck2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Você não tem reservas ativas.</p>
                <p className="text-sm mt-1">Acesse a aba Calendário para fazer uma nova reserva.</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Minhas Reservas</h2>
            <div className="space-y-3">
                {reservas.map(reserva => {
                    const futura = isFutura(reserva);
                    return (
                        <div key={reserva.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${futura ? 'bg-violet-50' : 'bg-gray-50'}`}>
                                    <CalendarCheck2 className={`w-5 h-5 ${futura ? 'text-violet-600' : 'text-gray-400'}`} />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-800 capitalize text-sm">{formatDate(reserva.data_reserva)}</p>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                        <Clock className="w-3 h-3" />
                                        {reserva.hora_inicio.slice(0, 5)} – {reserva.hora_fim.slice(0, 5)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {futura ? (
                                    <>
                                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> Ativa
                                        </span>
                                        <button
                                            onClick={() => cancelarReserva(reserva.id)}
                                            disabled={cancellingId === reserva.id}
                                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                                            title="Cancelar reserva"
                                        >
                                            {cancellingId === reserva.id
                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                : <X className="w-4 h-4" />
                                            }
                                        </button>
                                    </>
                                ) : (
                                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                                        Concluída
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
