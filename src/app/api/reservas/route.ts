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

        // Se for Subsíndico, forçamos o inner join (!inner) para garantir a restrição na query principal
        const joinType = isSubsindico ? '!inner' : '';
        let query = supabase
            .from('reservas')
            .select(`*, usuarios${joinType}(nome, nome_completo, foto_url, torre, apartamento, cargo)`)
            // CRÍTICO: filtrar apenas reservas ativas — canceladas não devem aparecer no calendário
            .eq('status', 'ativa');

        if (data) {
            query = query.eq('data_reserva', data);
        }

        if (isSubsindico && perfilLogado.torre) {
            // Subsíndico: restringe visão à própria torre
            query = query.eq('usuarios.torre', perfilLogado.torre);
        } else if (isAdminGlobal) {
            // Síndico Geral / SysAdmin: acesso total, ordenado por hora
            query = query.order('hora_inicio', { ascending: true });
        }

        const { data: result, error } = await query;

        if (error) {
            return NextResponse.json({ detail: error.message }, { status: 500 });
        }

        return NextResponse.json(result ?? []);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('[api/reservas] Unhandled exception:', error);
        return NextResponse.json({ detail: error?.message || 'Erro desconhecido' }, { status: 500 });
    }
}

// POST /api/reservas — Cria reserva com validação de sobreposição
export async function POST(request: NextRequest) {
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return NextResponse.json({ error: 'Config incompleta.' }, { status: 500 });

        const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
        if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

        const supabase = createClient(url, key);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

        const body = await request.json();
        const { data_reserva, hora_inicio, hora_fim, aceite_termos, usuario_id } = body;

        if (!data_reserva || !hora_inicio || !hora_fim || !usuario_id) {
            return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
        }

        // Validar sobreposição: já existe reserva ativa para esse slot?
        const { data: existente } = await supabase
            .from('reservas')
            .select('id')
            .eq('data_reserva', data_reserva)
            .eq('hora_inicio', hora_inicio)
            .eq('status', 'ativa')
            .limit(1);

        if (existente && existente.length > 0) {
            return NextResponse.json({ error: 'Este horário já está reservado.' }, { status: 409 });
        }

        const { data: nova, error } = await supabase
            .from('reservas')
            .insert([{ data_reserva, hora_inicio, hora_fim, aceite_termos, usuario_id, status: 'ativa' }])
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json(nova, { status: 201 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Erro desconhecido' }, { status: 500 });
    }
}
