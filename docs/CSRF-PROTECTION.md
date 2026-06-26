# CSRF Protection Guide

## Overview

This application uses **double-submit cookie pattern** for CSRF protection. Every mutation request (POST, PATCH, DELETE) must include a valid CSRF token.

## How It Works

1. **Token Generation**: On app initialization, `CsrfTokenInitializer` calls `/api/csrf-init` to generate and set a CSRF token in cookies
2. **Token Validation**: All mutation endpoints check that:
   - CSRF token exists in the `csrf-token` cookie
   - Token matches the `x-csrf-token` header value
3. **Token Refresh**: The same token is reused throughout the session (24 hour expiry)

## Client-Side Usage

### Using `fetchWithCsrf` Helper

For simple fetch-based requests, use the `fetchWithCsrf` wrapper:

```typescript
import { fetchWithCsrf } from '@/lib/csrf-client'

// POST request
const response = await fetchWithCsrf('/api/reservas', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... })
})

// PATCH request
const response = await fetchWithCsrf('/api/reservas/123', {
  method: 'PATCH',
  body: JSON.stringify({ ... })
})
```

### Using Axios Interceptor

For Axios-based requests, configure the CSRF interceptor:

```typescript
import axios from 'axios'
import { getCsrfToken } from '@/lib/csrf-client'

const axiosInstance = axios.create()

axiosInstance.interceptors.request.use((config) => {
  const token = getCsrfToken()
  if (token) {
    config.headers['x-csrf-token'] = token
  }
  return config
})

// All requests now include CSRF token automatically
await axiosInstance.post('/api/reservas', { ... })
```

### Manual Header Injection

If needed, manually inject the CSRF header:

```typescript
import { getCsrfToken } from '@/lib/csrf-client'

const token = getCsrfToken()
const response = await fetch('/api/reservas', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': token || '',
  },
  body: JSON.stringify({ ... })
})
```

## Protected Endpoints

All mutation endpoints enforce CSRF validation:

- `POST /api/reservas` - Create reservation
- `PATCH /api/reservas/[id]` - Cancel reservation
- `PATCH /api/reservas/[id]/chave` - Register key
- `POST /api/reservas/presencial` - Create presential reservation
- `POST /api/bloqueios` - Create blockage
- `DELETE /api/bloqueios/[id]` - Delete blockage
- `POST /api/usuarios` - Create user profile
- `PATCH /api/usuarios/[id]` - Update user
- `PATCH /api/usuarios/[id]/cargo` - Update user role

## Error Handling

When CSRF validation fails, the server returns:

```json
{
  "error": "CSRF token inválido.",
  "status": 403
}
```

**Common causes:**
- CSRF token not found in cookies (CsrfTokenInitializer failed)
- Token not sent in `x-csrf-token` header
- Token mismatch between cookie and header

**Solution:** Ensure `CsrfTokenInitializer` component is included in your root layout and the client uses `fetchWithCsrf` or injects the header manually.

## Security Notes

- Tokens are **HttpOnly-safe**: Not accessible to malicious JavaScript
- **SameSite=Strict**: Only sent in same-site requests
- **Secure flag**: HTTPS only (production)
- **24-hour expiration**: Tokens auto-refresh on app reload
- **Double-submit pattern**: Verifies cookie ≠ header attack vector

## Testing CSRF Protection

### Should Succeed (Valid Token)

```bash
# Get CSRF token from cookies
CSRF_TOKEN=$(curl -s -c /tmp/cookies.txt https://app.local/api/csrf-init | grep csrf-token)

# Use token in request
curl -X POST https://app.local/api/reservas \
  -b /tmp/cookies.txt \
  -H "x-csrf-token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### Should Fail (Missing Token)

```bash
# Request without CSRF header
curl -X POST https://app.local/api/reservas \
  -H "Content-Type: application/json" \
  -d '{...}'
# Returns 403: CSRF token inválido.
```

### Should Fail (Mismatched Token)

```bash
curl -X POST https://app.local/api/reservas \
  -b /tmp/cookies.txt \
  -H "x-csrf-token: wrong-token" \
  -H "Content-Type: application/json" \
  -d '{...}'
# Returns 403: CSRF token inválido.
```

## FAQ

**Q: Why not use SameSite cookie attribute alone?**  
A: SameSite provides good protection but has edge cases (trusted subdomain attacks, logged-in state mismatches). Double-submit adds a second layer of verification.

**Q: Can attackers steal the CSRF token from cookies?**  
A: No. Tokens are set with `httpOnly: false` (needed for JavaScript) but CORS restrictions and SameSite prevent cross-site access. The server **must** verify header ≠ cookie match.

**Q: Does this work with mobile apps?**  
A: Yes. Mobile apps should:
1. Call `/api/csrf-init` on startup
2. Use `fetchWithCsrf` or manually inject the header
3. Store token in memory (not persistent storage)

**Q: What if the token expires?**  
A: App automatically refreshes on page reload. For long-running SPAs, consider calling `/api/csrf-init` periodically or on significant state changes.
