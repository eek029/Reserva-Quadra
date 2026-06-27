import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { createRateLimiter } from '@/lib/rate-limit';
import { validateRequestPayload } from '@/lib/api-validation';
import { validateCsrfToken } from '@/lib/csrf';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const limiter = createRateLimiter({ windowMs: 60_000, max: 5 }, 'privacy-download');

function getToken(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

export async function POST(request: NextRequest) {
  try {
    const rl = limiter.check(request);
    if (rl) return rl;

    const validationError = validateRequestPayload(request);
    if (validationError) return validationError;

    if (!validateCsrfToken(request)) {
      return NextResponse.json({ error: 'CSRF token inválido.' }, { status: 403 });
    }

    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const { data: usuario, error: userError } = await supabase
      .rpc('get_usuario_decrypted', { target_id: user.id });

    if (userError || !usuario || usuario.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    const { data: reservas } = await supabase
      .from('reservas')
      .select('data_reserva, hora_inicio, hora_fim, status, status_chave, created_at')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false });

    const { data: solicitacoes } = await supabase
      .from('solicitacoes_exclusao')
      .select('status, created_at, motivo')
      .eq('usuario_id', user.id);

    const dadosPortabilidade = {
      exportado_em: new Date().toISOString(),
      usuario: {
        nome_completo: usuario[0].nome_completo,
        data_nascimento: usuario[0].data_nascimento,
        telefone: usuario[0].telefone,
        apartamento: usuario[0].apartamento,
        torre: usuario[0].torre,
        bloco: usuario[0].bloco || null,
        cargo: usuario[0].cargo,
        status: usuario[0].status,
      },
      documentos_pessoais: {
        cpf: usuario[0].cpf,
        rg: usuario[0].rg,
      },
      reservas_realizadas: (reservas || []).map(r => ({
        data: r.data_reserva,
        inicio: r.hora_inicio,
        fim: r.hora_fim,
        status: r.status,
        chave: r.status_chave,
      })),
      solicitacoes_exclusao: (solicitacoes || []).map(s => ({
        status: s.status,
        data: s.created_at,
        motivo: s.motivo,
      })),
    };

    const json = JSON.stringify(dadosPortabilidade, null, 2);

    const { error: notifError } = await supabase
      .from('notificacoes')
      .insert({
        destinatario_id: user.id,
        mensagem: 'Seus dados foram exportados conforme solicitação (LGPD Art. 18).',
        lida: false,
      });

    if (notifError) {
      logger.error('privacy_download_notif_error', { error: notifError.message });
    }

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="meus-dados-reserva-quadra-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (e) {
    logger.error('privacy_download_error', { endpoint: '/api/privacy/download' });
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
