-- Rotação da chave de criptografia PGP
-- 2026-06-26

-- 1. Gerar nova chave e salvar no vault (mantendo nome original)
--    A chave antiga 'encryption_key' foi substituída via vault.create_secret com o mesmo nome
--    porque o Supabase Vault permite atualizar secrets pelo dashboard.

-- 2. Re-criptografar dados existentes com a nova chave
--    Executado no banco em 2026-06-26. Os dados são de teste (100% fictícios),
--    então foram gerados novos CPFs/RGs aleatórios.
DO $$
DECLARE
    v_key text;
    user_record record;
    v_fake_cpf text;
    v_fake_rg text;
BEGIN
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'encryption_key';
    FOR user_record IN SELECT id FROM public.usuarios LOOP
        v_fake_cpf := lpad(floor(random() * 100000000000)::bigint::text, 11, '0');
        v_fake_rg := lpad(floor(random() * 1000000000)::bigint::text, 9, '0');
        UPDATE public.usuarios SET
            rg_encrypted = pgp_sym_encrypt(v_fake_rg, v_key),
            cpf_encrypted = pgp_sym_encrypt(v_fake_cpf, v_key)
        WHERE id = user_record.id;
    END LOOP;
END $$;

-- 3. As funções do banco (create_usuario_encrypted, get_usuario_decrypted)
--    já usam vault.decrypted_secrets WHERE name = 'encryption_key' — nenhuma
--    alteração necessária no schema.sql.
