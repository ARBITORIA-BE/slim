#!/usr/bin/env bash
# PostToolUse hook (matcher: Write|Edit)
# 편집 직후 typecheck. 베이스라인보다 에러가 늘면 builder에게 즉시 알림.
# CLAUDE.md 핵심 원칙 P4 (타입 안전) 강제.

set -euo pipefail

BASELINE_DIR=".claude/.baseline"
BEFORE=0
[[ -f "$BASELINE_DIR/typecheck.before.count" ]] && BEFORE=$(cat "$BASELINE_DIR/typecheck.before.count")

# 현재 typecheck
pnpm typecheck 2>&1 > "$BASELINE_DIR/typecheck.after.txt" || true
AFTER=$(grep -cE 'error TS' "$BASELINE_DIR/typecheck.after.txt" 2>/dev/null || echo 0)

if [[ "$AFTER" -gt "$BEFORE" ]]; then
  DIFF=$(( AFTER - BEFORE ))
  # 새로 발생한 에러 5개만 추출
  NEW_ERRORS=$(diff "$BASELINE_DIR/typecheck.before.txt" "$BASELINE_DIR/typecheck.after.txt" \
    | grep -E '^>.*error TS' | head -5 | sed 's/^> //' || true)

  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "❌ Typecheck 회귀 감지\n\n변경 후 신규 에러: ${DIFF}건\n\n${NEW_ERRORS}\n\n→ 다음 작업으로 넘어가기 전에 builder가 수정 필요 (P4 원칙)."
  }
}
EOF
elif [[ "$AFTER" -lt "$BEFORE" ]]; then
  FIXED=$(( BEFORE - AFTER ))
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "✅ Typecheck: 에러 ${FIXED}건 감소 (${BEFORE} → ${AFTER})"
  }
}
EOF
fi

exit 0
