#!/usr/bin/env bash
# PreToolUse hook (matcher: Write|Edit)
# 편집 전에 현재 typecheck 상태를 캡처. 편집 후 회귀 감지에 사용.

set -euo pipefail

BASELINE_DIR=".claude/.baseline"
mkdir -p "$BASELINE_DIR"

# typecheck 결과를 캡처 (실패해도 베이스라인은 저장)
pnpm typecheck 2>&1 > "$BASELINE_DIR/typecheck.before.txt" || true

# 에러 수만 추출
BEFORE=$(grep -cE 'error TS' "$BASELINE_DIR/typecheck.before.txt" 2>/dev/null || echo 0)
echo "$BEFORE" > "$BASELINE_DIR/typecheck.before.count"

exit 0
