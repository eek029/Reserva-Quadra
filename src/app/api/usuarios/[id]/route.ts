import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';



const ADMIN_CARGOS = ['SysAdmin', 'Síndico Geral', 'Subsíndico'];

// GET /api/usuarios/[id]
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!url || !key) {
            return NextResponse.json({ error: 'Supabase URL or Key is missing no ambiente.' }, { status: 500 });
        }

        const supabase = createClient(url, key);

        // 1. Validate JWT
        const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
        if (!token) {
            return NextResponse.json({ error: 'Não autorizado. Token ausente.' }, { status: 401 });
        }

        const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !caller) {
            return NextResponse.json({ error: 'Não autorizado. Token inválido.' }, { status: 401 });
        }
        const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
        const { id } = params;

        if (!ENCRYPTION_KEY) {
            console.error('[api/usuarios/[id]] ENCRYPTION_KEY not set');
            return NextResponse.json({ error: 'Configuração do servidor incompleta.' }, { status: 500 });
        }

        // 2. Check caller has admin role before returning sensitive decrypted data
        const { data: callerProfile, error: profileError } = await supabase
            .from('usuarios')
            .select('cargo')
            .eq('id', caller.id)
            .single();

        if (profileError) {
            console.error('[api/usuarios/[id]] Profile fetch error:', profileError.message);
            return NextResponse.json({ error: 'Erro ao verificar permissões.' }, { status: 500 });
        }

        if (!callerProfile || !ADMIN_CARGOS.includes(callerProfile.cargo)) {
            return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem visualizar dados sensíveis.' }, { status: 403 });
        }

        // 3. Decrypt user data via RPC (NULL-safe after migration)
        const { data, error } = await supabase.rpc('get_usuario_decrypted', {
            target_id: id,
            secret_key: ENCRYPTION_KEY,
        });

        if (error) {
            console.error('[api/usuarios/[id]] RPC error:', JSON.stringify(error));
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
        }

        // Audit log (fire and forget)
        supabase.from('audit_logs').insert({
            perfil_id: caller.id,
            acao: 'visualizou_dados_sensiveis',
            detalhes: { alvo_usuario_id: id, campos: ['rg', 'cpf'] }
        }).then(() => { /* fire and forget */ });

        return NextResponse.json(data[0]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('[api/usuarios/[id]] Unhandled exception:', error);
        return NextResponse.json({ error: error?.message || 'Erro desconhecido' }, { status: 500 });
    }
}
