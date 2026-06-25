import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { validarReserva, AppError } from '@/lib/services/reserva';
import { createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const normalLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export async function POST(request: NextRequest) {
  try {
    const rl = normalLimiter.check(request);
    if (rl) return rl;
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
