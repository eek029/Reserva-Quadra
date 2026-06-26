import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { createRateLimiter } from '@/lib/rate-limit';
import { validateRequestPayload } from '@/lib/api-validation';
import { validateCsrfToken } from '@/lib/csrf';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const limiter = createRateLimiter({ windowMs: 60_000, max: 30 }, 'notificacoes-delete');

export async function DELETE(request: NextRequest) {
    try {
        const rl = limiter.check(request);
        if (rl) return rl;

        const validationError = validateRequestPayload(request);
        if (validationError) return validationError;

        if (!validateCsrfToken(request)) {
            return NextResponse.json({ error: 'CSRF token inválido.' }, { status: 403 });
        }

        const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
        if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

        const supabase = getServiceClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

        const body = await request.json();
        const { ids } = body as { ids?: string[] };
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Nenhum ID fornecido.' }, { status: 400 });
        }
        if (ids.length > 100) {
            return NextResponse.json({ error: 'Máximo de 100 notificações por vez.' }, { status: 400 });
        }

        const { data: notifs, error: fetchError } = await supabase
            .from('notificacoes')
            .select('id, destinatario_id')
            .in('id', ids);

        if (fetchError) {
            logger.error('notificacoes_fetch_error', { error: fetchError });
            return NextResponse.json({ error: 'Erro ao verificar notificações.' }, { status: 500 });
        }

        const deletableIds = (notifs || [])
            .filter(n => n.destinatario_id === user.id)
            .map(n => n.id);

        if (deletableIds.length === 0) {
            return NextResponse.json({ error: 'Nenhuma notificação pode ser removida.' }, { status: 403 });
        }

        const { error: deleteError } = await supabase
            .from('notificacoes')
            .delete()
            .in('id', deletableIds);

        if (deleteError) {
            logger.error('notificacoes_delete_error', { error: deleteError });
            return NextResponse.json({ error: 'Erro ao remover notificações.' }, { status: 500 });
        }

        return NextResponse.json({ deleted: deletableIds.length });
    } catch (e) {
        logger.error('notificacoes_delete_catch', { error: e instanceof Error ? e.message : String(e) });
        return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
    }
}
