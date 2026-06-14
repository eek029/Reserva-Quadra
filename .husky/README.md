# Git Hooks - Segurança

Este projeto usa git hooks para prevenir commits acidentais de secrets.

## Pre-commit Hook

**Localização**: `.husky/pre-commit`

**O que faz**:
- Bloqueia commits que contêm padrões de secrets
- Detecta: `DATABASE_URL=`, `ENCRYPTION_KEY=`, `SUPABASE_*_KEY=`, etc
- Pula arquivos seguros: `.env.example`, `ENCRYPTION_KEY.md`

**Exemplo de bloqueio**:
```bash
$ git commit -m "adicionar credentials"
🔍 Verificando secrets no commit...
❌ BLOQUEADO: Possível secret encontrado em '.env'
   Padrão: DATABASE_URL=
🚫 COMMIT BLOQUEADO - Secrets detectados!
```

## Como Instalar

Automaticamente ao rodar `npm install` (via `prepare` script).

Ou manualmente:
```bash
npx husky install
```

## Como Ignorar (CUIDADO!)

Se você REALMENTE precisa commitar algo que pareça secret, use:
```bash
git commit --no-verify -m "mensagem"
```

**⚠️ NUNCA use `--no-verify` para secrets reais!**

## Adicionar Novos Padrões

Edit `.husky/pre-commit` e adicione à array `PATTERNS`:
```bash
PATTERNS=(
    "MINHA_NOVA_CHAVE="
    "outro_padrao_secret"
)
```

---

**Responsável**: Segurança da aplicação
**Data**: 2026-06-14
