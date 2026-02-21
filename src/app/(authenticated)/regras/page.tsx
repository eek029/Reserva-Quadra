'use client';



export default function RegrasPage() {
    return (
        <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 p-8 md:p-12">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8 border-b border-gray-100 pb-4">Regras para utilização da Quadra Poliesportiva do Complexo Júlio Prestes</h1>

                    <div className="space-y-8 text-gray-700">
                        <section className="bg-violet-50 p-6 rounded-xl border border-violet-100">
                            <h2 className="text-xl font-semibold text-violet-800 mb-3 flex items-center">
                                <span className="mr-3 text-2xl">⏰</span> Horário e Reservas
                            </h2>
                            <p className="leading-relaxed">A quadra funciona das <strong>09h às 22h</strong>. Apenas moradores das torres 1 a 5, maiores de 18 anos e com cadastro atualizado, podem realizar a reserva, com período máximo de utilização de 2 horas por dia, por unidade.</p>
                        </section>

                        <section className="p-6 border border-gray-200 rounded-xl hover:border-violet-200 transition-colors">
                            <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center">
                                <span className="mr-3 text-2xl">📋</span> Responsabilidade
                            </h2>
                            <p className="leading-relaxed">O morador titular da reserva é integralmente responsável pela conservação do espaço e pela conduta dos presentes. Caso haja menores de idade, a permanência do titular na quadra é <strong>obrigatória</strong> durante todo o período.</p>
                        </section>

                        <section className="p-6 border border-gray-200 rounded-xl hover:border-violet-200 transition-colors">
                            <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center">
                                <span className="mr-3 text-2xl">🌧️</span> Segurança e Chuva
                            </h2>
                            <p className="leading-relaxed">Por questões de segurança, é <strong>proibida</strong> a utilização da quadra em dias chuvosos ou enquanto o piso estiver molhado. Cabe aos usuários garantir que o local esteja seco antes do início da atividade.</p>
                        </section>

                        <section className="p-6 border border-gray-200 rounded-xl hover:border-violet-200 transition-colors">
                            <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center">
                                <span className="mr-3 text-2xl">👟</span> Preservação do Piso
                            </h2>
                            <p className="leading-relaxed">Para evitar danos à pintura e ao piso, é estritamente proibido o uso de bicicletas, patins, skates ou similares dentro da quadra.</p>
                        </section>

                        <section className="p-6 border border-gray-200 rounded-xl hover:border-violet-200 transition-colors">
                            <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center">
                                <span className="mr-3 text-2xl">🧹</span> Limpeza
                            </h2>
                            <p className="leading-relaxed">Ao final do período reservado, é dever do morador recolher todo o lixo gerado (garrafas, embalagens, etc.) e deixar o local organizado para o próximo usuário.</p>
                        </section>

                        <section className="bg-red-50 p-6 rounded-xl border border-red-100">
                            <h2 className="text-xl font-semibold text-red-800 mb-3 flex items-center">
                                <span className="mr-3 text-2xl">🔇</span> Lei do Silêncio e Convivência
                            </h2>
                            <p className="leading-relaxed">Barulhos excessivos, gritaria ou uso de caixas de som em volume alto são passíveis de advertência e multa, conforme o Regimento Interno, podendo acarretar a <strong>suspensão do direito de reserva</strong>.</p>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}
