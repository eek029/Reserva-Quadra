-- Reverte: delete policy via RLS (muito permissivo).
-- Deletion é feita via API route com service client.
DROP POLICY IF EXISTS "Usuarios deletam notificacoes" ON public.notificacoes;
