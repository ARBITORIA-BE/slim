# Build Gate 음성 PR 실행 가이드

> **목적**: PLAN §D.1 DoD #3 충족 — *typecheck를 깨는 PR이 GitHub Actions
> 에서 차단됨* 을 1회 음성 테스트로 검증.
>
> **참고 ADR**: [ADR-0002](adr/0002-build-gate-ownership.md) (Build gate 책임
> 분리) + [ADR-0015](adr/0015-vercel-integration-and-d1-closure.md) (Vercel
> 통합 운영). 본 가이드는 두 ADR의 *운영 단계 산출물*.
>
> **누가 실행**: Pieter (Claude Code 세션) — 운영자는 GitHub PR 생성/close 만
> 수행 (또는 Pieter가 `gh` CLI 사용).
>
> **소요 시간**: 15-20분 (1회).

---

## 보안 룰 정합 (CLAUDE.md §8 #6 — 2026-05-10 신설)

본 가이드는 다음 룰을 준수한다:

- **Bash 인자에 위험 패턴 금지**: quote+개행+`#` / 백틱 / `$(...)` / escape 안 된
  큰따옴표
- **임시 파일은 Edit/Write 도구로 생성** — Bash heredoc + 인용 회피
- **commit 메시지는 `git commit -F <파일>` 로 전달** — 인라인 `-m` 큰 메시지 금지

---

## Vercel preview vs GitHub Actions CI — 핵심 구분

> **운영자 혼동 방지를 위해 본 섹션을 *반드시* 먼저 읽기.**

| 게이트 | 실행 환경 | 검사 대상 | typecheck 깨졌을 때 |
|---|---|---|---|
| **Vercel preview build** | Vercel build server | `next build` 만 | ✅ **통과** (next.config.ts `typescript.ignoreBuildErrors: true` 효과 — D.1.a) |
| **GitHub Actions CI (`ci.yml`)** | ubuntu-latest runner | `pnpm typecheck` 단독 | ❌ **실패** (4단 게이트 첫 단계) |

**즉:**

- **D.1 DoD #2 (Vercel preview 1회 성공)** → 본 음성 PR의 Vercel build가
  *✅ 통과* 해야 함 (Vercel은 typecheck 무시하므로 통과 가능). 그 통과 자체가
  D.1 DoD #2 마감 신호.
- **D.1 DoD #3 (typecheck 깨는 PR 차단)** → 본 음성 PR의 GitHub Actions CI가
  *❌ 실패* 해야 함. 그 실패 + main 브랜치 보호 룰 (D.1.c) 활성화 = PR merge
  차단 = D.1 DoD #3 마감 신호.

**한 PR이 두 DoD를 동시에 검증한다** — Vercel ✅ + Actions ❌. 두 신호 모두
PR Checks UI에 *나란히* 노출 (ADR-0015 §T6 PR comment 통합).

---

## 사전 준비 (Pieter 자동 점검)

```bash
# 현재 브랜치 = main 확인
git branch --show-current

# main 클린 상태 확인
git status
```

운영자 사전 작업:
- ✅ Vercel project 'slim' (ARBITORIA org) 연결됨 (ADR-0015 §Amendment 1)
- ✅ EXPECTED_DB_ENDPOINTS allowlist 등록됨 (ADR-0017 §결정 2)
- ⏳ D.1.c (main 브랜치 보호 룰) — GitHub repo Settings → Branches → main →
  "Require status checks to pass before merging" + "ci / gate" 선택 *되어
  있어야 함*. 미설정 시 PR merge 차단 자체가 안 됨 → Pieter가 운영자에게 사전
  확인 요청.

---

## 음성 PR 실행 11단계

### 1. 새 브랜치 생성

```bash
git checkout -b test/build-gate-negative
```

### 2. 의도적 typecheck 에러 파일 신설 (Write 도구 사용)

**파일**: `scripts/__test_build_gate__.ts`

**내용**:
```ts
// Intentional type error for PLAN §D.1 DoD #3 negative test.
// This file MUST trigger `pnpm typecheck` failure in GitHub Actions ci.yml.
// Created via test/build-gate-negative branch — to be removed when PR closes.
//
// Why scripts/ and not src/?
//   - src/ files are bundled into next build → would trip Vercel build too
//     (we want Vercel to PASS to also validate D.1 DoD #2).
//   - scripts/ are excluded from next build but included in pnpm typecheck
//     (since PLAN 1.5.4 restored scripts/** to tsconfig).
//   - Net effect: Vercel ✅ pass, GitHub Actions ❌ fail. Exactly D.1 DoD
//     #2 + #3 dual signal.

const x: number = 'string'; // intentional TS2322 — Type 'string' is not assignable to type 'number'
console.log(x);
```

**중요한 이유 — 왜 `scripts/`?**:
- `src/` 에 두면 `next build` 도 깨짐 → Vercel ❌ → D.1 DoD #2 (Vercel ✅) 동시
  검증 불가
- `scripts/` 는 next build 에서 제외 (Next.js 기본 동작) + PLAN 1.5.4 에서
  `tsconfig.json` exclude 에서 제거됨 → `pnpm typecheck` 에 포함됨
- 결과: Vercel ✅ pass + GitHub Actions ❌ fail = 두 DoD 동시 검증

### 3. 임시 파일 stage

```bash
git add scripts/__test_build_gate__.ts
```

### 4. Commit 메시지를 임시 파일로 작성 (Write 도구 사용)

**파일**: `.git/COMMIT_NEG.txt`

**내용**:
```
test(d1): intentional typecheck failure for D.1 DoD #3 negative test

This commit deliberately introduces a type error in scripts/__test_build_gate__.ts
to validate that GitHub Actions CI (ci.yml) blocks PR merge when typecheck fails.

Expected:
- Vercel preview build: PASS (next build ignores TS errors per D.1.a)
- GitHub Actions ci.yml: FAIL at typecheck step
- PR merge: BLOCKED by D.1.c main branch protection

This branch will NOT be merged. PR will be closed and branch deleted.

Refs: ADR-0002, ADR-0015, PLAN D.1, docs/build-gate-negative-test.md
```

### 5. Commit 실행 (-F 로 파일 전달, 인라인 메시지 0)

```bash
git commit -F .git/COMMIT_NEG.txt
```

### 6. push

```bash
git push -u origin test/build-gate-negative
```

### 7. PR 생성

**옵션 A — `gh` CLI** (Pieter 권장):
```bash
gh pr create --base main --head test/build-gate-negative \
  --title "test(d1): typecheck negative test (DO NOT MERGE)" \
  --body-file .git/COMMIT_NEG.txt
```

**옵션 B — 운영자가 GitHub UI에서 직접**:
- https://github.com/Arbitoria/slim/pull/new/test/build-gate-negative
- 제목: `test(d1): typecheck negative test (DO NOT MERGE)`
- 본문: `.git/COMMIT_NEG.txt` 내용 복붙

### 8. 두 게이트 결과 검증 (PR 페이지에서)

PR 생성 후 ~3분 대기. PR Checks UI에 두 신호 노출:

| Check | 기대 결과 | 의미 |
|---|---|---|
| **Vercel** (Preview) | ✅ Ready | D.1 DoD #2 충족 — Vercel build 1회 성공 |
| **ci / gate (typecheck)** | ❌ Failure | D.1 DoD #3 충족 — typecheck 단계에서 PR 차단 신호 |

**추가 검증**:
- PR 본문 영역에 Vercel bot comment 노출 + preview URL 클릭 → 200 응답 확인
  (DoD #2 의 *실제 페이지 렌더* 확정)
- "Merge pull request" 버튼이 *비활성화* 또는 빨강 — D.1.c 브랜치 보호 룰
  + 4단 게이트 ❌ 효과
- 만약 merge 버튼이 *활성화* 되어 있으면 → D.1.c 미설정 → 운영자 후속 작업
  (GitHub repo Settings → Branches → main 보호 룰 활성화)

### 9. PR close (merge 안 함)

```bash
gh pr close $(gh pr view --json number -q .number)
```

또는 운영자가 GitHub UI에서 "Close pull request" 클릭.

### 10. 로컬 정리

```bash
git checkout main
git branch -D test/build-gate-negative
```

### 11. origin 정리

```bash
git push origin --delete test/build-gate-negative
```

---

## 사후 정리 (선택)

- 임시 파일 `.git/COMMIT_NEG.txt` 는 `.git/` 하위라 commit 안 됨 — 삭제 옵션
  (`Remove-Item .git/COMMIT_NEG.txt` PowerShell)
- `scripts/__test_build_gate__.ts` 는 브랜치 삭제와 함께 사라짐 (main에는 처음
  부터 없었음) — 추가 정리 0

---

## verifier 후속 (Step 4)

음성 PR 실행 + close 후 verifier 가 다음 5건 확인 → PLAN §D.1 [x] 마킹:

- [x] DoD #1 — `next build` 로컬 통과 (D.1.a 적용 후 통과 — 본 가이드 외부)
- [x] DoD #2 — Vercel preview 배포 1회 성공 (위 §단계 8 Vercel ✅)
- [x] DoD #3 — typecheck 깨는 PR 차단 (위 §단계 8 ci ❌ + merge 비활성)
- [x] DoD #4 — D.1.d 적용 후 ci.yml 4단 게이트 안정 (D.1.d 머지됨 — 본 가이드
  외부)
- [x] D.1.c — main 브랜치 보호 룰 활성화 (위 §단계 8 merge 비활성 검증)

PLAN §D.1 [ ] → [x] 마킹 + 작업 추적 메타 표 페이즈 0.5 카운트 1 → 2 갱신 +
GATE-J 진입.

---

## 실패 시나리오 (회귀 트리거)

| 관찰 | 원인 추정 | 대응 |
|---|---|---|
| Vercel ❌ + ci ❌ | `scripts/` 가 `next build` 에 포함되었거나 `tsconfig.json` next config 경로 충돌 | next.config.ts 확인 + scripts 경로 재설계 |
| Vercel ✅ + ci ✅ | `tsconfig.json` 의 scripts/** include 누락 (PLAN 1.5.4 회귀) | `tsconfig.json` exclude 항목에 `scripts/**` 가 *없는지* 확인 |
| Vercel ✅ + ci ❌ + merge 활성 | D.1.c (main 브랜치 보호) 미설정 | 운영자 GitHub Settings → Branches → main → "Require status checks" + "ci / gate" 추가 |
| Vercel build 안 됨 (PR 생성 후 3분 무응답) | Vercel project 미연결 또는 Build Settings 미설정 | ADR-0015 §Step-3-prime 재실행 |

발견 시 본 가이드 Amendment + 해당 ADR (0002 / 0015 / 0017) 회귀 트리거 발동.

---

## References

- [ADR-0002](adr/0002-build-gate-ownership.md) — §결정 1 Build gate 책임
  분리 (Vercel = 빌드 / Actions = 검증)
- [ADR-0015](adr/0015-vercel-integration-and-d1-closure.md) — §검증 2/3 D.1
  DoD #2/#3 마감 게이트
- [ADR-0017](0017-db-mismatch-incident-postmortem.md) — DB 미스매치 사건
  종결 (음성 PR 실행 시 production DB 영향 0 — 본 가이드는 typecheck/build
  단독)
- [ADR-0018](adr/0018-neon-multi-org-policy.md) — Neon 멀티 org 정책 (음성 PR
  은 preview 환경에서 실행 → production 영향 0)
- [`PLAN.md`](../PLAN.md) §D.1 — DoD 4건 정의
- [CLAUDE.md §8 #6](../CLAUDE.md) — Bash 보안 룰 (본 가이드 작성 룰의 헌법
  근거)
