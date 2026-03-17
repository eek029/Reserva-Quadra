import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['Síndico Geral', 'Subsíndico', 'SysAdmin'];

// DELETE /api/bloqueios/[id]
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceRoleKey) {
            return NextResponse.json({ error: 'Configuração incompleta.' }, { status: 500 });
        }

        const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
        if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

        const supabase = createClient(url, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

        const { data: profile } = await supabase
            .from('usuarios')
            .select('cargo')
            .eq('id', user.id)
            .maybeSingle();

        if (!profile || !ADMIN_ROLES.includes(profile.cargo)) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const { error } = await supabase
            .from('bloqueios')
            .delete()
            .eq('id', params.id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ ok: true });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Erro desconhecido' }, { status: 500 });
    }
}
