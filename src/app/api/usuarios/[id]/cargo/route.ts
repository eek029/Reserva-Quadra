import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { createRateLimiter } from '@/lib/rate-limit';
import { validateRequestPayload } from '@/lib/api-validation';
import { validateUUID } from '@/lib/validators';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const sensitiveLimiter = createRateLimiter({ windowMs: 60_000, max: 30 }, 'usuario-cargo');

const CARGOS_VALIDOS = ['Morador', 'Porteiro', 'Subsíndico', 'Síndico Geral', 'SysAdmin'] as const;

function cargosPermitidos(callerCargo: string): string[] {
  switch (callerCargo) {
    case 'SysAdmin':
      return ['Morador', 'Porteiro', 'Subsíndico', 'Síndico Geral']
    case 'Síndico Geral':
      return ['Morador', 'Porteiro', 'Subsíndico']
    default:
      return []
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
    if (!callerProfile) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

    const permitidos = cargosPermitidos(callerProfile.cargo);
    if (permitidos.length === 0)
      return NextResponse.json({ error: 'Você não tem permissão para alterar cargos.' }, { status: 403 });

    const { data: target } = await supabase
      .from('usuarios').select('cargo').eq('id', id).maybeSingle();
    if (!target) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    if (target.cargo === 'SysAdmin')
      return NextResponse.json({ error: 'Não é possível alterar o cargo de um SysAdmin.' }, { status: 403 });
    if (target.cargo === 'Síndico Geral' && callerProfile.cargo !== 'SysAdmin')
      return NextResponse.json({ error: 'Apenas SysAdmin pode alterar o cargo da Síndica Geral.' }, { status: 403 });

    const { novoCargo } = await request.json();
    if (!novoCargo || !(CARGOS_VALIDOS as readonly string[]).includes(novoCargo))
      return NextResponse.json({ error: 'Cargo inválido.' }, { status: 400 });
    if (!permitidos.includes(novoCargo))
      return NextResponse.json({ error: 'Você não pode definir este cargo.' }, { status: 403 });

    const { error } = await supabase.from('usuarios').update({ cargo: novoCargo }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('audit_logs').insert({
      perfil_id: caller.id, acao: 'alterou_cargo',
      detalhes: { alvo_usuario_id: id, cargo_antigo: target.cargo, cargo_novo: novoCargo },
    });

    return NextResponse.json({ ok: true, cargo_antigo: target.cargo, cargo_novo: novoCargo });
  } catch (e) {
    logger.error('cargo_error', { endpoint: '/api/usuarios/[id]/cargo' });
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}
