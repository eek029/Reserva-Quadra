import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient, getServiceClient } from '@/lib/supabase-server';
import { listarBloqueios, criarBloqueio, AppError } from '@/lib/services/bloqueio';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['Síndico Geral', 'Subsíndico', 'SysAdmin'];

export async function GET(request: NextRequest) {
  try {
    const supabase = getRouteClient(() => request.cookies.getAll());
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const data = request.nextUrl.searchParams.get('data') ?? undefined;
    const result = await listarBloqueios(supabase, data);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

    const { data: profile } = await supabase
      .from('usuarios').select('cargo').eq('id', user.id).maybeSingle();

    if (!profile || !ADMIN_ROLES.includes(profile.cargo))
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

    const body = await request.json();
    const result = await criarBloqueio(supabase, user.id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}
