#!/bin/sh
# Enterprise AI Dashboard — HTTP test suite
# Usage: ./run_tests.sh [BASE_URL]   (default: http://localhost:8080)

set -e
BASE="${1:-http://localhost:8080}"
PASS=0
FAIL=0

# ── Helpers ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

pass() { echo "  ${GREEN}[PASS]${NC} $1"; PASS=$((PASS+1)); }
fail() { echo "  ${RED}[FAIL]${NC} $1"; FAIL=$((FAIL+1)); }

check_http() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"
  local actual
  actual=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$actual" = "$expected" ]; then pass "$name (HTTP $actual)"; else fail "$name (expected $expected, got $actual)"; fi
}

check_body() {
  local name="$1"
  local url="$2"
  local pattern="$3"
  local body
  body=$(curl -s "$url")
  if echo "$body" | grep -qi "$pattern"; then pass "$name"; else fail "$name (pattern: $pattern)"; fi
}

check_header() {
  local name="$1"
  local url="$2"
  local header="$3"
  local headers
  headers=$(curl -s -I "$url")
  if echo "$headers" | grep -qi "$header"; then pass "$name"; else fail "$name (header: $header)"; fi
}

section() { echo ""; echo "${CYAN}${BOLD}── $1 ──${NC}"; }

# ── Test Suite ────────────────────────────────────────────────────────────────
echo ""
echo "${BOLD}════════════════════════════════════════${NC}"
echo "${BOLD}  Enterprise AI Dashboard — Test Suite  ${NC}"
echo "${BOLD}════════════════════════════════════════${NC}"
echo "  Target: ${YELLOW}$BASE${NC}"

section "Health Check"
check_http  "Health endpoint returns 200"          "$BASE/health"
check_body  "Health body: status=ok"               "$BASE/health"   '"status":"ok"'
check_body  "Health body: service=ai-dashboard"    "$BASE/health"   '"service":"ai-dashboard"'

section "Static File Serving"
check_http  "Root (index.html) returns 200"        "$BASE/"
check_http  "CSS file served"                      "$BASE/css/dashboard.css"
check_http  "JS file served"                       "$BASE/js/dashboard.js"
check_http  "Kiro CSV data file served"            "$BASE/data/kiro_sample.csv"
check_http  "Non-existent path returns 404"        "$BASE/does-not-exist.xyz"  404

section "HTML Content Validation"
check_body  "Page title present"                   "$BASE/"  "Enterprise AI Adoption Dashboard"
check_body  "Subtitle present"                     "$BASE/"  "IT SDLC AI Integration Tracker"
check_body  "AWS Kiro tab present"                 "$BASE/"  "AWS Kiro"
check_body  "Business Requirements tab present"    "$BASE/"  "Business Requirements"
check_body  "Solution Design tab present"          "$BASE/"  "Solution Design"
check_body  "QA / Testing tab present"             "$BASE/"  "QA"
check_body  "Production Deployment tab present"    "$BASE/"  "Production Deployment"
check_body  "Chart.js CDN reference present"       "$BASE/"  "chart.js"
check_body  "Tailwind CSS CDN reference present"   "$BASE/"  "tailwindcss"
check_body  "Stat counter (Active AI Users)"       "$BASE/"  "Active AI Users"
check_body  "Footer present"                       "$BASE/"  "Data refreshed daily"
check_body  "Architecture pipeline note"           "$BASE/"  "Glue"

section "Kiro CSV Data Validation"
CSV=$(curl -s "$BASE/data/kiro_sample.csv")
echo "$CSV" | grep -q "user_id,client_type" \
  && pass "CSV has correct headers" || fail "CSV has correct headers"
echo "$CSV" | grep -q "usr_001" \
  && pass "CSV contains sample user data" || fail "CSV contains sample user data"
echo "$CSV" | grep -q "enterprise" \
  && pass "CSV contains enterprise tier" || fail "CSV contains enterprise tier"
echo "$CSV" | grep -q "vscode" \
  && pass "CSV contains vscode client type" || fail "CSV contains vscode client type"
ROWS=$(echo "$CSV" | tail -n +2 | grep -c "usr_" || true)
if [ "$ROWS" = "20" ]; then pass "CSV has exactly 20 data rows"; else fail "CSV row count: expected 20, got $ROWS"; fi

section "JavaScript Validation"
JS=$(curl -s "$BASE/js/dashboard.js")
for fn in initTabs initCounters parseCSV buildKiroTable animateCounter \
           chartSdlcAdoption chartMonthlyTrend chartKiroTopUsers \
           chartKiroClientType chartKiroModels chartKiroDailyTrend \
           chartBizQuality chartBizTools chartSolutionRadar \
           chartQATestCases chartQADefects chartProdSuccessRate \
           chartProdFrequency chartProdAIvsManual; do
  echo "$JS" | grep -q "$fn" \
    && pass "Function $fn() defined" || fail "Function $fn() defined"
done
echo "$JS" | grep -q "DOMContentLoaded" \
  && pass "DOMContentLoaded init present" || fail "DOMContentLoaded init present"

section "CSS Validation"
CSS=$(curl -s "$BASE/css/dashboard.css")
for cls in header-gradient tab-btn tab-panel stat-card chart-container \
           info-banner data-table adoption-bar-track pulse-dot footer; do
  echo "$CSS" | grep -q "$cls" \
    && pass "CSS class .$cls defined" || fail "CSS class .$cls defined"
done

section "HTTP Security Headers"
check_header "X-Frame-Options on HTML"          "$BASE/"                    "X-Frame-Options"
check_header "X-Content-Type-Options on HTML"   "$BASE/"                    "X-Content-Type-Options"
check_header "X-XSS-Protection on HTML"         "$BASE/"                    "X-XSS-Protection"
check_header "Cache-Control on CSS assets"      "$BASE/css/dashboard.css"   "Cache-Control"
check_header "Cache-Control on JS assets"       "$BASE/js/dashboard.js"     "Cache-Control"
check_header "Cache-Control on CSV assets"      "$BASE/data/kiro_sample.csv" "Cache-Control"

section "Gzip Compression"
GZIP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Accept-Encoding: gzip" "$BASE/")
[ "$GZIP_STATUS" = "200" ] && pass "Gzip request accepted (HTTP $GZIP_STATUS)" || fail "Gzip request failed"

# ── Summary ──────────────────────────────────────────────────────────────────
TOTAL=$((PASS+FAIL))
echo ""
echo "${BOLD}════════════════════════════════════════${NC}"
if [ "$FAIL" = "0" ]; then
  echo "  ${GREEN}${BOLD}ALL $TOTAL TESTS PASSED${NC}"
else
  echo "  ${RED}${BOLD}$FAIL/$TOTAL TESTS FAILED${NC} · $PASS passed"
fi
echo "${BOLD}════════════════════════════════════════${NC}"
echo ""

[ "$FAIL" = "0" ]
