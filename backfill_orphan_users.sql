-- ============================================================
-- BACKFILL: Resgata usuários do Google OAuth que ficaram
-- "órfãos" — existem em auth.users mas NÃO em public.usuarios.
--
-- COMO USAR:
-- 1. Acesse o Supabase Dashboard → SQL Editor.
-- 2. Cole este script e clique em "Run".
-- 3. Verifique os usuários inseridos com a consulta no final.
--
-- SEGURO: o INSERT usa ON CONFLICT DO NOTHING, então
-- rodar múltiplas vezes não causa duplicatas.
-- ============================================================

INSERT INTO public.usuarios (
  id,
  nome_completo,
  foto_url,
  cargo,
  status
)
SELECT
  au.id,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'nome',
    au.raw_user_meta_data->>'name',
    au.email,  -- fallback: use o e-mail como nome temporário
    'Usuário Sem Nome'
  ) AS nome_completo,
  COALESCE(
    au.raw_user_meta_data->>'avatar_url',
    au.raw_user_meta_data->>'picture',
    NULL
  ) AS foto_url,
  'Morador' AS cargo,
  'pendente' AS status
FROM auth.users au
LEFT JOIN public.usuarios pu ON pu.id = au.id
WHERE pu.id IS NULL  -- apenas os órfãos
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Verificação: confirma quantos usuários foram resgatados
-- ============================================================
SELECT
  au.email,
  au.created_at AS criado_em,
  pu.nome_completo,
  pu.cargo,
  pu.status,
  CASE WHEN pu.cpf_encrypted IS NULL THEN 'Incompleto' ELSE 'Completo' END AS perfil
FROM auth.users au
LEFT JOIN public.usuarios pu ON pu.id = au.id
ORDER BY au.created_at DESC;
