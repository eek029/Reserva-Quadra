'use client';

import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, List, X, ChevronLeft, ChevronRight, Check, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Define types to replace 'any'
interface Slot {
    id: number;
    time: string;
    status: string;
    hora_inicio: string;
    hora_fim: string;
}

interface Usuario {
    id?: string;
    nome_completo?: string;
    nome?: string;
    torre?: string;
    apartamento?: string;
    apto?: string;
    cargo?: string;
    status?: string;
}

interface Reserva {
    id?: string;
    data_reserva?: string;
    hora_inicio?: string;
    hora_fim?: string;
    status?: string;
    usuario_id?: string;
}

// Helper to generate empty slots
const generateEmptySlots = (): Slot[] => {
    const slots = [];
    for (let i = 9; i < 22; i++) {
        slots.push({
            id: i,
            time: `${i.toString().padStart(2, '0')}:00 - ${(i + 1).toString().padStart(2, '0')}:00`,
            status: 'livre',
            hora_inicio: `${i.toString().padStart(2, '0')}:00:00`,
            hora_fim: `${(i + 1).toString().padStart(2, '0')}:00:00`,
        });
    }
    return slots;
};

export default function DashboardPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [slots, setSlots] = useState<Slot[]>(generateEmptySlots());
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

    // Auth & Data states
    const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
    const [sessionUser, setSessionUser] = useState<{ id: string } | null>(null);
    const [pendingUsers, setPendingUsers] = useState<Usuario[]>([]);
    const [sindicosList, setSindicosList] = useState<Usuario[]>([]);

    useEffect(() => {
        const loadInitialData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setSessionUser(session.user);

                // Fetch real user data
                try {
                    const res = await fetch(`/api/usuarios/${session.user.id}`, {
                        headers: { 'requester-id': session.user.id }
                    });
                    if (res.ok) {
                        const userData = await res.json();
                        setCurrentUser(userData);

                        // Check if admin to fetch pending approvals
                        if (userData && (userData.cargo === 'Síndico Geral' || userData.cargo === 'Subsíndico' || userData.cargo === 'SysAdmin')) {
                            const { data: pending } = await supabase
                                .from('usuarios')
                                .select('*')
                                .eq('status', 'pendente');
                            if (pending) {
                                setPendingUsers(pending);
                            }

                            // Specific to SysAdmin: fetch active Síndico Geral to allow revoking
                            if (userData.cargo === 'SysAdmin') {
                                const { data: sindicos } = await supabase
                                    .from('usuarios')
                                    .select('*')
                                    .eq('cargo', 'Síndico Geral')
                                    .eq('status', 'aprovado');
                                if (sindicos) {
                                    setSindicosList(sindicos);
                                }
                            }
                        }
                    } else {
                        // Fallback check directly in supabase
                        const { data: fallbackUser } = await supabase
                            .from('usuarios')
                            .select('*')
                            .eq('id', session.user.id)
                            .single();
                        if (fallbackUser) {
                            setCurrentUser(fallbackUser);
                            if (fallbackUser.cargo === 'Síndico Geral' || fallbackUser.cargo === 'Subsíndico' || fallbackUser.cargo === 'SysAdmin') {
                                const { data: pending } = await supabase
                                    .from('usuarios')
                                    .select('*')
                                    .eq('status', 'pendente');
                                if (pending) setPendingUsers(pending);

                                if (fallbackUser.cargo === 'SysAdmin') {
                                    const { data: sindicos } = await supabase
                                        .from('usuarios')
                                        .select('*')
                                        .eq('cargo', 'Síndico Geral')
                                        .eq('status', 'aprovado');
                                    if (sindicos) setSindicosList(sindicos);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error fetching user", err);
                }
            }
        };

        loadInitialData();
    }, []);

    useEffect(() => {
        const fetchReservas = async () => {
            const dateStr = currentDate.toISOString().split('T')[0];
            try {
                // Fetch valid appointments
                const res = await fetch(`/api/reservas?data=${dateStr}`);
                let reservas = [];

                if (res.ok) {
                    reservas = await res.json();
                } else {
                    // Fallback to supabase if API endpoint not up
                    const { data } = await supabase
                        .from('reservas')
                        .select('*')
                        .eq('data_reserva', dateStr)
                        .eq('status', 'ativa');
                    if (data) reservas = data;
                }

                const currentSlots = generateEmptySlots();
                reservas.forEach((reserva: Reserva) => {
                    const match = currentSlots.find(s => s.hora_inicio === reserva.hora_inicio);
                    if (match) {
                        match.status = 'ocupado';
                    }
                });

                setSlots(currentSlots);
            } catch (err) {
                console.error("Error fetching reservas", err);
            }
        };

        fetchReservas();
    }, [currentDate]);

    const handlePrevDay = () => {
        const prev = new Date(currentDate);
        prev.setDate(currentDate.getDate() - 1);
        setCurrentDate(prev);
    };

    const handleNextDay = () => {
        const next = new Date(currentDate);
        next.setDate(currentDate.getDate() + 1);
        setCurrentDate(next);
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: 'short',
        }).format(date);
    };

    const confirmReservation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!agreed) return;

        // If simple modal open from Plus button, we will pick random available slot or 10-12
        // Since original had no slot selection in the form, let's try pushing chosen slot if clicked, otherwise default.
        const defaultSlot = slots.find(s => s.status === 'livre');
        const targetSlot = selectedSlot || defaultSlot;

        if (!targetSlot) {
            alert('Não há horários livres neste dia.');
            return;
        }

        const payload = {
            data_reserva: currentDate.toISOString().split('T')[0],
            hora_inicio: targetSlot.hora_inicio,
            hora_fim: targetSlot.hora_fim,
            aceite_termos: agreed,
            usuario_id: sessionUser?.id || "uuid-placeholder"
        };

        try {
            const res = await fetch('/api/reservas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert('Reserva solicitada com sucesso!');
                const updatedSlots = [...slots];
                const matchIndex = updatedSlots.findIndex(s => s.id === targetSlot.id);
                if (matchIndex !== -1) {
                    updatedSlots[matchIndex].status = 'ocupado';
                }
                setSlots(updatedSlots);
            } else {
                const errorData = await res.json();
                alert(`Erro: ${errorData.detail || 'Falha ao reservar.'}`);
            }
        } catch (err) {
            console.error(err);
            alert('Falha na comunicação com o servidor.');
        }

        setIsModalOpen(false);
        setAgreed(false);
        setSelectedSlot(null);
    };

    const handleSlotClick = (slot: Slot) => {
        if (slot.status === 'livre') {
            setSelectedSlot(slot);
            setIsModalOpen(true);
        }
    };

    return (
        <>
            <div className="flex-1 max-w-4xl mx-auto w-full p-4 flex flex-col pb-24">
                {/* Admin Area: Aprovações Pendentes */}
                {currentUser && (currentUser.cargo === 'Síndico Geral' || currentUser.cargo === 'Subsíndico' || currentUser.cargo === 'SysAdmin') && pendingUsers.filter(p => currentUser.cargo === 'SysAdmin' || (p.cargo !== 'SysAdmin' && p.cargo !== 'Síndico Geral')).length > 0 && (
                    <div className="mb-6 bg-white rounded-xl border border-violet-200 shadow-sm overflow-hidden">
                        <div className="bg-violet-50 px-4 py-3 border-b border-violet-100 flex items-center justify-between">
                            <h2 className="text-violet-800 font-semibold flex items-center text-sm">
                                <ShieldCheck className="w-5 h-5 mr-2" />
                                Cadastros Pendentes ({pendingUsers.filter(p => currentUser.cargo === 'SysAdmin' || (p.cargo !== 'SysAdmin' && p.cargo !== 'Síndico Geral')).length})
                            </h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {pendingUsers.filter(p => currentUser.cargo === 'SysAdmin' || (p.cargo !== 'SysAdmin' && p.cargo !== 'Síndico Geral')).map(pending => (
                                <div key={pending.id} className="p-4 flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-gray-900 text-sm">{pending.nome_completo || pending.nome}</p>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{pending.cargo}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">Torre {pending.torre}, Apto {pending.apartamento || pending.apto}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="p-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors" title="Aprovar">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </button>
                                        <button className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors" title="Rejeitar">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* SysAdmin Area: Gerenciar Síndicos */}
                {currentUser && currentUser.cargo === 'SysAdmin' && sindicosList.length > 0 && (
                    <div className="mb-6 bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
                        <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex items-center justify-between">
                            <h2 className="text-red-800 font-semibold flex items-center text-sm">
                                <ShieldCheck className="w-5 h-5 mr-2" />
                                Gerenciamento de Síndico Geral
                            </h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {sindicosList.map(sindico => (
                                <div key={sindico.id} className="p-4 flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-gray-900 text-sm">{sindico.nome_completo || sindico.nome}</p>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{sindico.cargo}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">Torre {sindico.torre}, Apto {sindico.apartamento || sindico.apto}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200">
                                            Revogar Acesso
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Date Selector */}
                <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-100">
                    <button onClick={handlePrevDay} className="p-2 text-violet-600 hover:bg-violet-50 rounded-full">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="text-center">
                        <h2 className="text-lg font-bold text-gray-800 capitalize">{formatDate(currentDate)}</h2>
                        <p className="text-sm text-gray-500">Horários da Quadra (09h às 22h)</p>
                    </div>
                    <button onClick={handleNextDay} className="p-2 text-violet-600 hover:bg-violet-50 rounded-full">
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>

                {/* Slots List */}
                <div className="space-y-3">
                    {slots.map((slot) => (
                        <div
                            key={slot.id}
                            onClick={() => handleSlotClick(slot)}
                            className={`flex items-center justify-between p-4 rounded-xl border ${slot.status === 'livre'
                                ? 'bg-white border-violet-100 shadow-sm cursor-pointer hover:bg-violet-50'
                                : 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <span className={`font-semibold text-lg ${slot.status === 'livre' ? 'text-violet-700' : 'text-gray-500'}`}>
                                    {slot.time}
                                </span>
                            </div>
                            <div>
                                {slot.status === 'livre' ? (
                                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full flex items-center gap-1">
                                        <Check className="w-4 h-4" /> Livre
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 bg-gray-200 text-gray-600 text-sm font-medium rounded-full">
                                        Ocupado
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                <div className="max-w-4xl mx-auto flex justify-around">
                    <button className="flex-1 flex flex-col items-center py-3 text-gray-500 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                        <List className="w-6 h-6 mb-1" />
                        <span className="text-xs font-medium">Minhas Reservas</span>
                    </button>
                    <button className="flex-1 flex flex-col items-center py-3 text-violet-600 border-t-2 border-violet-600 bg-violet-50 transition-colors">
                        <CalendarIcon className="w-6 h-6 mb-1" />
                        <span className="text-xs font-medium">Calendário</span>
                    </button>
                </div>
            </nav>

            {/* Modal Nova Reserva */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-violet-600 p-4 flex items-center justify-between text-white">
                                <h3 className="font-bold text-lg">Confirmação de Reserva</h3>
                                <button onClick={() => { setIsModalOpen(false); setSelectedSlot(null); }} className="text-violet-100 hover:text-white">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={confirmReservation} className="p-6 space-y-6">
                                <div className="bg-violet-50 p-4 rounded-xl border border-violet-100">
                                    {selectedSlot && (
                                        <div className="mb-4 p-3 bg-white rounded-lg border border-violet-200 text-center">
                                            <p className="text-sm text-gray-500">Horário Escolhido</p>
                                            <p className="font-bold text-violet-700 text-lg">{selectedSlot.time}</p>
                                        </div>
                                    )}
                                    <p className="font-semibold text-gray-800 mb-3 text-sm">Antes de confirmar: Ao reservar, você concorda que:</p>
                                    <ul className="space-y-3 text-sm text-gray-700">
                                        <li className="flex items-start gap-2">
                                            <span className="text-lg leading-none">👟</span>
                                            <span>Usará tênis adequado e não entrará com bike/skate/patins.</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-lg leading-none">🔇</span>
                                            <span>Respeitará a lei do silêncio.</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-lg leading-none">🌧️</span>
                                            <span>A reserva será cancelada em caso de chuva.</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-lg leading-none">🧹</span>
                                            <span>Recolherá seu lixo ao sair.</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="flex items-start">
                                    <div className="flex items-center h-5">
                                        <input
                                            id="terms"
                                            type="checkbox"
                                            required
                                            checked={agreed}
                                            onChange={(e) => setAgreed(e.target.checked)}
                                            className="w-5 h-5 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                                        />
                                    </div>
                                    <div className="ml-3 text-sm">
                                        <label htmlFor="terms" className="font-medium text-gray-700">
                                            Li e concordo com as <a href="/regras" className="text-violet-600 underline" target="_blank">Regras Completas</a>.
                                        </label>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={!agreed}
                                    className={`w-full py-3 rounded-xl font-bold text-white transition-all ${agreed
                                        ? 'bg-violet-600 hover:bg-violet-700 shadow-md cursor-pointer'
                                        : 'bg-gray-300 cursor-not-allowed'
                                        }`}
                                >
                                    Confirmar Reserva
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }
        </>
    );
}
