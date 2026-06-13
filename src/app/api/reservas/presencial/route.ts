import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { criarReservaPresencial, AppError } from '@/lib/services/reserva';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    const requesterId = request.headers.get('requester-id');
    if (!requesterId) return NextResponse.json({ detail: 'requester-id header obrigatório.' }, { status: 400 });

    const { data: caller } = await supabase
      .from('usuarios').select('cargo').eq('id', requesterId).maybeSingle();

    if (!caller || !['Porteiro', 'Subsíndico', 'Síndico Geral', 'SysAdmin'].includes(caller.cargo))
      return NextResponse.json({ detail: 'Sem permissão.' }, { status: 403 });

    const body = await request.json();
    const result = await criarReservaPresencial(supabase, body, requesterId);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ detail: e.message }, { status: e.status });
    console.error('[api/reservas/presencial]', e);
    return NextResponse.json({ detail: 'Erro desconhecido' }, { status: 500 });
  }
}
