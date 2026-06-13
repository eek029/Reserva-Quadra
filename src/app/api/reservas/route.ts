import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/lib/supabase-server';
import { listarReservas, criarReserva, AppError } from '@/lib/services/reserva';

export const dynamic = 'force-dynamic';

function handleError(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error('[api/reservas]', e);
  return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
}

function getSupabase(request: NextRequest) {
  return getRouteClient(() => request.cookies.getAll());
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const data = request.nextUrl.searchParams.get('data') ?? undefined;
    const result = await listarReservas(supabase, data);
    return NextResponse.json(result);
  } catch (e) { return handleError(e); }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const body = await request.json();
    const result = await criarReserva(supabase, body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) { return handleError(e); }
}
