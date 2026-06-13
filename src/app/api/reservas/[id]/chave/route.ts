import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { registrarChave, AppError } from '@/lib/services/reserva';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getServiceClient();
    const requesterId = request.headers.get('requester-id');
    if (!requesterId) return NextResponse.json({ detail: 'requester-id header obrigatório.' }, { status: 400 });

    const { data: adminData } = await supabase
      .from('usuarios').select('cargo').eq('id', requesterId).maybeSingle();

    if (!adminData || !['SysAdmin', 'Síndico Geral', 'Subsíndico', 'Porteiro'].includes(adminData.cargo))
      return NextResponse.json({ detail: 'Sem permissão.' }, { status: 403 });

    const body = await request.json();
    const result = await registrarChave(supabase, params.id, body, requesterId);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[api/reservas/[id]/chave]', e);
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}
