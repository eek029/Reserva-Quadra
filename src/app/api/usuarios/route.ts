import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

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

/** Converts empty strings and whitespace-only strings to null */
function nullifyEmpty(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}

/**
 * Uploads a base64 data URI image to Supabase Storage and returns the public URL.
 * Returns the original value if it's already a plain URL (not base64).
 */
async function uploadAvatarToStorage(
    supabase: AnySupabaseClient,
    userId: string,
    dataUri: string
): Promise<string | null> {
    if (!dataUri.startsWith('data:')) return dataUri;

    try {
        const [meta, base64Data] = dataUri.split(',');
        if (!base64Data) return null;

        const mimeMatch = meta.match(/data:([^;]+);/);
        const mimeType = mimeMatch?.[1] ?? 'image/jpeg';
        const ext = mimeType.split('/')[1]?.split('+')[0] ?? 'jpg';

        const buffer = Buffer.from(base64Data, 'base64');
        const filePath = `avatars/${userId}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, buffer, { contentType: mimeType, upsert: true });

        if (uploadError) {
            console.error('[api/usuarios] Storage upload error:', uploadError.message);
            return null;
        }

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        return urlData?.publicUrl ?? null;
    } catch (e) {
        console.error('[api/usuarios] Failed to process avatar:', e);
        return null;
    }
}


// POST /api/usuarios?auth_id=xxx
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase();
        const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

        if (!ENCRYPTION_KEY) {
            console.error('[api/usuarios] ENCRYPTION_KEY env var not set');
            return NextResponse.json({ detail: 'Configuração do servidor incompleta.' }, { status: 500 });
        }

        const auth_id = request.nextUrl.searchParams.get('auth_id');
        if (!auth_id) {
            return NextResponse.json({ detail: 'auth_id é obrigatório.' }, { status: 400 });
        }

        // Validate that the caller's JWT matches the auth_id — prevents profile hijacking
        const user = await getAuthUser(request);
        if (!user || user.id !== auth_id) {
            return NextResponse.json({ detail: 'Não autorizado.' }, { status: 401 });
        }

        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ detail: 'Corpo da requisição inválido.' }, { status: 400 });
        }

        // ── Sanitize: convert empty strings to null ──────────────────────────
        const rawFotoUrl = typeof body.foto_url === 'string' ? body.foto_url : null;
        const rawApartamento = nullifyEmpty(body.apartamento);
        const rawTorre = nullifyEmpty(body.torre);
        const rawBloco = nullifyEmpty(body.bloco);
        const rawRg = nullifyEmpty(body.rg) ?? 'Não informado';

        // ── Avatar: upload base64 to Storage; never store base64 in DB ───────
        const fotoUrl = rawFotoUrl
            ? await uploadAvatarToStorage(supabase, auth_id, rawFotoUrl)
            : null;

        // ── Call upsert RPC ───────────────────────────────────────────────────
        const { data, error } = await supabase.rpc('create_usuario_encrypted', {
            p_id: auth_id,
            p_nome_completo: body.nome_completo as string,
            p_data_nascimento: body.data_nascimento as string,
            p_telefone: body.telefone as string,
            p_apartamento: rawApartamento,
            p_torre: rawTorre,
            p_bloco: rawBloco,
            p_foto_url: fotoUrl,
            p_cargo: (body.cargo as string) || 'Morador',
            p_rg: rawRg,
            p_cpf: body.cpf as string,
            p_secret_key: ENCRYPTION_KEY,
        });

        if (error) {
            console.error('[api/usuarios] RPC error:', JSON.stringify(error));
            return NextResponse.json({ detail: error.message }, { status: 500 });
        }

        return NextResponse.json({ id: data, status: 'ok' }, { status: 200 });

    } catch (err: unknown) {
        // Global safety net — guarantees we ALWAYS return a JSON response
        const message = err instanceof Error ? err.message : 'Erro interno desconhecido.';
        console.error('[api/usuarios] Unhandled exception:', message);
        return NextResponse.json({ detail: message }, { status: 500 });
    }
}
