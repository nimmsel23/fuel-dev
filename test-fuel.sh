#!/bin/bash
# Test suite for fuel CLI ecosystem (dispatcher, supplements, meals)

set -e

BOLD='\033[1;32m'
PASS='\033[0;32m'
FAIL='\033[0;31m'
NC='\033[0m'

test_count=0
pass_count=0

function test_cmd() {
    local name="$1"
    local cmd="$2"
    local expect_pattern="$3"

    test_count=$((test_count + 1))
    echo -ne "${BOLD}Test $test_count:${NC} $name ... "

    if output=$(eval "$cmd" 2>&1); then
        if [[ $output =~ $expect_pattern ]]; then
            echo -e "${PASS}✓${NC}"
            pass_count=$((pass_count + 1))
            return 0
        else
            echo -e "${FAIL}✗${NC}"
            echo "  Expected: $expect_pattern"
            echo "  Got: $output" | head -3
            return 1
        fi
    else
        echo -e "${FAIL}✗${NC}"
        echo "  Error: $output" | head -3
        return 1
    fi
}

echo -e "${BOLD}Fuel CLI Test Suite${NC}\n"

# Test 1: Dispatcher help
test_cmd "Dispatcher help" \
    "./fuel --help | head -5" \
    "fuel.*Nutrition.*Supplement.*Tracker"

# Test 2: Fuel-supplement shorthand
test_cmd "Supplement shorthand (melatonin)" \
    "./fuel-supplement log melatonin 1 --day 2026-05-18" \
    "Melatonin.*geloggt"

# Test 3: Fuel-meal with macros
test_cmd "Meal logging with macros" \
    "./fuel meal 'Test Meal' --kcal 300 --protein 20 --carbs 40 --fat 12" \
    "Test Meal.*300.*kcal.*geloggt"

# Test 4: API nutrition log
test_cmd "API: Nutrition log contains meals" \
    "curl -s 'http://127.0.0.1:9000/nutrition/log?date=2026-05-18' | jq '.data.meals | length'" \
    "[0-9]+"

# Test 5: API supplements log
test_cmd "API: Supplements log contains intakes" \
    "curl -s 'http://127.0.0.1:9000/supplements/log?date=2026-05-18' | jq '.data.intakes | length'" \
    "[0-9]+"

# Test 6: Catalog exists
test_cmd "API: Nutrition catalog accessible" \
    "curl -s 'http://127.0.0.1:9000/nutrition/catalog' | jq '.items | length'" \
    "[0-9]+"

# Summary
echo -e "\n${BOLD}Summary: $pass_count/$test_count tests passed${NC}"
if [ $pass_count -eq $test_count ]; then
    echo -e "${PASS}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${FAIL}✗ Some tests failed${NC}"
    exit 1
fi
