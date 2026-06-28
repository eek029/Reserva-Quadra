-- Config: tabela chave-valor para configurações do sistema
CREATE TABLE IF NOT EXISTS config (
  chave text PRIMARY KEY,
  valor text NOT NULL
);

ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler config (precisa saber a torre das chaves)
CREATE POLICY "qualquer um pode ler config"
  ON config FOR SELECT
  TO authenticated
  USING (true);

-- Só Síndico Geral e SysAdmin podem alterar config
CREATE POLICY "admin pode alterar config"
  ON config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND cargo IN ('Síndico Geral', 'SysAdmin')
    )
  );

-- Seed: torre 5 é a responsável pelas chaves
INSERT INTO config (chave, valor)
VALUES ('torre_gestao_chaves', '5')
ON CONFLICT (chave) DO NOTHING;
