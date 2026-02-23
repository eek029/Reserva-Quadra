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

// GET /api/reservas?data=YYYY-MM-DD
export async function GET(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user) {
        return NextResponse.json({ detail: 'Não autorizado.' }, { status: 401 });
    }

    const supabase = getSupabase();
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
