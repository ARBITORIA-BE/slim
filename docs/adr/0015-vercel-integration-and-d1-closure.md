# ADR-0015: Vercel 통합 운영 결정 + PLAN D.1 마감 게이트

## Status

**Accepted (2026-05-10)** — GATE-H 운영자 승인 완료. 단 운영자 정정 사항으로
Step 3 *재정의* (§Amendment 1 / §Step-3-prime 참조):

> 원래 가정: 운영자가 Vercel을 *처음 가입*. 실제 상태: Vercel 가입 + GitHub
> OAuth 연동 (ARBITORIA org) + Slim repo Vercel 프로젝트 연결 (slim-gamma.vercel.app)
> + 자동 build 트리거 *모두 이미 완료*. 따라서 §Operator-Action-Step3는 *신규
> 가입 가이드*가 아니라 §Step-3-prime — *현 셋업 점검 + 보강*으로 대체.
>
> 7개 결정(T1~T7)은 그대로 유효. T7만 *Step 3' (audit + reinforce)*로 의미 재해석.

GATE-H 통과 후 진행 순서: §Step-3-prime (현 Vercel 점검 + 보강) → Step 2
(Pieter 임시 PR 양성/음성 테스트) → Step 4 (verifier D.1 [x]).

본 ADR은 **결정 + 운영 가이드** 만 담는다. 코드/설정 변경은 D.1.a~D.1.d
(ADR-0002 본문 + Amendment 1) 에 이미 반영됨. 본 ADR은 D.1의 *운영 단계*
(=실제 Vercel 가입 + PR 차단 검증) 를 닫는 헌장.

## Context

### 본 ADR이 풀어야 하는 모호함

ADR-0002 + Amendment 1은 **검증 권한 분리** 라는 헌법 결정을 마쳤다:
- Vercel = 순수 빌드 머신 (`ignoreBuildErrors` + `ignoreDuringBuilds`)
- 검증 = 로컬 stop-gate + GitHub Actions CI (4단 게이트)

하지만 ADR-0002는 **Vercel 자체의 운영 정책** (자동 배포 ON/OFF, 환경변수
분리 정책, PR comment 통합 방식, 운영자 가입 절차) 을 결정 *외부* 로 둠. 그
결과 PLAN §D.1 DoD 4건 중 #2 (Vercel preview 배포 1회 성공) + #3 (PR 차단
검증) 가 *실제 운영* 측면에서 닫히지 않은 상태:

| DoD | 상태 (2026-05-09) | 차단 사유 |
|---|---|---|
| #1 `next build` 로컬 통과 | ✅ 통과 | D.1.a 적용됨 |
| #2 Vercel preview 배포 1회 성공 | ⏳ 미검증 | 운영자 Vercel 가입 미완료 |
| #3 typecheck 깨는 PR이 GitHub Actions에서 차단 | ⏳ 미검증 | 임시 PR 미생성 |
| #4 D.1.d 적용 후 ci.yml이 4단 게이트로 안정 동작 | ✅ 통과 | D.1.d 머지됨 |

ADR-0011 §결정 6 (`/data-sources` RSC + ISR 1h) + ADR-0008 §T9
(`app/api/inngest/route.ts` Vercel function) 은 **Vercel production 환경을
의존**. 즉 운영자 Vercel 가입 + 환경변수 등록 + 자동 배포 정책이 결정되지
않으면 페이즈 1 종료 게이트 (1.10 + 1.6/1.7 운영) 가 막힌다.

### 본 ADR이 기록하는 의사결정 7개

T1 CI/CD 흐름, T2 자동 배포 정책, T3 환경변수 분리, T4 Inngest 키 정책,
T5 Build gate 정책, T6 PR comment 통합, T7 운영자 가입 절차.

### 외부 사실 (검증된 출처 — 2026-05-09)

#### Vercel Hobby (Free) tier 한도 ([Vercel Pricing](https://vercel.com/pricing))

| 자원 | 한도 (Hobby) | 본 프로젝트 추정 사용 |
|---|---|---|
| Fast Data Transfer (bandwidth) | **100 GB/월** included | 페이즈 1 < 1 GB/월 (운영자 자가 테스트만) |
| Vercel Functions invocations | **1M/월** included | Inngest webhook ≈ 60/월 (cron 1회/일 × 2 fetcher) + 페이지 SSR < 1k/월 |
| Edge Requests | **1M/월** included | RSC + ISR 1h (`/data-sources`) |
| Deployments | "Unlimited" 명시 | preview build = git push마다 1회 (페이즈 1 < 30/월) |
| Build minutes | 명시 부재 (paid에서만 명시) | 추정: build 1회 ≈ 1-3분, 안전 |
| Automatic CI/CD (Git) | ✅ 포함 | T1/T2 결정 입력 |
| PR Preview | ✅ 포함 (별도 명시 없으나 표준 기능) | T6 결정 입력 |

**계산**: 페이즈 1 시점 사용량은 무료 한도의 0.1% 미만. 페이즈 4 베타
(M8~M10) 진입 시 재평가 (ADR-0004 §결정 2 격상 트리거).

#### Vercel + Neon 통합 ([Neon Docs — Vercel-managed integration](https://neon.com/docs/guides/vercel-managed-integration))

- **Preview branch per deploy**: Vercel preview 배포마다 *Neon branch*
  자동 생성 (`preview/<git-branch>` 명명 규칙). copy-on-write — production
  브랜치 데이터 격리 + 비용 0 (사용 시점에만 storage).
- **DATABASE_URL 자동 주입**: 통합 설치 시 production / preview /
  development 환경별로 *다른* connection string 자동 등록. preview는 위 임시
  branch 가리킴. **Vercel project env vars UI에서는 보이지 않음** (webhook
  주입).
- **Connection pooling**: 통합이 두 변수 노출:
  - `DATABASE_URL` (PgBouncer pooled, *RSC + serverless에 권장*)
  - `DATABASE_URL_UNPOOLED` (direct, migrations 등 트랜잭션 필수 케이스)
- **Free tier 호환**: Neon Free + Vercel Hobby 둘 다 허용 (명시 부재 부분은
  운영자 가입 시 확인 — Step 3 §검증 4).

#### Vercel auto-deploy 제어 ([Vercel — Managing Deployments](https://vercel.com/docs/deployments/managing-deployments) + [Git Configuration](https://vercel.com/docs/project-configuration/git-configuration))

- **기본 동작**: 모든 push에 deploy (preview = 모든 branch, production =
  Production Branch = main 자동 promote)
- **production 자동 promote 끄기 옵션**:
  1. **Settings → Git → Ignored Build Step** = `[ "$VERCEL_ENV" != "preview" ] && exit 1`
     로 production build skip — 단점: build 자체가 안 돌아 검증 불가.
  2. **vercel.json `git.deploymentEnabled.main = false`** — main push도
     아예 빌드 안 함. 단점: production 환경이 영영 stale.
  3. **Auto-promote 끄기** (권장): Settings → Git에서 main을 "non-production
     branch"로 두고 production은 manual promote (Deployments 페이지 ⋯ →
     "Promote to Production"). 운영자 명시 결정과 정합.

#### Vercel for GitHub PR comment ([Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github))

- 기본: PR마다 Vercel bot이 preview URL + 빌드 status 자동 comment
- 끄기: Settings → Git → Connected Git Repository 토글 (선택사항, 운영자
  자유)
- GitHub Actions와 별개: GitHub Actions 결과는 *checks* 영역, Vercel comment
  는 *PR comment* 영역. 둘이 충돌 없음.

#### Vercel system env vars (위 GitHub 통합 문서)

- `VERCEL_ENV` (production / preview / development) — 빌드 + 런타임에서
  접근 가능. T3 환경변수 분기에 사용 가능 (단 ADR-0015는 분기 코드 도입
  안 함, EXPECTED_DB_ENDPOINT 단일 가드로 대체).

### 운영자 컨텍스트 ([`docs/FOUNDER.md`](../FOUNDER.md))

- 솔로 사이드, 주 10-20시간, 월 €300 ALL-IN
- 무료 티어 우선 (Vercel Hobby + Neon Free)
- Vlaio/LU 그랜트 TVA 직후 1주 결정 (ADR-0004 §결정 6)
- Vercel 가입은 **이번이 처음** — 운영자가 단계별 명시 가이드 필요
- 운영자 명시 결정: *"자동 배포는 OFF (페이즈 4까지)"* — 베타 미시작 +
  데이터 정합성 우선

## Decision

T1~T7 7개 결정.

### T1 — CI/CD 흐름 = 동시 실행 (옵션 A 채택)

GitHub push → Vercel preview build *동시* + GitHub Actions CI 워크플로
(4단 게이트) *동시* 실행. PR에 둘 다 결과 노출 (T6 §통합).

```
git push origin feature-branch
    │
    ├──→ GitHub Actions: ci.yml (4단 게이트)
    │       typecheck → test → harness:plan → harness:data
    │       결과: PR Checks UI ✅/❌
    │
    └──→ Vercel: preview build
            next build (typecheck/eslint skip — D.1.a)
            결과: Vercel bot PR comment + Checks
```

**근거**:
- **fail-fast 정신**: 두 게이트가 직렬이면 한쪽 깨질 때 다른 쪽이 못 시작 →
  운영자 디버깅 시간 2배. 동시 실행 시 PR 한 번에 양쪽 신호 받음.
- **무료 티어 부담 0**: GitHub Actions Free (public repo 무제한) + Vercel
  Hobby (deployments unlimited). 동시 실행이 무료 한도에 영향 0.
- **검증 권한 단일성 (ADR-0002 정신)**: GitHub Actions가 *PR 차단 진실원* —
  Vercel 빌드는 부수 신호 (preview URL 확보 + production 호환성). 둘이 같은
  것을 검사하지 않음 (Vercel은 빌드만, CI는 typecheck/test).
- **운영자 학습 가치** (FOUNDER.md §5): 두 신호의 *역할 차이*가 한눈에
  보임 — Vercel = 빌드 가능성, CI = 코드 품질.

**거부된 옵션 B (CI 먼저, Vercel 후)**: GitHub Actions가 *Vercel을 트리거*
하는 워크플로 작성 부담 + Vercel 자체의 GitHub 통합을 무력화 (불필요한
중복). CI fail 시 preview URL 자체가 안 만들어져 *수동 디버깅 시 preview를
못 봄*. 거부.

**거부된 옵션 C (Vercel 자동 deploy 끄고 CI만)**: Vercel을 *수동 deploy*
도구로 격하 → preview URL이 PR마다 자동 생성 안 됨 → 페이즈 4 베타 모집 시
운영자가 매번 manual deploy. 솔로 시간 압박 (FOUNDER.md §2). 거부.

### T2 — 자동 배포 정책 = production OFF + preview ON (옵션 B 채택)

운영자 명시 결정 정합:
- **preview 자동 배포**: ✅ ON — 모든 git push (모든 branch + PR) 에서
  preview 빌드 자동
- **production 자동 promote**: ❌ OFF — main push가 자동으로 production에
  promote *되지 않음*. 운영자가 Vercel dashboard에서 *명시적 manual promote*
  (Deployments → ⋯ → "Promote to Production")

**구현 방법** (운영자 가입 시 Step 3.4 — Settings → Git):
- *"Auto-assign Custom Domains"* (Production Branch = main) 토글을 OFF로
  두는 옵션 + Deployments 화면에서 manual promote만 사용

또는 — Vercel UI 변경 시 대안:
- vercel.json `git.deploymentEnabled.main = true` 유지 (build는 함) +
  운영자가 *promote 행위만 manual*. 빌드 자체는 main에서도 돌아 회귀 신호
  확보 가능.

본 ADR은 **두 번째 방법 권장** — main build는 ON, **production promote만
OFF**. 빌드 회귀 (Vercel 환경 specific 빌드 깨짐) 를 main push 시점에 잡음.

**근거**:
- **베타 미시작 + 데이터 정합성**: 운영자가 production을 *언제* 사용자에게
  공개할지 통제 — 헌법 P3 (투명성) 정신 (사용자에게 stale data 보이지
  않도록).
- **운영자 명시 결정 정합**: FOUNDER.md §5 (메타 질문 우선) 와 일관 — 자동
  promote OFF가 *운영자 정렬* 우선.
- **롤백 옵션 보존**: production이 한 번 promote되면 이전 버전으로 instant
  rollback 가능 (Vercel 표준 기능). 자동 promote가 OFF면 운영자가 *언제*
  새 버전을 사용자에게 노출할지 선택 가능.
- **페이즈 4 진입 시 재평가**: 베타 시작 (M8~M10) 시 자동 promote ON 검토
  — 별도 ADR 트리거 (회귀 트리거 #1).

**거부된 옵션 A (production 자동 ON)**: 베타 미시작 시점에 main push가
*즉시* 사용자에게 노출 — 운영자가 의도하지 않은 배포 위험. 솔로 컨텍스트
(주 10-20h) 에서 빠른 사고 대응 어려움. 거부.

**거부된 옵션 C (production 보호 + preview만 자동)**: deployment-protection
은 production *접근* 만 막음, *promote* 는 막지 않음 → T2 의도 (운영자가
promote 결정) 와 다름. 거부.

### T3 — 환경변수 분리 = production / preview 분리 (옵션 A 채택)

| 환경 | DATABASE_URL | EXPECTED_DB_ENDPOINT | 비고 |
|---|---|---|---|
| **production** | `ep-fancy-fog-alt18340` (현재 endpoint) | `ep-fancy-fog-alt18340` | 운영자 명시 production 브랜치 |
| **preview** | Neon dev branch (운영자 신규 생성) | (Neon dev branch endpoint) | Vercel preview build 격리 |
| **development** (로컬) | `.env.local` 의 `ep-fancy-fog-alt18340` (운영자 자가 테스트 시) 또는 dev branch | 동일 | 로컬은 운영자 재량 |

**구현 방법** (운영자 가입 시 Step 3.5 — Vercel Settings → Environment
Variables):
1. **production**: `DATABASE_URL` = production endpoint connection string,
   `EXPECTED_DB_ENDPOINT` = `ep-fancy-fog-alt18340`
2. **preview**: Neon Console → Branches → "Create branch" (이름 = `dev`,
   parent = production) → connection string 복사 → Vercel preview env에
   등록. `EXPECTED_DB_ENDPOINT` = 새 endpoint name.
3. **development**: 운영자 로컬 `.env.local` 그대로 (변경 X).

**근거**:
- **EXPECTED_DB_ENDPOINT 가드와 정합** (PLAN 1.5.5 / `scripts/verify-db.ts`):
  운영자는 본인 머신에서 `pnpm verify:db` 실행 시 production endpoint 확인
  가능. preview는 Vercel build 환경 (운영자 머신 아님) — 가드는 build 시점에
  실행 안 함, 단 production endpoint와 *다른 endpoint* 임을 보장하면 OK.
- **데이터 오염 방지**: Vercel preview build가 production endpoint에 connect
  하면 — 잘못된 fetcher가 production에 데이터 쓸 위험. preview branch
  격리는 이 위험을 0으로.
- **Neon-Vercel 통합 옵션 (대안)**: `Neon-managed integration` 이 preview
  branch *자동* 생성 가능 ([Neon docs](https://neon.com/docs/guides/vercel-managed-integration)).
  본 ADR은 **수동 dev branch + Vercel UI에서 직접 등록** 권장 — 운영자
  학습 가치 + 무료 티어 명확성 + Vercel project env vars UI에서 *눈에
  보이게* (자동 통합은 webhook 주입이라 UI에 안 보임 — 디버깅 어려움).
- **단일 운영자 (FOUNDER.md §1)**: 자동 통합의 magic 보다 *명시적 4 변수
  등록* 이 솔로 디버깅에 유리.

**거부된 옵션 B (모두 같은 production endpoint)**: 단순하지만 preview build
실패 시 production 데이터 손상 가능. ADR-0007 §T4 (PII 90일 NULL화) 의 가정
(production endpoint = 정직한 운영자 통제) 위반. 거부.

**거부된 옵션 C (production read replica)**: Neon Free tier는 read replica
미제공 (paid). 월 €300 cap 위반 (ADR-0004). 거부.

### T4 — Inngest 키 정책 = production / preview 같은 키 (옵션 A 채택)

| 환경 | INNGEST_EVENT_KEY | INNGEST_SIGNING_KEY |
|---|---|---|
| **production** | 정식 키 (운영자가 Inngest dashboard에서 발급) | 동일 |
| **preview** | 같은 production 키 | 동일 |
| **development** (로컬) | 키 없음 → Inngest auto dev mode | 키 없음 |

**근거**:
- **ADR-0008 §T9 정합**: 환경변수 부재 시 Inngest는 자동 dev mode (로컬
  devserver). 두 키 모두 production 환경에만 필요.
- **무료 티어 부담 0**: Inngest Free 50k executions/월 한도 (ADR-0008 외부
  사실). 페이즈 1 시점 추정 사용 90 events/월 — 한도의 0.18%. preview에서
  cron이 추가로 발화해도 0.4% 미만.
- **단순성 우선 (솔로)**: 환경별 키 분리는 운영 복잡도 + Inngest 가입 시
  추가 app 생성 필요 — 솔로 시간 압박. preview build는 일반적으로 cron을
  발화시키지 않음 (build 시점에는 cron 트리거 X) — 키 공유의 실 위험 0.
- **회귀 트리거**: preview에서 의도치 않게 production cron이 발화 (수동
  `fetchers/run.requested` 이벤트) 한 사례 1건 → 환경별 키 분리 ADR
  Amendment.

**거부된 옵션 B (환경별 키 분리)**: Inngest app 2개 (slim-prod + slim-preview)
+ 환경변수 6개 — 운영 복잡도 ↑, 솔로 학습 부담 ↑. 페이즈 1 시점 가치 0.
거부.

### T5 — Build gate 정책 = Vercel 순수 빌드 + GitHub Actions가 4단 게이트 (옵션 A 유지 — ADR-0002 헌장 정합)

ADR-0002 §결정 1 + Amendment 1 그대로 유지. 본 ADR은 *추가 결정 없음* — 명시
재확인:

- **Vercel build = 순수 빌드** (`ignoreBuildErrors: true` +
  `ignoreDuringBuilds: true`). 빌드 자체 깨지면 Vercel UI에 ❌, 그 외 검사
  Vercel은 안 함.
- **GitHub Actions CI = 4단 게이트** (typecheck → test → harness:plan →
  harness:data). main 브랜치 보호 규칙 = CI 통과 필수 (D.1.c — 운영자 GitHub
  UI 수동 작업).
- **Vercel `buildCommand` 변경 X** — 옵션 B (Vercel build에 게이트 묶기)
  거부. ADR-0002 §대안 §옵션 D 와 동형 거부 사유: fail-late + 이중 강제
  복잡도 ↑ + Vercel build 환경에 pnpm test 의존 추가 부담.

**근거**: ADR-0002 정합. 변경 시 ADR-0002 자체를 재검토해야 함 (회귀 트리거
ADR-0002 #4).

### T6 — PR comment 통합 = 둘 다 (옵션 C 채택)

PR에 다음 두 신호 모두 노출:
1. **GitHub Actions check** (PR Checks 영역) — 4단 게이트 결과 (각 단계별
   ✅/❌)
2. **Vercel bot comment** (PR comment 영역) — preview URL + 빌드 status

**구현 방법** (운영자 가입 시 Step 3.7):
- Vercel: **silence GitHub comments OFF** (즉 comment ON, 기본값) — Settings
  → Git → Connected Git Repository에서 토글 ON 유지.
- GitHub Actions: ci.yml에 별도 PR comment step 추가 X (현 상태 유지). PR
  Checks UI 단계별 status로 충분.

**근거**:
- **운영자 학습 가치 (FOUNDER.md §5)**: 두 신호의 *역할 차이* 가 PR 한 곳에
  나란히 보임 — Vercel = 빌드 + preview URL, GitHub Actions = 코드 품질.
  중복 아님.
- **운영자 부담 0**: 둘 다 *기본값* — 추가 코드 0 + 추가 설정 0 (Vercel
  comment는 가입 시 자동, GitHub Actions Checks는 ci.yml로 자동).
- **노이즈 회피**: PR comment 영역에 Vercel 1개만 (GitHub Actions는 Checks
  영역) — UI 충돌 없음.
- **회귀 트리거**: PR comment 노이즈가 운영자 디버깅 방해 사례 1건 → silence
  comments 토글 ON으로 변경 + ADR Amendment.

**거부된 옵션 A (GitHub Actions가 PR에 직접 comment 추가)**: ci.yml에 추가
job + GitHub token + comment 권한 — 솔로 학습 부담 + 노이즈 ↑. 거부.

**거부된 옵션 B (Vercel만)**: GitHub Actions 결과를 PR Checks에서 *못 봄*
은 거짓 — Checks는 자동. 옵션 B 그대로면 두 신호 다 보임. 즉 옵션 B = 옵션
C 효과 동일. 단 옵션 B는 *Vercel comment 의존* 명시 부재 → 명시 안 한
경우 운영자가 silence 토글 누르면 신호 손실. 거부 (명시성 우선).

### T7 — 운영자 Vercel 가입 절차 (Step 3 가이드, §Operator-Action-Step3 별도 섹션)

**아래 §Operator-Action-Step3 섹션에서 단계별 명시.**

요약:
1. Vercel 가입 → GitHub 연동 → Slim repo import
2. Build & Output Settings 확인 (next build 자동 인식)
3. Environment Variables 4개 등록 (DATABASE_URL, EXPECTED_DB_ENDPOINT,
   INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY) × 2 환경 (production + preview)
4. Settings → Git → Production Auto-promote OFF (T2 적용)
5. Vercel CLI 설치 권장 (옵션, manual promote에 유용)

**Vercel CLI 설치 권장 여부**: ✅ **권장** (필수 아님). 이유:
- `vercel env pull` 로 환경변수 로컬 sync (디버깅에 유용)
- `vercel deploy` 로 manual promote 대안 경로 (T2 - dashboard 외 옵션)
- pnpm 환경에서 `pnpm dlx vercel@latest` 단일 명령 — 글로벌 설치 부담 0

## Alternatives considered (요약)

| Trade-off | 채택 | 거부된 주요 대안 | 거부 사유 |
|---|---|---|---|
| T1 CI/CD | 동시 (옵션 A) | 직렬 (B) / Vercel 끄기 (C) | fail-late 또는 솔로 부담 |
| T2 자동 배포 | production OFF + preview ON (B) | 모두 ON (A) / production 보호 (C) | 운영자 통제 + 베타 미시작 |
| T3 환경변수 | production / preview 분리 (A) | 같은 endpoint (B) / read replica (C) | 데이터 오염 방지 + €300 cap |
| T4 Inngest 키 | production = preview 같은 키 (A) | 환경별 분리 (B) | 단순성 + 무료 티어 부담 0 |
| T5 Build gate | ADR-0002 그대로 (옵션 A) | Vercel buildCommand에 게이트 (B) | fail-late + 이중 강제 |
| T6 PR comment | 둘 다 (C) | GitHub Actions만 (A) / Vercel만 (B) | 명시성 + 노이즈 회피 |
| T7 가입 절차 | 단계별 명시 (§Operator-Action-Step3) | (대안 없음) | — |

## Consequences

### ✅ 얻는 것

- **PLAN D.1 마감 게이트 명확화**: DoD 4건 중 #2/#3을 닫는 *운영 단계
  명세*. Step 2 (Pieter 임시 PR) → Step 3 (운영자 가입) → Step 4 (verifier)
  순서 확립.
- **운영자 가입 부담 최소화**: Step 3 §Operator-Action-Step3가 단계별 + URL
  + 메뉴 클릭 순서 명시 — 운영자 사전 학습 0 가정.
- **무료 티어 정합**: Vercel Hobby (1M function invocations/월) + Neon Free +
  Inngest Free 모두 한도의 1% 미만 사용 — 페이즈 4 베타 진입까지 격상 0.
  ADR-0004 §결정 2 정합.
- **데이터 오염 방지**: T3 (preview에 dev branch) — production 데이터에
  preview build가 쓸 위험 0.
- **운영자 통제 보존**: T2 (production 자동 promote OFF) — 베타 모집 시점
  운영자가 결정. 헌법 P3 정신 (투명성 = 운영자의 짐).
- **롤백 옵션 보존**: Vercel instant rollback 표준 기능 그대로.
- **단일 운영자 학습 곡선 완만화**: T4 (Inngest 단일 키) + T6 (기본값 둘 다)
  — 운영자가 매뉴얼 단계에서 *추가 결정* 안 함.

### ⚠️ 잃는 것 / 부채

- **T2 production 수동 promote**: 베타 시작 시점에 운영자가 *매 배포마다*
  Vercel UI 클릭 — 페이즈 4 진입 시 자동 ON 검토 필요 (회귀 트리거 #1).
- **T4 단일 Inngest 키**: preview에서 의도치 않게 production cron 발화 위험
  — 솔로 운영자가 *수동 트리거 사용 안 함* 가정에 의존. 가정 깨지면 ADR
  Amendment.
- **T3 dev branch 운영 부담**: Neon dev branch 한 개 추가 — Neon Free tier
  branch 한도 ~10개 (운영자 가입 시 확인) 안. 단 dev branch가 production
  schema와 *어긋날* 위험 — `pnpm db:push` 시 *어느 endpoint* 인지 운영자가
  명시적 확인 필요 (PLAN 1.5.5 EXPECTED_DB_ENDPOINT 가드 활용).
- **운영자 가입 1회 부담**: Step 3는 30~60분 추정 (Vercel 가입 5분 + GitHub
  연동 5분 + 환경변수 등록 10분 + Neon dev branch 10분 + 자동 배포 OFF 5분
  + 검증 빌드 10분). 솔로 시간 1회 흡수.
- **Vercel build 로그에서 typecheck 안 보임** (ADR-0002 §결과 ⚠️ 그대로):
  CI 로그에서 봐야 함.

## 검증 방법

본 ADR §검증은 PLAN D.1 DoD 4건과 1:1 매핑.

### 검증 1 — D.1 DoD #1 (`next build` 로컬 통과)

**현재 상태**: ✅ 통과. D.1.a 적용 후 (`next.config.ts` 의 ignore 옵션 둘 다
`true`) 로컬 `pnpm build` 가 typecheck/lint 무시하고 성공.

본 ADR 검증: builder 작업 0 — 이미 통과.

### 검증 2 — D.1 DoD #2 (Vercel preview 배포 1회 성공)

**현재 상태**: ⏳ 미검증. 운영자 Vercel 가입 + Step 2 (Pieter 임시 PR) 후
검증.

**검증 단계**:
1. 운영자 Step 3 완료 (§Operator-Action-Step3 7단계)
2. Pieter Step 2 — 사소한 변경 PR 생성 (예: docs/adr/INDEX.md 본 ADR 추가
   commit) → push
3. PR에서 Vercel bot comment 확인 → preview URL 클릭 → 페이지 200 응답 +
   샘플 페이지 (`/`, `/data-sources`) 정상 렌더 확인
4. 운영자가 production endpoint와 *분리된* dev branch에 fetcher가 데이터를
   쓰는지 (또는 쓰지 않는지 — preview에서 cron 안 도는 가정) 확인

**Pass 조건**: preview URL 200 응답 + production DB unchanged.

### 검증 3 — D.1 DoD #3 (typecheck 깨는 PR이 GitHub Actions에서 차단)

**현재 상태**: ⏳ 미검증. Step 2 (음성 테스트 PR) 후 검증.

**검증 단계**:
1. Pieter Step 2-b — 의도적으로 typecheck 깨는 변경 PR 생성 (예:
   `src/app/page.tsx` 에 `const x: number = 'string';` 1줄 추가)
2. GitHub Actions ci.yml 트리거 확인 → typecheck step ❌ 빨강 표시
3. PR 머지 차단 확인 (D.1.c — main 브랜치 보호 규칙 활성 가정)
4. PR close (머지하지 않음)

**Pass 조건**: GitHub Actions ❌ + PR 머지 버튼 비활성.

**전제**: D.1.c (main 브랜치 보호 규칙) 가 활성화됨. 운영자가 GitHub repo
Settings → Branches → main → "Require status checks to pass" + "ci / gate"
선택 — Step 3 §검증 후속 작업으로 분리.

### 검증 4 — D.1 DoD #4 (D.1.d 적용 후 ci.yml 4단 게이트 안정)

**현재 상태**: ✅ 통과. D.1.d 머지됨 (commit `175ba9d`).

본 ADR 검증: builder 작업 0 — 이미 통과.

### 검증 5 — 본 ADR §T1~T7 운영자 검토 (GATE-H)

운영자 (Kim Wonmin) 가 본 ADR을 검토하여 다음 7개 결정 모두 승인:
- T1 CI/CD 흐름 = 동시
- T2 자동 배포 = production OFF + preview ON
- T3 환경변수 = production / preview 분리 (Neon dev branch 신규)
- T4 Inngest 키 = 단일 키
- T5 Build gate = ADR-0002 정합 (변경 없음)
- T6 PR comment = 둘 다
- T7 가입 절차 = §Operator-Action-Step3 7단계

**GATE-H 통과** = 본 ADR Status `Proposed` → `Accepted` 격상 + Step 2~4 진행.

## 회귀 트리거 (Trigger for revisit)

다음 중 하나가 발견되면 ADR-0015를 재검토한다:

1. **베타 시작 (M8~M10) 진입 시 — T2 자동 promote 재평가**: 사용자 트래픽
   증가 + 운영자 manual promote 부담 ↑ → 자동 promote ON + deployment
   protection ADR.
2. **preview에서 의도치 않은 production cron 발화 1건**: T4 단일 키 가정
   깨짐 → 환경별 키 분리 Amendment.
3. **Vercel Hobby 한도 도달** (Functions 1M/월 또는 Bandwidth 100GB/월의
   80%): ADR-0004 §결정 2 격상 트리거 발동 + 본 ADR T1~T7 재평가.
4. **Neon dev branch 한도 도달** (~10개): 본 ADR T3 재평가.
5. **운영자 가입 단계 (§Operator-Action-Step3) 에서 막힘 1건 이상**: 본 ADR
   §Operator-Action-Step3 갱신 + scribe 운영 노트.
6. **D.1.c (main 브랜치 보호 규칙) 활성화 누락 발견**: 본 ADR §검증 3 전제
   깨짐 → 운영자 후속 액션 + scribe 노트.

## Operator-Action-Step3 — 운영자 Vercel 가입 가이드

> **이 섹션은 GATE-H 통과 후 운영자 Kim Wonmin 이 직접 수행하는 단계 명세.**
>
> 추정 소요 시간: 30~60분 (1회).
> 사전 준비: GitHub 계정 (Arbitoria 조직 owner 권한), Inngest 계정 (없으면
> Step 3.6에서 가입), Neon 계정 (있음 — `ep-fancy-fog-alt18340` production
> 사용 중).

### Step 3.1 — Vercel 가입 (5분)

1. https://vercel.com/signup 방문
2. **"Continue with GitHub"** 클릭 (운영자 GitHub 계정 = HanSap)
3. 이메일 (`kim.wonmin91@gmail.com`) 확인 + Vercel 계정 생성
4. **Hobby (Free) plan** 선택 — Pro 업그레이드 거부 (월 €300 cap, ADR-0004)
5. Team 이름 = 운영자 default (`hansap` 또는 personal)

**검증**: https://vercel.com/dashboard 접속 가능.

### Step 3.2 — GitHub 연동 + Slim repo import (5분)

1. Dashboard → **"Add New..."** → **"Project"**
2. **"Import Git Repository"** 섹션 → "Adjust GitHub App Permissions" 클릭
   (필요 시) → Arbitoria 조직 선택 → Slim repo 선택
3. Slim repo 옆 **"Import"** 클릭
4. **Configure Project** 화면:
   - Framework Preset: **Next.js** (자동 감지)
   - Root Directory: `./` (기본값)
   - Build & Output Settings: 기본값 유지 (build = `next build`, output =
     `.next`)
   - Install Command: `pnpm install --frozen-lockfile`
5. **Environment Variables** 섹션은 다음 단계 (Step 3.5) 에서 입력 → *지금
   비워두고 Deploy 누르지 말 것*. **"Deploy"** 누르기 전 Step 3.3~3.5 완료
   필수.

> **주의**: 만약 Vercel UI가 변경 시 환경변수 입력을 강제하면 4 변수 (Step
> 3.5) 를 *먼저* 입력 후 Deploy.

**검증**: 프로젝트 생성됨 (https://vercel.com/[team]/slim).

### Step 3.3 — Neon dev branch 생성 (10분)

1. https://console.neon.tech 접속 → 운영자 Slim 프로젝트 선택
2. 좌측 **Branches** → **"Create branch"** 클릭
3. **Branch name**: `dev` (또는 `preview`)
4. **Parent branch**: `main` (production = `ep-fancy-fog-alt18340` 부모)
5. **Compute size**: Default (0.25 CU 미만 — Free tier)
6. **Create branch** 클릭
7. 새 branch endpoint 이름 복사 (예: `ep-soft-cloud-XXXXX`) — Step 3.5에서
   사용
8. Connection Details 페이지에서 **pooled connection string** 복사 (예:
   `postgresql://user:****@ep-soft-cloud-XXXXX-pooler.region.aws.neon.tech/dbname?sslmode=require`)

**검증**: Neon Console → Branches에 `dev` 행 표시.

### Step 3.4 — Vercel 자동 배포 정책 설정 (5분, T2 적용)

1. Vercel project → **Settings** → **Git** 메뉴
2. **Production Branch** 섹션 확인 — `main` 으로 설정됨 (자동)
3. **"Auto-assign Custom Domains"** 토글 → **OFF** (production 자동 promote
   OFF, T2)
   - 현재 Vercel UI에 해당 옵션이 없을 수 있음 — 그 경우 다음 대안:
     - vercel.json 추가: `{ "git": { "deploymentEnabled": { "main": true } } }`
       (build는 main에서도 함, promote만 manual)
     - 또는 운영자가 *promote 행위 자체를 manual로만 수행* (Deployments → ⋯
       → "Promote to Production")
4. **"Connected Git Repository"** 섹션 확인 — comments 토글 ON 유지 (T6 PR
   comment)

**검증**: Settings → Git에서 production branch = main + auto-promote 관련
토글 운영자 결정 정합.

### Step 3.5 — 환경변수 4개 등록 (10분, T3 + T4 적용)

1. Vercel project → **Settings** → **Environment Variables** 메뉴
2. 각 변수마다 **"Add"** 클릭 후 다음 4개를 *2 환경* (production, preview)
   각각 등록:

| Key | Value (production) | Value (preview) |
|---|---|---|
| `DATABASE_URL` | `ep-fancy-fog-alt18340` pooled connection string (운영자 `.env.local` 의 현재값) | Step 3.3에서 복사한 `dev` branch pooled connection string |
| `EXPECTED_DB_ENDPOINT` | `ep-fancy-fog-alt18340` | Step 3.3 dev branch endpoint name (예: `ep-soft-cloud-XXXXX`) |
| `INNGEST_EVENT_KEY` | (Step 3.6에서 발급한 production event key) | (production과 동일 — T4) |
| `INNGEST_SIGNING_KEY` | (Step 3.6에서 발급한 production signing key) | (production과 동일 — T4) |

3. 각 변수마다 **Environment** 체크박스: **Production** + **Preview** 체크
   (Development 체크 X — 로컬은 `.env.local` 단독)
4. **Save** 클릭

**검증**: Settings → Environment Variables에 4 변수 × 2 환경 = 총 8 항목
표시.

### Step 3.6 — Inngest 가입 + 키 발급 (10분)

> ADR-0008 §다음 단계 §1과 동일. 이미 가입 + 키 발급 완료 시 Step 3.6 skip.

1. https://app.inngest.com/sign-up → GitHub 연동 가입
2. App 생성: **slim-prod** (또는 운영자 명명)
3. **Free (Hobby) plan** 선택
4. App → **Keys** 메뉴 → **Event Key** + **Signing Key** 각각 복사
5. Step 3.5에서 두 키를 production + preview 환경변수에 등록 (T4 단일 키)

**검증**: Inngest dashboard → Apps → slim-prod 표시 + Keys 페이지에서 두 키
모두 active.

### Step 3.7 — 첫 build 검증 (10분)

1. Vercel project → **Deployments** 탭
2. 만약 Step 3.2~3.5 중 자동 build가 실행되었으면 → 그 build 결과 확인
3. 결과 없으면 → GitHub repo로 가서 작은 commit 1회 push (예: README.md
   sentence 추가) → main push → Vercel preview build 자동 트리거 확인
   (만약 Step 3.4에서 main build OFF로 둔 경우는 PR 생성 + push로 트리거)
4. Vercel build log 확인 — `next build` 성공 (ignoreBuildErrors 효과로
   typecheck/eslint skip 메시지 OK)
5. preview URL 클릭 → 메인 페이지 200 응답 확인
6. 운영자가 본 ADR §검증 2 (D.1 DoD #2) Pass 확정

**검증**: Vercel Deployments → 최근 build = ✅ + preview URL 200.

### Step 3.8 — 운영자가 Pieter에게 보낼 신호 (5분)

운영자가 본 가이드 완료 후 Pieter (Claude session) 에게 다음 정보를 전달:

```
✅ Vercel 가입 완료
- Vercel project ID: prj_XXXXXXXXXXXXXXXXXXXXXXXXX
- Vercel project URL: https://slim-XXXX.vercel.app (production URL)
- preview URL 샘플 (Step 3.7 build): https://slim-XXX-XXX.vercel.app
- 환경변수 4 × 2 등록 확인: ✅
- Neon dev branch endpoint: ep-soft-cloud-XXXXX
- D.1.c (main 브랜치 보호 규칙) 활성화: ✅ / ⏳ (해당 시 별도 액션)
```

운영자가 위 정보를 이슈 또는 commit message로 남기면 Pieter가 D.1 DoD 4건
모두 [x] 마킹 + verifier Step 4 진행.

### Step 3.9 (선택) — Vercel CLI 설치 (5분)

```bash
# 글로벌 설치 안 함, pnpm dlx로 임시 실행
pnpm dlx vercel@latest login
pnpm dlx vercel@latest env pull .env.vercel.local --environment=preview
```

**용도**:
- `env pull` — 디버깅 시 preview env vars 로컬 확인
- `vercel deploy` — manual promote 대안 경로 (T2 - dashboard 외)

**검증**: `pnpm dlx vercel@latest --version` 출력.

## 영향

### PLAN.md 갱신 (본 ADR GATE-H 통과 후, verifier 책임)

- **§D.1 DoD**: 본문은 변경 없음. DoD 4건의 *검증 책임자* 매핑 추가:
  - DoD #1 (`next build` 로컬 통과) → 이미 통과 (D.1.a)
  - DoD #2 (Vercel preview 1회 성공) → 본 ADR §검증 2 + Step 3.7
  - DoD #3 (typecheck PR 차단) → 본 ADR §검증 3 + Step 2 음성 테스트
  - DoD #4 (4단 게이트 안정) → 이미 통과 (D.1.d)
- **§D.1**: GATE-H 통과 + Step 2~4 완료 시 [x] 마킹.
- **작업 추적 메타 표**: 페이즈 0.5 완료 카운트 갱신 (D.1 + D.2 모두 [x]).

### 다른 ADR과의 관계

- **ADR-0002 (헌장)**: 본 ADR이 ADR-0002 §결정 1을 *운영 단계*로 끌어옴.
  ADR-0002 자체는 변경 없음. 본 ADR §T5는 ADR-0002와 정합 명시.
- **ADR-0004 (€300 cap)**: 본 ADR §외부 사실의 무료 티어 사용량 0.1% 미만이
  ADR-0004 §결정 2 (cap €300) 정합 입증.
- **ADR-0008 (Inngest)**: 본 ADR §T4 + Step 3.6 가 ADR-0008 §T9 환경변수
  정책 그대로 운영 단계로 끌어옴.
- **ADR-0011 (`/data-sources` RSC + ISR)**: 본 ADR §T2 (production manual
  promote) 가 ADR-0011 §T6 ISR 1h 와 정합 — production endpoint 노출이
  운영자 결정 시점.
- **ADR-0007 (PII 90일 NULL화)**: 본 ADR §T3 (preview branch 격리) 가
  ADR-0007 §T4 production endpoint 통제 가정 보호.

### MONETIZATION.md 영향 — 가정 변동 없음

- 인프라 €300/월 cap 안 사용량 0.1% 미만 — ADR-0004 §결정 2 정합.

### 외부 의존성 추가 — 0건

- Vercel CLI는 *권장* (필수 아님, pnpm dlx로 임시 실행). package.json 변경
  X.
- 새 npm 패키지 0건. GATE-C (ADR-0011) 통과.

## References

- 헌법: [`CLAUDE.md`](../../CLAUDE.md) — P3 (투명성 운영자의 짐), P4 (타입
  안전), §5 기술 스택 (Vercel + Neon)
- 운영자: [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, 월 €300, 무료
  티어 우선
- 직접 받는 ADR:
  - [ADR-0002](0002-build-gate-ownership.md) — Build gate 책임 분리 (헌장).
    본 ADR이 *운영 단계*로 끌어옴.
  - [ADR-0004](0004-monetization-solo-side-rebalance.md) — €300 cap, 무료
    티어 정합
  - [ADR-0008](0008-fetcher-interface-and-cron.md) — §T9 Inngest 환경변수
    + `app/api/inngest/route.ts`
  - [ADR-0011](0011-data-sources-page-and-caveats-boundary.md) — §결정 6
    `/data-sources` RSC + ISR 1h (Vercel 의존)
- PLAN: [`PLAN.md`](../../PLAN.md) — §D.1 (a/b/c/d 서브태스크 + DoD 4건)
- 운영 파일:
  - [`next.config.ts`](../../next.config.ts) — D.1.a (ignoreBuildErrors +
    ignoreDuringBuilds)
  - [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — 4단 게이트
    (D.1.b + D.1.d)
  - [`scripts/verify-db.ts`](../../scripts/verify-db.ts) —
    EXPECTED_DB_ENDPOINT 가드 (1.5.5)
- 외부 사실 (검증된 출처 — 2026-05-09):
  - [Vercel Pricing — Hobby tier](https://vercel.com/pricing) — 100GB
    bandwidth, 1M function invocations, 1M edge requests, unlimited
    deployments
  - [Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github) — auto
    deploy + PR comment + system env vars
  - [Vercel Managing Deployments](https://vercel.com/docs/deployments/managing-deployments)
    — manual promote 절차
  - [Vercel Git Configuration](https://vercel.com/docs/project-configuration/git-configuration)
    — `git.deploymentEnabled` 옵션
  - [Neon Vercel-managed integration](https://neon.com/docs/guides/vercel-managed-integration)
    — preview branch per deploy + DATABASE_URL injection
- 운영자 GATE 정의 (본 ADR 작성 컨텍스트):
  - GATE-H = 본 ADR §T1~T7 운영자 승인 → Accepted
  - Step 2 = Pieter 임시 PR (D.1 DoD #2/#3 음성 테스트)
  - Step 3 = 운영자 Vercel 가입 (§Operator-Action-Step3 — Amendment 1로 §Step-3-prime 대체)
  - Step 4 = verifier D.1 DoD 4건 [x] 마킹

---

## Amendment 1 — §Step-3-prime: 현 Vercel 셋업 점검 + 보강 (2026-05-10)

### 운영자 정정 사항 (GATE-H 응답)

| 항목 | 원래 가정 | 실제 상태 |
|---|---|---|
| Vercel 가입 | 미가입 | ✅ ARBITORIA org 가입 + GitHub OAuth 연동 |
| Slim repo 연결 | 미연결 | ✅ Vercel 프로젝트 'slim' 생성됨 |
| 배포 URL | 미발급 | ✅ slim-gamma.vercel.app |
| 자동 build | 미트리거 | ✅ 작동 중 (커밋 'D.1.e force vercel rebuild' 검증됨) |

따라서 §Operator-Action-Step3 (가입 9단계 ~50분) → **§Step-3-prime
(점검 4단계 ~20분)** 으로 대체. 7개 결정(T1~T7)은 그대로 유효.

### Step-3-prime — 4 단계 (운영자 + Pieter 협업)

#### 3'a. Pieter 로컬 자동 점검 (완료, 2026-05-10)

- ✅ vercel CLI 설치됨 (글로벌 npm)
- ❌ vercel CLI 인증 안 됨 (`vercel whoami` → no credentials)
- ❌ `.vercel/project.json` 없음 (CLI로 프로젝트 link 안 됨)
- ❌ `vercel.json` 없음 (Vercel auto-detect 사용)
- 결론: **CLI 기반 자동 env 추출 불가**. 운영자 dashboard 검증 필수.

#### 3'b. 운영자 Vercel dashboard 점검 (~10분)

운영자가 Vercel Console (`https://vercel.com/arbitoria/slim`) 에서 확인:

**환경변수** (Settings → Environment Variables):

| 키 | Production | Preview | Development | 비고 |
|---|---|---|---|---|
| DATABASE_URL | ❓ | ❓ | ❓ | T3: production = ep-fancy-fog-alt18340 / preview = Neon 신규 dev branch |
| EXPECTED_DB_ENDPOINT | ❓ | ❓ | ❓ | 1.5.5 가드. production = ep-fancy-fog-alt18340 |
| INNGEST_EVENT_KEY | ❓ | ❓ | ❓ | T4: production / preview 같은 키 |
| INNGEST_SIGNING_KEY | ❓ | ❓ | ❓ | 동일 |
| UPSTASH_REDIS_REST_URL | (선택) | (선택) | (선택) | 페이즈 4 결과 캐시 |
| UPSTASH_REDIS_REST_TOKEN | (선택) | (선택) | (선택) | 동일 |
| SENTRY_DSN | (선택) | (선택) | (선택) | 페이즈 6.2 알림 |
| NEXT_PUBLIC_POSTHOG_KEY | (선택) | (선택) | (선택) | 페이즈 4 펀널 |

**자동 배포 정책** (Settings → Git):
- ❓ Production Branch: `main` 인지 확인
- ❓ Production Auto-Deployments: ON / OFF 토글 상태

**Preview 정책:**
- ❓ PR push 시 preview build 자동 트리거 여부 (기본 ON)

#### 3'c. 운영자 → Pieter 보고 형식

운영자가 다음 정보를 채팅으로 회신:

```
[Vercel 점검 결과]
환경변수 (production):
  - DATABASE_URL: 등록됨 / 없음
  - EXPECTED_DB_ENDPOINT: 등록됨 / 없음
  - INNGEST_EVENT_KEY: 등록됨 / 없음
  - INNGEST_SIGNING_KEY: 등록됨 / 없음
환경변수 (preview): 동일 4개 항목

자동 배포:
  - Production auto-deploy: ON / OFF
  - Production branch: main / [다른 이름]
  - PR preview auto: ON / OFF

Neon dev branch:
  - 생성됨: yes / no (no면 production endpoint 공유 중)
  - dev endpoint: ep-XXX-YYY (있으면)
```

#### 3'd. Pieter 보강 작업 (운영자 회신 기반 분기)

| 회신 패턴 | 보강 작업 |
|---|---|
| 모두 등록 + production OFF + dev branch 있음 | ✅ 점검 끝. Step 2 음성 PR 진입. |
| env 일부 누락 | 누락 env 등록 가이드 (Settings → Environment Variables → Add New) |
| production auto-deploy ON | 운영자 명시 결정(T2)과 충돌. OFF 전환 가이드 또는 main을 preview로 강등 + 별도 production 브랜치 신설 (architect 추가 ADR 후보) |
| dev branch 없음 | T3 미적용 — Neon Console에서 dev branch 생성 가이드 (Branches → Create branch → parent=production → endpoint 복사 → preview env 등록) |

### 갱신된 회귀 트리거

- **#7 (신설)**: §Step-3-prime 점검 후 운영자 회신에 *예상 외* 패턴 발견 시 본
  ADR §Step-3-prime 갱신 + scribe 운영 노트.
- **#8 (신설)**: Bash 보안 경고 패턴 발견 시 (운영자 No 선택 사례 2026-05-10
  발생) — `scripts/hooks/pre-tool-guard.sh`에 패턴 자동 차단 hook 추가 필요
  (PLAN 1.5.7 부채로 등록).

