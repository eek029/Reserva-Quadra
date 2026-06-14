# 🚨 QUICK FIXES - Vulnerabilidades Críticas

## Prioridade 1: Corrigir Autenticação em `/api/reservas/presencial`

**Arquivo:** `src/app/api/reservas/presencial/route.ts`

### ❌ CÓDIGO VULNERÁVEL (ATUAL)
```typescript
export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    const requesterId = request.headers.get('requester-id');  // ❌ INSEGURO
    if (!requesterId) return NextResponse.json({ detail: 'requester-id header obrigatório.' }, { status: 400 });

    const { data: caller } = await supabase
      .from('usuarios').select('cargo').eq('id', requesterId).maybeSingle();

    if (!caller || !['Porteiro', 'Subsíndico', 'Síndico Geral', 'SysAdmin'].includes(caller.cargo))
      return NextResponse.json({ detail: 'Sem permissão.' }, { status: 403 });

    const body = await request.json();
    const result = await criarReservaPresencial(supabase, body, requesterId);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ detail: e.message }, { status: e.status });
    console.error('[api/reservas/presencial]', e);
    return NextResponse.json({ detail: 'Erro desconhecido' }, { status: 500 });
  }
}
```

### ✅ CÓDIGO CORRIGIDO
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { criarReservaPresencial, AppError } from '@/lib/services/reserva';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // ✅ CORRETO: Extrair token do Authorization header
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ detail: 'Não autorizado.' }, { status: 401 });

    const supabase = getServiceClient();
    
    // ✅ CORRETO: Validar token JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ detail: 'Token inválido.' }, { status: 401 });

    // ✅ CORRETO: Usar user.id do JWT validado
    const { data: caller } = await supabase
      .from('usuarios').select('cargo').eq('id', user.id).maybeSingle();

    if (!caller || !['Porteiro', 'Subsíndico', 'Síndico Geral', 'SysAdmin'].includes(caller.cargo))
      return NextResponse.json({ detail: 'Sem permissão.' }, { status: 403 });

    const body = await request.json();
    const result = await criarReservaPresencial(supabase, body, user.id);  // ✅ Usar user.id
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ detail: e.message }, { status: e.status });
    console.error('[api/reservas/presencial]', e);
    return NextResponse.json({ detail: 'Erro desconhecido' }, { status: 500 });
  }
}
```

---

## Prioridade 2: Atualizar Next.js

```bash
# Atualizar para versão segura
npm update next@latest

# Verificar versão
npm list next
# Deve ser >= 15.0.0
```

---

## Prioridade 3: Executar npm audit fix

```bash
# Corrigir vulnerabilidades de dependências
npm audit fix

# Se necessário, forçar atualização major
npm audit fix --force

# Verificar resultado
npm audit
# Deve mostrar 0 vulnerabilidades críticas/altas
```

---

## Prioridade 4: Adicionar Security Headers

**Arquivo:** `next.config.mjs`

### ✅ CÓDIGO CORRIGIDO
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
    swcMinify: false,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'bgkedrkyeofuwctiteuf.supabase.co',
                port: '',
                pathname: '/storage/v1/object/public/**',
            },
        ],
    },
    // ✅ NOVO: Security headers
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY'
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block'
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin'
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()'
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=31536000; includeSubDomains'
                    }
                ],
            },
        ];
    },
};

export default nextConfig;
```

---

## Checklist de Implementação

- [ ] Corrigir `/api/reservas/presencial` (usar JWT)
- [ ] Corrigir `/api/reservas/[id]/chave` (usar JWT)
- [ ] Atualizar Next.js para 15.0+
- [ ] Executar `npm audit fix`
- [ ] Adicionar security headers em `next.config.mjs`
- [ ] Testar todas as API routes
- [ ] Fazer commit e push
- [ ] Deploy em staging
- [ ] Testar em staging
- [ ] Deploy em produção

---

## Tempo Estimado

- Corrigir autenticação: 2-4 horas
- Atualizar Next.js: 1-2 horas
- npm audit fix: 30 minutos
- Security headers: 30 minutos
- Testes: 2-3 horas
- **Total: 6-10 horas**

---

## Verificação Pós-Fix

```bash
# 1. Verificar vulnerabilidades
npm audit

# 2. Testar API routes
curl -X POST http://localhost:3000/api/reservas/presencial \
  -H "Content-Type: application/json" \
  -H "requester-id: fake-uuid" \
  -d '{}' 
# Deve retornar 401 (não autorizado)

# 3. Testar com token válido
curl -X POST http://localhost:3000/api/reservas/presencial \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{"observacao":"teste","telefone_contato":"11999999999","hora_inicio":"10:00","hora_fim":"11:00"}'
# Deve funcionar

# 4. Verificar security headers
curl -I http://localhost:3000
# Deve mostrar X-Content-Type-Options, X-Frame-Options, etc.
```

---

**Status:** 🔴 CRÍTICO - Implementar HOJE
**Próxima revisão:** Após implementação de todos os fixes
