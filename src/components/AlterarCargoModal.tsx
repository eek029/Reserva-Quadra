'use client';

import { useState } from 'react';
import { Shield, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props {
  usuario: { id: string; nome_completo: string; cargo: string };
  allowChangeTo: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AlterarCargoModal({ usuario, allowChangeTo, onClose, onSuccess }: Props) {
  const [novoCargo, setNovoCargo] = useState(usuario.cargo);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSubmit = async () => {
    if (novoCargo === usuario.cargo) return;
    setLoading(true);
    setResult(null);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const res = await fetch(`/api/usuarios/${usuario.id}/cargo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ novoCargo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, msg: data.error || 'Erro desconhecido' });
      } else {
        setResult({ ok: true, msg: `Cargo alterado para ${novoCargo}.` });
        setTimeout(onSuccess, 1200);
      }
    } catch {
      setResult({ ok: false, msg: 'Erro de conexão.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-violet-50 rounded-full flex-shrink-0">
            <Shield className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Alterar Cargo</h3>
            <p className="text-sm text-gray-600 mt-1">
              Alterar cargo de <strong>{usuario.nome_completo}</strong> ({usuario.cargo})
            </p>
          </div>
        </div>

        <select
          value={novoCargo}
          onChange={e => setNovoCargo(e.target.value)}
          className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-violet-500 focus:border-violet-500 bg-white"
        >
          {allowChangeTo.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <p className="text-xs text-gray-400 mt-2">Essa ação será registrada em auditoria.</p>

        {result && (
          <div className={`mt-3 flex items-center gap-2 text-sm font-semibold ${result.ok ? 'text-green-700' : 'text-red-600'}`}>
            {result.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {result.msg}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={loading || novoCargo === usuario.cargo} className="flex-1 py-2 font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
