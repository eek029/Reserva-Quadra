'use client';

import { useState } from 'react';
import { ArrowLeft, Camera, Upload } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
    const [cargo, setCargo] = useState('Morador');
    const [torre, setTorre] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center mb-8">
                    <Link href="/" className="flex items-center text-violet-600 hover:text-violet-500 font-medium transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar para Login
                    </Link>
                </div>

                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="bg-violet-600 px-8 py-6 text-white text-center">
                        <h1 className="text-2xl font-bold">Cadastro de Usuário</h1>
                        <p className="text-violet-100 mt-1">Preencha seus dados para acessar o sistema.</p>
                    </div>

                    <form className="p-8 space-y-8">
                        {/* Foto Upload Section */}
                        <div className="flex flex-col items-center space-y-4">
                            <div className="relative w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden group">
                                {previewImage ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <Camera className="w-10 h-10 text-gray-400" />
                                )}
                                <label className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                    <Upload className="text-white w-6 h-6" />
                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                </label>
                            </div>
                            <span className="text-sm font-medium text-gray-700">Sua Foto</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Nome Completo */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                                <input
                                    type="text"
                                    required
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                    placeholder="Seu nome completo"
                                />
                            </div>

                            {/* RG & CPF */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">RG</label>
                                <input
                                    type="text"
                                    required
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                    placeholder="00.000.000-0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">CPF</label>
                                <input
                                    type="text"
                                    required
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                    placeholder="000.000.000-00"
                                />
                            </div>

                            {/* Data Nasc & Telefone */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Data de Nascimento</label>
                                <input
                                    type="date"
                                    required
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Telefone Celular</label>
                                <input
                                    type="tel"
                                    required
                                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                    placeholder="(11) 90000-0000"
                                />
                            </div>

                            {/* Cargo - Selection Boxes */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Seu Cargo</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {['Morador', 'Porteiro', 'Subsíndico', 'Síndico Geral'].map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => setCargo(item)}
                                            className={`px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${cargo === item
                                                ? 'border-violet-600 bg-violet-50 text-violet-700'
                                                : 'border-gray-200 text-gray-500 hover:border-violet-200'
                                                }`}
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Conditional Tower and Apt Section */}
                            {cargo !== 'Porteiro' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Torre</label>
                                        <select
                                            required
                                            value={torre}
                                            onChange={(e) => setTorre(e.target.value)}
                                            className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                        >
                                            <option value="">Selecione a Torre</option>
                                            {[1, 2, 3, 4, 5].map((num) => (
                                                <option key={num} value={num}>Torre {num}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Apartamento</label>
                                        <input
                                            type="text"
                                            required
                                            className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 transition-shadow sm:text-sm"
                                            placeholder="00"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Conditional Bloco for Torre 5 */}
                            {cargo !== 'Porteiro' && torre === '5' && (
                                <div className="md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="block text-sm font-medium text-gray-700">Bloco (Torre 5)</label>
                                    <div className="mt-2 flex space-x-4">
                                        {['A', 'B'].map((b) => (
                                            <label key={b} className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    name="bloco"
                                                    value={b}
                                                    className="form-radio h-4 w-4 text-violet-600 border-gray-300 focus:ring-violet-500"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">Bloco {b}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                className="w-full flex justify-center py-4 px-4 border border-transparent text-base font-bold rounded-lg text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 transition-all shadow-lg hover:shadow-violet-200"
                            >
                                Finalizar Cadastro
                            </button>
                        </div>
                    </form>

                    <div className="px-8 pb-8 text-center">
                        <p className="text-xs text-gray-400">
                            Ao se cadastrar, você concorda com nossos termos de uso e política de privacidade sob as diretrizes da LGPD (2026).
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
