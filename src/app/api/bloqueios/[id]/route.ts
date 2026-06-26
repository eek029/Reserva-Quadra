import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRateLimiter } from '@/lib/rate-limit';
import { validateUUID } from '@/lib/validators';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const sensitiveLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
const ADMIN_ROLES = ['Síndico Geral', 'SysAdmin'];

// DELETE /api/bloqueios/[id]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const rl = sensitiveLimiter.check(request);
        if (rl) return rl;
        const { id } = await params;
        
        const uuidValidation = validateUUID(id);
        if (!uuidValidation.valid) {
          return NextResponse.json({ error: uuidValidation.error }, { status: 400 });
        }
        
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
            .eq('id', id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ ok: true });
    } catch (e) {
        logger.error('bloqueio_delete_error', { endpoint: '/api/bloqueios/[id]' });
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Erro desconhecido' },
          { status: 500 }
        );
    }
}
