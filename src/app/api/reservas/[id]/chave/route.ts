import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

import { getTurnoAtual } from '@/lib/turno';

// Helper: create client lazily inside each handler so env vars are available at runtime

// PATCH /api/reservas/[id]/chave
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!url || !key) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta.' }, { status: 500 });
        }

        const supabase = createClient(url, key);
        const requesterId = request.headers.get('requester-id');
        const { id } = params;
        const body = await request.json();
        const { acao, ocorrencia_texto } = body;

        if (!requesterId) {
            return NextResponse.json({ detail: 'requester-id header obrigatório.' }, { status: 400 });
        }

        // Permission check
        const { data: adminData } = await supabase
            .from('usuarios')
            .select('cargo')
            .eq('id', requesterId)
            .single();

        if (!adminData || !['SysAdmin', 'Síndico Geral', 'Subsíndico', 'Porteiro'].includes(adminData.cargo)) {
            return NextResponse.json({ detail: 'Sem permissão.' }, { status: 403 });
        }

        // Determine shift using native JS Intl API for America/Sao_Paulo (BRT)
        const agora = new Date();
        const turno = getTurnoAtual();
        const novaTimestamp = agora.toISOString();

        const updatePayload: Record<string, string> = { turno_registro: turno };

        if (acao === 'entregar') {
            updatePayload.status_chave = 'em_uso';
            updatePayload.retirada_em = novaTimestamp;
            updatePayload.entregue_por = requesterId;
        } else if (acao === 'receber') {
            updatePayload.status_chave = 'concluida';
            updatePayload.devolvida_em = novaTimestamp;
            updatePayload.recebida_por = requesterId;
            if (ocorrencia_texto) updatePayload.ocorrencia_texto = ocorrencia_texto;
        } else {
            return NextResponse.json({ detail: 'Ação inválida.' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('reservas')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 });
        }

        return NextResponse.json(data);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('[api/reservas/[id]/chave] Unhandled exception:', error);
        return NextResponse.json({ error: error?.message || 'Erro desconhecido' }, { status: 500 });
    }
}
