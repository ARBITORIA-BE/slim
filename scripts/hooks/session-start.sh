#!/usr/bin/env bash
# SessionStart hook
# 새 Claude Code 세션 시작 시 PLAN 진행도 + 다음 작업 한 줄 보고.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

PLAN_FILE="PLAN.md"

if [[ ! -f "$PLAN_FILE" ]]; then
  emit_hook_output "SessionStart" "👋 Pieter 세션 시작 — PLAN.md 없음. 'bash scripts/preflight.sh' 먼저 돌리고 architect 호출."
  exit 0
fi

TOTAL=$(count_pattern '^- \[[ x~!]\]' "$PLAN_FILE")
DONE=$(count_pattern '^- \[x\]' "$PLAN_FILE")
IN_PROGRESS=$(count_pattern '^- \[~\]' "$PLAN_FILE")
BLOCKED=$(count_pattern '^- \[!\]' "$PLAN_FILE")
PENDING=$(( TOTAL - DONE - IN_PROGRESS - BLOCKED ))

NEXT=$(first_match '^- \[ \]' "$PLAN_FILE")
NEXT=${NEXT#- \[ \] }
NEXT=${NEXT:-"(없음 — 다음 페이즈 시작 가능)"}

LAST_COMMIT=$(git log -1 --format='%s · %ar' 2>/dev/null || echo "(아직 커밋 없음)")

CONTEXT="👋 Pieter 세션 시작

📊 PLAN: ${DONE}✅ / ${IN_PROGRESS}🔄 / ${BLOCKED}🚫 / ${PENDING}⏳ (총 ${TOTAL})

▶️ 다음 작업: ${NEXT}

🕒 마지막 커밋: ${LAST_COMMIT}"

emit_hook_output "SessionStart" "$CONTEXT"
exit 0
