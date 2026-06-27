import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { createRateLimiter } from '@/lib/rate-limit';
import { validateRequestPayload } from '@/lib/api-validation';
import { validateCsrfToken } from '@/lib/csrf';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const limiter = createRateLimiter({ windowMs: 60_000, max: 3 }, 'privacy-excluir');

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

    const body = await request.json();
    const motivo = typeof body?.motivo === 'string'
      ? body.motivo.trim().slice(0, 500)
      : null;

    const { data: existing } = await supabase
      .from('solicitacoes_exclusao')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('status', 'pendente')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Você já possui uma solicitação de exclusão pendente.' },
        { status: 409 }
      );
    }

    const { error: insertError } = await supabase
      .from('solicitacoes_exclusao')
      .insert({
        usuario_id: user.id,
        motivo,
        status: 'pendente',
      });

    if (insertError) {
      logger.error('privacy_excluir_insert_error', { error: insertError.message });
      return NextResponse.json({ error: 'Erro ao registrar solicitação.' }, { status: 500 });
    }

    await supabase
      .from('notificacoes')
      .insert({
        destinatario_id: user.id,
        mensagem: 'Sua solicitação de exclusão de dados foi recebida. A administração analisará seu pedido em até 48h.',
        lida: false,
      });

    const { data: admins } = await supabase
      .from('usuarios')
      .select('id')
      .in('cargo', ['SysAdmin', 'Síndico Geral', 'Subsíndico']);

    if (admins && admins.length > 0) {
      const notificacoes = admins.map(a => ({
        destinatario_id: a.id,
        mensagem: `Nova solicitação de exclusão de dados recebida. Acesse o painel de administração para revisar.`,
        lida: false,
      }));

      await supabase.from('notificacoes').insert(notificacoes);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error('privacy_excluir_error', { endpoint: '/api/privacy/excluir' });
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
