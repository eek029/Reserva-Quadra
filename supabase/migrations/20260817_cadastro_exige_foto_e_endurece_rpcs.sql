-- Cadastro exige foto + endurece RPCs de PII e auto-aprovação.
-- Não usa NOT NULL em foto_url: handle_new_user cria stub sem foto (pendente).
-- SysAdmin existente continua aprovado sem foto.

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

    SELECT decrypted_secret INTO v_secret_key
    FROM vault.decrypted_secrets
    WHERE name = 'encryption_key';

    INSERT INTO public.usuarios (
        id, nome_completo, data_nascimento, telefone, apartamento, torre, bloco,
        foto_url, cargo, rg_encrypted, cpf_encrypted, status
    )
    VALUES (
        p_id, p_nome_completo, p_data_nascimento, p_telefone,
        NULLIF(p_apartamento, ''), NULLIF(p_torre, ''), NULLIF(p_bloco, ''),
        v_foto, COALESCE(NULLIF(p_cargo, ''), 'Morador'),
        pgp_sym_encrypt(COALESCE(p_rg, 'Nao informado'), v_secret_key),
        pgp_sym_encrypt(p_cpf, v_secret_key),
        'pendente'
    )
    ON CONFLICT (id) DO UPDATE SET
        nome_completo = EXCLUDED.nome_completo,
        data_nascimento = EXCLUDED.data_nascimento,
        telefone = EXCLUDED.telefone,
        apartamento = NULLIF(EXCLUDED.apartamento, ''),
        torre = NULLIF(EXCLUDED.torre, ''),
        bloco = NULLIF(EXCLUDED.bloco, ''),
        foto_url = COALESCE(NULLIF(EXCLUDED.foto_url, ''), usuarios.foto_url),
        cargo = EXCLUDED.cargo,
        rg_encrypted = EXCLUDED.rg_encrypted,
        cpf_encrypted = EXCLUDED.cpf_encrypted;

    RETURN p_id;
END;
$$;

ALTER TABLE public.usuarios
    DROP CONSTRAINT IF EXISTS usuarios_aprovado_exige_foto;

ALTER TABLE public.usuarios
    ADD CONSTRAINT usuarios_aprovado_exige_foto
    CHECK (
        status IS DISTINCT FROM 'aprovado'
        OR cargo = 'SysAdmin'
        OR (foto_url IS NOT NULL AND length(btrim(foto_url)) > 0)
    );

DROP POLICY IF EXISTS "Usuario atualiza campos seguros do proprio perfil" ON public.usuarios;

CREATE POLICY "Usuario atualiza campos seguros do proprio perfil"
ON public.usuarios
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id
    AND cargo IS NOT DISTINCT FROM (SELECT u.cargo FROM public.usuarios u WHERE u.id = auth.uid())
    AND status IS NOT DISTINCT FROM (SELECT u.status FROM public.usuarios u WHERE u.id = auth.uid())
    AND foto_url IS NOT DISTINCT FROM (SELECT u.foto_url FROM public.usuarios u WHERE u.id = auth.uid())
    AND cpf_encrypted IS NOT DISTINCT FROM (SELECT u.cpf_encrypted FROM public.usuarios u WHERE u.id = auth.uid())
    AND rg_encrypted IS NOT DISTINCT FROM (SELECT u.rg_encrypted FROM public.usuarios u WHERE u.id = auth.uid())
);

REVOKE ALL ON FUNCTION public.create_usuario_encrypted(uuid, text, date, text, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_usuario_encrypted(uuid, text, date, text, text, text, text, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_usuario_encrypted(uuid, text, date, text, text, text, text, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_usuario_decrypted(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_usuario_decrypted(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_usuario_decrypted(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.update_usuario_encrypted_fields(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_usuario_encrypted_fields(uuid, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_usuario_encrypted_fields(uuid, text, text, text, text) TO service_role;
