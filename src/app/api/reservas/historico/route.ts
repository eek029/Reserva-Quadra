import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { listarHistoricoReservas, AppError } from '@/lib/services/reserva';
import { createRateLimiter } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const normalLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export async function GET(request: NextRequest) {
  try {
    const rl = normalLimiter.check(request);
    if (rl) return rl;

    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

    const { data: caller } = await supabase
      .from('usuarios').select('id, cargo, torre').eq('id', user.id).maybeSingle();
    if (!caller) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 401 });

    const filters = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await listarHistoricoReservas(
      supabase, caller.id, caller.cargo, caller.torre, filters
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    logger.error('historico_error', { endpoint: '/api/reservas/historico' });
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}
