import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/** Extract & validate JWT Bearer token — returns null if invalid/missing */
async function getAuthUser(request: NextRequest, url: string, key: string) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return null;
    const { data: { user }, error } = await createClient(url, key).auth.getUser(token);
    return error ? null : user;
}

// GET /api/reservas?data=YYYY-MM-DD
export async function GET(request: NextRequest) {
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !key || !serviceRoleKey) {
            return NextResponse.json({ error: 'Supabase URL or Key is missing no ambiente.' }, { status: 500 });
        }

        const user = await getAuthUser(request, url, key);
        if (!user) {
            return NextResponse.json({ detail: 'Não autorizado.' }, { status: 401 });
        }

        const supabase = createClient(url, serviceRoleKey);
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
