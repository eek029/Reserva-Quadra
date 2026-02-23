import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

// POST /api/usuarios?auth_id=xxx
export async function POST(request: NextRequest) {
    const supabase = getSupabase();
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

    const auth_id = request.nextUrl.searchParams.get('auth_id');
    if (!auth_id) {
        return NextResponse.json({ detail: 'auth_id é obrigatório.' }, { status: 400 });
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
        console.error('Erro ao criar usuário:', error);
        return NextResponse.json({ detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data, status: 'pendente' }, { status: 201 });
}
