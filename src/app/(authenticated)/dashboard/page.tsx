'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Calendar as CalendarIcon, List, ChevronLeft, ChevronRight,
    Users, XCircle, CloudRain, Wrench, Loader2, X, Lock, Unlock, History, Bell, Trash2
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getCsrfToken } from '@/lib/csrf-client';
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
    foto_url?: string;
}

interface ReservaSlotAdmin {
    reserva_id: string;
    usuario_id: string;
    slot: Slot;
    observacao?: string;
    telefone_contato?: string;
    presencial_nome?: string;
    presencial_torre?: string;
    presencial_apt?: string;
    presencial_bloco?: string;
    usuarios: {
        nome?: string;
        nome_completo?: string;
        foto_url?: string;
        torre?: string;
        apartamento?: string;
        cargo?: string;
    } | null;
}

interface Bloqueio {
    id: string;
    data: string;
    hora_inicio: string;
    hora_fim: string;
    motivo: string;
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

// ─── Modal: Cancelar Reserva ───────────────────────────────────────────────
function CancelModal({
    info,
    onClose,
    onConfirm,
}: {
    info: ReservaSlotAdmin;
    onClose: () => void;
    onConfirm: (reservaId: string, motivo: string) => Promise<void>;
}) {
    const [motivo, setMotivo] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!motivo.trim()) return;
        setLoading(true);
        await onConfirm(info.reserva_id, motivo);
        setLoading(false);
    };

    const nome = info.usuarios?.nome_completo || info.usuarios?.nome || 'Morador';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm border-t-8 border-red-500 shadow-2xl">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="font-black text-gray-800 flex items-center gap-2">
                        <XCircle className="text-red-600 w-5 h-5" /> Cancelar Reserva
                    </h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-sm text-gray-500 mb-1">
                    Reserva de <strong>{nome}</strong> — {info.slot.time}
                </p>
                {info.telefone_contato && (
                    <p className="text-sm text-gray-500 mb-4">
                        Contato: <strong className="text-gray-700">{info.telefone_contato}</strong>
                        <span className="text-xs text-gray-400 ml-2">(reserva presencial)</span>
                    </p>
                )}
                <form onSubmit={handleSubmit}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Motivo do cancelamento <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={motivo}
                        onChange={e => setMotivo(e.target.value)}
                        placeholder="Ex: Evento no condomínio, manutenção emergencial..."
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                        rows={3}
                        maxLength={200}
                        required
                    />
                    <div className="flex gap-2 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 font-bold text-gray-400 hover:text-gray-600"
                        >
                            Voltar
                        </button>
                        <button
                            type="submit"
                            disabled={!motivo.trim() || loading}
                            className="flex-1 py-2 bg-red-600 text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Confirmar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Modal: Bloquear Horários ──────────────────────────────────────────────
function BloqueioModal({
    slots,
    dateStr,
    token,
    refreshToken,
    onClose,
    onSuccess,
}: {
    slots: Slot[];
    dateStr: string;
    token: string;
    refreshToken: string;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
    const [motivo, setMotivo] = useState<'Chuva' | 'Manutenção'>('Chuva');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const toggleSlot = (id: number) => {
        setSelectedSlots(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSlots.length) {
            setError('Selecione ao menos um horário.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const slotsPayload = slots
                .filter(s => selectedSlots.includes(s.id))
                .map(s => ({ hora_inicio: s.hora_inicio + ':00', hora_fim: s.hora_fim + ':00' }));

            const csrf = getCsrfToken();
            const res = await fetch('/api/bloqueios', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-Refresh-Token': refreshToken,
                    'x-csrf-token': csrf || '',
                },
                body: JSON.stringify({ data: dateStr, slots: slotsPayload, motivo }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao bloquear');
            }

            onSuccess();
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro inesperado');
            setLoading(false);
        }
    };

    const livres = slots.filter(s => s.status === 'livre');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm border-t-8 border-amber-500 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-gray-800 flex items-center gap-2">
                        <Lock className="text-amber-600 w-5 h-5" /> Bloquear Horários
                    </h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Motivo */}
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Motivo</label>
                    <div className="flex gap-2 mb-4">
                        {(['Chuva', 'Manutenção'] as const).map(m => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setMotivo(m)}
                                className={`flex-1 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-1 transition-colors ${
                                    motivo === m
                                        ? m === 'Chuva' ? 'bg-blue-500 text-white' : 'bg-amber-500 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {m === 'Chuva' ? <CloudRain className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                                {m}
                            </button>
                        ))}
                    </div>

                    {/* Horários livres */}
                    <label className="block text-xs font-semibold text-gray-600 mb-2">
                        Horários disponíveis para bloqueio
                    </label>
                    {livres.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-2">
                            Todos os horários já estão ocupados ou bloqueados.
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {livres.map(slot => (
                                <button
                                    key={slot.id}
                                    type="button"
                                    onClick={() => toggleSlot(slot.id)}
                                    className={`py-2 rounded-xl text-sm font-semibold transition-colors border ${
                                        selectedSlots.includes(slot.id)
                                            ? 'bg-amber-500 text-white border-amber-500'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                                    }`}
                                >
                                    {slot.hora_inicio}
                                </button>
                            ))}
                        </div>
                    )}

                    {error && <p className="text-xs text-red-500 mb-3 text-center">{error}</p>}

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 font-bold text-gray-400 hover:text-gray-600"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedSlots.length || loading}
                            className="flex-1 py-2 bg-amber-500 text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Bloquear {selectedSlots.length > 0 ? `(${selectedSlots.length})` : ''}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Página Principal ──────────────────────────────────────────────────────
export default function DashboardPage() {
    const [currentDate, setCurrentDate] = useState(() => {
        return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    });
    const [slots, setSlots] = useState<Slot[]>(generateEmptySlots());
    const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
    const [activeTab, setActiveTab] = useState<'calendario' | 'minhas-reservas'>('calendario');
    const [slotsReservaMap, setSlotsReservaMap] = useState<Record<string, ReservaSlotAdmin>>({});
    const [bloqueiosMap, setBloqueiosMap] = useState<Record<string, Bloqueio>>({});
    const [sessionToken, setSessionToken] = useState<string>('');
    const [refreshToken, setRefreshToken] = useState<string>('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
    const [agreed, setAgreed] = useState(false);

    // Cancelamento
    const [cancelTarget, setCancelTarget] = useState<ReservaSlotAdmin | null>(null);

    // Bloqueio
    const [isBloqueioModalOpen, setIsBloqueioModalOpen] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setSessionToken(session.access_token);
                setRefreshToken(session.refresh_token);
                const { data: user } = await supabase
                    .from('usuarios')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                setCurrentUser(user);
            }
        };
        loadUser();
    }, []);

    const dateStr = currentDate.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    const fetchReservas = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || '';
            const rt = session?.refresh_token || '';

            const authHeaders = (t: string, r: string) => ({
                Authorization: `Bearer ${t}`,
                'X-Refresh-Token': r,
            });

            const [reservasRes, bloqueiosRes] = await Promise.all([
                fetch(`/api/reservas?data=${dateStr}`, {
                    headers: authHeaders(token, rt),
                }),
                fetch(`/api/bloqueios?data=${dateStr}`, {
                    headers: authHeaders(token, rt),
                }),
            ]);

            let reservas: Record<string, unknown>[] = [];
            let bloqueios: Bloqueio[] = [];

            if (reservasRes.ok) reservas = await reservasRes.json();
            if (bloqueiosRes.ok) bloqueios = await bloqueiosRes.json();

            const currentSlots = generateEmptySlots();
            const newMap: Record<string, ReservaSlotAdmin> = {};
            const newBloqueiosMap: Record<string, Bloqueio> = {};

            // Processar bloqueios
            bloqueios.forEach(bloqueio => {
                const slotHour = parseInt(bloqueio.hora_inicio.slice(0, 2), 10);
                const match = currentSlots.find(s => s.id === slotHour);
                if (match) {
                    match.status = 'bloqueado';
                    newBloqueiosMap[String(match.id)] = bloqueio;
                }
            });

            // Processar reservas (só sobrescreve se não bloqueado)
            reservas.forEach(reserva => {
                const reservaStart = (reserva.hora_inicio as string || '').slice(0, 5);
                const slotHour = parseInt(reservaStart.split(':')[0], 10);
                const match = currentSlots.find(s => s.id === slotHour);

                if (match && match.status !== 'bloqueado') {
                    match.status = 'ocupado';
                    if (reserva.id && reserva.usuario_id) {
                        const dadosUsuario = Array.isArray(reserva.usuarios)
                            ? reserva.usuarios[0]
                            : reserva.usuarios;
                        newMap[String(match.id)] = {
                            reserva_id: reserva.id as string,
                            usuario_id: reserva.usuario_id as string,
                            slot: match,
                            observacao: (reserva.observacao as string) || undefined,
                            telefone_contato: (reserva.telefone_contato as string) || undefined,
                            presencial_nome: (reserva.presencial_nome as string) || undefined,
                            presencial_torre: (reserva.presencial_torre as string) || undefined,
                            presencial_apt: (reserva.presencial_apt as string) || undefined,
                            presencial_bloco: (reserva.presencial_bloco as string) || undefined,
                            usuarios: dadosUsuario as ReservaSlotAdmin['usuarios'],
                        };
                    }
                }
            });

            setSlotsReservaMap(newMap);
            setBloqueiosMap(newBloqueiosMap);
            setSlots(currentSlots);
        } catch (err) {
            console.error(err);
        }
    }, [dateStr]);

    useEffect(() => {
        if (currentUser) fetchReservas();
    }, [currentUser, fetchReservas]);

    const handleCancelReserva = async (reservaId: string, motivo: string) => {
        try {
            const csrf = getCsrfToken();
            const res = await fetch(`/api/reservas/${reservaId}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${sessionToken}`,
                    'Content-Type': 'application/json',
                    'X-Refresh-Token': refreshToken,
                    'x-csrf-token': csrf || '',
                },
                body: JSON.stringify({ motivo_cancelamento: motivo }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao cancelar');
            }
            setCancelTarget(null);
            fetchReservas();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Erro ao cancelar reserva.');
        }
    };

    const handleRemoverBloqueio = async (bloqueioId: string) => {
        if (!confirm('Remover este bloqueio?')) return;
        try {
            const res = await fetch(`/api/bloqueios/${bloqueioId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${sessionToken}`, 'X-Refresh-Token': refreshToken },
            });
            if (!res.ok) throw new Error('Erro ao remover bloqueio');
            fetchReservas();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Erro ao remover bloqueio.');
        }
    };

    const confirmReservation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSlot || !currentUser) return;

        const csrf = getCsrfToken();
        const res = await fetch('/api/reservas', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${sessionToken}`,
                'Content-Type': 'application/json',
                'X-Refresh-Token': refreshToken,
                'x-csrf-token': csrf || '',
            },
            body: JSON.stringify({
                data_reserva: dateStr,
                hora_inicio: selectedSlot.hora_inicio + ':00',
                hora_fim: selectedSlot.hora_fim + ':00',
                aceite_termos: agreed,
                usuario_id: currentUser.id,
            }),
        });

        if (res.ok) {
            alert('Reserva feita com sucesso!');
            setIsModalOpen(false);
            setAgreed(false);
            fetchReservas();
        } else {
            const err = await res.json().catch(() => ({}));
            alert(err.error || 'Erro ao fazer reserva.');
            // Se o slot foi ocupado enquanto o modal estava aberto, fechar e atualizar o quadro
            if (res.status === 409) {
                setIsModalOpen(false);
                setAgreed(false);
                fetchReservas();
            }
        }
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
    const podeVerPainelAdmin = isAdmin || currentUser.cargo === 'Porteiro';

    return (
        <div className="flex-1 max-w-4xl mx-auto w-full p-4 flex flex-col pb-24">

            {podeVerPainelAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <AdminApprovalPanel currentUserRole={currentUser.cargo!} />
                    <AdminNotificationPanel />
                    <ProfileReviewPanel
                        currentUserId={currentUser.id}
                        currentUserRole={currentUser.cargo!}
                        currentUserTorre={currentUser.torre!}
                    />
                    {isAdmin && (
                        <>
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
                        <Link
                            href="/dashboard/solicitacoes-exclusao"
                            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4 hover:border-rose-300 hover:shadow-md transition-all group"
                        >
                            <div className="p-3 bg-rose-50 rounded-xl group-hover:bg-rose-100 transition-colors">
                                <Trash2 className="w-6 h-6 text-rose-600" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-sm font-semibold text-gray-700 group-hover:text-rose-700 transition-colors">
                                    Exclusão de Dados (LGPD)
                                </h2>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Solicitações de exclusão pendentes
                                </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-rose-400 transition-colors" />
                        </Link>
                        <Link
                            href="/dashboard/historico"
                            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4 hover:border-emerald-300 hover:shadow-md transition-all group"
                        >
                            <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                                <History className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-sm font-semibold text-gray-700 group-hover:text-emerald-700 transition-colors">
                                    Histórico de Reservas
                                </h2>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Visualizar reservas passadas e cancelamentos
                                </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-400 transition-colors" />
                        </Link>
                        </>
                    )}
                    <Link
                        href="/dashboard/mensagens"
                        className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4 hover:border-violet-300 hover:shadow-md transition-all group"
                    >
                        <div className="p-3 bg-violet-50 rounded-xl group-hover:bg-violet-100 transition-colors">
                            <Bell className="w-6 h-6 text-violet-600" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-sm font-semibold text-gray-700 group-hover:text-violet-700 transition-colors">
                                Mensagens
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Central de notificações e comunicados
                            </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-400 transition-colors" />
                    </Link>
                </div>
            )}

            {currentUser.cargo === 'Porteiro' ? (
                <PorteiroAgendaHoje />
            ) : activeTab === 'minhas-reservas' ? (
                <MinhasReservas onReservaChanged={fetchReservas} />
            ) : (
                <>
                    {/* Header do Calendário */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm mb-4 border border-gray-100">
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

                    {/* Botão Bloquear Horários (só Síndico Geral e SysAdmin) */}
                    {isSindicoOuSysAdmin && (
                        <div className="flex justify-end mb-3">
                            <button
                                onClick={() => setIsBloqueioModalOpen(true)}
                                className="flex items-center gap-2 text-xs font-bold px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors"
                            >
                                <Lock className="w-3.5 h-3.5" />
                                Bloquear Horários
                            </button>
                        </div>
                    )}

                    {/* Slots */}
                    <div className="space-y-3">
                        {slots.map((slot) => {
                            const info = slotsReservaMap[String(slot.id)];
                            const bloqueio = bloqueiosMap[String(slot.id)];
                            const isBloqueado = slot.status === 'bloqueado';

                            return (
                                <div
                                    key={slot.id}
                                    onClick={() => slot.status === 'livre' && (setSelectedSlot(slot), setIsModalOpen(true))}
                                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                                        slot.status === 'livre'
                                            ? 'bg-white border-violet-100 cursor-pointer hover:border-violet-300'
                                            : isBloqueado
                                            ? 'bg-amber-50 border-amber-200 cursor-default'
                                            : 'bg-gray-50 border-gray-200 cursor-default'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className={`font-bold ${
                                            slot.status === 'livre' ? 'text-violet-600'
                                            : isBloqueado ? 'text-amber-600'
                                            : 'text-gray-400'
                                        }`}>
                                            {slot.time}
                                        </span>

                                        {/* Nome de quem reservou (visível só para admins) */}
                                        {slot.status === 'ocupado' && isAdmin && info?.usuarios && (
                                            <div className="flex items-center gap-2 border-l pl-4 border-gray-200">
                                                {(info.presencial_nome || info.observacao) ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-gray-700">
                                                            {info.presencial_nome || info.observacao}
                                                        </span>
                                                        {info.presencial_torre && (
                                                            <span className="text-xs text-gray-500">
                                                                T{info.presencial_torre}{info.presencial_apt ? `, Apto ${info.presencial_apt}` : ''}
                                                                {info.presencial_bloco ? `, Bloco ${info.presencial_bloco}` : ''}
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-amber-600 font-semibold">
                                                            Presencial — {info.usuarios.nome_completo || info.usuarios.nome}
                                                        </span>
                                                        {info.telefone_contato && (
                                                            <span className="text-xs text-gray-500 mt-0.5">
                                                                Tel: {info.telefone_contato}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <>
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
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Label do bloqueio */}
                                        {isBloqueado && bloqueio && (
                                            <div className="flex items-center gap-1.5 border-l pl-4 border-amber-200">
                                                {bloqueio.motivo === 'Chuva'
                                                    ? <CloudRain className="w-4 h-4 text-blue-500" />
                                                    : <Wrench className="w-4 h-4 text-amber-600" />
                                                }
                                                <span className="text-sm font-semibold text-amber-700">{bloqueio.motivo}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Ações à direita */}
                                    <div className="flex gap-2 items-center">
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                                            slot.status === 'livre' ? 'bg-green-50 text-green-600'
                                            : isBloqueado ? 'bg-amber-100 text-amber-700'
                                            : 'bg-gray-200 text-gray-500'
                                        }`}>
                                            {isBloqueado ? 'Bloqueado' : slot.status}
                                        </span>

                                        {/* Cancelar reserva (só se permitido) */}
                                        {slot.status === 'ocupado' && info && (
                                            (() => {
                                                const isSindico = currentUser.cargo === 'Síndico Geral' || currentUser.cargo === 'SysAdmin';
                                                const isSubsindicoDaTorre = currentUser.cargo === 'Subsíndico' && info.usuarios?.torre === currentUser.torre;
                                                if (!isSindico && !isSubsindicoDaTorre) return null;
                                                return (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setCancelTarget(info); }}
                                                        className="p-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                                                        title="Cancelar reserva"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                );
                                            })()
                                        )}

                                        {/* Remover bloqueio (admin) */}
                                        {isAdmin && isBloqueado && bloqueio && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRemoverBloqueio(bloqueio.id); }}
                                                className="p-1 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                                                title="Remover bloqueio"
                                            >
                                                <Unlock className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Modal: Confirmar Reserva */}
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

            {/* Modal: Cancelar Reserva */}
            {cancelTarget && (
                <CancelModal
                    info={cancelTarget}
                    onClose={() => setCancelTarget(null)}
                    onConfirm={handleCancelReserva}
                />
            )}

            {/* Modal: Bloquear Horários */}
            {isBloqueioModalOpen && (
                <BloqueioModal
                    slots={slots}
                    dateStr={dateStr}
                    token={sessionToken}
                    refreshToken={refreshToken}
                    onClose={() => setIsBloqueioModalOpen(false)}
                    onSuccess={() => fetchReservas()}
                />
            )}

            {/* Nav Bottom */}
            <nav className="fixed bottom-0 left-0 w-full bg-white border-t p-2 flex justify-around shadow-lg">
                <button onClick={() => setActiveTab('minhas-reservas')} className={`flex flex-col items-center p-2 rounded-xl ${activeTab === 'minhas-reservas' ? 'text-violet-600 bg-violet-50' : 'text-gray-400'}`}>
                    <List /><span className="text-[10px] font-bold mt-1 uppercase">Reservas</span>
                </button>
                <button onClick={() => { setActiveTab('calendario'); fetchReservas(); }} className={`flex flex-col items-center p-2 rounded-xl ${activeTab === 'calendario' ? 'text-violet-600 bg-violet-50' : 'text-gray-400'}`}>
                    <CalendarIcon /><span className="text-[10px] font-bold mt-1 uppercase">Quadro</span>
                </button>
            </nav>
        </div>
    );
}
