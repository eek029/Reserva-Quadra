import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { createRateLimiter } from '@/lib/rate-limit';
import { validateRequestPayload } from '@/lib/api-validation';
import { validateCsrfToken } from '@/lib/csrf';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const limiter = createRateLimiter({ windowMs: 60_000, max: 10 }, 'privacy-rejeitar');

function getToken(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { data: admin } = await supabase
      .from('usuarios')
      .select('cargo')
      .eq('id', user.id)
      .maybeSingle();

    if (!admin || !['SysAdmin', 'Síndico Geral', 'Subsíndico'].includes(admin.cargo)) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const { id } = await params;

    const body = await request.json();
    const motivo_rejeicao = typeof body?.motivo === 'string'
      ? body.motivo.trim().slice(0, 500)
      : 'Solicitação rejeitada pela administração.';

    const { data: solicitacao, error: fetchError } = await supabase
      .from('solicitacoes_exclusao')
      .select('*')
      .eq('id', id)
      .eq('status', 'pendente')
      .maybeSingle();

    if (fetchError || !solicitacao) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada ou já processada.' },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabase
      .from('solicitacoes_exclusao')
      .update({
        status: 'rejeitado',
        revisado_por: user.id,
        revisado_em: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      logger.error('privacy_rejeitar_update_error', { error: updateError.message });
      return NextResponse.json({ error: 'Erro ao rejeitar solicitação.' }, { status: 500 });
    }

    await supabase
      .from('audit_logs')
      .insert({
        perfil_id: user.id,
        acao: 'rejeitou_exclusao',
        detalhes: { solicitacao_id: id, usuario_id: solicitacao.usuario_id, motivo: motivo_rejeicao },
      });

    await supabase
      .from('notificacoes')
      .insert({
        destinatario_id: solicitacao.usuario_id,
        mensagem: `Sua solicitação de exclusão foi rejeitada. Motivo: ${motivo_rejeicao}`,
        lida: false,
      });

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error('privacy_rejeitar_error', { endpoint: '/api/privacy/[id]/rejeitar' });
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
