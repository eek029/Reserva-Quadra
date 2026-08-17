import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { getUsuarioDecrypted, atualizarUsuario, excluirUsuario, AppError } from '@/lib/services/usuario';
import { createRateLimiter } from '@/lib/rate-limit';
import { validateRequestPayload } from '@/lib/api-validation';
import { validateUUID } from '@/lib/validators';
import { validateCsrfToken } from '@/lib/csrf';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const sensitiveLimiter = createRateLimiter({ windowMs: 60_000, max: 30 }, 'usuario-id');
const ADMIN_CARGOS = ['SysAdmin', 'Síndico Geral', 'Subsíndico'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rl = sensitiveLimiter.check(request);
    if (rl) return rl;
    const { id } = await params;
    
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return NextResponse.json({ error: uuidValidation.error }, { status: 400 });
    }
    
    const supabase = getServiceClient();
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { data: callerProfile } = await supabase
      .from('usuarios').select('cargo, torre').eq('id', caller.id).maybeSingle();

    if (!callerProfile || !ADMIN_CARGOS.includes(callerProfile.cargo))
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

    // Fetch target user's torre for authorization validation
    const { data: targetUser } = await supabase
      .from('usuarios').select('torre').eq('id', id).maybeSingle();

    if (!targetUser)
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

    // Subsíndicos can only access users in their own tower
    if (callerProfile.cargo === 'Subsíndico' && callerProfile.torre !== targetUser.torre)
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

    const data = await getUsuarioDecrypted(supabase, id);

    const { error: auditError } = await supabase.from('audit_logs').insert({
      perfil_id: caller.id, acao: 'visualizou_dados_sensiveis',
      detalhes: { alvo_usuario_id: id, campos: ['rg', 'cpf'] },
    });

    if (auditError) {
      logger.error('audit_log_failed', {
        endpoint: '/api/usuarios/[id]',
        userId: caller.id,
        targetUserId: id,
        auditError: auditError.message,
      });
    }

    return NextResponse.json(data);
   } catch (e) {
     if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
     logger.error('usuario_get_error', { endpoint: '/api/usuarios/[id]' });
     return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
   }
 }

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
    
    const supabase = getServiceClient();
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

    const { data: callerProfile } = await supabase
      .from('usuarios').select('cargo, torre').eq('id', caller.id).maybeSingle();

    if (!callerProfile || !ADMIN_CARGOS.includes(callerProfile.cargo))
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

    // Fetch target user's torre for authorization validation
    const { data: targetUser } = await supabase
      .from('usuarios').select('torre').eq('id', id).maybeSingle();

    if (!targetUser)
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

    // Subsíndicos can only access users in their own tower
    if (callerProfile.cargo === 'Subsíndico' && callerProfile.torre !== targetUser.torre)
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

      const body = await request.json();
      await atualizarUsuario(supabase, id, caller.id, body);
     return NextResponse.json({ ok: true });
   } catch (e) {
     if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
     logger.error('usuario_update_error', { endpoint: '/api/usuarios/[id]' });
     return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
   }
 }

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rl = sensitiveLimiter.check(request);
    if (rl) return rl;
    if (!validateCsrfToken(request)) {
      return NextResponse.json({ error: 'CSRF token inválido.' }, { status: 403 });
    }

    const { id } = await params;
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return NextResponse.json({ error: uuidValidation.error }, { status: 400 });
    }

    const supabase = getServiceClient();
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

    const { data: callerProfile } = await supabase
      .from('usuarios').select('cargo, torre').eq('id', caller.id).maybeSingle();

    if (!callerProfile || !ADMIN_CARGOS.includes(callerProfile.cargo))
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

    await excluirUsuario(supabase, id, caller.id, callerProfile.cargo, callerProfile.torre);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    logger.error('usuario_delete_error', { endpoint: '/api/usuarios/[id]' });
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}
