import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { validarReserva, AppError } from '@/lib/services/reserva';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ detail: 'Não autorizado.' }, { status: 401 });

    const body = await request.json();
    const result = await validarReserva(getServiceClient(), body);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ detail: e.message }, { status: e.status });
    console.error('[api/reservas/validate]', e);
    return NextResponse.json({ detail: 'Erro desconhecido' }, { status: 500 });
  }
}
