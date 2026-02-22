import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/reservas?data=YYYY-MM-DD
export async function GET(request: NextRequest) {
    const data = request.nextUrl.searchParams.get('data');

    let query = supabase
        .from('reservas')
        .select('*, usuarios(nome_completo, torre, apartamento)');

    if (data) {
        query = query.eq('data_reserva', data);
    }

    const { data: result, error } = await query;

    if (error) {
        return NextResponse.json({ detail: error.message }, { status: 500 });
    }

    return NextResponse.json(result);
}
