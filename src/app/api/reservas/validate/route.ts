import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

/** Extract & validate JWT Bearer token — returns null if invalid/missing */
async function getAuthUser(request: NextRequest) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return null;
    const { data: { user }, error } = await createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ).auth.getUser(token);
    return error ? null : user;
}

// POST /api/reservas/validate
export async function POST(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user) {
        return NextResponse.json({ detail: 'Não autorizado.' }, { status: 401 });
    }

    const supabase = getSupabase();
    const body = await request.json();
    const { usuario_id, data_reserva, hora_inicio, hora_fim } = body;

    // 1. Validate operational hours (09h–22h)
    const [h1, m1] = hora_inicio.split(':').map(Number);
    const [h2, m2] = hora_fim.split(':').map(Number);
    const startMins = h1 * 60 + m1;
    const endMins = h2 * 60 + m2;

    if (startMins < 9 * 60 || endMins > 22 * 60) {
        return NextResponse.json({ detail: 'A quadra só funciona das 09h às 22h.' }, { status: 400 });
    }
    if (startMins >= endMins) {
        return NextResponse.json({ detail: 'Horário de início deve ser anterior ao fim.' }, { status: 400 });
    }

    const duracaoNova = (endMins - startMins) / 60;

    // 2. Max 2h per reservation
    if (duracaoNova > 2) {
        return NextResponse.json({ detail: 'Uma única reserva não pode exceder 2 horas.' }, { status: 400 });
    }

    // 3. Daily 2h limit per user
    const { data: reservasDia } = await supabase
        .from('reservas')
        .select('hora_inicio, hora_fim')
        .eq('usuario_id', usuario_id)
        .eq('data_reserva', data_reserva)
        .eq('status', 'ativa');

    let totalHoras = duracaoNova;
    for (const r of (reservasDia || [])) {
        const [rh1, rm1] = r.hora_inicio.split(':').map(Number);
        const [rh2, rm2] = r.hora_fim.split(':').map(Number);
        totalHoras += ((rh2 * 60 + rm2) - (rh1 * 60 + rm1)) / 60;
    }
    if (totalHoras > 2.001) {
        return NextResponse.json({ detail: 'Limite de 2 horas por dia por unidade excedido.' }, { status: 400 });
    }

    // 4. Overlap check
    const { data: overlap } = await supabase
        .from('reservas')
        .select('hora_inicio, hora_fim')
        .eq('data_reserva', data_reserva)
        .eq('status', 'ativa');

    for (const r of (overlap || [])) {
        if (hora_inicio < r.hora_fim && hora_fim > r.hora_inicio) {
            return NextResponse.json({ detail: 'Já existe uma reserva para este horário.' }, { status: 400 });
        }
    }

    return NextResponse.json({ status: 'valid' });
}
