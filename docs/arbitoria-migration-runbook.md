# ARBITORIA 3 플랫폼 정렬 마이그레이션 — Runbook

> **연관 ADR**: [ADR-0019](adr/0019-arbitoria-three-platform-alignment.md) —
> 본 runbook 은 ADR-0019 §Migration Plan (M1~M8) 의 단계별 명세 + 검증 명령
> + 롤백 시나리오. 운영자 + Pieter 협업 ~30분 1회 작업.
>
> **사전 조건**: ADR-0019 GATE-M 운영자 승인 통과.
>
> **목표**: GitHub `Arbitoria/slim` (personal user) → 새 GitHub org `ARBITORIA`
> (또는 분기 결정 이름) 이전 → 3 플랫폼 (GitHub + Vercel + Neon) 정렬 완성.

---

## 안전 헌법 정합

- **CLAUDE.md §8 #6 (Bash 보안 룰)**: 본 runbook 의 모든 명령은 Edit/Write
  도구 또는 안전한 Bash 패턴 (heredoc with `'EOF'` quoted, 백틱 / `$(...)` /
  unescaped 큰따옴표 0). PLAN 1.5.7 (Bash 보안 자동 차단 hook) 부채와 정합.
- **새 의존성 0건**: GATE-C (ADR-0011) 통과 — 본 runbook 은 운영 자산 정렬만,
  npm 의존 추가 0.
- **5단 게이트 통과**: 본 runbook 작성은 .md 파일만 — typecheck/lint/test 영향
  0, harness:plan 영향 0 (PLAN.md 변동 없음).

---

## 사전 점검 (M0)

### M0.1 — 운영자 GitHub owner 자격 확인

운영자가 GitHub.com 에 로그인 + 운영자 자신 (`HanSap` 또는 현재 GitHub
username) 이 새 org 의 owner 자격 가능 확인.

```
사전 사실 (Pieter 진단, 2026-05-10):
- GitHub user `Arbitoria` (id 261937864) — 운영자 본인 소유?
  • 본 user 가 운영자 본인이라면 → org `ARBITORIA` 이름 충돌 가능 (T3 분기 검토)
  • 본 user 가 별개 계정이라면 → 운영자 본인 다른 GitHub 계정 (예: kimwonmin91)
    으로 새 org 생성 + Slim repo 이전 시 *원 owner 권한* 필요
```

**운영자 회신 요청 (M0)**:

```
[운영자 회신 형식]
1. GitHub user `Arbitoria` (id 261937864) = 운영자 본인 ?
   ✅ yes (본인 다른 계정) / ❌ no
2. 현재 git push 권한자 GitHub username = ___________
3. 새 org 운영자 owner 자격 가능 ? ✅ yes / ❌ no
```

운영자 회신에 따라 M0.2 분기.

### M0.2 — org 이름 가용성 사전 확인 (ADR-0019 §검증 1)

운영자가 GitHub.com → Settings → Organizations → New organization →
`ARBITORIA` 입력 → 가용성 표시 확인 (commit 안 함, 가용성만).

| 결과 | 분기 |
|---|---|
| ✅ `ARBITORIA` 가용 | M1 진행 (옵션 A) |
| ❌ `ARBITORIA` 충돌 (case-insensitive `Arbitoria` user 와 매칭) | T3 분기 검토 |

**T3 분기**:

| 분기 | 옵션 | 추가 비용 |
|---|---|---|
| **분기 A** | org 이름 = `ARBITORIA-BE` 또는 `Arbitoria-Org` | 0 (헌장 명확성 손실 — ADR Amendment 필요) |
| **분기 B** | personal user `Arbitoria` rename → `kimwonmin91-arb` (또는 운영자 재량) → 새 org `Arbitoria` 생성 | 0 (옛 personal repo redirect 자동) |

**권장**: 분기 B (personal rename + org `Arbitoria`) — 헌장 단일성 보존. 단
운영자 재량.

---

## M1 — GitHub org `ARBITORIA` 생성 (운영자, 5분)

### 단계

1. GitHub.com 로그인 (운영자 owner 계정)
2. 우상단 프로필 → **Settings** → 좌측 **Access** → **Organizations**
3. **New organization** 버튼
4. **Free plan** 선택 (Team $4/user/month 거부 — ADR-0019 §T4 비용 영향 0)
5. Organization name = `ARBITORIA` (또는 T3 분기 결과)
6. Contact email = `kim.wonmin91@gmail.com`
7. This organization belongs to: **My personal account** (사업체 명의로
   변경은 TVA 발급 후 별도 — ADR-0019 §T1 미래 회귀 트리거)
8. 다음 단계는 *건너뛰기 가능* (Invite members → 솔로 사이드 0명 / Verify
   email 등은 추후)

### 검증

- 운영자 GitHub.com 우상단 프로필 → 조직 목록에 `ARBITORIA` 표시
- `https://github.com/ARBITORIA` URL 접속 → org 페이지 정상

### 롤백

- 운영자 ARBITORIA org Settings → "Delete this organization" → 이름 typing
  확인 → 즉시 삭제 가능 (멤버 0 + repo 0 상태에서)

---

## M2 — Slim repo 이전 (운영자, 2분)

### 단계

1. `https://github.com/Arbitoria/slim` 접속
2. **Settings** 탭 → 하단 **Danger Zone**
3. **Transfer ownership** 또는 **Transfer** 버튼
4. New owner = `ARBITORIA` (Step M1 신설 org)
5. Repository name = `slim` (그대로 유지)
6. Repository name 입력 typing 확인 → **I understand, transfer this repository**

### 검증

- 새 URL `https://github.com/ARBITORIA/slim` 접속 → repo 페이지 정상
- 옛 URL `https://github.com/Arbitoria/slim` 접속 → 새 URL 자동 redirect
- Issues / PR / Wiki / Stars / Watchers / Webhooks / Secrets 보존 확인 (UI
  점검):
  - Issues 개수 (이전 후 동일)
  - GitHub Actions secrets (있으면) 보존
  - Branch protection 룰 (D.1.c — main 보호) 보존
  - Webhooks (GitHub Actions trigger 등) 보존

### 롤백

- 옛 owner (Arbitoria personal user) 가 Settings → Danger Zone → Transfer
  ownership → 다시 personal user 로 이전 (운영자가 양쪽 owner 자격 시 가능)

---

## M3 — 로컬 git remote 갱신 (Pieter, 1분)

### 단계

```bash
# 현재 working directory: C:\Users\kimwo\slim (Pieter 작업 디렉토리)
git remote -v
# 출력: origin https://github.com/Arbitoria/slim.git (fetch + push)

git remote set-url origin https://github.com/ARBITORIA/slim.git
git remote -v
# 출력: origin https://github.com/ARBITORIA/slim.git (fetch + push)

git fetch origin
# 출력: 정상 fetch (자동 redirect 가 transparent 동작)
```

### 검증

- `git remote -v` → 새 URL
- `git fetch origin` → 0 에러 + 최근 commit hash 그대로
- `git log -1 --pretty=format:"%H %an <%ae>"` → 기존 commit author 보존
  (운영자 개인, T1 옵션 A)

### 롤백

```bash
git remote set-url origin https://github.com/Arbitoria/slim.git
```

---

## M4 — Vercel + GitHub App 재연결 (운영자, 5분)

### 단계

1. `https://vercel.com/arbitoria/slim/settings/git` 접속 (운영자 ARBITORIA
   team 의 slim 프로젝트)
2. **Connected Git Repository** 섹션 확인
   - 표시 = `Arbitoria/slim` (옛 URL) → repo 이전 후 *연결 끊김 가능* 또는
     *redirect 로 자동 동작* (둘 다 가능 — Vercel 측 처리 의존)
3. 연결 끊김 시 → **Disconnect** → **Connect Git Repository** → "Adjust
   GitHub App Permissions" 클릭
4. Vercel GitHub App 설치 페이지 → ARBITORIA org 선택 → "All repositories"
   또는 "Only select repositories" → slim 선택 → **Install**
5. Vercel 으로 돌아가서 → **Connect Git Repository** → ARBITORIA/slim 선택 →
   **Connect**
6. **Settings → Environment Variables** 점검 (보존 확인):
   - DATABASE_URL (production + preview) 보존
   - EXPECTED_DB_ENDPOINT (production + preview) 보존
   - INNGEST_EVENT_KEY (production + preview) 보존
   - INNGEST_SIGNING_KEY (production + preview) 보존
   - 합 8 항목 그대로 (ADR-0015 §T3)

### 검증

- Vercel project Settings → Git → Connected Git Repository = `ARBITORIA/slim`
- Settings → Environment Variables → 8 항목 보존
- M7 (다음 단계) 의 임시 PR 에서 Vercel preview build 자동 트리거 확인

### 롤백

- Vercel project Settings → Git → Disconnect → opt: Vercel project 자체 삭제
  + 새로 import. 단 *환경변수 + build history 손실* — 권장하지 않음.
- repo 자체를 Arbitoria personal 로 다시 이전 (M2 롤백) → Vercel 자동 redirect
  검증

---

## M5 — Neon GitHub Integration 점검 (운영자, 3분)

### 단계

1. `https://console.neon.tech` 접속 → ARBITORIA org → Slim 프로젝트
2. 좌측 **Settings** → **Integrations** (또는 좌측 **Integrations** 탭) 확인
3. 분기:
   - **GitHub Integration 미설치** → 추가 행동 0 (Vercel-managed integration
     이 webhook 으로 DATABASE_URL 주입 — Neon 측 GitHub URL 갱신 불필요)
   - **GitHub Integration 설치됨** → repo URL 갱신:
     - Disconnect 옛 `Arbitoria/slim`
     - Connect 새 `ARBITORIA/slim`
     - 또는 Integration Settings 에서 repo 재선택

### 검증

- Neon Console Slim 프로젝트 Branches 탭 → production (`ep-fancy-fog-alt18340`)
  + preview (`ep-autumn-water-all6d93e`) 그대로
- 로컬에서 `pnpm verify:db` 실행 → ✅ allowlist 통과 (ADR-0018 §결정 3)
- M7 임시 PR → Vercel preview build 시 DATABASE_URL 정상 주입 확인

### 롤백

- Neon Console Integration → Disconnect → 추가 행동 0 (Vercel webhook injection
  은 Neon Integration 과 독립)

---

## M6 — git config user.name/email 결정 (운영자 + Pieter, 2분)

### 단계 (ADR-0019 §T1 옵션 A 채택 시)

```bash
# 현재 상태 확인
git config user.name
# 출력 예: kimwonmin91-4132

git config user.email
# 출력 예: kim.wonmin91@gmail.com
```

**옵션 A 채택 시**: 행동 0 (현 상태 유지).

**옵션 B 채택 시 (미래 회귀 트리거 발동 후)**:
```bash
git config user.name "ARBITORIA Bot"
git config user.email "noreply@arbitoria.be"
```

**옵션 C 채택 시**: commit message trailer 자동화 → PLAN 1.5.x 부채 신설 후
별도 작업.

### 검증

- `git config user.name` + `git config user.email` 출력 = 운영자 결정 정합
- 다음 commit (M7 임시 PR) 의 author = 결정 정합

### 롤백

```bash
git config user.name "<옛 값>"
git config user.email "<옛 값>"
```

---

## M7 — 임시 PR 검증 (Pieter, 5분)

### 단계

```bash
# 임시 브랜치 생성
git checkout -b chore/adr-0019-migration-verify

# docs 변경 (예: docs/adr/INDEX.md 본 ADR 추가 — M8 작업 전반)
# Edit/Write 도구로 .md 파일 변경
# (Bash heredoc 보안 패턴 회피 — CLAUDE.md §8 #6 정합)

git add docs/adr/INDEX.md docs/adr/0019-arbitoria-three-platform-alignment.md docs/arbitoria-migration-runbook.md
git commit -m "docs(adr-0019): ARBITORIA 3 platform alignment ADR + runbook"

git push -u origin chore/adr-0019-migration-verify
# 출력: 정상 push (새 ARBITORIA/slim repo 에)
```

GitHub UI 에서 PR 생성:
1. `https://github.com/ARBITORIA/slim/compare/main...chore/adr-0019-migration-verify`
2. **Create pull request**

### 검증 (병렬)

#### Vercel preview build (M4 검증)
- PR 페이지 → Vercel bot comment → preview URL 확인
- Vercel preview build ✅ 결과
- preview URL 200 응답 + 페이지 정상 렌더

#### GitHub Actions CI (검증 4)
- PR 페이지 → Checks 탭 → ci.yml 워크플로 트리거
- 4단 게이트 (typecheck → test → harness:plan → harness:data) ✅
- main 브랜치 보호 규칙 (D.1.c) 활성 보존 → ✅ 통과 시 PR 머지 가능 표시

#### Neon DATABASE_URL injection (M5 검증)
- Vercel build 로그 → DATABASE_URL 정상 주입 확인 (build 자체 성공이 신호)

### 머지 + 정리

PR 검증 통과 시:
- PR 페이지 → **Merge pull request** (또는 운영자 manual review 후 머지)
- `git checkout main && git pull` (로컬 동기화)
- `git branch -d chore/adr-0019-migration-verify` (로컬 브랜치 정리)

### 롤백

- PR Close (머지 안 함) — 단 docs/adr/0019 + runbook 은 머지 권장 (산출물
  보존)

---

## M8 — ADR-0017/0018 References 보강 (Pieter, 3분)

### 단계 (ADR-0019 §T5 정책)

본 작업은 M7 PR 안에서 함께 commit 또는 별도 PR 로 분리.

**ADR-0017 §References 추가**:

```markdown
- [ADR-0019](0019-arbitoria-three-platform-alignment.md) — 본 사건의 후속
  정렬 (GitHub org 신설 + Slim repo 이전).
```

**ADR-0018 §References 추가**:

```markdown
- [ADR-0019](0019-arbitoria-three-platform-alignment.md) — 본 ADR §결정 1 의
  GitHub 적용 (org 신설 + Slim repo 이전). ADR-0019 가 본 ADR §결정 1 헌장을
  *완성*.
```

**ADR-0018 §결정 6 끝에 인용 1줄**:

```markdown
> 본 ADR §결정 6 (4단계 절차) 의 *동형 패턴* — GitHub org 추가 + repo 이전
> 절차는 ADR-0019 §Migration Plan + arbitoria-migration-runbook.md 참조.
```

**`docs/adr/INDEX.md` 본 ADR 행 + §설명 섹션 추가** (verifier 책임).

**PLAN.md §1.5.5 본문 인용 1줄 추가**:

```markdown
> 사고 종결 = ADR-0017 + 정책 = ADR-0018 + 3 플랫폼 정렬 = ADR-0019.
```

### 검증

- `pnpm harness:plan` ✅ 통과 (PLAN.md ↔ ADR 인용 정합)
- `docs/adr/INDEX.md` ADR-0019 행 표시
- ADR-0017 + ADR-0018 §References 양방향 링크 확인
- PLAN.md §1.5.5 본문 인용 추가 확인

### 롤백

- 본 ADR Status 가 `Accepted` 미달 (GATE-M 미통과) 시 M8 작업 보류
- 머지된 commit revert 또는 새 PR 로 롤백

---

## 마이그레이션 종합 검증 (M9, 5분)

### 점검 체크리스트

- [ ] M1 — GitHub org `ARBITORIA` 생성 + 운영자 owner 자격
- [ ] M2 — Slim repo 이전 + redirect 동작 + Issues/PR/Webhooks 보존
- [ ] M3 — 로컬 git remote 새 URL + git fetch 정상
- [ ] M4 — Vercel project Connected Git Repository 새 URL + 환경변수 8 항목
      보존 + GitHub App 권한 ARBITORIA org 부여
- [ ] M5 — Neon GitHub Integration (있으면) 새 URL + `pnpm verify:db` ✅
- [ ] M6 — git config user.name/email = 운영자 결정 (T1 옵션 A 또는 분기)
- [ ] M7 — 임시 PR Vercel preview build ✅ + GitHub Actions CI ✅ + main
      보호 규칙 활성 보존
- [ ] M8 — ADR-0017/0018 §References 보강 + PLAN.md §1.5.5 인용 + INDEX.md
      갱신

### 운영자 종결 보고 (Pieter 에 회신)

```
[ARBITORIA 마이그레이션 종결 보고]

GitHub:
  - 새 org: ARBITORIA (또는 분기 결정)
  - 새 repo URL: https://github.com/ARBITORIA/slim
  - 옛 redirect 동작: ✅ / ❌
  - Issues/PR/Secrets/Webhooks 보존: ✅ / ❌
  - main 브랜치 보호 규칙: ✅ / ❌

Vercel:
  - GitHub App 권한 ARBITORIA org 부여: ✅ / ❌
  - Connected Git Repository 새 URL: ✅ / ❌
  - 환경변수 4×2 (DATABASE_URL, EXPECTED_DB_ENDPOINT, INNGEST_*) 보존: ✅ / ❌
  - 임시 PR preview build: ✅ / ❌

Neon:
  - GitHub Integration 상태: 미설치 / 설치 + 갱신
  - production endpoint (ep-fancy-fog-alt18340): ✅
  - preview endpoint (ep-autumn-water-all6d93e): ✅
  - pnpm verify:db: ✅ / ❌

git:
  - remote URL 갱신: ✅
  - commit author 보존 (T1 옵션 A): ✅

분기 결정:
  - T3 (personal user `Arbitoria` 처리): 그대로 / rename → ___
  - org 이름 충돌 분기: 없음 / 분기 A (`ARBITORIA-BE`) / 분기 B (personal rename)

ADR / PLAN 갱신:
  - ADR-0017 §References 인용: ✅
  - ADR-0018 §References 인용: ✅
  - INDEX.md ADR-0019 행 추가: ✅
  - PLAN.md §1.5.5 인용: ✅
```

운영자 회신 후 Pieter 가 ADR-0019 Status `Proposed` → `Accepted` 격상.

---

## 롤백 시나리오 (전체)

마이그레이션 도중 *어느 단계라도* 차단 발견 시:

### 시나리오 1 — M1/M2 단계에서 org 이름 충돌 (T3 분기 A 또는 B)

ADR-0019 Amendment 진입:
- 분기 A 채택 시 → org 이름 `ARBITORIA-BE` 또는 `Arbitoria-Org` → ADR Amendment
  + ADR-0018 §결정 1 헌장 인용 갱신
- 분기 B 채택 시 → personal user rename 후 org `Arbitoria` 생성 → ADR Amendment
  + 운영자 ID 변경 추적 (FOUNDER.md §1)

### 시나리오 2 — M4 단계에서 Vercel 재연결 실패

- Vercel project 삭제 + 새로 import (환경변수 8 항목 재등록 부담 — ADR-0015
  §Step-3-prime 재실행)
- 환경변수 백업: 운영자가 사전 `pnpm dlx vercel@latest env pull .env.backup
  --environment=production` (M0 사전 단계로 격상)

### 시나리오 3 — M5 단계에서 Neon DATABASE_URL injection 실패

- Vercel build 환경변수에 DATABASE_URL 수동 등록 (Neon Console pooled
  connection string 직접 입력)
- ADR-0017 §결정 2 EXPECTED_DB_ENDPOINTS allowlist 그대로 유지

### 시나리오 4 — M7 단계에서 ci.yml 또는 main 보호 규칙 미동작

- main 브랜치 보호 규칙 재활성 (운영자 GitHub UI Settings → Branches → main →
  Require status checks)
- ci.yml 자체 변경 0 — D.1.b/d 이미 머지됨 (전체 commit `175ba9d` + `4718d72`)

### 전면 롤백 (마이그레이션 자체 취소)

1. M2 역순 — 새 ARBITORIA/slim → 옛 Arbitoria/slim 으로 다시 이전 (운영자
   양쪽 owner 자격 시 가능)
2. M3 역순 — `git remote set-url origin https://github.com/Arbitoria/slim.git`
3. M4 역순 — Vercel project Settings → Git → 옛 URL 재연결 (자동 redirect 로
   transparent 가능성)
4. M1 역순 — 새 ARBITORIA org 삭제 (멤버 0 + repo 0 상태)

전면 롤백 시 ADR-0019 Status → `Rejected` 격상 + 거부 사유 기록.

---

## 사후 점검 (M9+1주, M9+1개월)

ADR-0018 §결정 5 (자산 라이프사이클) 정합 — 본 마이그레이션은 *자산 추가*
이므로 라이프사이클 X. 단 다음 정기 점검:

- **M9+1주 (2026-05-17, ADR-0017 personal org 모니터링과 동시)**:
  - 운영자 ARBITORIA org / Slim repo 이상 신호 0 확인
  - Vercel build 7일간 ✅ 비율 ≥ 95% 확인
  - GitHub Actions CI 7일간 ✅ 비율 ≥ 95% 확인
  - Pieter 작업 시 git push / fetch 0 에러 확인

- **M9+1개월 (2026-06-10, ADR-0017 slim-prod 삭제 결정과 동시)**:
  - GitHub Free org 한도 사용량 점검 (CI/CD 2,000분/월의 활용률)
  - Vercel + Neon ARBITORIA team/org 자산 일관 확인
  - ADR-0019 §회귀 트리거 #4 (협업자 추가 검토) — TVA 발급 진척 확인

- **매월 1일 self-check (ADR-0018 §결정 4 동기)**:
  - GitHub: ARBITORIA org Slim repo 단일 + 운영자 personal user 별 자산 점검
  - Vercel: ARBITORIA team Slim 프로젝트 단일
  - Neon: ARBITORIA org Slim 프로젝트 단일

---

## References

- [ADR-0019](adr/0019-arbitoria-three-platform-alignment.md) — 본 runbook 의
  헌장 ADR
- [ADR-0017](adr/0017-db-mismatch-incident-postmortem.md) — DB 미스매치 사건
  종결 (cleanup 일정 동기)
- [ADR-0018](adr/0018-neon-multi-org-policy.md) — Neon 멀티 org 정책 (매월
  self-check)
- [ADR-0015](adr/0015-vercel-integration-and-d1-closure.md) — Vercel 통합
  운영 (Step-3-prime 동형 패턴)
- [`CLAUDE.md`](../CLAUDE.md) — §8 #6 (Bash 보안 룰 정합)
- [`PLAN.md`](../PLAN.md) — §1.5.5 본문 인용 추가 대상

### 외부 사실

- [GitHub Pricing](https://github.com/pricing) — Free org $0/month
- [GitHub Docs — Transferring a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository)
  — 자동 redirect + 자동 이전 항목
- [GitHub Docs — Creating a new organization](https://docs.github.com/articles/creating-a-new-organization-from-scratch)
- [Vercel Docs — Deploying GitHub Projects](https://vercel.com/docs/git/vercel-for-github)
  — GitHub App 권한 + repo 재연결 절차
- [Neon Docs — GitHub Integration](https://neon.com/docs/guides/neon-github-integration)
  — Vercel-managed vs Neon-managed integration 분기
