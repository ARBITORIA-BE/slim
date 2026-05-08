#!/usr/bin/env bash
# scripts/hooks/_lib.sh — 공용 헬퍼
# v0.6: Stop hook은 additionalContext 안 받으므로 조용히 종료하도록 수정

# 안전한 카운팅 (grep -c "|| echo 0" 패턴 버그 박멸)
count_pattern() {
  local n
  n=$(grep -cE "$1" "$2" 2>/dev/null) || n=0
  printf '%s' "${n:-0}"
}

# 안전한 첫 매치
first_match() {
  local result
  result=$(grep -E "$1" "$2" 2>/dev/null | head -1 || true)
  printf '%s' "$result"
}

# Hook JSON 출력 — Claude Code의 hook 스키마에 맞춰
# Stop hook은 additionalContext를 받지 않으므로 통과 시 조용히 종료
emit_hook_output() {
  local event="$1"
  local context="$2"

  # Stop hook 통과 시: 출력 없이 끝 (Claude Code 스키마 호환)
  # 차단이 필요하면 stop-gate.sh에서 별도로 {"decision":"block",...} 출력
  if [ "$event" = "Stop" ]; then
    return 0
  fi

  # 다른 hook (SessionStart, UserPromptSubmit, PostToolUse, SubagentStop)
  # 은 additionalContext 정상 사용
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg evt "$event" --arg ctx "$context" '{
      hookSpecificOutput: {
        hookEventName: $evt,
        additionalContext: $ctx
      }
    }'
  else
    local escaped
    escaped=$(printf '%s' "$context" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' | awk '{printf "%s\\n", $0}' | sed 's/\\n$//')
    printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":"%s"}}\n' "$event" "$escaped"
  fi
}
