import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { listarReservas, criarReserva, AppError } from '@/lib/services/reserva';
import { createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const normalLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

function getToken(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

function handleError(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error('[api/reservas]', e);
  return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
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

    const { data: perfil } = await supabase
      .from('usuarios').select('cargo').eq('id', user.id).maybeSingle();

    const data = request.nextUrl.searchParams.get('data') ?? undefined;
    const result = await listarReservas(supabase, data, user.id, perfil?.cargo);
    return NextResponse.json(result);
  } catch (e) { return handleError(e); }
}

export async function POST(request: NextRequest) {
  try {
    const rl = normalLimiter.check(request);
    if (rl) return rl;
    const token = getToken(request);
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const body = await request.json();
    const result = await criarReserva(supabase, body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) { return handleError(e); }
}
