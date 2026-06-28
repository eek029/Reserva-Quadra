'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, ShieldAlert, Key, Plus, X, UserCheck, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { getCsrfToken } from '@/lib/csrf-client';

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
    presencial_nome?: string;
    presencial_torre?: string;
    presencial_apt?: string;
    presencial_bloco?: string;
    presencial_documento?: string;
    created_at?: string;
    retirada_em?: string;
    devolvida_em?: string;
    ocorrencia_texto?: string;
    usuarios: {
        nome_completo: string;
        torre: string;
        apartamento: string;
        foto_url?: string;
    };
    porteiro_entrega?: { nome_completo: string } | null;
    porteiro_recebimento?: { nome_completo: string } | null;
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

function fmtTime(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface TimelineEvent {
    icon: string;
    time: string;
    label: string;
    color: string;
}

function buildTimeline(res: Reserva): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    if (res.created_at && res.status !== 'cancelada') {
        events.push({ icon: '📋', time: fmtDateTime(res.created_at), label: 'Reserva criada', color: 'text-violet-600' });
    }
    if (res.retirada_em) {
        const nome = res.porteiro_entrega?.nome_completo;
        events.push({ icon: '🔑', time: fmtDateTime(res.retirada_em), label: `Chave entregue${nome ? ` por ${nome}` : ''}`, color: 'text-amber-600' });
    }
    if (res.devolvida_em) {
        const nome = res.porteiro_recebimento?.nome_completo;
        events.push({ icon: '✅', time: fmtDateTime(res.devolvida_em), label: `Chave devolvida${nome ? ` por ${nome}` : ''}`, color: 'text-teal-600' });
        if (res.ocorrencia_texto) {
            events.push({ icon: '⚠️', time: '', label: `Ocorrência: ${res.ocorrencia_texto}`, color: 'text-red-600' });
        }
    }

    return events;
}

export default function PorteiroAgendaHoje() {
    const [reservasHoje, setReservasHoje] = useState<Reserva[]>([]);
    const [bloqueiosHoje, setBloqueiosHoje] = useState<Bloqueio[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [ocorrencia, setOcorrencia] = useState('');
    const [isDevolucaoModalOpen, setIsDevolucaoModalOpen] = useState(false);
    const [reservaSelecionada, setReservaSelecionada] = useState<Reserva | null>(null);
    const [sessionUserId, setSessionUserId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const [isPresencialOpen, setIsPresencialOpen] = useState(false);
    const [nomePresencial, setNomePresencial] = useState('');
    const [telefonePresencial, setTelefonePresencial] = useState('');
    const [torrePresencial, setTorrePresencial] = useState('');
    const [aptPresencial, setAptPresencial] = useState('');
    const [blocoPresencial, setBlocoPresencial] = useState('');
    const [documentoPresencial, setDocumentoPresencial] = useState('');
    const [selectedSlot, setSelectedSlot] = useState('');
    const [freeSlots, setFreeSlots] = useState<Slot[]>([]);
    const [isSavingPresencial, setIsSavingPresencial] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setSessionUserId(session.user.id);
        });
    }, []);

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

    // Realtime: atualizar prancheta automaticamente
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return;
            channelRef.current = supabase
                .channel('prancheta-realtime')
                .on('postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'reservas' },
                    () => { fetchReservasHoje(); }
                )
                .on('postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'reservas' },
                    () => { fetchReservasHoje(); }
                )
                .subscribe();
        });
        return () => {
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
    }, [fetchReservasHoje]);

    const openPresencialModal = async () => {
        setIsPresencialOpen(true);
        setNomePresencial('');
        setTelefonePresencial('');
        setTorrePresencial('');
        setAptPresencial('');
        setBlocoPresencial('');
        setDocumentoPresencial('');
        setSelectedSlot('');

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

    const handleConfirmarPresencial = async () => {
        if (!nomePresencial.trim() || !telefonePresencial.trim() || !torrePresencial || !aptPresencial.trim() || !selectedSlot || !sessionUserId) return;
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
                    presencial_nome: nomePresencial.trim(),
                    telefone_contato: telefonePresencial.trim(),
                    presencial_torre: torrePresencial,
                    presencial_apt: aptPresencial.trim(),
                    presencial_bloco: blocoPresencial || null,
                    presencial_documento: documentoPresencial.trim() || null,
                    hora_inicio: slot.hora_inicio,
                    hora_fim: slot.hora_fim,
                }),
            });

            if (res.ok) {
                setIsPresencialOpen(false);
                fetchReservasHoje();
            } else {
                const err = await res.json();
                alert(`Erro: ${err.error || 'Não foi possível criar a reserva.'}`);
            }
        } catch (e) {
            console.error(e);
            alert('Erro de comunicação com o servidor.');
        } finally {
            setIsSavingPresencial(false);
        }
    };

    const processarChave = async (res: Reserva, acao: 'entregar' | 'receber') => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const csrf = await getCsrfToken();
            if (!csrf) return;
            const payload: { acao: string; ocorrencia_texto?: string } = { acao };
            if (ocorrencia) payload.ocorrencia_texto = ocorrencia;
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
                alert(`Chave ${acao === 'entregar' ? 'entregue' : 'recebida'} com sucesso!`);
                setOcorrencia('');
                setIsDevolucaoModalOpen(false);
                setReservaSelecionada(null);
                fetchReservasHoje();
            } else {
                const errData = await response.json();
                alert(`Erro: ${errData.error || errData.detail || 'Erro desconhecido'}`);
            }
        } catch (error) {
            console.error('Erro na operação de chaves', error);
        }
    };

    const toggleTimeline = (id: string) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    if (isLoading) return <div className="text-center p-8 text-gray-500">Carregando Prancheta...</div>;

    return (
        <div className="w-full">
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

            {reservasHoje.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center shadow-sm">
                    <p className="text-gray-500 font-medium">Nenhuma reserva confirmada para hoje.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {reservasHoje.map((res) => {
                        const timeline = buildTimeline(res);
                        const isExpanded = expandedId === res.id;
                        return (
                            <div key={res.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="flex flex-col md:flex-row">
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
            {res.presencial_nome || res.observacao ? (
                <>
                    <p className="font-bold text-gray-900 leading-tight">{res.presencial_nome || res.observacao}</p>
                    <p className="text-xs text-amber-600 font-semibold mt-0.5">Presencial</p>
                    {res.presencial_torre && (
                        <p className="text-xs text-gray-500 mt-0.5">
                            T{res.presencial_torre}{res.presencial_apt ? `, Apto ${res.presencial_apt}` : ''}
                            {res.presencial_bloco ? `, Bloco ${res.presencial_bloco}` : ''}
                        </p>
                    )}
                    {res.telefone_contato && (
                        <p className="text-xs text-gray-500 mt-0.5">Tel: {res.telefone_contato}</p>
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

                                {/* Timeline toggle */}
                                <button
                                    onClick={() => toggleTimeline(res.id)}
                                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 border-t border-gray-100 transition-colors"
                                >
                                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Timeline</span>
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>

                                {isExpanded && timeline.length > 0 && (
                                    <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
                                        <div className="relative pl-6 space-y-3">
                                            {/* Vertical line */}
                                            <div className="absolute left-[9px] top-1 bottom-1 w-0.5 bg-gray-200" />
                                            {timeline.map((event, idx) => (
                                                <div key={idx} className="relative flex items-start gap-3">
                                                    <div className="absolute -left-[18px] top-0 text-xs">{event.icon}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-xs font-medium ${event.color}`}>{event.label}</p>
                                                        {event.time && (
                                                            <p className="text-[10px] text-gray-400 mt-0.5">{event.time}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal: Nova Reserva Presencial */}
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

                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Nome do Morador <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={nomePresencial}
                                onChange={e => setNomePresencial(e.target.value)}
                                placeholder="Ex: João Silva"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-violet-500 focus:border-violet-500"
                            />
                        </div>

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

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                    Torre <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={torrePresencial}
                                    onChange={e => { setTorrePresencial(e.target.value); if (e.target.value !== '5') setBlocoPresencial(''); }}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-violet-500 focus:border-violet-500 bg-white"
                                >
                                    <option value="">Selecione...</option>
                                    {['1','2','3','4','5'].map(t => (
                                        <option key={t} value={t}>Torre {t}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                    Apartamento <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={aptPresencial}
                                    onChange={e => setAptPresencial(e.target.value)}
                                    placeholder="Ex: 304"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-violet-500 focus:border-violet-500"
                                />
                            </div>
                        </div>

                        {torrePresencial === '5' && (
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Bloco</label>
                                <select
                                    value={blocoPresencial}
                                    onChange={e => setBlocoPresencial(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-violet-500 focus:border-violet-500 bg-white"
                                >
                                    <option value="">Selecione...</option>
                                    {['A','B'].map(b => (
                                        <option key={b} value={b}>Bloco {b}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Documento (RG/CPF)
                            </label>
                            <input
                                type="text"
                                value={documentoPresencial}
                                onChange={e => setDocumentoPresencial(e.target.value)}
                                placeholder="Ex: 12.345.678-9 ou 123.456.789-00"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-violet-500 focus:border-violet-500"
                            />
                        </div>

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
                                disabled={!nomePresencial.trim() || !telefonePresencial.trim() || !torrePresencial || !aptPresencial.trim() || !selectedSlot || isSavingPresencial || freeSlots.length === 0}
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

            {/* Modal: Registrar Devolução */}
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
