#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash)
# 위험한 명령을 즉시 차단.
# settings.json의 permissions.deny와 이중 안전장치.

set -euo pipefail

# stdin으로 들어오는 JSON 파싱
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# 차단 패턴
BLOCK_REASONS=()

if echo "$COMMAND" | grep -qE 'rm\s+-rf\s+/'; then
  BLOCK_REASONS+=("루트 경로 강제 삭제 시도")
fi

if echo "$COMMAND" | grep -qE 'git\s+push.*(--force|-f)\b'; then
  BLOCK_REASONS+=("git force push 시도 — pull request 워크플로우 사용")
fi

if echo "$COMMAND" | grep -qE '(API_KEY|SECRET|TOKEN|PASSWORD)='; then
  BLOCK_REASONS+=("환경변수 인라인 노출 — .env 파일 사용")
fi

if echo "$COMMAND" | grep -qE 'curl.*-X\s+(POST|PUT).*(slim\.eu|production)'; then
  BLOCK_REASONS+=("프로덕션 직접 mutation — 어드민 UI 사용")
fi

if echo "$COMMAND" | grep -qE 'DROP\s+(TABLE|DATABASE|SCHEMA)'; then
  BLOCK_REASONS+=("파괴적 SQL — 마이그레이션 사용")
fi

if [[ ${#BLOCK_REASONS[@]} -gt 0 ]]; then
  REASON_LIST=$(printf '• %s\n' "${BLOCK_REASONS[@]}")
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "🚫 차단된 명령:\n${REASON_LIST}\n\n명령: ${COMMAND}"
  }
}
EOF
  exit 0
fi

# 통과
exit 0
