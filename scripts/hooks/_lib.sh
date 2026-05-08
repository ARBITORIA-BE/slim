#!/usr/bin/env bash
# 공용 헬퍼. 모든 hook 스크립트가 source한다.
# 핵심: grep -c "|| echo 0" 패턴 버그 박멸 (이중 출력 → 산술 syntax error 연쇄)

# 안전한 카운팅
# grep -c 는 매치 0건이어도 "0" 출력 + exit 1 → || echo 0가 두 번째 "0" 출력
# → 변수에 "0\n0" 캡쳐 → (( 산술 ))에서 syntax error
count_pattern() {
  local n
  n=$(grep -cE "$1" "$2" 2>/dev/null) || n=0
  printf '%s' "${n:-0}"
}

# 안전한 첫 매치 (head -1 pipefail 회피)
first_match() {
  local result
  result=$(grep -E "$1" "$2" 2>/dev/null | head -1 || true)
  printf '%s' "$result"
}

# JSON 출력 — jq 있으면 사용, 없으면 간이 escape
emit_hook_output() {
  local event="$1"
  local context="$2"
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
