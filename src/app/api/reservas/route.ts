import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// GET /api/reservas?data=YYYY-MM-DD
export async function GET(request: NextRequest) {
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!url || !key) {
            return NextResponse.json({ error: 'Supabase URL or Key is missing no ambiente.' }, { status: 500 });
        }

        const supabase = createClient(url, key);

        // 1. Validate JWT
        const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
        if (!token) {
            return NextResponse.json({ detail: 'Não autorizado. Token ausente.' }, { status: 401 });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ detail: 'Não autorizado.' }, { status: 401 });
        }

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('[api/reservas] Unhandled exception:', error);
        return NextResponse.json({ detail: error?.message || 'Erro desconhecido' }, { status: 500 });
    }
}
