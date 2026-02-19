'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, Trash2 } from 'lucide-react';

export default function PrivacyPage() {
    const [showConfirm, setShowConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteRequest = async () => {
        setIsDeleting(true);
        // Simulate API call for deletion
        await new Promise(resolve => setTimeout(resolve, 1500));
        alert('Sua solicitação de exclusão foi enviada. Os administradores processarão seu pedido em até 48h conforme a LGPD.');
        setIsDeleting(false);
        setShowConfirm(false);
    };

    return (
        <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <Link href="/dashboard" className="flex items-center text-violet-600 hover:text-violet-500 font-medium transition-colors cursor-pointer">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">Privacidade & LGPD</h1>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
                    <div className="p-6 md:p-8 space-y-6">
                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                                <ShieldAlert className="w-5 h-5 mr-2 text-violet-600" />
                                Como tratamos seus dados
                            </h2>
                            <div className="text-sm text-gray-600 space-y-3 leading-relaxed">
                                <p>
                                    O aplicativo <strong>Reserva Quadra - Condomínio Júlio Prestes</strong> coleta as seguintes informações obrigatoriamente para fins de segurança e organização do condomínio: Nome, Data de Nascimento, Telefone, RG, CPF, Torre e Apartamento.
                                </p>
                                <p>
                                    Seus dados sensíveis (como RG e CPF) são armazenados sob <strong>forte criptografia (AES-256)</strong> em nossos servidores e só podem ser acessados ou descriptografados por autoridade administrativa (Síndico Geral) mediante necessidades específicas estabelecidas nas regras condominais. Todo acesso a esses dados gera um log de auditoria inalterável.
                                </p>
                            </div>
                        </section>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
                    <div className="bg-red-50 p-6 md:p-8">
                        <h2 className="text-lg font-semibold text-red-700 mb-2 flex items-center">
                            <Trash2 className="w-5 h-5 mr-2" />
                            Excluir ou Anonimizar Dados
                        </h2>
                        <p className="text-sm text-red-600 mb-6">
                            Em conformidade com a LGPD, você tem o direito de solicitar a exclusão da sua conta e anonimização dos seus dados pessoais. Note que isso o impedirá de acessar o sistema de reservas permanentemente. Reservas passadas serão anonimizadas mantendo apenas o registro de uso da quadra sem a sua identificação direta.
                        </p>

                        {!showConfirm ? (
                            <button
                                onClick={() => setShowConfirm(true)}
                                className="bg-white text-red-600 border border-red-200 hover:bg-red-100 py-2 px-6 rounded-lg font-medium transition-colors text-sm"
                            >
                                Solicitar Exclusão de Conta
                            </button>
                        ) : (
                            <div className="bg-white p-4 rounded-lg border border-red-200 mt-4 animate-in fade-in slide-in-from-top-2">
                                <p className="font-semibold text-gray-800 text-sm mb-3">Tem certeza que deseja solicitar a exclusão?</p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleDeleteRequest}
                                        disabled={isDeleting}
                                        className="bg-red-600 hover:bg-red-700 text-white py-2 px-6 rounded-lg font-medium transition-colors text-sm disabled:opacity-50"
                                    >
                                        {isDeleting ? 'Enviando...' : 'Confirmar Solicitação'}
                                    </button>
                                    <button
                                        onClick={() => setShowConfirm(false)}
                                        disabled={isDeleting}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-medium transition-colors text-sm"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
