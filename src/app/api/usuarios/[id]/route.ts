import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

// GET /api/usuarios/[id]
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = getSupabase();
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

    const requesterId = request.headers.get('requester-id');
    const { id } = params;

    const { data, error } = await supabase.rpc('get_usuario_decrypted', {
        target_id: id,
        secret_key: ENCRYPTION_KEY,
    });

    if (error || !data || data.length === 0) {
        return NextResponse.json({ detail: 'Usuário não encontrado' }, { status: 404 });
    }

    // Audit log (fire and forget)
    if (requesterId) {
        supabase.from('audit_logs').insert({
            perfil_id: requesterId,
            acao: 'visualizou_dados_sensiveis',
            detalhes: { alvo_usuario_id: id, campos: ['rg', 'cpf'] }
        }).then(() => { });
    }

    return NextResponse.json(data[0]);
}
