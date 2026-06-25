import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { criarReservaPresencial, AppError } from '@/lib/services/reserva';
import { createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const sensitiveLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
const PERMITIDOS = ['Porteiro', 'Subsíndico', 'Síndico Geral', 'SysAdmin'];

export async function POST(request: NextRequest) {
  try {
    const rl = sensitiveLimiter.check(request);
    if (rl) return rl;
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ detail: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ detail: 'Token inválido.' }, { status: 401 });

    const { data: caller } = await supabase
      .from('usuarios').select('cargo').eq('id', user.id).maybeSingle();

    if (!caller || !PERMITIDOS.includes(caller.cargo))
      return NextResponse.json({ detail: 'Sem permissão.' }, { status: 403 });

    const body = await request.json();
    const result = await criarReservaPresencial(supabase, body, user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ detail: e.message }, { status: e.status });
    console.error('[api/reservas/presencial]', e);
    return NextResponse.json({ detail: 'Erro desconhecido' }, { status: 500 });
  }
}
