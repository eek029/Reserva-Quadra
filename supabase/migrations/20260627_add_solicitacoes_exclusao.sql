-- Migration: Add solicitacoes_exclusao table for LGPD data deletion requests
CREATE TABLE IF NOT EXISTS public.solicitacoes_exclusao (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    motivo text,
    status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    revisado_por uuid REFERENCES public.usuarios(id),
    revisado_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.solicitacoes_exclusao ENABLE ROW LEVEL SECURITY;

-- User can insert own request
CREATE POLICY "Usuario insere propria solicitacao" ON public.solicitacoes_exclusao
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = usuario_id);

-- User can read own requests
CREATE POLICY "Usuario le suas solicitacoes" ON public.solicitacoes_exclusao
    FOR SELECT
    USING (auth.uid() = usuario_id);

-- Admin can read all requests
CREATE POLICY "Admin le todas solicitacoes" ON public.solicitacoes_exclusao
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.cargo IN ('SysAdmin', 'Síndico Geral', 'Subsíndico')
    ));

-- Admin can update (approve/reject)
CREATE POLICY "Admin atualiza solicitacao" ON public.solicitacoes_exclusao
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.cargo IN ('SysAdmin', 'Síndico Geral', 'Subsíndico')
    ));
