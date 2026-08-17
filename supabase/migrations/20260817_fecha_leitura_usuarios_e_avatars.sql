-- Fecha leitura aberta de usuarios e o bucket publico de avatars.
-- SELECT de outros moradores fica só na API (service_role).
-- Foto oficial continua via URL assinada gerada no servidor.

DROP POLICY IF EXISTS "select_usuarios" ON public.usuarios;

CREATE POLICY "select_usuarios"
ON public.usuarios
FOR SELECT
TO authenticated
USING (auth.uid() = id);

REVOKE SELECT ON public.usuarios FROM anon;

UPDATE storage.buckets
SET
    public = false,
    file_size_limit = 1048576,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'avatars';

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;

DROP POLICY IF EXISTS "Users read own avatar" ON storage.objects;

CREATE POLICY "Users read own avatar"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (
        name LIKE '%' || auth.uid()::text || '%'
        OR (storage.foldername(name))[1] = auth.uid()::text
    )
);
