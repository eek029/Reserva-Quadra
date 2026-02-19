'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

export default function CookieBanner() {
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        // Check if user has already consented
        const hasConsented = localStorage.getItem('lgpd_consent');
        if (!hasConsented) {
            setShowBanner(true);
        }
    }, []);

    const handleAcceptAll = () => {
        localStorage.setItem('lgpd_consent', 'all');
        setShowBanner(false);
    };

    const handleAcceptEssential = () => {
        localStorage.setItem('lgpd_consent', 'essential');
        setShowBanner(false);
    };

    if (!showBanner) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-gray-200 shadow-2xl p-4 md:p-6 transform transition-transform duration-500 ease-in-out">
            <div className="max-w-4xl mx-auto md:flex md:items-center md:justify-between gap-4">
                <div className="flex-1 pr-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Sua Privacidade é Importante (LGPD)</h3>
                    <p className="text-sm text-gray-600 mb-4 md:mb-0 leading-relaxed">
                        Utilizamos cookies essenciais para o funcionamento seguro do nosso sistema de reservas e, com o seu consentimento, cookies de análise para melhorar a sua experiência.
                        Você pode revisar nossa{' '}
                        <Link href="/privacy" className="text-violet-600 font-semibold hover:underline">
                            Política de Privacidade
                        </Link>{' '}
                        e gerenciar seus dados a qualquer momento.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 min-w-[300px]">
                    <button
                        onClick={handleAcceptEssential}
                        className="flex-1 py-2 px-4 border border-violet-600 text-violet-700 font-medium rounded-lg hover:bg-violet-50 transition-colors text-sm"
                    >
                        Apenas Essenciais
                    </button>
                    <button
                        onClick={handleAcceptAll}
                        className="flex-1 py-2 px-4 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-colors shadow-md text-sm"
                    >
                        Aceitar Todos
                    </button>
                </div>

                <button
                    onClick={handleAcceptEssential}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 md:hidden"
                    aria-label="Closed"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
