import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!
    );
}

/** Extract & validate JWT Bearer token — returns null if invalid/missing */
async function getAuthUser(request: NextRequest) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return null;
    const { data: { user }, error } = await createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!
    ).auth.getUser(token);
    return error ? null : user;
}

const ADMIN_CARGOS = ['SysAdmin', 'Síndico Geral', 'Subsíndico'];

// GET /api/usuarios/[id]
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    // 1. Validate JWT
    const caller = await getAuthUser(request);
    if (!caller) {
        return NextResponse.json({ detail: 'Não autorizado.' }, { status: 401 });
    }

    const supabase = getSupabase();
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
    const { id } = params;

    // 2. Check caller has admin role before returning sensitive decrypted data (CPF/RG)
    const { data: callerProfile } = await supabase
        .from('usuarios')
        .select('cargo')
        .eq('id', caller.id)
        .single();

    if (!callerProfile || !ADMIN_CARGOS.includes(callerProfile.cargo)) {
        return NextResponse.json({ detail: 'Acesso negado. Apenas administradores podem visualizar dados sensíveis.' }, { status: 403 });
    }

    const { data, error } = await supabase.rpc('get_usuario_decrypted', {
        target_id: id,
        secret_key: ENCRYPTION_KEY,
    });

    if (error || !data || data.length === 0) {
        return NextResponse.json({ detail: 'Usuário não encontrado' }, { status: 404 });
    }

    // Audit log (fire and forget)
    supabase.from('audit_logs').insert({
        perfil_id: caller.id,
        acao: 'visualizou_dados_sensiveis',
        detalhes: { alvo_usuario_id: id, campos: ['rg', 'cpf'] }
    }).then(() => { });

    return NextResponse.json(data[0]);
}
