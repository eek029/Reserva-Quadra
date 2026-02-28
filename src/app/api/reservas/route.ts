import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// GET /api/reservas?data=YYYY-MM-DD
export async function GET(request: NextRequest) {
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
            return NextResponse.json({ detail: 'Não autorizado. Token ausente.' }, { status: 401 });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ detail: 'Não autorizado.' }, { status: 401 });
        }

        // Identifique o cargo do usuário logado através do perfil
        const { data: perfilLogado, error: perfilError } = await supabase
            .from('usuarios')
            .select('cargo, torre')
            .eq('id', user.id)
            .single();

        if (perfilError || !perfilLogado) {
            return NextResponse.json({ detail: 'Perfil não encontrado.' }, { status: 403 });
        }

        const data = request.nextUrl.searchParams.get('data');

        // Regras de acesso e filtros condicionais
        const isSubsindico = perfilLogado.cargo === 'Subsíndico';
        const isAdminGlobal = perfilLogado.cargo === 'Síndico Geral' || perfilLogado.cargo === 'SysAdmin';

        // Nested Select do Supabase trazendo informações do morador (nome, foto_url, torre, cargo)
        // Se for Subsíndico, forçamos o inner join (!inner) para garantir a restrição na query principal
        const joinType = isSubsindico ? '!inner' : '';
        let query = supabase
            .from('reservas')
            .select(`*, usuarios${joinType}(nome, nome_completo, foto_url, torre, cargo)`);

        if (data) {
            query = query.eq('data_reserva', data);
        }

        if (isSubsindico && perfilLogado.torre) {
            // Se for 'Subsíndico': Aplica filtro obrigatório para restringir visão à própria torre
            query = query.eq('usuarios.torre', perfilLogado.torre);
        } else if (isAdminGlobal) {
            // Se for 'Síndico Geral' ou 'SysAdmin': Acesso total sem filtro de torre, ordenado por data e hora
            query = query.order('data_reserva', { ascending: true }).order('hora_inicio', { ascending: true });
        }

        const { data: result, error } = await query;

        if (error) {
            return NextResponse.json({ detail: error.message }, { status: 500 });
        }

        return NextResponse.json(result);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('[api/reservas] Unhandled exception:', error);
        return NextResponse.json({ detail: error?.message || 'Erro desconhecido' }, { status: 500 });
    }
}
