import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { registrarChave, AppError } from '@/lib/services/reserva';
import { createRateLimiter } from '@/lib/rate-limit';
import { validateRequestPayload } from '@/lib/api-validation';
import { validateUUID } from '@/lib/validators';
import { validateCsrfToken } from '@/lib/csrf';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const sensitiveLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
const PERMITIDOS = ['SysAdmin', 'Síndico Geral', 'Subsíndico', 'Porteiro'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rl = sensitiveLimiter.check(request);
    if (rl) return rl;
    
    const validationError = validateRequestPayload(request);
    if (validationError) return validationError;
    
    if (!validateCsrfToken(request)) {
      return NextResponse.json({ error: 'CSRF token inválido.' }, { status: 403 });
    }
    
    const { id } = await params;
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return NextResponse.json({ error: uuidValidation.error }, { status: 400 });
    }
    
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

    const { data: caller } = await supabase
      .from('usuarios').select('cargo').eq('id', user.id).maybeSingle();

    if (!caller || !PERMITIDOS.includes(caller.cargo))
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });

    const body = await request.json();
    const result = await registrarChave(supabase, id, body, user.id);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    logger.error('chave_error', { endpoint: '/api/reservas/[id]/chave' });
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}
