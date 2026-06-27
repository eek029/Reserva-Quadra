import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { createRateLimiter } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const limiter = createRateLimiter({ windowMs: 60_000, max: 20 }, 'privacy-dados');

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

    const { data: usuario, error } = await supabase
      .rpc('get_usuario_decrypted', { target_id: user.id });

    if (error || !usuario || usuario.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    const dados = usuario[0];

    const dadosLimpos = {
      nome_completo: dados.nome_completo,
      data_nascimento: dados.data_nascimento,
      telefone: dados.telefone,
      apartamento: dados.apartamento,
      torre: dados.torre,
      bloco: dados.bloco || null,
      cargo: dados.cargo,
      status: dados.status,
      cpf: dados.cpf,
      rg: dados.rg,
      foto_url: dados.foto_url,
    };

    return NextResponse.json(dadosLimpos);
  } catch (e) {
    logger.error('privacy_dados_error', { endpoint: '/api/privacy/dados' });
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
