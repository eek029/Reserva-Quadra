import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
    const { data, error } = await supabase
        .from('usuarios')
        .select('nome, nome_completo, foto_url')
        .eq('status', 'pendente');
    return NextResponse.json({ data, error });
}
