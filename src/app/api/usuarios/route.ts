import { NextRequest, NextResponse } from 'next/server';
import { createApiClient, getServiceClient } from '@/lib/supabase-server';
import { listarUsuarios, criarUsuario, AppError } from '@/lib/services/usuario';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getToken(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request);
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    const supabase = await createApiClient(token);

    const status = request.nextUrl.searchParams.get('status') ?? undefined;
    const result = await listarUsuarios(supabase, status);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[api/usuarios]', e);
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    const auth_id = request.nextUrl.searchParams.get('auth_id');
    if (!auth_id) return NextResponse.json({ error: 'auth_id é obrigatório.' }, { status: 400 });

    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.id !== auth_id)
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const body = await request.json();
    const result = await criarUsuario(supabase, auth_id, body);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[api/usuarios]', e);
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}
