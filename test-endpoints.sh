#!/bin/bash
API="http://127.0.0.1:9000"
DATE="2026-05-18"
PASS=0
FAIL=0

test_ep() {
  local name="$1"
  local url="$2"
  if curl -s "$url" | jq . >/dev/null 2>&1; then
    echo "✓ $name"
    ((PASS++))
  else
    echo "✗ $name"
    ((FAIL++))
  fi
}

echo "=== ENDPOINTS ==="
test_ep "Health" "$API/health"
test_ep "Nutrition Search" "$API/nutrition/search?q=apfel"
test_ep "Nutrition Log" "$API/nutrition/log?date=$DATE"
test_ep "Nutrition Catalog" "$API/nutrition/catalog"
test_ep "Nutrition Journal" "$API/nutrition/journal?date=$DATE"
test_ep "Supplements Catalog" "$API/supplements/catalog"
test_ep "Supplements Log" "$API/supplements/log?date=$DATE"
test_ep "Supplements Stats" "$API/supplements/stats?days=7&anchor=$DATE"
test_ep "Fuel Log" "$API/fuel/log?date=$DATE"

echo -e "\n=== RESULT ==="
echo "✓ $PASS / $((PASS+FAIL)) passed"
[ $FAIL -eq 0 ] && echo "✅ ALL TESTS PASSED" || echo "⚠️  $FAIL FAILED"
