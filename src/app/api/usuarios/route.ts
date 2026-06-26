import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { listarUsuarios, criarUsuario, AppError } from '@/lib/services/usuario';
import { createRateLimiter } from '@/lib/rate-limit';
import { validateRequestPayload } from '@/lib/api-validation';
import { validateCsrfToken } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const normalLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export async function GET(request: NextRequest) {
  try {
    const rl = normalLimiter.check(request);
    if (rl) return rl;
    const auth = request.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

    const { data: caller } = await supabase
      .from('usuarios').select('cargo, torre').eq('id', user.id).maybeSingle();
    if (!caller) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 401 });

    const status = request.nextUrl.searchParams.get('status') ?? undefined;
    const result = await listarUsuarios(supabase, status, user.id, caller.cargo, caller.torre);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[api/usuarios]', e);
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rl = normalLimiter.check(request);
    if (rl) return rl;
    
    const validationError = validateRequestPayload(request);
    if (validationError) return validationError;
    
    if (!validateCsrfToken(request)) {
      return NextResponse.json({ error: 'CSRF token inválido.' }, { status: 403 });
    }
    
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
