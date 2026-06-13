import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { cancelarReserva, AppError } from '@/lib/services/reserva';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

    const { data: callerProfile } = await supabase
      .from('usuarios').select('cargo').eq('id', user.id).maybeSingle();

    if (!callerProfile || !['Síndico Geral', 'Subsíndico', 'SysAdmin'].includes(callerProfile.cargo))
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

    const body = await request.json();
    await cancelarReserva(supabase, params.id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[api/reservas/[id]]', e);
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}
