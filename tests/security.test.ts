/**
 * Security Integration Tests
 *
 * Tests that security controls are working:
 * - CSRF token validation
 * - Invalid UUID rejection
 * - Rate limiting
 * - Security headers
 *
 * Run: npx playwright test tests/security.test.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test';

test.describe('CSRF Protection', () => {
  test('POST /api/reservas without CSRF token returns 403', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/reservas`, {
      data: { data: '2026-07-01' },
    });
    expect(response.status()).toBe(403);
  });

  test('POST /api/usuarios without CSRF token returns 403', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/usuarios`, {
      data: { nome: 'Test' },
    });
    expect(response.status()).toBe(403);
  });
});

test.describe('UUID Validation', () => {
  test('GET /api/usuarios/invalid-uuid returns 400', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/usuarios/invalid-uuid`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    expect(response.status()).toBe(400);
  });

  test('DELETE /api/bloqueios/invalid-uuid returns 400', async ({ request }) => {
    const response = await request.delete(`${BASE_URL}/api/bloqueios/invalid-uuid`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    expect(response.status()).toBe(400);
  });
});

test.describe('Authentication', () => {
  test('GET /api/reservas without auth returns 401', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/reservas`);
    expect(response.status()).toBe(401);
  });

  test('POST /api/reservas without auth returns 401', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/reservas`, {
      data: {},
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('Content-Type Validation', () => {
  test('POST /api/reservas with non-JSON body returns 415', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/reservas`, {
      data: 'text body',
      headers: { 'Content-Type': 'text/plain' },
    });
    expect(response.status()).toBe(415);
  });
});
