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

CREATE POLICY "Usuários podem criar suas próprias reservas" ON public.reservas
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

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
