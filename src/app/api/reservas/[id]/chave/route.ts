import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { registrarChave, AppError } from '@/lib/services/reserva';

export const dynamic = 'force-dynamic';

const PERMITIDOS = ['SysAdmin', 'Síndico Geral', 'Subsíndico', 'Porteiro'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const result = await registrarChave(supabase, params.id, body, user.id);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[api/reservas/[id]/chave]', e);
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}
