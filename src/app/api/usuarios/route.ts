import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

/** Extract & validate JWT Bearer token — returns null if invalid/missing */
async function getAuthUser(request: NextRequest) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return null;
    const { data: { user }, error } = await createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ).auth.getUser(token);
    return error ? null : user;
}

// POST /api/usuarios?auth_id=xxx
export async function POST(request: NextRequest) {
    const supabase = getSupabase();
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

    const auth_id = request.nextUrl.searchParams.get('auth_id');
    if (!auth_id) {
        return NextResponse.json({ detail: 'auth_id é obrigatório.' }, { status: 400 });
    }

    // Validate that the caller's JWT matches the auth_id — prevents profile hijacking
    const user = await getAuthUser(request);
    if (!user || user.id !== auth_id) {
        return NextResponse.json({ detail: 'Não autorizado.' }, { status: 401 });
    }

    const body = await request.json();

    const { data, error } = await supabase.rpc('create_usuario_encrypted', {
        p_id: auth_id,
        p_nome_completo: body.nome_completo,
        p_data_nascimento: body.data_nascimento,
        p_telefone: body.telefone,
        p_apartamento: body.apartamento || '',
        p_torre: body.torre || '',
        p_bloco: body.bloco || '',
        p_foto_url: body.foto_url || '',
        p_cargo: body.cargo || 'Morador',
        p_rg: body.rg || 'Não informado',
        p_cpf: body.cpf,
        p_secret_key: ENCRYPTION_KEY,
    });

    if (error) {
        console.error('[api/usuarios] Erro ao upsert usuário:', error);
        return NextResponse.json({ detail: error.message }, { status: 500 });
    }

    // 200 OK — RPC is an upsert; works for both first-time registration
    // and retries (e.g. if trigger pre-created a partial row).
    return NextResponse.json({ id: data, status: 'ok' }, { status: 200 });
}
