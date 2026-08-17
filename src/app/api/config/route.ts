import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { AppError, getConfig, setConfig } from '@/lib/services/reserva';
import { createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = createRateLimiter({ windowMs: 60_000, max: 60 }, 'config');

export async function GET(request: NextRequest) {
  try {
    const rl = limiter.check(request);
    if (rl) return rl;

    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

    const torre = await getConfig(supabase, 'torre_gestao_chaves');
    return NextResponse.json({ torre_gestao_chaves: torre || null });
  } catch {
    return NextResponse.json({ error: 'Erro ao ler configuração.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rl = limiter.check(request);
    if (rl) return rl;

    // CSRF validation before processing any data
    const csrfToken = request.headers.get('x-csrf-token');
    const csrfCookie = request.cookies.get('csrf-token')?.value;
    if (!csrfToken || !csrfCookie || csrfToken !== csrfCookie) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

    const { data: caller } = await supabase
      .from('usuarios').select('cargo').eq('id', user.id).maybeSingle();
    if (!caller || !['Síndico Geral', 'SysAdmin'].includes(caller.cargo))
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });

    const body = await request.json();
    const { torre_gestao_chaves } = body;
    if (!torre_gestao_chaves || !['1', '2', '3', '4', '5'].includes(torre_gestao_chaves))
      return NextResponse.json({ error: 'Torre inválida.' }, { status: 400 });

    await setConfig(supabase, 'torre_gestao_chaves', torre_gestao_chaves);
    return NextResponse.json({ torre_gestao_chaves });
  } catch {
    return NextResponse.json({ error: 'Erro ao alterar configuração.' }, { status: 500 });
  }
}
