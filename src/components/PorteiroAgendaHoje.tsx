'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, ShieldAlert, Key, Plus, X, UserCheck } from 'lucide-react';
import { getCsrfToken } from '@/lib/csrf-client';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Reserva {
    id: string;
    data_reserva: string;
    hora_inicio: string;
    hora_fim: string;
    status: string;
    usuario_id: string;
    status_chave: string;
    observacao?: string;
    telefone_contato?: string;
    usuarios: {
        nome_completo: string;
        torre: string;
        apartamento: string;
        foto_url?: string;
    };
}

interface Bloqueio {
    id: string;
    data: string;
    hora_inicio: string;
    hora_fim: string;
    motivo: string;
}


interface Slot {
    hora_inicio: string;
    hora_fim: string;
    label: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ALL_SLOTS: Slot[] = Array.from({ length: 13 }, (_, i) => {
    const h = i + 9;
    return {
        hora_inicio: `${String(h).padStart(2, '0')}:00:00`,
        hora_fim: `${String(h + 1).padStart(2, '0')}:00:00`,
        label: `${String(h).padStart(2, '0')}:00 – ${String(h + 1).padStart(2, '0')}:00`,
    };
});

function getTodayBRT(): string {
    return new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
    ).toISOString().split('T')[0];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PorteiroAgendaHoje() {
    const [reservasHoje, setReservasHoje] = useState<Reserva[]>([]);
    const [bloqueiosHoje, setBloqueiosHoje] = useState<Bloqueio[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [ocorrencia, setOcorrencia] = useState('');
    const [isDevolucaoModalOpen, setIsDevolucaoModalOpen] = useState(false);
    const [reservaSelecionada, setReservaSelecionada] = useState<Reserva | null>(null);
    const [sessionUserId, setSessionUserId] = useState<string | null>(null);

    // ── Modal: Reserva Presencial ────────────────────────────────────────────
    const [isPresencialOpen, setIsPresencialOpen] = useState(false);
    const [observacaoPresencial, setObservacaoPresencial] = useState('');
    const [telefonePresencial, setTelefonePresencial] = useState('');
    const [selectedSlot, setSelectedSlot] = useState('');
    const [freeSlots, setFreeSlots] = useState<Slot[]>([]);
    const [isSavingPresencial, setIsSavingPresencial] = useState(false);

    // ── Fetch session ────────────────────────────────────────────────────────
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setSessionUserId(session.user.id);
        });
    }, []);

    // ── Fetch today's reservas ───────────────────────────────────────────────
    const fetchReservasHoje = useCallback(async () => {
        setIsLoading(true);
        const dateStr = getTodayBRT();
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('Sessão não encontrada');

            const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
            const [resReservas, resBloqueios] = await Promise.all([
                fetch(`/api/reservas?data=${dateStr}`, { headers }),
                fetch(`/api/bloqueios?data=${dateStr}`, { headers }),
            ]);
            if (!resReservas.ok) throw new Error('Erro ao carregar reservas');
            if (!resBloqueios.ok) throw new Error('Erro ao carregar bloqueios');
            setReservasHoje(await resReservas.json() || []);
            setBloqueiosHoje(await resBloqueios.json() || []);
        } catch (error) {
            console.error('Erro ao buscar dados de hoje:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchReservasHoje(); }, [fetchReservasHoje]);

    // ── Open Presencial Modal ────────────────────────────────────────────────
    const openPresencialModal = async () => {
        setIsPresencialOpen(true);
        setObservacaoPresencial('');
        setTelefonePresencial('');
        setSelectedSlot('');

        // Compute free slots for today (reservas + bloqueios)
        const dateStr = getTodayBRT();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
        const [resOcupadas, resBloqueios] = await Promise.all([
            fetch(`/api/reservas?data=${dateStr}`, { headers }),
            fetch(`/api/bloqueios?data=${dateStr}`, { headers }),
        ]);

        const ocupadas = [
            ...(resOcupadas.ok ? await resOcupadas.json() : []),
            ...(resBloqueios.ok ? await resBloqueios.json() : []),
        ];

        const livres = ALL_SLOTS.filter(slot =>
            !ocupadas.some(r => slot.hora_inicio < r.hora_fim && slot.hora_fim > r.hora_inicio)
        );
        setFreeSlots(livres);
    };

    // ── Submit Presencial ────────────────────────────────────────────────────
    const handleConfirmarPresencial = async () => {
        if (!observacaoPresencial.trim() || !telefonePresencial.trim() || !selectedSlot || !sessionUserId) return;
        setIsSavingPresencial(true);

        const slot = ALL_SLOTS.find(s => s.hora_inicio === selectedSlot);
        if (!slot) { setIsSavingPresencial(false); return; }

        try {
            const csrf = await getCsrfToken();
            if (!csrf) { setIsSavingPresencial(false); return; }
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) { setIsSavingPresencial(false); return; }

            const res = await fetch('/api/reservas/presencial', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-csrf-token': csrf,
                },
                body: JSON.stringify({
                    observacao: observacaoPresencial.trim(),
                    telefone_contato: telefonePresencial.trim(),
                    hora_inicio: slot.hora_inicio,
                    hora_fim: slot.hora_fim,
                }),
            });

            if (res.ok) {
                setIsPresencialOpen(false);
                fetchReservasHoje();
            } else {
                const err = await res.json();
                alert(`Erro: ${err.detail || 'Não foi possível criar a reserva.'}`);
            }
        } catch (e) {
            console.error(e);
            alert('Erro de comunicação com o servidor.');
        } finally {
            setIsSavingPresencial(false);
        }
    };

    // ── Key operations ───────────────────────────────────────────────────────
    const processarChave = async (res: Reserva, acao: 'entregar' | 'receber') => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const csrf = await getCsrfToken();
            if (!csrf) return;
            const payload = { acao, ocorrencia_texto: ocorrencia || null };
            const response = await fetch(`/api/reservas/${res.id}/chave`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'x-csrf-token': csrf,
                },
                body: JSON.stringify(payload),
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
            console.error('Erro na operação de chaves', error);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    if (isLoading) return <div className="text-center p-8 text-gray-500">Carregando Prancheta...</div>;

    return (
        <div className="w-full">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Prancheta Operacional</h2>
                    <p className="text-sm text-gray-500">Controle de Chaves da Quadra Poliesportiva</p>
                </div>
                <button
                    onClick={openPresencialModal}
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" /> Nova Reserva Presencial
                </button>
            </div>

            {/* Bloqueios list */}
            {bloqueiosHoje.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-amber-700 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        Horários Bloqueados
                    </h3>
                    <div className="grid gap-2">
                        {bloqueiosHoje.map(b => (
                            <div key={b.id} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                                <span className="font-mono font-bold text-amber-800 text-sm">
                                    {b.hora_inicio.slice(0, 5)} – {b.hora_fim.slice(0, 5)}
                                </span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                                    {b.motivo}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Reservation list */}
            {reservasHoje.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center shadow-sm">
                    <p className="text-gray-500 font-medium">Nenhuma reserva confirmada para hoje.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {reservasHoje.map((res) => (
                        <div key={res.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
                            <div className="p-4 flex items-center gap-4 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50">
                                <div className="w-14 h-14 rounded-full bg-gray-300 border-2 border-white shadow-sm overflow-hidden flex-shrink-0">
                                    {res.usuarios?.foto_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={res.usuarios.foto_url} alt="Morador" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-500 text-xl font-bold">
                                            {res.usuarios?.nome_completo?.charAt(0) || '?'}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    {res.observacao ? (
                                        <>
                                            <p className="font-bold text-gray-900 leading-tight">{res.observacao}</p>
                                            <p className="text-xs text-amber-600 font-semibold mt-0.5">
                                                Presencial
                                            </p>
                                            {res.telefone_contato && (
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    Tel: {res.telefone_contato}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <p className="font-bold text-gray-900 leading-tight">{res.usuarios?.nome_completo}</p>
                                            <p className="text-xs font-semibold text-violet-700 bg-violet-100 inline-block px-2 py-0.5 rounded-full mt-1">
                                                Torre {res.usuarios?.torre} - Apto {res.usuarios?.apartamento}
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 flex-1 flex flex-col justify-center">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700 font-semibold text-sm">
                                        {res.hora_inicio.slice(0, 5)} - {res.hora_fim.slice(0, 5)}
                                    </span>
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
                                        <div className="flex-1 bg-gray-50 text-gray-400 py-2 rounded-lg font-semibold text-sm flex items-center justify-center border border-gray-100">
                                            Turno Concluído
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Modal: Nova Reserva Presencial ─────────────────────────────────── */}
            {isPresencialOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                                <UserCheck className="w-5 h-5 text-violet-600" /> Nova Reserva Presencial
                            </h3>
                            <button onClick={() => setIsPresencialOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 mb-5">
                            Registre uma reserva em nome de um morador que está presente na portaria.
                        </p>

                        {/* Morador: texto livre */}
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Nome e Apto do Morador <span className="font-normal text-gray-400">(Registro Manual)</span>
                            </label>
                            <input
                                type="text"
                                value={observacaoPresencial}
                                onChange={e => setObservacaoPresencial(e.target.value)}
                                placeholder="Ex: João Silva — Torre 2, Apto 304"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-violet-500 focus:border-violet-500"
                            />
                        </div>

                        {/* Telefone de contato */}
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Telefone de Contato <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                value={telefonePresencial}
                                onChange={e => setTelefonePresencial(e.target.value)}
                                placeholder="Ex: (11) 99999-8888"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-violet-500 focus:border-violet-500"
                            />
                        </div>

                        {/* Slot selector */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Horário Disponível</label>
                            {freeSlots.length === 0 ? (
                                <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">
                                    Não há horários livres para hoje.
                                </p>
                            ) : (
                                <select
                                    value={selectedSlot}
                                    onChange={e => setSelectedSlot(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-violet-500 focus:border-violet-500 bg-white"
                                >
                                    <option value="">Selecione um horário...</option>
                                    {freeSlots.map(s => (
                                        <option key={s.hora_inicio} value={s.hora_inicio}>{s.label}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsPresencialOpen(false)}
                                className="flex-1 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmarPresencial}
                                disabled={!observacaoPresencial.trim() || !telefonePresencial.trim() || !selectedSlot || isSavingPresencial || freeSlots.length === 0}
                                className="flex-1 py-2 font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSavingPresencial ? (
                                    <span className="animate-spin">⏳</span>
                                ) : (
                                    <Key className="w-4 h-4" />
                                )}
                                Confirmar Reserva
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Registrar Devolução ──────────────────────────────────────── */}
            {isDevolucaoModalOpen && reservaSelecionada && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h3 className="font-bold text-lg text-gray-900 mb-2 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-teal-600" /> Registrar Devolução
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            A chave está sendo devolvida por <strong>{reservaSelecionada.usuarios.nome_completo}</strong>. Houve alguma ocorrência durante o uso da quadra?
                        </p>

                        <textarea
                            rows={3}
                            value={ocorrencia}
                            onChange={(e) => setOcorrencia(e.target.value)}
                            className="w-full text-sm border-gray-300 rounded-lg p-3 bg-gray-50 mb-4 focus:ring-teal-500 focus:border-teal-500"
                            placeholder="Opcional. Exemplo: Rede do gol rasgada, barulho após horário..."
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setIsDevolucaoModalOpen(false); setOcorrencia(''); }}
                                className="flex-1 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => processarChave(reservaSelecionada, 'receber')}
                                className="flex-1 py-2 font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
                            >
                                Confirmar Recebimento
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
