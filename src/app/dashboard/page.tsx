'use client';

import { useState } from 'react';
import { BookOpen, User, Calendar as CalendarIcon, Plus, List, X, ChevronLeft, ChevronRight, Check, ShieldCheck, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

// Mock user data to simulate role-based rendering
const currentUser = {
    nome: 'Síndico Teste',
    cargo: 'Síndico Geral', // Change to 'Morador' to see standard view
};

// Mock pending approvals
const mockPending = [
    { id: '1', nome: 'João Morador', apto: '42', torre: '1' },
    { id: '2', nome: 'Maria Silva', apto: '15', torre: '3' },
];

// Mock data for initial UI demonstration
const generateTimeSlots = () => {
    const slots = [];
    for (let i = 9; i < 22; i++) {
        slots.push({
            id: i,
            time: `${i.toString().padStart(2, '0')}:00 - ${(i + 1).toString().padStart(2, '0')}:00`,
            status: Math.random() > 0.5 ? 'livre' : 'ocupado',
        });
    }
    return slots;
};

export default function DashboardPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [slots] = useState(generateTimeSlots());

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

    const confirmReservation = (e: React.FormEvent) => {
        e.preventDefault();
        if (!agreed) return;

        // Final payload to send to backend exactly as requested
        const payload = {
            data_reserva: currentDate.toISOString().split('T')[0],
            hora_inicio: "10:00:00", // example dynamic value
            hora_fim: "12:00:00", // example dynamic value
            aceite_termos: agreed, // Must be true
            usuario_id: "uuid-placeholder"
        };

        console.log('Enviando para API:', payload);
        alert('Reserva solicitada com sucesso!');
        setIsModalOpen(false);
        setAgreed(false);
    };

    return (
        <main className="min-h-screen bg-gray-50 flex flex-col font-sans pb-20">
            {/* Top Header */}
            <header className="bg-violet-600 text-white p-4 shadow-md sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-violet-600 font-bold">
                            CQ
                        </div>
                        <h1 className="text-lg font-bold">Reserva Quadra</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 hover:bg-violet-500 rounded-full transition-colors flex flex-col items-center" title="Regras de Utilização da Quadra">
                            <BookOpen className="w-5 h-5" />
                        </button>
                        <Link href="/profile" className="p-2 hover:bg-violet-500 rounded-full transition-colors flex flex-col items-center" title="Perfil">
                            <User className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content - Daily Calendar View */}
            <div className="flex-1 max-w-4xl mx-auto w-full p-4 flex flex-col">

                {/* Admin Area: Aprovações Pendentes */}
                {(currentUser.cargo === 'Síndico Geral' || currentUser.cargo === 'Subsíndico') && mockPending.length > 0 && (
                    <div className="mb-6 bg-white rounded-xl border border-violet-200 shadow-sm overflow-hidden">
                        <div className="bg-violet-50 px-4 py-3 border-b border-violet-100 flex items-center justify-between">
                            <h2 className="text-violet-800 font-semibold flex items-center text-sm">
                                <ShieldCheck className="w-5 h-5 mr-2" />
                                Cadastros Pendentes ({mockPending.length})
                            </h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {mockPending.map(pending => (
                                <div key={pending.id} className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">{pending.nome}</p>
                                        <p className="text-xs text-gray-500">Torre {pending.torre}, Apto {pending.apto}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="p-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </button>
                                        <button className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                                            <X className="w-5 h-5" />
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
                            className={`flex items-center justify-between p-4 rounded-xl border ${slot.status === 'livre'
                                ? 'bg-white border-violet-100 shadow-sm'
                                : 'bg-gray-100 border-gray-200 text-gray-500'
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
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex-1 flex flex-col items-center py-3 text-violet-600 hover:bg-violet-50 transition-colors"
                    >
                        <Plus className="w-6 h-6 mb-1" />
                        <span className="text-xs font-semibold">Nova Reserva</span>
                    </button>
                    <button className="flex-1 flex flex-col items-center py-3 text-gray-500 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                        <List className="w-6 h-6 mb-1" />
                        <span className="text-xs font-medium">Minhas Reservas</span>
                    </button>
                    <button className="flex-1 flex flex-col items-center py-3 text-gray-500 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                        <CalendarIcon className="w-6 h-6 mb-1" />
                        <span className="text-xs font-medium">Calendário</span>
                    </button>
                </div>
            </nav>

            {/* Modal Nova Reserva */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-violet-600 p-4 flex items-center justify-between text-white">
                            <h3 className="font-bold text-lg">Confirmação de Reserva</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-violet-100 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={confirmReservation} className="p-6 space-y-6">
                            <div className="bg-violet-50 p-4 rounded-xl border border-violet-100">
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
                                        Li e concordo com as <a href="#" className="text-violet-600 underline">Regras Completas</a>.
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
            )}
        </main>
    );
}
