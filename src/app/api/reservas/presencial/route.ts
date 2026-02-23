import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

// POST /api/reservas/presencial
// Body: { morador_id, hora_inicio, hora_fim }
// Header: requester-id (porteiro)
export async function POST(request: NextRequest) {
    const supabase = getSupabase();
    const porteiro_id = request.headers.get('requester-id');
    if (!porteiro_id) {
        return NextResponse.json({ detail: 'requester-id header obrigatório.' }, { status: 400 });
    }

    // Verify caller is a Porteiro (or higher)
    const { data: caller } = await supabase
        .from('usuarios')
        .select('cargo')
        .eq('id', porteiro_id)
        .single();

    if (!caller || !['Porteiro', 'Subsíndico', 'Síndico Geral', 'SysAdmin'].includes(caller.cargo)) {
        return NextResponse.json({ detail: 'Sem permissão.' }, { status: 403 });
    }

    const body = await request.json();
    const { morador_id, hora_inicio, hora_fim } = body;

    if (!morador_id || !hora_inicio || !hora_fim) {
        return NextResponse.json({ detail: 'morador_id, hora_inicio e hora_fim são obrigatórios.' }, { status: 400 });
    }

    // Verify morador exists and is approved
    const { data: morador } = await supabase
        .from('usuarios')
        .select('id, status')
        .eq('id', morador_id)
        .eq('status', 'aprovado')
        .single();

    if (!morador) {
        return NextResponse.json({ detail: 'Morador não encontrado ou não aprovado.' }, { status: 404 });
    }

    // Use BRT date for today
    const brtDate = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const data_reserva = new Date(brtDate).toISOString().split('T')[0];

    // Check for slot conflicts
    const { data: conflitos } = await supabase
        .from('reservas')
        .select('hora_inicio, hora_fim')
        .eq('data_reserva', data_reserva)
        .eq('status', 'ativa');

    for (const r of (conflitos || [])) {
        if (hora_inicio < r.hora_fim && hora_fim > r.hora_inicio) {
            return NextResponse.json({ detail: 'Horário já está ocupado.' }, { status: 409 });
        }
    }

    // Insert reservation linked to the morador (not the porteiro)
    const { data, error } = await supabase
        .from('reservas')
        .insert([{
            usuario_id: morador_id,
            data_reserva,
            hora_inicio,
            hora_fim,
            status: 'ativa',
            status_chave: 'aguardando',
            aceite_termos: true,
        }])
        .select()
        .single();

    if (error || !data) {
        return NextResponse.json({ detail: error?.message || 'Erro ao criar reserva.' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}
