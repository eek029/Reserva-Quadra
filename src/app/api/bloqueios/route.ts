import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { listarBloqueios, criarBloqueio, AppError } from '@/lib/services/bloqueio';
import { createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const normalLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
const sensitiveLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
const ADMIN_ROLES = ['Síndico Geral', 'SysAdmin'];

function getToken(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

export async function GET(request: NextRequest) {
  try {
    const rl = normalLimiter.check(request);
    if (rl) return rl;
    const token = getToken(request);
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

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
    const rl = sensitiveLimiter.check(request);
    if (rl) return rl;
    const token = getToken(request);
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

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
