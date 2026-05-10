#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash)
# 위험한 명령을 즉시 차단.
# settings.json의 permissions.deny와 이중 안전장치.
#
# 차단 대상:
#   (1) 전통 패턴 — rm -rf /, force push, secret 인라인, prod mutation, DROP TABLE
#   (2) CLAUDE.md §8 #6 (2026-05-10 운영자 결정) — Bash 인자 안 위험 패턴:
#       (a) 따옴표 + 개행 + # (path validation 우회 위험)
#       (b) 더블쿼트 안 backtick / $(...) (command substitution)
#       단, 싱글쿼트 안의 $()/backtick은 bash가 literal 처리하므로 통과.
#       세 번째 항목 ("escape 안 된 큰따옴표 끼어듦")은 자동 탐지 시 false
#       positive 비율이 높아 운영자 수동 검토에 의존 (스크립트 끝 주석 참조).

set -euo pipefail

# stdin으로 들어오는 JSON 파싱 (jq 부재 환경 호환 — ADR-0002 D.2)
INPUT=$(cat)
if command -v jq >/dev/null 2>&1; then
  COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')
else
  # fallback: tool_input.command 첫 매치 추출. JSON escape 처리.
  # 순서 — \\ → 센티넬, \" → ", \n → 실 개행, \t → 실 탭, 센티넬 → \
  # (역순 처리 시 \\n 같은 입력이 잘못 디코딩되는 문제 회피)
  COMMAND_RAW=$(printf '%s' "$INPUT" \
    | grep -oE '"command"[[:space:]]*:[[:space:]]*"([^"\\]|\\.)*"' \
    | head -1 \
    | sed -E 's/.*"command"[[:space:]]*:[[:space:]]*"((([^"\\]|\\.)*))"/\1/')
  COMMAND=$(printf '%s' "$COMMAND_RAW" \
    | sed -e 's/\\\\/__SLIM_BS__/g' \
          -e 's/\\"/"/g' \
          -e 's/\\n/\
/g' \
          -e 's/\\t/	/g' \
          -e 's/__SLIM_BS__/\\/g')
  COMMAND=${COMMAND:-}
fi

# 차단 패턴
BLOCK_REASONS=()
HAS_ARG_PATTERN=0  # CLAUDE.md §8 #6 위반 시 안전 대안 메시지 추가용

# === (1) 전통 패턴 ===

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

# === (2) CLAUDE.md §8 #6 — Bash 인자 안 위험 패턴 ===
# 멀티라인 정규식을 위해 newline → 0x0B (vertical tab) 센티넬로 변환.
# (0x0B는 일반 명령어/메시지에 거의 등장하지 않아 충돌 가능성 낮음.)
NL_SENTINEL=$(printf '\v')
COMMAND_FLAT=$(printf '%s' "$COMMAND" | tr '\n' "$NL_SENTINEL")

# 패턴 (a): 따옴표 인자 안에 개행 + #
#   매칭 규칙 — 여는 따옴표 + (해당 따옴표 종류 외 임의) + 개행 + ... + # + ... + 닫는 따옴표
#   닫는 따옴표를 강제해 heredoc body의 위양성을 차단 (heredoc은 닫는 따옴표 없음).
if printf '%s' "$COMMAND_FLAT" | grep -qE "\"[^\"]*${NL_SENTINEL}[^\"]*#[^\"]*\"" \
   || printf '%s' "$COMMAND_FLAT" | grep -qE "'[^']*${NL_SENTINEL}[^']*#[^']*'"; then
  BLOCK_REASONS+=("따옴표 인자 안에 개행 + # 패턴 — path validation 우회 위험 (CLAUDE.md §8 #6)")
  HAS_ARG_PATTERN=1
fi

# 패턴 (b): 더블쿼트 안 backtick 또는 $(...)
#   싱글쿼트 안의 $()/backtick은 bash가 literal로 두므로 안전 → 통과.
#   닫는 더블쿼트 강제로 stray 매칭 회피.
if printf '%s' "$COMMAND_FLAT" | grep -qE "\"[^\"]*(\`|\\\$\()[^\"]*\""; then
  BLOCK_REASONS+=("더블쿼트 인자 안에 backtick 또는 \$(...) — command substitution (CLAUDE.md §8 #6)")
  HAS_ARG_PATTERN=1
fi

# === 출력 ===
if [[ ${#BLOCK_REASONS[@]} -gt 0 ]]; then
  REASON_LIST=$(printf '• %s\n' "${BLOCK_REASONS[@]}")
  ALT_HINT=""
  if [[ $HAS_ARG_PATTERN -eq 1 ]]; then
    ALT_HINT=$'\n\n안전 대안 (CLAUDE.md §8 #6):\n  • 파일 작성 → Edit / Write 도구 직접 사용 (가장 안전)\n  • 임시 파일 작성 후 mv\n  • heredoc을 stdin으로 — 예) command --file=- <<'"'"'EOF'"'"'\n      ...\n    EOF\n  • git commit 멀티라인: git commit --file=- <<'"'"'EOF'"'"' ... EOF\n    ($()와 더블쿼트 wrap 없이 stdin으로 직접 주입)'
  fi
  # JSON 안전 인코딩 — jq 있으면 jq, 없으면 sed로 escape
  if command -v jq >/dev/null 2>&1; then
    REASON_FULL=$'🚫 차단된 명령:\n'"$REASON_LIST"$'\n명령: '"$COMMAND""$ALT_HINT"
    jq -n --arg reason "$REASON_FULL" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: $reason
      }
    }'
  else
    # 수동 escape
    esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk 'BEGIN{ORS=""} NR>1{printf "\\n"} {print}'; }
    REASON_ESC=$(esc "🚫 차단된 명령:")
    REASONS_ESC=$(esc "$REASON_LIST")
    CMD_ESC=$(esc "$COMMAND")
    ALT_ESC=$(esc "$ALT_HINT")
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s\\n%s\\n명령: %s%s"}}\n' \
      "$REASON_ESC" "$REASONS_ESC" "$CMD_ESC" "$ALT_ESC"
  fi
  exit 0
fi

# 통과
exit 0

# === 주석: 패턴 (c) "큰따옴표 escape 누락"에 대해 ===
#
# CLAUDE.md §8 #6 의 세 번째 항목: "인자 안에 큰따옴표 escape 없이 끼어든 패턴"
# — 자동 탐지 시도가 다음 두 흔한 합법 패턴과 구분되지 않음:
#
#   (i)  외부에 ' 로 감싼 안에 " 가 일반 문자로 등장: echo 'say "hi"'
#   (ii) 닫고 다시 여는 인접 인용: echo "hello "world""  → 'hello world'
#
# 운영자 수동 검토 + Edit/Write 우선 사용으로 보강. 추후 false positive
# 비율을 낮출 휴리스틱이 발견되면 본 hook에 추가.
