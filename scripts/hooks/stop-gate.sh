#!/usr/bin/env bash
# Stop hook
# 메인 응답 종료 직전 7단 게이트 실행. 하나라도 실패하면 decision: "block".
# 환경 미준비(pnpm 없음 등)는 에러 메시지를 명확히.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

# 환경 점검 — pnpm 없으면 게이트 자체를 건너뛰고 사용자에게 알림
if ! command -v pnpm >/dev/null 2>&1; then
  emit_hook_output "Stop" "⚠️  Stop 게이트 스킵: pnpm 미설치. 'bash scripts/preflight.sh' 실행해서 환경 먼저 갖추기."
  exit 0
fi

# package.json 없으면 Phase 0.1 시작 전 — 게이트 의미 없음
if [[ ! -f "package.json" ]]; then
  emit_hook_output "Stop" "ℹ️  package.json 없음 — Phase 0.1 'pnpm init' 수행 전이라 게이트 스킵."
  exit 0
fi

# node_modules 없으면 의존성 설치 안 됨
if [[ ! -d "node_modules" ]]; then
  emit_hook_output "Stop" "ℹ️  node_modules 없음 — 'pnpm install' 먼저 수행 후 게이트 활성화."
  exit 0
fi

# 변경 파일이 없으면 게이트 스킵 (속도)
CHANGED=$(git diff --name-only HEAD 2>/dev/null | wc -l)
CHANGED=${CHANGED:-0}
if [[ "$CHANGED" -eq 0 ]]; then
  exit 0
fi

REPORT=()
FAILED=0

run_gate() {
  local name="$1"
  local cmd="$2"
  local output
  if output=$(eval "$cmd" 2>&1); then
    REPORT+=("✅ ${name}")
  else
    FAILED=1
    local snippet
    snippet=$(printf '%s' "$output" | head -5)
    REPORT+=("❌ ${name}"$'\n'"${snippet}")
  fi
}

# Gate 1: typecheck
run_gate "Gate 1 typecheck" "pnpm typecheck"

# Gate 2: lint
run_gate "Gate 2 lint" "pnpm lint"

# Gate 3: tests (변경 영향만)
run_gate "Gate 3 tests" "pnpm test --changed --run"

# Gate 4: harness
[[ -f "scripts/harness/verify-plan.ts" ]]    && run_gate "Gate 4a plan" "pnpm harness:plan"
[[ -f "scripts/harness/data-fidelity.ts" ]]  && run_gate "Gate 4b data" "pnpm harness:data"
# bias audit은 DB 필요 — 운영 환경 토글
if [[ -f "scripts/harness/bias-audit.ts" && "${RUN_BIAS_AUDIT:-false}" == "true" ]]; then
  run_gate "Gate 4c bias" "pnpm harness:bias"
fi

# Gate 5: DB 인스턴스 일치 (PLAN 1.5.5)
# 사고 재발 방지 — db:push가 외부 endpoint로 적용되는 케이스 차단.
# .env.local 부재 (CI 등) 시 스킵해 안전.
if [[ -f "scripts/verify-db.ts" && -f ".env.local" ]]; then
  run_gate "Gate 5 db-endpoint" "pnpm verify:db"
fi

# Gate 6: cross-ref (ADR-0044 §D3 — error 격상)
# 컴포넌트 href ↔ 라우트 파일 존재 / i18n nextButton 라벨 ↔ 도달지 / STEPS ↔ router.push
# 2026-06-09 P0 회귀 5건 재발 방지 룰 3종. Q2 잠금 = Stop hook 차단.
[[ -f "scripts/harness/verify-cross-ref.ts" ]] && run_gate "Gate 6 cross-ref" "pnpm harness:cross-ref"

# Gate 7: 문서 링크 무결성 (ADR-0044 Amendment 1 §A1.D1 — error 격상)
# 마크다운 상대 링크 `[텍스트](경로.md)` 대상 파일 실재 검증.
# 2026-08-14 고아 ADR 사고 재발 방지 — PLAN/CHANGELOG가 main에 없는 ADR-0048/0049를
# 11건 [x] 격상 근거로 링크한 상태가 4개월간 게이트를 통과했다 (룰 3종은 코드 한정).
[[ -f "scripts/harness/verify-doc-links.ts" ]] && run_gate "Gate 7 doc-links" "pnpm harness:doc-links"

# 결과 조립
SUMMARY=$(printf '%s\n' "${REPORT[@]}")

if [[ "$FAILED" -eq 1 ]]; then
  REASON="🚫 Stop 게이트 실패. 응답을 마무리할 수 없습니다.

${SUMMARY}

조치: 위 실패 항목을 수정한 뒤 재시도. P4 (타입 안전) / P1 (정보 우선) 원칙 강제."
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg r "$REASON" '{ decision: "block", reason: $r }'
  else
    ESCAPED=$(printf '%s' "$REASON" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk '{printf "%s\\n", $0}' | sed 's/\\n$//')
    printf '{"decision":"block","reason":"%s"}\n' "$ESCAPED"
  fi
else
  emit_hook_output "Stop" "✅ 7단 게이트 모두 통과

${SUMMARY}"
fi

exit 0
