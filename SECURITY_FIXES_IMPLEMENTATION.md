# 🛠️ SECURITY FIXES — IMPLEMENTAÇÃO PRONTA

## Fix #1: Adicionar CSP Header

**Arquivo:** `next.config.mjs`  
**Tempo:** 5 minutos  
**Impacto:** Alto

```javascript
// next.config.mjs - SUBSTITUIR async headers() completo
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self' https://bgkedrkyeofuwctiteuf.supabase.co; frame-ancestors 'none';",
        },
      ],
    },
  ];
}
```

---

## Fix #2: Implementar Logger Estruturado

**Arquivo:** `src/lib/logger.ts` (NOVO)  
**Tempo:** 10 minutos

```typescript
// src/lib/logger.ts
type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogContext {
  endpoint?: string;
  userId?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: unknown;
}

class SecureLogger {
  private isDev = process.env.NODE_ENV === 'development';
  
  private sanitize(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sensitiveKeys = ['password', 'token', 'secret', 'cpf', 'rg', 'key', 'apikey'];
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitize(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const sanitized = context ? this.sanitize(context) : {};
    
    const logEntry = {
      timestamp,
      level,
      message,
      ...sanitized,
    };
    
    if (this.isDev) {
      console.log(JSON.stringify(logEntry, null, 2));
    } else {
      // Em produção, enviar para serviço de logging (ex: Sentry, LogRocket)
      console.log(JSON.stringify(logEntry));
    }
  }
  
  error(message: string, context?: LogContext) {
    this.log('error', message, context);
  }
  
  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }
  
  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }
  
  debug(message: string, context?: LogContext) {
    if (this.isDev) {
      this.log('debug', message, context);
    }
  }
}

export const logger = new SecureLogger();
```

**Uso nos endpoints (exemplo):**

```typescript
// ANTES (inseguro)
console.error('[api/reservas/presencial]', e);

// DEPOIS (seguro)
import { logger } from '@/lib/logger';
logger.error('reservas_presencial_error', {
  endpoint: '/api/reservas/presencial',
  userId: user?.id,
  statusCode: 500,
});
```

---

## Fix #3: Completar Rate Limiting

**Arquivo:** `src/app/api/bloqueios/route.ts`  
**Tempo:** 5 minutos

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { criarBloqueio, AppError } from '@/lib/services/bloqueio';
import { createRateLimiter } from '@/lib/rate-limit';
import { validateRequestPayload } from '@/lib/api-validation';

export const dynamic = 'force-dynamic';

const normalLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

function getToken(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

export async function GET(request: NextRequest) {
  try {
    // ✅ ADICIONAR RATE LIMIT
    const rl = normalLimiter.check(request);
    if (rl) return rl;

    const token = getToken(request);
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    // ... resto do código
  } catch (e) {
    console.error('[api/bloqueios]', e);
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // ✅ ADICIONAR RATE LIMIT
    const rl = normalLimiter.check(request);
    if (rl) return rl;

    const validationError = validateRequestPayload(request);
    if (validationError) return validationError;

    const token = getToken(request);
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    // ... resto do código
  } catch (e) {
    console.error('[api/bloqueios]', e);
    return NextResponse.json({ error: 'Erro desconhecido' }, { status: 500 });
  }
}
```

---

## Fix #4: Melhorar Audit Logging em Dados Sensíveis

**Arquivo:** `src/app/api/usuarios/[id]/route.ts`  
**Tempo:** 5 minutos

```typescript
// ANTES
const { error: auditError } = await supabase.from('audit_logs').insert({
  perfil_id: caller.id, 
  acao: 'visualizou_dados_sensiveis',
  detalhes: { alvo_usuario_id: id, campos: ['rg', 'cpf'] },
});

if (auditError) {
  console.error('[audit] Falha ao registrar acesso a dados sensíveis:', auditError);
}

// DEPOIS
const { error: auditError } = await supabase.from('audit_logs').insert({
  perfil_id: caller.id, 
  acao: 'visualizou_dados_sensiveis',
  detalhes: { alvo_usuario_id: id, campos: ['rg', 'cpf'] },
});

if (auditError) {
  logger.error('audit_log_failed', {
    endpoint: '/api/usuarios/[id]',
    userId: caller.id,
    targetUserId: id,
    auditError: auditError.message,
  });
  
  // ⚠️ Opcional: Falhar a requisição se auditoria é crítica
  // return NextResponse.json(
  //   { error: 'Falha ao registrar auditoria. Acesso negado.' },
  //   { status: 500 }
  // );
}
```

---

## Fix #5: Atualizar npm Dependencies

**Opção A: Aceitar o risco (recomendado curto prazo)**

```bash
# Nenhuma ação - PostCSS XSS é apenas em build-time
# Documentar risco: vulnerability é em postcss (dev dependency)
# Monitorar: Next.js 16.2.10+ quando lançar patch
```

**Opção B: Forçar update (breaking change)**

```bash
npm audit fix --force
# Atualiza Next.js para 9.3.3 (breaking change MAJOR)
# Só fazer se tiver tempo para testar compatibilidade
```

**Recomendação:** Opção A (aguardar patch)

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### Semana 1 (Imediato)
- [ ] Fix #1: CSP + X-XSS-Protection headers (5 min)
- [ ] Fix #2: Logger estruturado (10 min)
- [ ] Fix #4: Audit logging melhorado (5 min)
- [ ] Testar no localhost: `npm run dev`
- [ ] Verificar headers: `curl -I http://localhost:3000`

### Semana 2
- [ ] Fix #3: Completar rate limiting (5 min)
- [ ] Fix #5: Avaliar npm updates
- [ ] Testes: Criar test suite para security headers

### Semana 3-4
- [ ] Implementar LGPD compliance
- [ ] Revisar RLS policies
- [ ] Considerar HSM para encryption keys

---

## ✅ VERIFICAÇÃO PÓS-IMPLEMENTAÇÃO

### Verificar CSP Header

```bash
curl -I https://seu-dominio.com | grep Content-Security-Policy
# Esperado: Content-Security-Policy: default-src 'self'; ...
```

### Verificar X-XSS-Protection

```bash
curl -I https://seu-dominio.com | grep X-XSS-Protection
# Esperado: X-XSS-Protection: 1; mode=block
```

### Testar Rate Limiting

```bash
# Script para testar rate limiting
for i in {1..25}; do
  curl -H "Authorization: Bearer invalid-token" \
       http://localhost:3000/api/bloqueios
  echo "Request $i"
done
# Esperado: 429 Too Many Requests após 20 requests
```

### Verificar Logger Estruturado

```typescript
// Testar no endpoint
logger.error('test_error', {
  userId: 'test-user-123',
  token: 'secret-token-xxx',  // Deve aparecer como [REDACTED]
  cpf: '123.456.789-00',      // Deve aparecer como [REDACTED]
});
```

---

## 📊 ESTIMATIVA DE ESFORÇO

| Fix | Tempo | Impacto | Risco |
|-----|-------|---------|-------|
| #1 CSP Header | 5 min | Alto | Baixo |
| #2 Logger | 10 min | Médio | Baixo |
| #3 Rate Limit | 5 min | Médio | Baixo |
| #4 Audit Log | 5 min | Médio | Baixo |
| #5 npm Updates | 2h | Médio | Alto |
| **TOTAL** | **2h 25min** | — | — |

---

## 🔗 REFERÊNCIAS

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [CSP Policy Generator](https://www.npmjs.com/package/csp-header)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/nodejs-security-features/)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)

