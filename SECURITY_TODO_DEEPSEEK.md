# 🔐 TODO Segurança — Tarefas Prontas para DeepSeek

**Data:** 25/06/2026  
**Status:** Risk Score 5.1/10 → alvo 3.2/10  
**Documentação:** Ver `SECURITY_FIXES_IMPLEMENTATION.md` para código pronto

---

## 📋 RESUMO EXECUTIVO

**Vulnerabilidades Encontradas:** 10 (0 críticas, 1 alta, 5 médias, 4 baixas)

**Tarefas Restantes:** 6 principais

**Tempo Total:** ~90 minutos

**Impacto:** Risk Score → 3.2/10 (BAIXO)

---

## 🔴 PRIORIDADE ALTA — Fazer Esta Semana

### Task 1: Completar Logger em Todos os Endpoints (15 min)

**Descrição:** Converter `console.error()` → `logger.error()` em 5 endpoints

**Arquivos a Modificar:**
```
src/app/api/reservas/historico/route.ts        (2 console.error)
src/app/api/reservas/presencial/route.ts       (2 console.error)
src/app/api/reservas/validate/route.ts         (2 console.error)
src/app/api/reservas/[id]/chave/route.ts       (2 console.error)
src/app/api/usuarios/[id]/cargo/route.ts       (2 console.error)
```

**Passo 1:** Adicionar import no topo de cada arquivo
```typescript
import { logger } from '@/lib/logger';
```

**Passo 2:** Encontrar linhas com `console.error` (use grep)
```bash
grep -n "console.error" src/app/api/reservas/historico/route.ts
```

**Passo 3:** Substituir padrão
```typescript
// ANTES
console.error('[api/reservas/historico]', e);

// DEPOIS
logger.error('historico_error', { endpoint: '/api/reservas/historico' });
```

**Teste:**
```bash
npm run build
# Deve passar sem erros de TypeScript
```

**Verificação:**
```bash
grep -r "console.error" src/app/api
# Não deve retornar nada (ou apenas em comments)
```

---

### Task 2: Rate Limiting em 2 Endpoints (10 min)

**Descrição:** Adicionar `const limiter = createRateLimiter()` em 2 endpoints

**Arquivo 1:** `src/app/api/reservas/[id]/route.ts`

**Mudança:**
```typescript
// ANTES (linha ~10)
const sensitiveLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

export async function PATCH(...) {
  try {
    const rl = sensitiveLimiter.check(request);
    if (rl) return rl;
    
    const validationError = validateRequestPayload(request);
    // ... resto do código

// DEPOIS — Já está correto! Apenas verificar que `sensitiveLimiter` existe
// Se não existir, adicionar:
const sensitiveLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
```

**Arquivo 2:** `src/app/api/bloqueios/[id]/route.ts`

**Mudança:**
```typescript
// ANTES (linha ~10)
const sensitiveLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

export async function DELETE(...) {
  try {
    const rl = sensitiveLimiter.check(request);
    if (rl) return rl;
    
    const uuidValidation = validateUUID(id);
    // ... resto do código

// DEPOIS — Já deve estar correto, apenas verificar!
```

**Teste:**
```bash
npm run build
```

---

### Task 3: Audit Logging com Fallback (5 min)

**Descrição:** Se audit log falhar em dados sensíveis, falhar a requisição (LGPD compliance)

**Arquivo:** `src/app/api/usuarios/[id]/route.ts` (linhas ~40-50)

**Mudança:**
```typescript
// ANTES
if (auditError) {
  logger.error('audit_log_failed', {
    endpoint: '/api/usuarios/[id]',
    userId: caller.id,
    targetUserId: id,
    auditError: auditError.message,
  });
}

// DEPOIS — Opcional mas recomendado
if (auditError) {
  logger.error('audit_log_failed', {
    endpoint: '/api/usuarios/[id]',
    userId: caller.id,
    targetUserId: id,
    auditError: auditError.message,
  });
  
  // Falhar a requisição se auditoria é crítica
  return NextResponse.json(
    { error: 'Falha ao registrar auditoria. Acesso negado.' },
    { status: 500 }
  );
}
```

**Teste:**
```bash
npm run build
curl -X GET http://localhost:3000/api/usuarios/user-id \
  -H "Authorization: Bearer token"
# Se auditoria falhar, deve retornar 500
```

---

## 🟡 PRIORIDADE MÉDIA — Fazer em 2-4 Semanas

### Task 4: Avaliar npm Vulnerabilities (5 min)

**Descrição:** Verificar PostCSS XSS (CVSS 6.1, dev-only, baixo risco)

**Ação:**
```bash
npm audit
# Procurar por: PostCSS < 8.5.10
```

**Opção A: Aceitar Risco (Recomendado)**
```bash
# Nenhuma ação - XSS é apenas em build-time
# Criar arquivo SECURITY_ACCEPTED_RISKS.md para documentar
echo "PostCSS < 8.5.10: XSS em build-time, não em runtime. Aguardando Next.js patch." > SECURITY_ACCEPTED_RISKS.md
```

**Opção B: Forçar Update (Breaking Change)**
```bash
npm install postcss@latest --save-dev
npm run build
# Verificar se algum erro aparece
```

**Recomendação:** Opção A (é mais seguro aguardar)

---

### Task 5: Teste de Validação de Input (10 min)

**Descrição:** Verificar que CPF/RG/telefone/UUID rejeitam inputs inválidos

**Testes Manuais:**

```bash
# 1. Test Invalid CPF (GET)
curl "http://localhost:3000/api/usuarios/123" \
  -H "Authorization: Bearer valid_token"
# Esperado: 400 "UUID inválido"

# 2. Test Invalid UUID (DELETE bloqueio)
curl -X DELETE "http://localhost:3000/api/bloqueios/not-uuid" \
  -H "Authorization: Bearer valid_token"
# Esperado: 400 "UUID inválido"

# 3. Test CSRF Token (POST reserva)
curl -X POST "http://localhost:3000/api/reservas" \
  -H "Content-Type: application/json" \
  -d '{"data":"test"}'
# Esperado: 403 "CSRF token inválido"

# 4. Test Rate Limiting (5 requests em 1 segundo)
for i in {1..6}; do
  curl -X GET "http://localhost:3000/api/bloqueios" \
    -H "Authorization: Bearer token" &
done
wait
# Request #6 deve retornar 429
```

**Criação de Script de Teste:**
```bash
# Criar: tests/security-validation.sh
cat > tests/security-validation.sh << 'EOF'
#!/bin/bash

# Test 1: Invalid UUID
echo "Test 1: Invalid UUID rejection..."
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  "http://localhost:3000/api/usuarios/invalid-uuid" \
  -H "Authorization: Bearer test")
if [ "$RESPONSE" = "400" ]; then
  echo "✅ PASS: Invalid UUID rejected"
else
  echo "❌ FAIL: Expected 400, got $RESPONSE"
fi

# Test 2: CSRF Token
echo "Test 2: CSRF token validation..."
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X POST "http://localhost:3000/api/reservas" \
  -H "Content-Type: application/json" \
  -d '{}')
if [ "$RESPONSE" = "403" ]; then
  echo "✅ PASS: CSRF token required"
else
  echo "❌ FAIL: Expected 403, got $RESPONSE"
fi

echo "All validation tests completed!"
EOF

chmod +x tests/security-validation.sh
./tests/security-validation.sh
```

---

### Task 6: Documentar Security Headers (5 min)

**Descrição:** Criar documento para explicar headers de segurança implementados

**Criar:** `docs/SECURITY_HEADERS.md`

```markdown
# Security Headers

Este documento lista todos os headers de segurança implementados no projeto.

## Headers Implementados

| Header | Valor | Propósito |
|--------|-------|----------|
| X-Content-Type-Options | nosniff | Previne MIME-type sniffing |
| X-Frame-Options | DENY | Previne clickjacking (X-Frame-Options) |
| X-XSS-Protection | 1; mode=block | Legacy XSS protection (navegadores antigos) |
| Content-Security-Policy | default-src 'self'; ... | Previne XSS injection |
| Referrer-Policy | strict-origin-when-cross-origin | Controla Referer header |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | Desabilita APIs sensíveis |
| Strict-Transport-Security | max-age=31536000; includeSubDomains | Força HTTPS |

## Teste de Headers

```bash
curl -I https://reserva-quadra.local
# Verificar que todos headers estão presentes
```

## Roadmap

- [ ] Subresource Integrity (SRI) para scripts externos
- [ ] Expect-CT para Certificate Transparency
- [ ] Public Key Pinning (HPKP) — opcional

## Referências

- https://owasp.org/www-project-secure-headers/
- https://nextjs.org/docs/advanced-features/security-headers
```

---

## 🔵 PRIORIDADE BAIXA — Fazer em 4-8 Semanas

### Task 7: LGPD Compliance Roadmap (Documentação)

**Descrição:** Planejar implementação de compliance LGPD (não é code, apenas planejamento)

**Criar:** `docs/LGPD_ROADMAP.md`

```markdown
# LGPD Compliance Roadmap

## Status Atual

- ✅ Autenticação & Autorização
- ✅ Criptografia em repouso
- ✅ Logs de auditoria
- ❌ Direito de exclusão (right to be forgotten)
- ❌ Export de dados (right to data portability)
- ❌ Notificação de breach
- ❌ Data Processing Agreement (DPA)

## Tarefas Necessárias

### Sprint 1 (Semanas 1-2): Direito de Exclusão
- [ ] Criar endpoint POST /api/usuarios/[id]/delete-request
- [ ] Validar que usuário é dono da conta
- [ ] Marcar usuário como deleted (soft delete)
- [ ] Agendar exclusão permanente em 30 dias (LGPD requirement)
- [ ] Notificar usuário via email

### Sprint 2 (Semanas 3-4): Export de Dados
- [ ] Criar endpoint POST /api/usuarios/[id]/export-request
- [ ] Gerar JSON com todos dados do usuário
- [ ] Criptografar arquivo
- [ ] Enviar via email

### Sprint 3 (Semanas 5-6): Breach Notification
- [ ] Criar table: breach_notifications
- [ ] Implementar notificação automática se dados vazam
- [ ] Logs de quem acessou que dado

## Referências

- https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd
- https://iapp.org/resources/article/gdpr-101-lgpd-comparison/
```

---

### Task 8: Encryption Key Rotation Strategy (Documentação)

**Descrição:** Planejar rotação de chaves de criptografia (não é code ainda)

**Criar:** `docs/KEY_ROTATION_STRATEGY.md`

```markdown
# Encryption Key Rotation Strategy

## Status Atual

- Chaves encriptam CPF e RG
- Usando Supabase pgcrypto (não rotacionável sem reencriptação)

## Problema

- Se chave vazar, toda coluna CPF é comprometida
- Não há estratégia de rotação implementada

## Solução (Future)

### Opção 1: Field-level Encryption (Recomendado)
- Implementar chaves por campo
- Rotacionar CPF separadamente de RG
- Código: Node.js crypto + Supabase Vault

### Opção 2: Database-level Encryption (Mais Caro)
- Usar Supabase Vault (enterprise feature)
- Rotação automática de chaves
- Custo: ~$500/mês

### Próximas Ações

- [ ] Avaliar opção 1 vs opção 2 com time
- [ ] Estimar custo/benefício
- [ ] Implementar em 2-3 meses
```

---

### Task 9: Penetration Testing (Profissional)

**Descrição:** Contratar serviço de pen testing profissional

**Recomendações:**
- Empresas: Infodefense, Hivecast, AlphaRed
- Custo: R$ 5.000-15.000
- Escopo: API endpoints + frontend XSS + CSRF
- Timeline: 2 semanas

**Não fazer agora** — Apenas documentar para futuro

---

### Task 10: Security Test Suite (E2E)

**Descrição:** Criar testes automatizados de segurança

**Arquivo:** `tests/security.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test('CSRF token is required for mutations', async ({ page }) => {
  const response = await page.request.post('/api/reservas', {
    data: { data: '2026-07-01' },
  });
  expect(response.status()).toBe(403);
});

test('Invalid UUID is rejected', async ({ page }) => {
  const response = await page.request.get('/api/usuarios/invalid-uuid', {
    headers: { Authorization: 'Bearer test' },
  });
  expect(response.status()).toBe(400);
});

test('Rate limiting kicks in after 5 requests', async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await page.request.get('/api/bloqueios', {
      headers: { Authorization: 'Bearer test' },
    });
  }
  
  const response = await page.request.get('/api/bloqueios', {
    headers: { Authorization: 'Bearer test' },
  });
  expect(response.status()).toBe(429);
});

test('Security headers are present', async ({ page }) => {
  await page.goto('http://localhost:3000');
  const headers = page.context().requestContext().headers;
  expect(headers['content-security-policy']).toBeDefined();
  expect(headers['x-frame-options']).toBe('DENY');
});
```

**Executar:**
```bash
npm install @playwright/test --save-dev
npx playwright test tests/security.test.ts
```

---

## 📊 Checklist de Implementação

```
PRIORIDADE ALTA (Esta Semana)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☐ Task 1: Logger em todos endpoints (15 min)
☐ Task 2: Rate limiting gaps (10 min)
☐ Task 3: Audit logging fallback (5 min)
  Subtotal: 30 minutos

PRIORIDADE MÉDIA (Próximas 2-4 Semanas)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☐ Task 4: npm vulnerabilities (5 min)
☐ Task 5: Input validation tests (10 min)
☐ Task 6: Security headers docs (5 min)
  Subtotal: 20 minutos

PRIORIDADE BAIXA (Próximas 4-8 Semanas)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☐ Task 7: LGPD roadmap (planning)
☐ Task 8: Key rotation strategy (planning)
☐ Task 9: Pen testing profissional (outsource)
☐ Task 10: Security test suite (1 hour)
  Subtotal: Documentação + Outsource

TOTAL: ~50 minutos de código + planejamento
```

---

## 🔗 Referências Rápidas

| Recurso | Link |
|---------|------|
| OWASP Top 10 | https://owasp.org/www-project-top-ten/ |
| Security Headers | https://owasp.org/www-project-secure-headers/ |
| Next.js Security | https://nextjs.org/docs/advanced-features/security-headers |
| Supabase RLS | https://supabase.com/docs/guides/auth/row-level-security |
| LGPD Brasil | https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd |

---

## 📝 Como Usar Este Documento

**Para DeepSeek:**

1. Copie este arquivo
2. Abra cada Task numerada
3. Siga os passos exatos
4. Execute o Teste após cada mudança
5. Commit quando passar no teste

**Exemplo:**
```bash
# Task 1
# 1. Abrir: src/app/api/reservas/historico/route.ts
# 2. Adicionar: import { logger } from '@/lib/logger';
# 3. Encontrar: console.error('[api/reservas/historico]', e);
# 4. Substituir por: logger.error('historico_error', { endpoint: '/api/reservas/historico' });
# 5. Teste: npm run build
# 6. Commit: git add -A && git commit -m "security: replace console.error with logger"
```

---

## ✅ Verificação Final

Depois de completar todas as tarefas, executar:

```bash
# 1. Build
npm run build

# 2. Lint
npm run lint

# 3. Security audit
npm audit

# 4. Grep validation (não deve encontrar console.error em src/app/api)
grep -r "console.error" src/app/api

# 5. Ver headers de segurança
npm run dev &
sleep 2
curl -I http://localhost:3000 | grep -E "X-|Content-Security|Strict"
```

**Esperado:**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; ...
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

**Última Atualização:** 25/06/2026  
**Status:** Pronto para DeepSeek implementar  
**Créditos Estimados:** ~15-20 créditos DeepSeek para todas tarefas
