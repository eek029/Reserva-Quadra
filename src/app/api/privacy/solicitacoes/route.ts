import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { createRateLimiter } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const limiter = createRateLimiter({ windowMs: 60_000, max: 20 }, 'privacy-solicitacoes');

function getToken(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

export async function GET(request: NextRequest) {
  try {
    const rl = limiter.check(request);
    if (rl) return rl;

    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const { data: cargo } = await supabase
      .from('usuarios')
      .select('cargo')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = cargo && ['SysAdmin', 'Síndico Geral', 'Subsíndico'].includes(cargo.cargo);

    let query = supabase
      .from('solicitacoes_exclusao')
      .select(isAdmin
        ? 'id, usuario_id, motivo, status, created_at, revisado_em, usuarios!solicitacoes_exclusao_usuario_id_fkey(nome_completo, torre, apartamento)'
        : 'id, motivo, status, created_at'
      )
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('usuario_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('privacy_solicitacoes_fetch_error', { error: error.message });
      return NextResponse.json({ error: 'Erro ao buscar solicitações.' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (e) {
    logger.error('privacy_solicitacoes_error', { endpoint: '/api/privacy/solicitacoes' });
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
