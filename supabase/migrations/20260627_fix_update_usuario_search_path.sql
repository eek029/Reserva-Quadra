-- A função update_usuario_encrypted_fields foi criada com search_path='public'
-- mas pgp_sym_encrypt está no schema 'extensions' (instalado pelo pgcrypto).
-- Isso causava: function pgp_sym_encrypt(text, text) does not exist

ALTER FUNCTION public.update_usuario_encrypted_fields SET search_path TO public, extensions;
