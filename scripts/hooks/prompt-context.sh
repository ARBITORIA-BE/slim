#!/usr/bin/env bash
# UserPromptSubmit hook
# 매 메시지 직전 PLAN.md 현재 상태를 컨텍스트로 주입.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

PLAN_FILE="PLAN.md"
[[ ! -f "$PLAN_FILE" ]] && exit 0

# 미완료 [ ] 또는 진행 중 [~] 상위 5개
PENDING=$(grep -E '^- \[[ ~]\]' "$PLAN_FILE" 2>/dev/null | head -5 || true)
PENDING=${PENDING:-"(없음)"}

BLOCKED=$(grep -E '^- \[!\]' "$PLAN_FILE" 2>/dev/null || true)
BLOCKED=${BLOCKED:-"(없음)"}

TOTAL=$(count_pattern '^- \[[ x~!]\]' "$PLAN_FILE")
DONE=$(count_pattern '^- \[x\]' "$PLAN_FILE")
PROGRESS=0
[[ "$TOTAL" -gt 0 ]] && PROGRESS=$(( DONE * 100 / TOTAL ))

CONTEXT="## 📋 PLAN.md 현재 상태

진행: ${DONE}/${TOTAL} (${PROGRESS}%)

### 다음 미완료 항목
${PENDING}

### 차단된 항목
${BLOCKED}

⚠️ 작업이 위 항목과 매칭되지 않으면 architect를 먼저 호출해 PLAN을 갱신할 것."

emit_hook_output "UserPromptSubmit" "$CONTEXT"
exit 0
