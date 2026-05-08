#!/usr/bin/env bash
# preflight.sh
# Phase 0.1을 시작하기 전에 환경이 갖춰졌는지 점검.
# Claude Code 워크플로우의 가장 첫 단계 — 이게 통과해야 5단 게이트가 의미를 가진다.

set -euo pipefail

PASS=0
FAIL=0
WARN=0

check() {
  local name="$1"
  local cmd="$2"
  local required_msg="$3"
  local install_hint="$4"
  if eval "$cmd" >/dev/null 2>&1; then
    local version
    version=$(eval "$cmd" 2>&1 | head -1)
    printf '✅ %-20s %s\n' "$name" "$version"
    PASS=$(( PASS + 1 ))
  else
    printf '❌ %-20s 없음 — %s\n' "$name" "$required_msg"
    printf '   설치: %s\n' "$install_hint"
    FAIL=$(( FAIL + 1 ))
  fi
}

check_warn() {
  local name="$1"
  local cmd="$2"
  local hint="$3"
  if eval "$cmd" >/dev/null 2>&1; then
    printf '✅ %-20s OK\n' "$name"
    PASS=$(( PASS + 1 ))
  else
    printf '⚠️  %-20s 권장 — %s\n' "$name" "$hint"
    WARN=$(( WARN + 1 ))
  fi
}

echo "=========================================="
echo "Slim — 사전 환경 점검 (preflight)"
echo "=========================================="
echo ""

echo "[필수]"
check "Node.js"     "node --version"     "Node 22+ 필요"        "https://nodejs.org/  또는  nvm install 22"
check "pnpm"        "pnpm --version"     "패키지 매니저"          "corepack enable && corepack prepare pnpm@latest --activate  (또는: npm install -g pnpm)"
check "git"         "git --version"      "버전 관리"             "https://git-scm.com/"
check "bash"        "bash --version"     "hook 스크립트 실행"    "이미 설치됨 (Windows: Git Bash)"

# Python — Windows는 python, Linux는 python3
PYTHON_FOUND=""
for cmd in python3 python py; do
  if command -v "$cmd" >/dev/null 2>&1; then
    if "$cmd" -c "import sys; sys.exit(0 if sys.version_info[0] >= 3 else 1)" >/dev/null 2>&1; then
      PYTHON_FOUND="$cmd"
      break
    fi
  fi
done
if [[ -n "$PYTHON_FOUND" ]]; then
  printf '✅ %-20s %s\n' "Python 3" "$($PYTHON_FOUND --version 2>&1)"
  PASS=$(( PASS + 1 ))
else
  printf '❌ %-20s 없음 — bootstrap의 PLAN 갱신용\n' "Python 3"
  printf '   설치: Microsoft Store (Python 3.12) 또는 https://www.python.org/\n'
  FAIL=$(( FAIL + 1 ))
fi

echo ""
echo "[권장]"
check_warn "jq"          "jq --version"          "JSON 처리 정밀도 ↑"
check_warn "Docker"      "docker --version"      "로컬 Postgres 띄울 때"
check_warn "tsx"         "command -v tsx"        "harness 직접 실행시 (pnpm install 후 자동)"

echo ""
echo "[Node 버전 체크]"
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node --version | sed 's/v\([0-9]*\)\..*/\1/')
  if [[ "$NODE_MAJOR" -ge 22 ]]; then
    printf '✅ Node v%s — OK\n' "$NODE_MAJOR"
  else
    printf '❌ Node v%s — 22+ 필요 (Next.js 15 + 최신 TypeScript)\n' "$NODE_MAJOR"
    FAIL=$(( FAIL + 1 ))
  fi
fi

echo ""
echo "[프로젝트 파일]"
for f in CLAUDE.md PLAN.md package.json tsconfig.json .claude/settings.json; do
  if [[ -f "$f" ]]; then
    printf '✅ %s\n' "$f"
    PASS=$(( PASS + 1 ))
  else
    printf '❌ %s 없음\n' "$f"
    FAIL=$(( FAIL + 1 ))
  fi
done

echo ""
echo "[hook 스크립트 syntax]"
for h in scripts/hooks/*.sh; do
  if bash -n "$h" 2>/dev/null; then
    printf '✅ %s\n' "$h"
    PASS=$(( PASS + 1 ))
  else
    printf '❌ %s — syntax error\n' "$h"
    FAIL=$(( FAIL + 1 ))
  fi
done

echo ""
echo "=========================================="
printf '결과: ✅ %d 통과 · ❌ %d 실패 · ⚠️  %d 경고\n' "$PASS" "$FAIL" "$WARN"
echo "=========================================="

if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "🚫 환경이 준비 안 됐습니다. 위 실패 항목 해결 후 다시 실행하세요."
  echo "   해결 후: bash scripts/preflight.sh"
  exit 1
fi

echo ""
echo "✅ 환경 OK. 다음 단계:"
echo ""
echo "   1) pnpm install            # 의존성 설치"
echo "   2) claude                  # Claude Code 시작"
echo "   3) 첫 메시지: '/verify-plan'"
echo "   4) Pieter가 PLAN 0.1부터 안내합니다"
echo ""
exit 0
