import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['Síndico Geral', 'Subsíndico', 'SysAdmin'];

// PATCH /api/reservas/[id] — Cancela reserva com motivo (admin only)
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !serviceRoleKey) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta.' }, { status: 500 });
        }

        const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
        if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

        const supabaseAdmin = createClient(url, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

        const { data: callerProfile } = await supabaseAdmin
            .from('usuarios')
            .select('cargo')
            .eq('id', user.id)
            .maybeSingle();

        if (!callerProfile || !ADMIN_ROLES.includes(callerProfile.cargo)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const body = await request.json();
        const { motivo_cancelamento } = body;

        if (!motivo_cancelamento || !motivo_cancelamento.trim()) {
            return NextResponse.json({ error: 'Motivo de cancelamento é obrigatório.' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('reservas')
            .update({
                status: 'cancelada',
                motivo_cancelamento: motivo_cancelamento.trim(),
            })
            .eq('id', params.id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ ok: true });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Erro desconhecido' }, { status: 500 });
    }
}
