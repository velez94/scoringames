#!/bin/bash
# Run tests for all Lambda domain packages

echo "🧪 Running tests for all Lambda packages..."
echo ""

FAILED=0
PASSED=0

for dir in shared competitions organizations athletes scoring scheduling categories wods; do
  echo "Testing $dir..."
  cd $dir
  if npm test -- --silent 2>&1 | grep -q "PASS"; then
    echo "✅ $dir tests passed"
    ((PASSED++))
  else
    echo "❌ $dir tests failed"
    ((FAILED++))
  fi
  cd ..
  echo ""
done

echo "================================"
echo "Test Summary:"
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo "================================"

exit $FAILED
