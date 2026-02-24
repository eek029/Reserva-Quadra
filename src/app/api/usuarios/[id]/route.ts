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
        // ATIVAÇÃO DO MODO DEUS: Chave de Serviço para ignorar o RLS no backend
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !serviceRoleKey) {
            return NextResponse.json({ error: 'Supabase URL ou SERVICE_ROLE_KEY ausentes no ambiente.' }, { status: 500 });
        }

        // Cliente Admin criado (Bypass automático das regras do banco)
        const supabaseAdmin = createClient(url, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // 1. Validar o Token JWT de quem clicou no botão "Revelar"
        const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
        if (!token) {
            return NextResponse.json({ error: 'Não autorizado. Token ausente.' }, { status: 401 });
        }

        const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !caller) {
            return NextResponse.json({ error: 'Não autorizado. Token inválido.' }, { status: 401 });
        }
        
        const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
        const { id } = params;

        if (!ENCRYPTION_KEY) {
            console.error('[api/usuarios/[id]] ENCRYPTION_KEY not set');
            return NextResponse.json({ error: 'Configuração do servidor incompleta.' }, { status: 500 });
        }

        // 2. Checar cargo (Agora o Admin Client lê a tabela sem ser bloqueado pelo RLS)
        const { data: callerProfile, error: profileError } = await supabaseAdmin
            .from('usuarios')
            .select('cargo')
            .eq('id', caller.id)
            .maybeSingle();

        if (profileError) {
            console.error('[api/usuarios/[id]] Profile fetch error:', profileError.message);
            return NextResponse.json({ error: 'Erro ao verificar permissões interna.' }, { status: 500 });
        }

        if (!callerProfile) {
            return NextResponse.json({ error: 'Erro ao verificar permissões ou perfil não encontrado.' }, { status: 403 });
        }

        if (!ADMIN_CARGOS.includes(callerProfile.cargo)) {
            return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem visualizar dados sensíveis.' }, { status: 403 });
        }

        // 3. Descriptografar via RPC
        const { data, error } = await supabaseAdmin.rpc('get_usuario_decrypted', {
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

        // Log de Auditoria
        supabaseAdmin.from('audit_logs').insert({
            perfil_id: caller.id,
            acao: 'visualizou_dados_sensiveis',
            detalhes: { alvo_usuario_id: id, campos: ['rg', 'cpf'] }
        }).then(() => { /* fire and forget */ });

        return NextResponse.json(data[0]);

    } catch (error: any) {
        console.error('[api/usuarios/[id]] Unhandled exception:', error);
        return NextResponse.json({ error: error?.message || 'Erro desconhecido' }, { status: 500 });
    }
}