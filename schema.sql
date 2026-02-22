-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create tables
CREATE TABLE public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome_completo TEXT NOT NULL,
    rg_encrypted BYTEA NOT NULL,
    cpf_encrypted BYTEA NOT NULL,
    data_nascimento DATE NOT NULL,
    telefone TEXT NOT NULL,
    apartamento TEXT,
    torre TEXT,
    bloco TEXT,
    foto_url TEXT,
    cargo TEXT NOT NULL DEFAULT 'Morador',
    status TEXT NOT NULL DEFAULT 'pendente'
);

CREATE TABLE public.reservas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    data_reserva DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    aceite_termos BOOLEAN NOT NULL DEFAULT true,
    versao_termos TEXT,
    timestamp_aceite TIMESTAMPTZ DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'ativa'
);

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id UUID NOT NULL,
    acao TEXT NOT NULL,
    detalhes JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Policies for usuarios
CREATE POLICY "Moradores podem ver seu próprio perfil" ON public.usuarios
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Síndico Geral, Subsíndico e SysAdmin podem ver todos" ON public.usuarios
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = auth.uid() AND u.cargo IN ('Síndico Geral', 'Subsíndico', 'SysAdmin')
        )
    );

CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.usuarios
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "SysAdmin pode atualizar e gerenciar qualquer perfil" ON public.usuarios
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = auth.uid() AND u.cargo = 'SysAdmin'
        )
    );

-- Policies for reservas
CREATE POLICY "Todos podem ver reservas (para calendário)" ON public.reservas
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserção de reservas" ON public.reservas
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuários podem editar/cancelar suas próprias reservas" ON public.reservas
    FOR UPDATE USING (auth.uid() = usuario_id);

CREATE POLICY "Porteiros, Síndicos e SysAdmin podem gerenciar todas as reservas" ON public.reservas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = auth.uid() AND u.cargo IN ('Síndico Geral', 'Subsíndico', 'Porteiro', 'SysAdmin')
        )
    );

-- Policies for audit_logs
CREATE POLICY "Somente Síndico Geral e SysAdmin podem ver audit_logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = auth.uid() AND u.cargo IN ('Síndico Geral', 'SysAdmin')
        )
    );
    
-- 4. RPC Functions for Encrypted Operations

-- RPC to create user with encrypted RG/CPF
CREATE OR REPLACE FUNCTION create_usuario_encrypted(
    p_id UUID,
    p_nome_completo TEXT,
    p_data_nascimento DATE,
    p_telefone TEXT,
    p_apartamento TEXT,
    p_torre TEXT,
    p_bloco TEXT,
    p_foto_url TEXT,
    p_cargo TEXT,
    p_rg TEXT,
    p_cpf TEXT,
    p_secret_key TEXT
) RETURNS UUID AS $$
BEGIN
    INSERT INTO public.usuarios (
        id, nome_completo, data_nascimento, telefone, apartamento, torre, bloco, foto_url, cargo, 
        rg_encrypted, cpf_encrypted, status
    ) VALUES (
        p_id, p_nome_completo, p_data_nascimento, p_telefone, p_apartamento, p_torre, p_bloco, p_foto_url, p_cargo,
        pgp_sym_encrypt(p_rg, p_secret_key), pgp_sym_encrypt(p_cpf, p_secret_key), 'pendente'
    );
    RETURN p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to get user with decrypted RG/CPF
CREATE OR REPLACE FUNCTION get_usuario_decrypted(
    target_id UUID,
    secret_key TEXT
) RETURNS TABLE (
    id UUID,
    nome_completo TEXT,
    data_nascimento DATE,
    telefone TEXT,
    apartamento TEXT,
    torre TEXT,
    bloco TEXT,
    foto_url TEXT,
    cargo TEXT,
    rg TEXT,
    cpf TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id, u.nome_completo, u.data_nascimento, u.telefone, u.apartamento, u.torre, u.bloco, u.foto_url, u.cargo,
        pgp_sym_decrypt(u.rg_encrypted, secret_key) AS rg,
        pgp_sym_decrypt(u.cpf_encrypted, secret_key) AS cpf,
        u.status
    FROM public.usuarios u
    WHERE u.id = target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Profile Update Requests
CREATE TABLE public.profile_update_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    novo_nome_completo TEXT,
    novo_cpf_encrypted BYTEA,
    nova_foto_url TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profile_update_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem criar suas próprias solicitações" ON public.profile_update_requests
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuários podem ver suas próprias solicitações" ON public.profile_update_requests
    FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "Síndicos e SysAdmin podem gerenciar solicitações" ON public.profile_update_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = auth.uid() AND u.cargo IN ('Síndico Geral', 'Subsíndico', 'SysAdmin')
        )
    );

-- 6. Tabela Notificacoes
CREATE TABLE IF NOT EXISTS public.notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mensagem TEXT NOT NULL,
    destinatario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE, -- NULL means "todos"
    lida BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Colunas de Auditoria de Chaves e Ocorrencia na tabela Reservas
ALTER TABLE public.reservas 
ADD COLUMN IF NOT EXISTS status_chave TEXT DEFAULT 'aguardando' CHECK (status_chave IN ('aguardando', 'em_uso', 'concluida')),
ADD COLUMN IF NOT EXISTS retirada_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS entregue_por UUID REFERENCES public.usuarios(id),
ADD COLUMN IF NOT EXISTS devolvida_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS recebida_por UUID REFERENCES public.usuarios(id),
ADD COLUMN IF NOT EXISTS ocorrencia_texto TEXT,
ADD COLUMN IF NOT EXISTS turno_registro TEXT CHECK (turno_registro IN ('Turno Dia', 'Turno Noite'));

-- 8. Ativacao RLS Adicional
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- 9. Novas Policies e Ajustes de Segurança (Aplicados em Produção)
-- Permitir select publico (usuários necessitam apenas estar logados para buscar-- Policies: USUARIOS
CREATE POLICY "Permitir SELECT para usuarios" ON public.usuarios
FOR SELECT USING (true);

-- Notificações
CREATE POLICY "Usuarios leem notificacoes para eles ou para todos" ON public.notificacoes
FOR SELECT USING (
    auth.uid() IS NOT NULL AND (destinatario_id IS NULL OR destinatario_id = auth.uid())
);

CREATE POLICY "Usuarios podem marcar como lido" ON public.notificacoes
FOR UPDATE USING (
    destinatario_id = auth.uid() OR destinatario_id IS NULL
);

CREATE POLICY "Somente Admin e Sindico criam notificacoes" ON public.notificacoes
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuarios admin
        WHERE admin.id = auth.uid() AND admin.cargo IN ('SysAdmin', 'Síndico Geral', 'Subsíndico')
    )
);



-- 10. Tabela: solicitacoes_perfil (fila de aprovação de dados sensíveis)
CREATE TABLE IF NOT EXISTS public.solicitacoes_perfil (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    novo_nome TEXT,
    novo_cpf TEXT,
    nova_foto_url TEXT,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    revisado_por UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.solicitacoes_perfil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario insere propria solicitacao" ON public.solicitacoes_perfil
FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuario le sua solicitacao" ON public.solicitacoes_perfil
FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "Admin le todas as solicitacoes" ON public.solicitacoes_perfil
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.cargo IN ('SysAdmin', 'Síndico Geral', 'Subsíndico'))
);

CREATE POLICY "Admin atualiza solicitacao" ON public.solicitacoes_perfil
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.cargo IN ('SysAdmin', 'Síndico Geral', 'Subsíndico'))
);
