import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { getUsuarioDecrypted, atualizarUsuario, AppError } from '@/lib/services/usuario';
import { createRateLimiter } from '@/lib/rate-limit';
import { validateRequestPayload } from '@/lib/api-validation';
import { validateUUID } from '@/lib/validators';
import { validateCsrfToken } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const sensitiveLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
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
      .from('usuarios').select('cargo').eq('id', caller.id).maybeSingle();

    if (!callerProfile || !ADMIN_CARGOS.includes(callerProfile.cargo))
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

    const data = await getUsuarioDecrypted(supabase, id);

    const { error: auditError } = await supabase.from('audit_logs').insert({
      perfil_id: caller.id, acao: 'visualizou_dados_sensiveis',
      detalhes: { alvo_usuario_id: id, campos: ['rg', 'cpf'] },
    });

    if (auditError) {
      console.error('[audit] Falha ao registrar acesso a dados sensíveis:', auditError);
    }

    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[api/usuarios/[id]]', e);
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
      .from('usuarios').select('cargo').eq('id', caller.id).maybeSingle();

    if (!callerProfile || !ADMIN_CARGOS.includes(callerProfile.cargo))
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

    const body = await request.json();
    await atualizarUsuario(supabase, id, caller.id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[api/usuarios/[id]]', e);
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}
