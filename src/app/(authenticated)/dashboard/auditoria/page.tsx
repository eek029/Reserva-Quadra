'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, History, FileText, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface AuditReserva {
    id: string;
    data_reserva: string;
    hora_inicio: string;
    hora_fim: string;
    turno_registro: string;
    retirada_em: string;
    devolvida_em: string;
    ocorrencia_texto: string;
    status_chave: string;
    usuarios: {
        nome_completo: string;
        torre: string;
        apartamento: string;
    } | null;
    porteiro_entrega: {
        nome_completo: string;
    } | null;
    porteiro_recebimento: {
        nome_completo: string;
    } | null;
}

export default function AuditoriaChavesPage() {
    const [historico, setHistorico] = useState<AuditReserva[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [csvLoading, setCsvLoading] = useState(false);

    const csvCell = (v: string): string => {
        const escaped = v.replace(/"/g, '""');
        if (/^[=+\-@]/.test(escaped)) return `"'${escaped}"`;
        return `"${escaped}"`;
    };

    const exportCSV = useCallback(() => {
        setCsvLoading(true);
        try {
            const header = 'Data,Turno,Morador,Torre,Apto,Retirada,Entregue por,Devolvida,Recebida por,Ocorrência,Status';
            const rows = historico.map(r => {
                const data = new Date(r.data_reserva).toLocaleDateString('pt-BR');
                const morador = r.usuarios?.nome_completo || '--';
                const torre = r.usuarios?.torre || '--';
                const apto = r.usuarios?.apartamento || '--';
                const retirada = r.retirada_em ? new Date(r.retirada_em).toLocaleString('pt-BR') : '--';
                const entreguePor = r.porteiro_entrega?.nome_completo || '--';
                const devolvida = r.devolvida_em ? new Date(r.devolvida_em).toLocaleString('pt-BR') : '--';
                const recebidaPor = r.porteiro_recebimento?.nome_completo || '--';
                const ocorrencia = r.ocorrencia_texto || '--';
                const status = r.status_chave.replace('_', ' ');
                return [data, r.turno_registro || '--', morador, torre, apto, retirada, entreguePor, devolvida, recebidaPor, ocorrencia, status].map(csvCell).join(',');
            });

            const bom = '\uFEFF';
            const blob = new Blob([bom + header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `auditoria-chaves-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } finally {
            setCsvLoading(false);
        }
    }, [historico]);

    useEffect(() => {
        const verifyAccessAndFetch = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: user } = await supabase.from("usuarios").select("cargo").eq("id", session.user.id).single();
            if (!user || !['SysAdmin', 'Síndico Geral', 'Subsíndico'].includes(user.cargo)) {
                setIsLoading(false);
                return;
            }

            setIsAuthorized(true);

            // Fetching reservations that interacted with keys
            const { data, error } = await supabase
                .from('reservas')
                .select(`
                     id, data_reserva, hora_inicio, hora_fim, turno_registro, retirada_em, devolvida_em, ocorrencia_texto, status_chave,
                     usuarios:usuario_id(nome_completo, torre, apartamento),
                     porteiro_entrega:entregue_por(nome_completo),
                     porteiro_recebimento:recebida_por(nome_completo)
                 `)
                .in('status_chave', ['em_uso', 'concluida'])
                .order('devolvida_em', { ascending: false, nullsFirst: false });

            if (!error && data) {
                setHistorico(data as unknown as AuditReserva[]);
            }
            setIsLoading(false);
        };
        verifyAccessAndFetch();
    }, []);

    if (isLoading) return <div className="p-8 text-center text-gray-500">Verificando credenciais e carregando relatório...</div>;

    if (!isAuthorized) return (
        <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl max-w-2xl mx-auto mt-10 border border-red-200">
            <h2 className="text-xl font-bold flex items-center justify-center gap-2 mb-2"><ShieldCheck className="w-6 h-6" /> Acesso Negado</h2>
            <p>Somente a Administração do Condomínio possui acesso à auditoria operacional.</p>
            <Link href="/dashboard" className="text-violet-600 underline mt-4 block font-semibold">Voltar ao Início</Link>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto w-full p-4 pb-24">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <History className="text-violet-600 w-6 h-6" /> Relatório de Auditoria
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Histórico completo de retirada, devolução de chaves e ocorrências.</p>
                </div>
                <button
                    onClick={exportCSV}
                    disabled={csvLoading || historico.length === 0}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 transition font-semibold text-sm ${csvLoading || historico.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                >
                    {csvLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {csvLoading ? 'Gerando...' : 'Exportar CSV'}
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider">
                            <th className="p-4 font-semibold">Data / Turno</th>
                            <th className="p-4 font-semibold">Morador</th>
                            <th className="p-4 font-semibold">Movimentação (Retirada ➔ Devolução)</th>
                            <th className="p-4 font-semibold">Ocorrência</th>
                            <th className="p-4 font-semibold text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {historico.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">Nenhum histórico registrado no momento.</td></tr>
                        ) : (
                            historico.map(record => (
                                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-semibold text-gray-900">{new Date(record.data_reserva).toLocaleDateString('pt-BR')}</div>
                                        <div className="text-xs text-violet-600 bg-violet-50 inline-block px-2 py-0.5 rounded-full mt-1 border border-violet-100 font-medium">
                                            {record.turno_registro || 'Não Calculado'}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <p className="font-semibold text-gray-800 text-sm">{record.usuarios?.nome_completo}</p>
                                        <p className="text-xs text-gray-500">T{record.usuarios?.torre} - Apto {record.usuarios?.apartamento}</p>
                                    </td>
                                    <td className="p-4 text-xs">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                            <span className="font-medium text-gray-700">Retirada:</span>
                                            <span className="text-gray-600">
                                                {record.retirada_em ? new Date(record.retirada_em).toLocaleString('pt-BR') : '--'}
                                            </span>
                                            {record.porteiro_entrega && <span className="text-gray-400">por {record.porteiro_entrega.nome_completo}</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                                            <span className="font-medium text-gray-700">Devolvida:</span>
                                            <span className="text-gray-600">
                                                {record.devolvida_em ? new Date(record.devolvida_em).toLocaleString('pt-BR') : '--'}
                                            </span>
                                            {record.porteiro_recebimento && <span className="text-gray-400">por {record.porteiro_recebimento.nome_completo}</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm max-w-xs">
                                        {record.ocorrencia_texto ? (
                                            <div className="bg-red-50 text-red-800 p-2 rounded border border-red-100 flex items-start gap-1">
                                                <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                <span className="line-clamp-2" title={record.ocorrencia_texto}>{record.ocorrencia_texto}</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 italic">Sem ocorrências</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${record.status_chave === 'em_uso' ? 'bg-amber-100 text-amber-700' :
                                            'bg-green-100 text-green-700'
                                            }`}>
                                            {record.status_chave.replace('_', ' ')}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
