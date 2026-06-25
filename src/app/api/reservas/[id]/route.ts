import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { cancelarReserva, AppError } from '@/lib/services/reserva';
import { createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const sensitiveLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rl = sensitiveLimiter.check(request);
    if (rl) return rl;
    const { id } = await params;
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

    const { data: callerProfile } = await supabase
      .from('usuarios').select('cargo, torre').eq('id', user.id).maybeSingle();

    if (!callerProfile || !['Síndico Geral', 'Subsíndico', 'SysAdmin'].includes(callerProfile.cargo))
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

    if (callerProfile.cargo === 'Subsíndico') {
      const { data: reserva } = await supabase
        .from('reservas').select('usuario_id').eq('id', id).maybeSingle();
      if (!reserva) return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 });

      const { data: morador } = await supabase
        .from('usuarios').select('torre').eq('id', reserva.usuario_id).maybeSingle();

      if (!morador || morador.torre !== callerProfile.torre)
        return NextResponse.json({ error: 'Você só pode cancelar reservas da sua torre.' }, { status: 403 });
    }

    const body = await request.json();
    await cancelarReserva(supabase, id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[api/reservas/[id]]', e);
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}
