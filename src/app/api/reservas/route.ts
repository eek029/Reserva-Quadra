import { NextRequest, NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase-server';
import { listarReservas, criarReserva, AppError } from '@/lib/services/reserva';

export const dynamic = 'force-dynamic';

function handleError(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error('[api/reservas]', e);
  return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
}

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

    const data = request.nextUrl.searchParams.get('data') ?? undefined;
    const result = await listarReservas(supabase, data);
    return NextResponse.json(result);
  } catch (e) { return handleError(e); }
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request);
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    const supabase = await createApiClient(token);

    const body = await request.json();
    const result = await criarReserva(supabase, body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) { return handleError(e); }
}
