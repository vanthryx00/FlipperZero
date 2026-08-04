#!/usr/bin/env bash
# smoke_test_flipper_ai.sh — curl-based smoke tests for bugreaperx Flipper AI endpoints.
#
# Tests the Worker's SubGHz, RFID, and NFC generation endpoints,
# verifying both HTTP structure and payload-file content.
#
# Prerequisites:
#   cd bugreaperx && npx wrangler dev    (starts the Worker on :8787)
#
# Usage:
#   bash scripts/smoke_test_flipper_ai.sh
#   bash scripts/smoke_test_flipper_ai.sh http://localhost:8787
#
# Exit: 0 = all tests passed, 1 = one or more failures, 2 = Worker unreachable.

set -euo pipefail

BASE_URL="${1:-http://localhost:8787}"
PASS=0
FAIL=0
SKIP=0

# Auto-detect Python (Windows Git Bash has `python`, Linux/macOS has `python3`)
PYTHON=$(command -v python3 2>/dev/null || command -v python 2>/dev/null || echo "python3")

# ── helpers ────────────────────────────────────────────────────────────────

red()    { printf "\033[31m%s\033[0m" "$*"; }
green()  { printf "\033[32m%s\033[0m" "$*"; }
yellow() { printf "\033[33m%s\033[0m" "$*"; }
dim()    { printf "\033[2m%s\033[0m" "$*"; }

pass() { PASS=$((PASS + 1)); printf "  %s %s\n" "$(green "PASS")" "$1"; }
fail() { FAIL=$((FAIL + 1)); printf "  %s %s\n" "$(red "FAIL")" "$1"; }
skip() { SKIP=$((SKIP + 1)); printf "  %s %s\n" "$(yellow "SKIP")" "$1"; }

error_detail() {
    local label="$1" code="$2" body="$3"
    printf "         %s" "$(dim "${label}")"
    printf "  HTTP %s" "$(red "${code}")"
    printf "  body: %s\n" "$(dim "$(echo "$body" | head -c 200)")"
}

do_curl() {
    # do_curl method path json_body -> (http_code, body)
    local method="$1" path="$2" body="$3"
    local tmp
    tmp=$(mktemp)
    local http_code
    http_code=$(curl -s -o "$tmp" -w "%{http_code}" \
        -X "$method" \
        -H "Content-Type: application/json" \
        -d "$body" \
        "$BASE_URL$path" 2>&1 || echo "000")
    local resp
    resp=$(cat "$tmp")
    rm -f "$tmp"
    echo "$http_code"
    echo "$resp"
}

# Extract a JSON field from a response body.  Returns the raw value.
json_get() {
    # json_get key < stdin
    $PYTHON -c "import sys,json; print(json.load(sys.stdin).get('$1',''))" 2>/dev/null
}

# Check that a JSON response body has all expected top-level keys.
# Prints "OK" or "MISSING:key1,key2".
json_has_keys() {
    # json_has_keys key1 key2 ... < stdin
    local keylist
    keylist=$(printf "%s " "$@")
    $PYTHON -c "
import sys,json
d=json.load(sys.stdin)
keys='${keylist}'.strip().split()
missing=[k for k in keys if k not in d]
print('OK' if not missing else 'MISSING:'+','.join(missing))
" 2>/dev/null || echo "PARSE_ERROR"
}

# ── content validators ─────────────────────────────────────────────────────

validate_sub_content() {
    local content="$1"
    local label="${2:-subghz}"
    local ok=true

    for header in Filetype Version Frequency Preset; do
        if ! echo "$content" | grep -qi "^${header}:"; then
            fail "$label: missing '${header}:' header"
            ok=false
        fi
    done

    if ! echo "$content" | grep -qi "RAW_Data:"; then
        fail "$label: missing 'RAW_Data:' — generated .sub should include timing data"
        ok=false
    fi

    if ! echo "$content" | grep -qi "synthesized\|generated\|honest-limit\|NOT captured"; then
        fail "$label: missing honest-limits / safety note"
        ok=false
    fi

    $ok && pass "$label: content has valid .sub structure"
}

validate_rfid_content() {
    local content="$1"
    local label="${2:-rfid}"
    local ok=true

    for header in Filetype Version Frequency "Key type"; do
        if ! echo "$content" | grep -qi "^${header}:"; then
            fail "$label: missing '${header}:' header"
            ok=false
        fi
    done

    if ! echo "$content" | grep -qi "^Key:\|^Data:"; then
        fail "$label: missing 'Key:' or 'Data:' field"
        ok=false
    fi

    if ! echo "$content" | grep -qi "synthesized\|generated\|honest-limit\|NOT a real"; then
        fail "$label: missing honest-limits / safety note"
        ok=false
    fi

    $ok && pass "$label: content has valid .rfid structure"
}

validate_nfc_content() {
    local content="$1"
    local label="${2:-nfc}"
    local ok=true

    for header in Filetype Version "Device type" UID ATQA SAK; do
        if ! echo "$content" | grep -qi "^${header}:"; then
            fail "$label: missing '${header}:' header"
            ok=false
        fi
    done

    if ! echo "$content" | grep -qiE "^(Block [0-9]+|Page [0-9]+):"; then
        fail "$label: missing Block/Page data"
        ok=false
    fi

    if ! echo "$content" | grep -qi "synthesized\|generated\|honest-limit\|NOT a real"; then
        fail "$label: missing honest-limits / safety note"
        ok=false
    fi

    $ok && pass "$label: content has valid .nfc structure"
}

# ── endpoint test helper ───────────────────────────────────────────────────
#
#   test_gen ENDPOINT  KEY  LABEL  VALIDATOR  [extras...]
#
# Sends a valid POST, checks JSON keys, extracts the payload content,
# and runs the validator on it.  Handles 000/502/http-err gracefully.
test_gen() {
    local endpoint="$1"      # e.g. /api/flipper-ai/generate-subghz
    local content_key="$2"   # e.g. sub_content
    local label="$3"         # human label for test messages
    local validator="$4"     # function name: validate_sub_content, etc.
    local body="$5"          # JSON request body

    local http; http=$(do_curl POST "$endpoint" "$body")
    local code; code=$(echo "$http" | head -1)
    local resp; resp=$(echo "$http" | tail -n +2)

    if [ "$code" = "000" ]; then
        skip "$label: Worker unreachable mid-test (000)"
        return
    elif [ "$code" = "502" ]; then
        skip "$label: HTTP 502 — LLM endpoint is down, skipping content checks"
        return
    elif [ "$code" != "200" ]; then
        fail "$label: expected 200, got $code"
        error_detail "$label" "$code" "$resp"
        return
    fi

    # Check JSON keys
    local keys; keys=$(echo "$resp" | json_has_keys "$content_key" model)
    if [ "$keys" = "OK" ]; then
        pass "$label: response has '$content_key' and 'model' keys"
    else
        fail "$label: response key check: $keys"
    fi

    # Extract and validate payload content
    local payload; payload=$(echo "$resp" | json_get "$content_key")
    if [ -n "$payload" ]; then
        "$validator" "$payload" "$label"
    else
        fail "$label: could not extract '$content_key' from JSON"
    fi

    # Run extra checks (passed as more args)
    shift 5
    for check in "$@"; do
        $check "$payload" "$label"
    done
}

# ── error-case test helper ─────────────────────────────────────────────────
#
#   test_400 ENDPOINT  LABEL  JSON_BODY
#
# Expects HTTP 400 (missing required field).  Fails if 502 (LLM down
# means the validation didn't fire first).
test_400() {
    local endpoint="$1"
    local label="$2"
    local body="$3"

    local http; http=$(do_curl POST "$endpoint" "$body")
    local code; code=$(echo "$http" | head -1)

    if [ "$code" = "000" ]; then
        skip "$label: Worker unreachable (000)"
    elif [ "$code" = "400" ]; then
        pass "$label: correctly returned 400"
    elif [ "$code" = "502" ]; then
        fail "$label: returned 502 (LLM down), expected 400 validation error before LLM call"
    else
        fail "$label: expected 400, got $code (should reject before calling LLM)"
    fi
}

# ── NTAG-specific validator (extra check for NFC generator) ────────────────

check_ntag_layout() {
    local content="$1"
    local label="$2"
    if echo "$content" | grep -qi "Pages total:"; then
        pass "$label: uses page-based layout (Pages total:)"
    else
        fail "$label: NTAG card should use 'Pages total:' not block layout"
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
# Worker health check
# ══════════════════════════════════════════════════════════════════════════════

echo "═══ Flipper AI Smoke Tests ═══"
echo "    target: $BASE_URL"
echo

printf "  Checking Worker health... "
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/flipper-ai/health" 2>&1 || echo "000")

if [ "$HEALTH_CODE" = "000" ]; then
    echo "$(red "UNREACHABLE")"
    echo
    echo "  The Worker at $BASE_URL is not reachable."
    echo "  Start it with: cd bugreaperx && npx wrangler dev"
    exit 2
elif [ "$HEALTH_CODE" -ge 500 ]; then
    echo "$(yellow "$HEALTH_CODE") (LLM may be down — content tests will be skipped)"
else
    echo "$(green "$HEALTH_CODE")"
fi
echo

# ══════════════════════════════════════════════════════════════════════════════
# SubGHz
# ══════════════════════════════════════════════════════════════════════════════

echo "── SubGHz generation ──────────────────────────────────────────────────"

test_gen \
    /api/flipper-ai/generate-subghz \
    sub_content \
    "generate-subghz (315 MHz garage opener)" \
    validate_sub_content \
    '{"description":"315 MHz garage door opener with static code","frequency":315000000}'

test_400 \
    /api/flipper-ai/generate-subghz \
    "generate-subghz (no description)" \
    '{"frequency":433920000}'

echo

# ══════════════════════════════════════════════════════════════════════════════
# RFID
# ══════════════════════════════════════════════════════════════════════════════

echo "── RFID generation ────────────────────────────────────────────────────"

test_gen \
    /api/flipper-ai/generate-rfid \
    rfid_content \
    "generate-rfid (EM4100 125 kHz)" \
    validate_rfid_content \
    '{"description":"EM4100 125 kHz badge for access control testing","key_type":"EM4100","frequency":125000}'

test_gen \
    /api/flipper-ai/generate-rfid \
    rfid_content \
    "generate-rfid (HID Prox H10301)" \
    validate_rfid_content \
    '{"description":"HID Prox 26-bit Wiegand card, facility 100","key_type":"H10301","frequency":125000}'

test_400 \
    /api/flipper-ai/generate-rfid \
    "generate-rfid (no description)" \
    '{"key_type":"EM4100"}'

echo

# ══════════════════════════════════════════════════════════════════════════════
# NFC
# ══════════════════════════════════════════════════════════════════════════════

echo "── NFC generation ─────────────────────────────────────────────────────"

test_gen \
    /api/flipper-ai/generate-nfc \
    nfc_content \
    "generate-nfc (Mifare Classic 1K)" \
    validate_nfc_content \
    '{"description":"Mifare Classic 1K test card for emulation testing","protocol":"Mifare Classic","uid_size":4}'

test_gen \
    /api/flipper-ai/generate-nfc \
    nfc_content \
    "generate-nfc (NTAG215)" \
    validate_nfc_content \
    '{"description":"NTAG215 blank tag for NFC write testing","protocol":"NTAG215","uid_size":7}' \
    check_ntag_layout

test_400 \
    /api/flipper-ai/generate-nfc \
    "generate-nfc (no description)" \
    '{"protocol":"Mifare Classic"}'

echo

# ══════════════════════════════════════════════════════════════════════════════
# Cross-cutting: discovery endpoint, health, CORS
# ══════════════════════════════════════════════════════════════════════════════

echo "── Cross-cutting ──────────────────────────────────────────────────────"

# --- Unknown endpoint → 404 ---
HTTP=$(do_curl GET /api/flipper-ai/nonexistent "")
CODE=$(echo "$HTTP" | head -1)
if [ "$CODE" = "000" ]; then
    skip "unknown endpoint: Worker unreachable (000)"
elif [ "$CODE" = "404" ]; then
    pass "unknown endpoint: correctly returned 404"
else
    fail "unknown endpoint: expected 404, got $CODE"
fi

# --- Health endpoint ---
HTTP=$(do_curl GET /api/flipper-ai/health "")
CODE=$(echo "$HTTP" | head -1)
if [ "$CODE" = "000" ]; then
    skip "health endpoint: Worker unreachable (000)"
elif [ "$CODE" = "200" ] || [ "$CODE" = "502" ]; then
    pass "health endpoint: returned $CODE (200=LLM ok, 502=LLM unreachable)"
else
    fail "health endpoint: expected 200 or 502, got $CODE"
fi

# --- CORS preflight ---
HTTP=$(do_curl OPTIONS /api/flipper-ai/generate-subghz "")
CODE=$(echo "$HTTP" | head -1)
if [ "$CODE" = "000" ]; then
    skip "CORS preflight: Worker unreachable (000)"
elif [ "$CODE" = "204" ]; then
    pass "CORS preflight: returned 204"
else
    fail "CORS preflight: expected 204, got $CODE"
fi

echo

# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════

echo "═══ Results ═══"
printf "  Pass: %s  Fail: %s  Skip: %s\n" "$(green "$PASS")" "$(red "$FAIL")" "$(yellow "$SKIP")"
echo

if [ "$SKIP" -gt 0 ] && [ "$FAIL" -eq 0 ]; then
    echo "$(yellow "Some tests skipped") — LLM endpoint was down (502) or Worker went offline."
    echo "Start the LLM and re-run for full content validation."
fi

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
exit 0
