import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { validarReserva, AppError } from '@/lib/services/reserva';
import { createRateLimiter } from '@/lib/rate-limit';
import { validateCsrfToken } from '@/lib/csrf';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const normalLimiter = createRateLimiter({ windowMs: 60_000, max: 60 }, 'reservas-validate');

export async function POST(request: NextRequest) {
  try {
    const rl = normalLimiter.check(request);
    if (rl) return rl;
    if (!validateCsrfToken(request)) {
      return NextResponse.json({ error: 'CSRF token inválido.' }, { status: 403 });
    }
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ detail: 'Não autorizado.' }, { status: 401 });

    const body = await request.json();
    const result = await validarReserva(getServiceClient(), body);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ detail: e.message }, { status: e.status });
    logger.error('validate_error', { endpoint: '/api/reservas/validate' });
    return NextResponse.json({ detail: 'Erro desconhecido' }, { status: 500 });
  }
}
