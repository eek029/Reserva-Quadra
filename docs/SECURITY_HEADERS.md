# Security Headers

Este documento lista todos os headers de segurança implementados no projeto.

## Headers Implementados

| Header | Valor | Propósito |
|--------|-------|----------|
| X-Content-Type-Options | nosniff | Previne MIME-type sniffing |
| X-Frame-Options | DENY | Previne clickjacking |
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
