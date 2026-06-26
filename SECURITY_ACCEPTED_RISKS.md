# Accepted Security Risks

## PostCSS < 8.5.10 — Moderate (CVSS 6.1)

**Vulnerability:** XSS via unescaped `</style>` in CSS stringify output
**Dependency:** `next` → `postcss` (dev dependency, build-time only)
**Fix:** `npm install next@9.3.3` — breaking change, incompatível com Next.js 16

**Justificativa:** XSS ocorre apenas em build-time (compilação), não em runtime.
Usuários finais não são afetados. Impacto operacional zero.

**Monitoramento:** Aguardar Next.js 16.2.10+ incluir postcss >= 8.5.10

## glob/rimraf — High (CVSS 7.3+)

**Vulnerability:** Command injection via `-c/--cmd` with `shell:true`
**Dependency:** `eslint` → ... → `glob` (dev dependency, CI-only)
**Fix:** Atualizar eslint

**Justificativa:** Apenas executado em CI/desenvolvimento local.
Impacto em produção: zero.

## Ações

- [ ] Revisar mensalmente: `npm audit`
- [ ] Atualizar quando Next.js lançar patch
- [ ] Data da última revisão: 25/06/2026
