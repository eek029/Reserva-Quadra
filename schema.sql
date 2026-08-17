-- Regenerado em 13/06/2026 do banco real (19 migrations)
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabelas
CREATE TABLE IF NOT EXISTS public.usuarios (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome_completo text,
    rg_encrypted bytea,
    cpf_encrypted bytea,
    data_nascimento date,
    telefone text,
    apartamento text,
    torre text,
    bloco text,
    foto_url text,
    cargo text NOT NULL DEFAULT 'Morador'::text,
    status text NOT NULL DEFAULT 'pendente'::text,
    CONSTRAINT usuarios_aprovado_exige_foto CHECK (
        status IS DISTINCT FROM 'aprovado'
        OR cargo = 'SysAdmin'
        OR (foto_url IS NOT NULL AND length(btrim(foto_url)) > 0)
    )
);

CREATE TABLE IF NOT EXISTS public.reservas (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    data_reserva date NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fim time without time zone NOT NULL,
    aceite_termos boolean NOT NULL DEFAULT true,
    versao_termos text,
    timestamp_aceite timestamp with time zone DEFAULT now(),
    status text NOT NULL DEFAULT 'ativa'::text,
    status_chave text DEFAULT 'aguardando'::text CHECK (status_chave IN ('aguardando', 'em_uso', 'concluida')),
    retirada_em timestamp with time zone,
    entregue_por uuid REFERENCES public.usuarios(id),
    devolvida_em timestamp with time zone,
    recebida_por uuid REFERENCES public.usuarios(id),
    cancelado_por uuid REFERENCES public.usuarios(id),
    ocorrencia_texto text,
    turno_registro text CHECK (turno_registro IN ('Turno Dia', 'Turno Noite')),
    observacao text,
    presencial_nome text,
    presencial_torre text,
    presencial_apt text,
    presencial_bloco text,
    presencial_documento text
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    perfil_id uuid NOT NULL,
    acao text NOT NULL,
    detalhes jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notificacoes (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    mensagem text NOT NULL,
    destinatario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
    lida boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.solicitacoes_perfil (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    novo_nome text,
    novo_cpf text,
    nova_foto_url text,
    status text NOT NULL DEFAULT 'pendente'::text CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    revisado_por uuid REFERENCES public.usuarios(id),
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blackout_periods (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    reason text NOT NULL,
    created_by uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.terms_versions (
    version text NOT NULL PRIMARY KEY,
    content_md text NOT NULL,
    active boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.terms_acceptance_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    terms_version text NOT NULL REFERENCES public.terms_versions(version),
    accepted_at timestamp with time zone NOT NULL DEFAULT now(),
    payload_json jsonb NOT NULL
);

-- RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blackout_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_acceptance_logs ENABLE ROW LEVEL SECURITY;

-- Helpers (SECURITY DEFINER) para evitar recursao em policies
CREATE OR REPLACE FUNCTION public.get_current_user_torre()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT torre FROM public.usuarios WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_cargo()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT cargo FROM public.usuarios WHERE id = auth.uid();
$$;

-- RLS Policies: usuarios
CREATE POLICY "select_usuarios" ON public.usuarios
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Usuario atualiza campos seguros do proprio perfil" ON public.usuarios
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin pode atualizar qualquer perfil" ON public.usuarios
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.usuarios admin
        WHERE admin.id = auth.uid() AND admin.cargo IN ('SysAdmin', 'Síndico Geral', 'Subsíndico')
    ));

-- RLS Policies: reservas
CREATE POLICY "select_reservas" ON public.reservas
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Autenticados podem ver bloqueios" ON public.bloqueios
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Permitir insercao de reservas" ON public.reservas
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuario atualiza/cancela sua reserva" ON public.reservas
    FOR UPDATE
    USING (auth.uid() = usuario_id);

CREATE POLICY "Porteiro e Admins gerenciam reservas (chaves)" ON public.reservas
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.usuarios admin
        WHERE admin.id = auth.uid() AND admin.cargo IN ('SysAdmin', 'Síndico Geral', 'Subsíndico', 'Porteiro')
    ));

CREATE POLICY "Porteiros e Sindicos gerenciam todas" ON public.reservas
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = auth.uid() AND u.cargo IN ('Síndico Geral', 'Subsíndico', 'Porteiro')
    ));

-- RLS Policies: audit_logs
CREATE POLICY "Somente Sindico Geral pode ver audit_logs" ON public.audit_logs
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = auth.uid() AND u.cargo = 'Síndico Geral'
    ));

-- RLS Policies: notificacoes
CREATE POLICY "Usuarios leem notificacoes" ON public.notificacoes
    FOR SELECT
    USING (auth.uid() IS NOT NULL AND (destinatario_id IS NULL OR destinatario_id = auth.uid()));

CREATE POLICY "Usuarios marcam como lido" ON public.notificacoes
    FOR UPDATE
    USING (destinatario_id = auth.uid() OR destinatario_id IS NULL);

CREATE POLICY "Admin cria notificacoes" ON public.notificacoes
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.usuarios admin
        WHERE admin.id = auth.uid() AND admin.cargo IN ('SysAdmin', 'Síndico Geral', 'Subsíndico')
    ));

-- RLS Policies: solicitacoes_perfil
CREATE POLICY "Usuario insere propria solicitacao" ON public.solicitacoes_perfil
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuario le sua solicitacao" ON public.solicitacoes_perfil
    FOR SELECT
    USING (auth.uid() = usuario_id);

CREATE POLICY "Admin le todas solicitacoes" ON public.solicitacoes_perfil
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.cargo IN ('SysAdmin', 'Síndico Geral', 'Subsíndico')
    ));

CREATE POLICY "Admin atualiza solicitacao" ON public.solicitacoes_perfil
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.cargo IN ('SysAdmin', 'Síndico Geral', 'Subsíndico')
    ));

-- RLS Policies: blackout_periods
CREATE POLICY "Anyone can view blackout periods" ON public.blackout_periods
    FOR SELECT
    USING (true);

-- RLS Policies: terms_versions
CREATE POLICY "Anyone can view terms" ON public.terms_versions
    FOR SELECT
    USING (true);

-- RLS Policies: terms_acceptance_logs
CREATE POLICY "Users can view own acceptance logs" ON public.terms_acceptance_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO public.usuarios (id, nome_completo, foto_url, cargo, status)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL),
        'Morador',
        'pendente'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_usuario_encrypted(
    p_id uuid, p_nome_completo text, p_data_nascimento date,
    p_telefone text, p_apartamento text, p_torre text, p_bloco text,
    p_foto_url text, p_cargo text, p_rg text, p_cpf text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_secret_key text;
    v_foto text;
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_id THEN
        RAISE EXCEPTION 'Não autorizado' USING ERRCODE = '42501';
    END IF;

    v_foto := NULLIF(btrim(COALESCE(p_foto_url, '')), '');
    IF v_foto IS NULL THEN
        RAISE EXCEPTION 'A foto de perfil é obrigatória para finalizar o cadastro'
            USING ERRCODE = '23502';
    END IF;

    SELECT decrypted_secret INTO v_secret_key FROM vault.decrypted_secrets WHERE name = 'encryption_key';
    INSERT INTO public.usuarios (id, nome_completo, data_nascimento, telefone, apartamento, torre, bloco, foto_url, cargo, rg_encrypted, cpf_encrypted, status)
    VALUES (p_id, p_nome_completo, p_data_nascimento, p_telefone, NULLIF(p_apartamento, ''), NULLIF(p_torre, ''), NULLIF(p_bloco, ''), v_foto, COALESCE(NULLIF(p_cargo, ''), 'Morador'), pgp_sym_encrypt(COALESCE(p_rg, 'Nao informado'), v_secret_key), pgp_sym_encrypt(p_cpf, v_secret_key), 'pendente')
    ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo, data_nascimento = EXCLUDED.data_nascimento, telefone = EXCLUDED.telefone, apartamento = NULLIF(EXCLUDED.apartamento, ''), torre = NULLIF(EXCLUDED.torre, ''), bloco = NULLIF(EXCLUDED.bloco, ''), foto_url = COALESCE(NULLIF(EXCLUDED.foto_url, ''), usuarios.foto_url), cargo = EXCLUDED.cargo, rg_encrypted = EXCLUDED.rg_encrypted, cpf_encrypted = EXCLUDED.cpf_encrypted;
    RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_usuario_decrypted(target_id uuid)
RETURNS TABLE (id uuid, nome_completo text, data_nascimento date, telefone text, apartamento text, torre text, bloco text, foto_url text, cargo text, rg text, cpf text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_secret_key text;
BEGIN
    SELECT decrypted_secret INTO v_secret_key FROM vault.decrypted_secrets WHERE name = 'encryption_key';
    RETURN QUERY SELECT u.id, u.nome_completo, u.data_nascimento, u.telefone, u.apartamento, u.torre, u.bloco, u.foto_url, u.cargo, CASE WHEN u.rg_encrypted IS NULL THEN null ELSE pgp_sym_decrypt(u.rg_encrypted::bytea, v_secret_key) END, CASE WHEN u.cpf_encrypted IS NULL THEN null ELSE pgp_sym_decrypt(u.cpf_encrypted::bytea, v_secret_key) END, u.status FROM public.usuarios u WHERE u.id = target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_decrypt(data bytea, key text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE result text;
BEGIN
    IF data IS NULL THEN RETURN NULL; END IF;
    BEGIN result := pgp_sym_decrypt(data, key); RETURN result;
    EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
END;
$$;

-- Trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
