#!/usr/bin/env bash
# bootstrap.sh — Phase 0 부트스트랩 자동화
# Phase 0.1~0.7을 한 번에 끝낸다. 사용자가 git clone 직후 단 한 줄로 환경을 갖추기 위함.
#
# 흐름:
#   1) preflight (환경 점검)
#   2) pnpm install
#   3) husky 초기화 (lint-staged 훅)
#   4) git init + 초기 커밋
#   5) PLAN.md 0.1~0.7 [x] 마킹 + 합계 표 갱신 (Python)
#   6) typecheck + harness:plan + harness:data 검증

set -euo pipefail

cd "$(dirname "$0")/.."  # 프로젝트 루트로

echo "=========================================="
echo "🚀 Slim — Phase 0 부트스트랩 시작"
echo "=========================================="
echo ""

# ──────────────────────────────────────────
# 1) Preflight
# ──────────────────────────────────────────
echo "▶️  Step 1/6 — 환경 점검 (preflight)"
if ! bash scripts/preflight.sh; then
  echo ""
  echo "🚫 환경 미준비. preflight 실패 항목 해결 후 다시 실행하세요."
  exit 1
fi
echo ""

# ──────────────────────────────────────────
# 2) pnpm install
# ──────────────────────────────────────────
echo "▶️  Step 2/6 — pnpm install"
pnpm install --prefer-offline --ignore-scripts 2>&1 | tail -10
echo ""

# ──────────────────────────────────────────
# 3) Husky (lint-staged 훅) — git 저장소 안에서만 동작
# ──────────────────────────────────────────
echo "▶️  Step 3/6 — Husky (Git pre-commit 훅)"
if [[ ! -d .git ]]; then
  echo "  ℹ️  git repo 아님 — 'git init' 먼저 수행"
  git init -b main >/dev/null
fi

if [[ ! -d .husky ]]; then
  pnpm exec husky init >/dev/null 2>&1 || true
  cat > .husky/pre-commit <<'HOOK'
pnpm exec lint-staged
HOOK
  chmod +x .husky/pre-commit 2>/dev/null || true
  echo "  ✅ .husky/pre-commit 설정"
else
  echo "  ✅ Husky 이미 설정됨"
fi
echo ""

# ──────────────────────────────────────────
# 4) Git initial commit (충돌 회피 — 이미 커밋 있으면 스킵)
# ──────────────────────────────────────────
echo "▶️  Step 4/6 — Git 초기 커밋"
if [[ -z "$(git log --oneline 2>/dev/null)" ]]; then
  git add -A >/dev/null
  git -c user.email=bootstrap@slim.eu -c user.name=bootstrap \
      commit -m "chore(phase-0): bootstrap — Next.js 15 + Tailwind 4 + Drizzle + .claude" \
      >/dev/null
  echo "  ✅ 초기 커밋 생성"
else
  echo "  ✅ 이미 커밋 있음 (스킵)"
fi
echo ""

# ──────────────────────────────────────────
# 5) PLAN.md 0.1~0.7 [x] 마킹 + 합계 표 갱신 (Python으로 정확하게)
# ──────────────────────────────────────────
echo "▶️  Step 5/6 — PLAN.md Phase 0 완료 마킹"

# Windows/Linux 양쪽 호환 — python3 우선, 없으면 python, py 순
PYTHON_CMD=""
for cmd in python3 python py; do
  if command -v "$cmd" >/dev/null 2>&1; then
    if "$cmd" -c "import sys; sys.exit(0 if sys.version_info[0] >= 3 else 1)" >/dev/null 2>&1; then
      PYTHON_CMD="$cmd"
      break
    fi
  fi
done

if [[ -z "$PYTHON_CMD" ]]; then
  echo "  🚫 Python 3 미설치. https://www.python.org/downloads/ 또는 Microsoft Store"
  exit 1
fi

"$PYTHON_CMD" - <<'PYTHON'
import re
import sys

with open('PLAN.md', 'r', encoding='utf-8') as f:
    content = f.read()

original = content

# 5.1 — 페이즈 0의 모든 [ ] → [x]
content = re.sub(
    r'^- \[ \] (\*\*0\.[0-9]+\*\*)',
    r'- [x] \1',
    content,
    flags=re.MULTILINE,
)

# 5.2 — 페이즈 0 행: | 0 | 7 | 0 | 0 | → | 0 | 7 | 7 | 0 |
content = re.sub(
    r'\| 0 \| 7 \| 0 \| 0 \|',
    '| 0 | 7 | 7 | 0 |',
    content,
    count=1,
)

# 5.3 — 합계 행: **합계** | **61** | **0** | **0** | → **합계** | **61** | **7** | **0** |
content = re.sub(
    r'\*\*합계\*\* \| \*\*61\*\* \| \*\*0\*\* \| \*\*0\*\*',
    '**합계** | **61** | **7** | **0**',
    content,
    count=1,
)

if content == original:
    print('  ℹ️  변경 없음 (이미 완료 상태)')
else:
    with open('PLAN.md', 'w', encoding='utf-8') as f:
        f.write(content)
    completed = len(re.findall(r'^- \[x\] \*\*0\.', content, re.MULTILINE))
    print(f'  ✅ PLAN.md 갱신 — Phase 0 완료 항목: {completed}/7')
PYTHON
echo ""

# ──────────────────────────────────────────
# 6) 게이트 검증 — 부트스트랩 성공 확인
# ──────────────────────────────────────────
echo "▶️  Step 6/6 — 게이트 검증"

run_check() {
  local name="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "  ✅ $name"
  else
    echo "  ❌ $name"
    echo "     디버그: $cmd"
    return 1
  fi
}

FAILED=0
run_check "typecheck" "pnpm typecheck" || FAILED=1
run_check "harness:plan" "pnpm harness:plan" || FAILED=1
# data 하네스는 src/components/StaleLabel.tsx 등 강제 — 위에서 다 만들었으니 통과해야 함
run_check "harness:data" "pnpm harness:data" || FAILED=1
run_check "test (단위)" "pnpm test --run" || FAILED=1

echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo "=========================================="
  echo "✅ Phase 0 부트스트랩 완료"
  echo "=========================================="
  echo ""
  echo "다음 단계:"
  echo "  1) pnpm dev      — 로컬 확인 (http://localhost:3000)"
  echo "  2) claude        — Claude Code 시작 → Phase 1.1부터"
  echo ""
else
  echo "=========================================="
  echo "⚠️  부트스트랩 부분 실패"
  echo "=========================================="
  echo ""
  echo "위 ❌ 항목을 수정하거나 'pnpm bootstrap'을 다시 실행하세요."
  exit 1
fi
