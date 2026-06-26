#!/bin/bash

echo "========================================="
echo "  Security Validation Tests"
echo "========================================="
echo ""

BASE_URL=${1:-"http://localhost:3000"}
PASS=0
FAIL=0

test_case() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✅ PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $name (expected $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

echo "--- Test 1: Invalid UUID rejection ---"
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  "$BASE_URL/api/usuarios/invalid-uuid" \
  -H "Authorization: Bearer test" 2>/dev/null || echo "000")
test_case "Invalid UUID returns 400" "400" "$RESPONSE"

echo ""
echo "--- Test 2: CSRF token validation ---"
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X POST "$BASE_URL/api/reservas" \
  -H "Content-Type: application/json" \
  -d '{}' 2>/dev/null || echo "000")
test_case "Missing CSRF token returns 403" "403" "$RESPONSE"

echo ""
echo "--- Test 3: Missing auth token ---"
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  "$BASE_URL/api/reservas" 2>/dev/null || echo "000")
test_case "Missing auth returns 401" "401" "$RESPONSE"

echo ""
echo "--- Test 4: Security headers ---"
HEADERS=$(curl -s -I "$BASE_URL/" 2>/dev/null || echo "")
CSP=$(echo "$HEADERS" | grep -c "content-security-policy" || echo "0")
test_case "Content-Security-Policy header present" "1" "$CSP"
FRAME=$(echo "$HEADERS" | grep -c "x-frame-options" || echo "0")
test_case "X-Frame-Options header present" "1" "$FRAME"

echo ""
echo "========================================="
echo "Results: $PASS passed, $FAIL failed"
echo "========================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
