#!/usr/bin/env bash
# INF-007: decides whether a GUT run passed from its JUnit report and log, not from the "All tests passed" banner.
#
# GUT skips a test script that fails to load (a parse error, a missing class) with only a warning: the run still exits 0
# and prints "All tests passed" with that script's tests silently missing. So a run passes only when
#   - the report counts at least one test and no failures,
#   - every test script under game/tests (prefix test_, as in game/.gutconfig.json) appears in the report, and
#   - the log has no "SCRIPT ERROR" (a runtime error inside a test that GUT does not count as a failure).
#
# Usage: game/tools/check_gut_report.sh <junit.xml> <gut.log>
set -euo pipefail

report="${1:?usage: check_gut_report.sh <junit.xml> <gut.log>}"
log="${2:?usage: check_gut_report.sh <junit.xml> <gut.log>}"
game_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
status=0

[ -s "${report}" ] || { echo "::error::GUT wrote no JUnit report at ${report}"; exit 1; }

header="$(grep -m1 -o '<testsuites [^>]*>' "${report}" || true)"
tests="$(printf '%s' "${header}" | sed -n 's/.* tests="\([0-9]*\)".*/\1/p')"
failures="$(printf '%s' "${header}" | sed -n 's/.* failures="\([0-9]*\)".*/\1/p')"
if [ -z "${tests}" ] || [ -z "${failures}" ]; then
  echo "::error::the JUnit report has no <testsuites tests=… failures=…> header"
  exit 1
fi
echo "GUT report: ${tests} tests, ${failures} failures"
if [ "${tests}" -eq 0 ]; then
  echo "::error::GUT ran no tests"
  status=1
fi
if [ "${failures}" -ne 0 ]; then
  echo "::error::GUT reported ${failures} failing tests"
  status=1
fi

missing=0
while IFS= read -r script; do
  name="${script#"${game_dir}/"}"
  if ! grep -qF "<testsuite name=\"${name}\"" "${report}"; then
    echo "::error file=game/${name}::test script did not run (GUT skips scripts that fail to load); see the SCRIPT ERROR lines in the log"
    missing=$((missing + 1))
  fi
done < <(find "${game_dir}/tests" -type f -name 'test_*.gd' | sort)
if [ "${missing}" -ne 0 ]; then
  status=1
fi

if grep -q "SCRIPT ERROR" "${log}"; then
  echo "::error::the GUT log has script errors:"
  grep -A2 "SCRIPT ERROR" "${log}" | head -40
  status=1
fi

exit "${status}"
