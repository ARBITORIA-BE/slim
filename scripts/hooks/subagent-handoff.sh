#!/usr/bin/env bash
# SubagentStop hook — 서브에이전트 종료 시 다음 단계를 안내. jq 의존 제거.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

INPUT=$(cat)
AGENT_NAME="unknown"
if command -v jq >/dev/null 2>&1; then
  AGENT_NAME=$(printf '%s' "$INPUT" | jq -r '.subagent_type // "unknown"' 2>/dev/null || echo unknown)
else
  AGENT_NAME=$(printf '%s' "$INPUT" | grep -oE '"subagent_type"[[:space:]]*:[[:space:]]*"[^"]+"' | sed 's/.*"\([^"]*\)"$/\1/' || echo unknown)
fi
AGENT_NAME=${AGENT_NAME:-unknown}

case "$AGENT_NAME" in
  architect) NEXT="builder가 ADR/명세를 받아 구현 시작" ;;
  builder)   NEXT="verifier가 5단 게이트 실행 → (정책/법무 영향 있으면 legal 호출)" ;;
  verifier)  NEXT="scribe가 CHANGELOG/문서 동기화" ;;
  scribe)    NEXT="작업 완료. /checkpoint로 커밋 가능" ;;
  legal)     NEXT="법무 검토 결과 반영 → builder가 수정 또는 외부 감사 권고 시 사용자 결정" ;;
  *)         NEXT="결과 검토 후 다음 작업 선정" ;;
esac

emit_hook_output "SubagentStop" "🔁 ${AGENT_NAME} 종료 → ${NEXT}"
exit 0
