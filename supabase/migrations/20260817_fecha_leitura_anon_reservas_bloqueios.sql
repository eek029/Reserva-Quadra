-- Anon não lê agenda nem bloqueios. Quem está logado continua vendo
-- (MinhasReservas e auditoria usam o client autenticado).

DROP POLICY IF EXISTS "select_reservas" ON public.reservas;

CREATE POLICY "select_reservas"
ON public.reservas
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Todos podem ver bloqueios" ON public.bloqueios;

CREATE POLICY "Autenticados podem ver bloqueios"
ON public.bloqueios
FOR SELECT
TO authenticated
USING (true);

REVOKE ALL ON TABLE public.reservas FROM anon;
REVOKE ALL ON TABLE public.bloqueios FROM anon;
