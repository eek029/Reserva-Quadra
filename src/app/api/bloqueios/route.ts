import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['Síndico Geral', 'Subsíndico', 'SysAdmin'];
const MOTIVOS_VALIDOS = ['Chuva', 'Manutenção'];

function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function validateAdmin(request: NextRequest) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return { error: 'Não autorizado.', status: 401 };

    const supabase = getAdminClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { error: 'Token inválido.', status: 401 };

    const { data: profile } = await supabase
        .from('usuarios')
        .select('cargo')
        .eq('id', user.id)
        .maybeSingle();

    if (!profile || !ADMIN_ROLES.includes(profile.cargo)) {
        return { error: 'Acesso negado.', status: 403 };
    }

    return { user, supabase };
}

// GET /api/bloqueios?data=YYYY-MM-DD
export async function GET(request: NextRequest) {
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return NextResponse.json({ error: 'Config incompleta.' }, { status: 500 });

        const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
        if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

        const supabase = createClient(url, key);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

        const data = request.nextUrl.searchParams.get('data');
        let query = supabase.from('bloqueios').select('*').order('hora_inicio', { ascending: true });
        if (data) query = query.eq('data', data);

        const { data: result, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json(result || []);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Erro desconhecido' }, { status: 500 });
    }
}

// POST /api/bloqueios
// Body: { data: string, slots: [{ hora_inicio, hora_fim }], motivo: 'Chuva'|'Manutenção' }
export async function POST(request: NextRequest) {
    try {
        const auth = await validateAdmin(request);
        if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const { user, supabase } = auth;
        const body = await request.json();
        const { data, slots, motivo } = body as {
            data: string;
            slots: { hora_inicio: string; hora_fim: string }[];
            motivo: string;
        };

        if (!data || !slots?.length || !MOTIVOS_VALIDOS.includes(motivo)) {
            return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
        }

        // Inserir bloqueios
        const bloqueiosParaInserir = slots.map(slot => ({
            data,
            hora_inicio: slot.hora_inicio,
            hora_fim: slot.hora_fim,
            motivo,
            criado_por: user.id,
        }));

        const { error: insertError } = await supabase
            .from('bloqueios')
            .insert(bloqueiosParaInserir);

        if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

        // Auto-cancelar reservas ativas conflitantes
        for (const slot of slots) {
            const { data: reservasConflitantes } = await supabase
                .from('reservas')
                .select('id')
                .eq('data_reserva', data)
                .eq('hora_inicio', slot.hora_inicio)
                .eq('status', 'ativa');

            if (reservasConflitantes?.length) {
                const ids = reservasConflitantes.map(r => r.id);
                await supabase
                    .from('reservas')
                    .update({
                        status: 'cancelada',
                        motivo_cancelamento: `Bloqueado — ${motivo}`,
                    })
                    .in('id', ids);
            }
        }

        return NextResponse.json({ ok: true }, { status: 201 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Erro desconhecido' }, { status: 500 });
    }
}
