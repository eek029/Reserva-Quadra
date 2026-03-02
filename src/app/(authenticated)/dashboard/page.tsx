'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, List, ChevronLeft, ChevronRight, Ban, Clock, Users } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AdminApprovalPanel from '@/components/AdminApprovalPanel';
import ProfileReviewPanel from '@/components/ProfileReviewPanel';
import AdminNotificationPanel from '@/components/AdminNotificationPanel';
import PorteiroAgendaHoje from '@/components/PorteiroAgendaHoje';
import MinhasReservas from '@/components/MinhasReservas';

interface Slot {
    id: number;
    time: string;
    status: string;
    hora_inicio: string;
    hora_fim: string;
}

interface Usuario {
    id: string;
    nome?: string;
    nome_completo?: string;
    torre?: string;
    apartamento?: string;
    cargo?: string;
    status?: string;
    suspenso_ate?: string;
    foto_url?: string;
}

interface ReservaSlotAdmin {
    reserva_id: string;
    usuario_id: string;
    slot: Slot;
    usuarios: {
        nome?: string;
        nome_completo?: string;
        foto_url?: string;
        torre?: string;
        apartamento?: string;
        cargo?: string;
    } | null;
}

const generateEmptySlots = (): Slot[] => {
    const slots = [];
    for (let i = 9; i < 22; i++) {
        slots.push({
            id: i,
            time: `${i.toString().padStart(2, '0')}:00 - ${(i + 1).toString().padStart(2, '0')}:00`,
            status: 'livre',
            hora_inicio: `${i.toString().padStart(2, '0')}:00`,
            hora_fim: `${(i + 1).toString().padStart(2, '0')}:00`,
        });
    }
    return slots;
};

export default function DashboardPage() {
    const [currentDate, setCurrentDate] = useState(() => {
        return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    });
    const [slots, setSlots] = useState<Slot[]>(generateEmptySlots());
    const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
    const [activeTab, setActiveTab] = useState<'calendario' | 'minhas-reservas'>('calendario');
    const [slotsReservaMap, setSlotsReservaMap] = useState<Record<string, ReservaSlotAdmin>>({});

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
    const [agreed, setAgreed] = useState(false);
    const [isSuspenderModalOpen, setIsSuspenderModalOpen] = useState(false);
    const [suspenderTarget, setSuspenderTarget] = useState<ReservaSlotAdmin | null>(null);
    const [suspensaoDias, setSuspensaoDias] = useState(3);

    useEffect(() => {
        const loadUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: user } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single();
                setCurrentUser(user);
            }
        };
        loadUser();
    }, []);

    const fetchReservas = useCallback(async () => {
        // FIX: use locale-aware date string (BRT) to avoid timezone off-by-one
        const dateStr = currentDate.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || '';

            let reservas: Record<string, unknown>[] = [];

            const res = await fetch(`/api/reservas?data=${dateStr}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                reservas = await res.json();
            } else {
                // Fallback with correct join alias and status filter
                const { data } = await supabase
                    .from('reservas')
                    .select('*, usuarios:usuario_id(nome_completo, foto_url, torre, apartamento, cargo)')
                    .eq('data_reserva', dateStr)
                    .eq('status', 'ativa');
                if (data) reservas = data;
            }

            const currentSlots = generateEmptySlots();
            const newMap: Record<string, ReservaSlotAdmin> = {};

            reservas?.forEach((reserva) => {
                const reservaStart = (reserva.hora_inicio as string || '').slice(0, 5); // "09:00"
                const slotHour = parseInt(reservaStart.split(':')[0], 10);               // 9

                // FIX: match by numeric hour (slot.id) — robust against "HH:MM" vs "HH:MM:SS"
                const match = currentSlots.find(s => s.id === slotHour);

                if (match) {
                    match.status = 'ocupado';
                    if (reserva.id && reserva.usuario_id) {
                        const dadosUsuario = Array.isArray(reserva.usuarios)
                            ? reserva.usuarios[0]
                            : reserva.usuarios;
                        newMap[String(match.id)] = {
                            reserva_id: reserva.id as string,
                            usuario_id: reserva.usuario_id as string,
                            slot: match,
                            usuarios: dadosUsuario as ReservaSlotAdmin['usuarios'],
                        };
                    }
                }
            });

            setSlotsReservaMap(newMap);
            setSlots(currentSlots);
        } catch (err) {
            console.error(err);
        }
    }, [currentDate]);

    useEffect(() => {
        if (currentUser) fetchReservas();
    }, [currentUser, fetchReservas]);

    const handleSuspenderUser = async () => {
        if (!suspenderTarget) return;
        const dataSuspensao = new Date();
        dataSuspensao.setDate(dataSuspensao.getDate() + suspensaoDias);
        await supabase.from('usuarios').update({ suspenso_ate: dataSuspensao.toISOString() }).eq('id', suspenderTarget.usuario_id);
        alert('Usuário suspenso com sucesso!');
        setIsSuspenderModalOpen(false);
        fetchReservas();
    };

    const confirmReservation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSlot || !currentUser) return;
        const dateStr = currentDate.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        const payload = {
            data_reserva: dateStr,
            hora_inicio: selectedSlot.hora_inicio + ':00',
            hora_fim: selectedSlot.hora_fim + ':00',
            aceite_termos: agreed,
            usuario_id: currentUser.id,
        };
        const { error } = await supabase.from('reservas').insert([payload]);
        if (!error) {
            alert('Reserva feita com sucesso!');
            fetchReservas();
        } else {
            alert('Erro ao fazer reserva: ' + error.message);
        }
        setIsModalOpen(false);
        setAgreed(false);
    };

    const navigateDate = (delta: number) => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() + delta);
            return d;
        });
    };

    if (!currentUser) return <div className="p-10 text-center font-bold text-violet-600">Carregando tatame...</div>;

    const isAdmin = ['Síndico Geral', 'Subsíndico', 'SysAdmin'].includes(currentUser.cargo || '');
    const isSindicoOuSysAdmin = ['Síndico Geral', 'SysAdmin'].includes(currentUser.cargo || '');

    return (
        <div className="flex-1 max-w-4xl mx-auto w-full p-4 flex flex-col pb-24">

            {isAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <AdminApprovalPanel currentUserRole={currentUser.cargo!} />
                    <AdminNotificationPanel />
                    <ProfileReviewPanel
                        currentUserId={currentUser.id}
                        currentUserRole={currentUser.cargo!}
                        currentUserTorre={currentUser.torre!}
                    />
                    {/* RESTAURADO: Card de Gestão de Usuários */}
                    {isSindicoOuSysAdmin && (
                        <Link
                            href="/dashboard/usuarios"
                            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4 hover:border-violet-300 hover:shadow-md transition-all group"
                        >
                            <div className="p-3 bg-violet-50 rounded-xl group-hover:bg-violet-100 transition-colors">
                                <Users className="w-6 h-6 text-violet-600" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-sm font-semibold text-gray-700 group-hover:text-violet-700 transition-colors">
                                    Gestão de Usuários
                                </h2>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Visualizar, suspender ou excluir moradores
                                </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-400 transition-colors" />
                        </Link>
                    )}
                </div>
            )}

            {currentUser.cargo === 'Porteiro' ? (
                <PorteiroAgendaHoje />
            ) : activeTab === 'minhas-reservas' ? (
                <MinhasReservas />
            ) : (
                <>
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-100">
                        <button onClick={() => navigateDate(-1)} className="p-2 text-violet-600"><ChevronLeft /></button>
                        <div className="text-center">
                            <h2 className="text-lg font-bold capitalize">
                                {new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' }).format(currentDate)}
                            </h2>
                            <p className="text-xs text-gray-400 font-bold uppercase">
                                {currentUser.cargo} - {currentUser.torre || 'Geral'}
                            </p>
                        </div>
                        <button onClick={() => navigateDate(1)} className="p-2 text-violet-600"><ChevronRight /></button>
                    </div>

                    <div className="space-y-3">
                        {slots.map((slot) => {
                            const info = slotsReservaMap[String(slot.id)];
                            return (
                                <div
                                    key={slot.id}
                                    onClick={() => slot.status === 'livre' && (setSelectedSlot(slot), setIsModalOpen(true))}
                                    className={`flex items-center justify-between p-4 rounded-xl border ${slot.status === 'livre'
                                        ? 'bg-white border-violet-100 cursor-pointer hover:border-violet-300 transition-all'
                                        : 'bg-gray-50 border-gray-200'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className={`font-bold ${slot.status === 'livre' ? 'text-violet-600' : 'text-gray-400'}`}>
                                            {slot.time}
                                        </span>
                                        {slot.status === 'ocupado' && isAdmin && info?.usuarios && (
                                            <div className="flex items-center gap-2 border-l pl-4 border-gray-200">
                                                <img
                                                    src={info.usuarios.foto_url || '/avatar-purple.png'}
                                                    alt="Avatar"
                                                    referrerPolicy="no-referrer"
                                                    className="w-8 h-8 rounded-full object-cover bg-violet-100"
                                                    onError={(e) => { e.currentTarget.src = '/avatar-purple.png'; }}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-700">
                                                        {info.usuarios.nome_completo || info.usuarios.nome}
                                                    </span>
                                                    {(info.usuarios.torre || info.usuarios.apartamento) && (
                                                        <span className="text-xs text-gray-500">
                                                            {info.usuarios.torre ? `Torre ${info.usuarios.torre}` : ''}
                                                            {info.usuarios.torre && info.usuarios.apartamento ? ' - ' : ''}
                                                            {info.usuarios.apartamento ? `Apto ${info.usuarios.apartamento}` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${slot.status === 'livre' ? 'bg-green-50 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                                            {slot.status}
                                        </span>
                                        {isAdmin && info && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSuspenderTarget(info); setIsSuspenderModalOpen(true); }}
                                                className="p-1 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors"
                                                title="Suspender morador"
                                            >
                                                <Ban className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
                        <h3 className="font-bold text-lg mb-4 text-violet-700">Confirmar Reserva: {selectedSlot?.time}</h3>
                        <label className="flex items-center gap-2 mb-6 cursor-pointer text-sm">
                            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="w-5 h-5" />
                            <span>Li e concordo com as <Link href="/regras" className="text-violet-600 underline">Regras da Quadra</Link>.</span>
                        </label>
                        <div className="flex gap-2">
                            <button onClick={() => { setIsModalOpen(false); setAgreed(false); }} className="flex-1 py-2 font-bold text-gray-400">Voltar</button>
                            <button onClick={confirmReservation} disabled={!agreed} className="flex-1 py-2 bg-violet-600 text-white font-bold rounded-lg disabled:opacity-50">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {isSuspenderModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm border-t-8 border-orange-500">
                        <h3 className="font-black text-gray-800 mb-2 flex items-center gap-2">
                            <Clock className="text-orange-600" /> Suspender Morador
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Dias de suspensão para <strong>{suspenderTarget?.usuarios?.nome_completo || suspenderTarget?.usuarios?.nome}</strong>:
                        </p>
                        <div className="flex gap-2 mb-6">
                            {[3, 7, 15, 30].map(d => (
                                <button key={d} onClick={() => setSuspensaoDias(d)}
                                    className={`flex-1 py-2 rounded-lg font-bold transition-colors ${suspensaoDias === d ? 'bg-orange-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                                    {d}d
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setIsSuspenderModalOpen(false)} className="flex-1 py-2 font-bold text-gray-400">Sair</button>
                            <button onClick={handleSuspenderUser} className="flex-1 py-2 bg-orange-600 text-white font-bold rounded-lg">Suspender</button>
                        </div>
                    </div>
                </div>
            )}

            <nav className="fixed bottom-0 left-0 w-full bg-white border-t p-2 flex justify-around shadow-lg">
                <button onClick={() => setActiveTab('minhas-reservas')} className={`flex flex-col items-center p-2 rounded-xl ${activeTab === 'minhas-reservas' ? 'text-violet-600 bg-violet-50' : 'text-gray-400'}`}>
                    <List /><span className="text-[10px] font-bold mt-1 uppercase">Reservas</span>
                </button>
                <button onClick={() => setActiveTab('calendario')} className={`flex flex-col items-center p-2 rounded-xl ${activeTab === 'calendario' ? 'text-violet-600 bg-violet-50' : 'text-gray-400'}`}>
                    <CalendarIcon /><span className="text-[10px] font-bold mt-1 uppercase">Quadro</span>
                </button>
            </nav>
        </div>
    );
}
