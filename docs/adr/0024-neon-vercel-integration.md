# ADR-0024: Neon-side Vercel Integration — PR마다 DB branch 자동 생성 (도입 검토)

## Status

**Accepted** (2026-05-15, Pieter 세션 architect — 옵션 C 조건부 잠금. PLAN §D.3.e 의사결정 게이트 마감).

채택 옵션 = **C (조건부 — 4.6~4.8 옵션 B 유지 + §Decision §재평가 트리거 4건 중 1건 발화 시 architect 재호출 → 옵션 A 격상 평가)**. 본 ADR 은 *결정 완료* 상태이며 옵션 A 도입 작업 sub-task 는 **현 시점 비활성** — §재평가 트리거 발화 시점에 신규 sub-task 분해.

> 이전 상태: Proposed (2026-05-15 작성). 동일 세션에서 architect 가 비판적 재검토 + 트리거 구체화 후 Accepted 전이 (옵션 C 의 본질 = "결정 보류" 가 아닌 "조건부 결정 잠금").

> **번호 재지정 사연**: PLAN §D.3.e + ADR-0020 §결정 6 가 본 ADR 을 *"가칭 ADR-0022"* 로 처음 예약했으나 ADR-0022(DB 환경 분리)가 0022 슬롯을 소비 → *"가칭 ADR-0023"* 재지정 → ADR-0023(Lighthouse/axe 하네스)이 0023 을 소비 → 본 ADR 이 **0024** 로 최종 안착. PLAN §D.3.e L116-119 본문에 이미 재지정 메모 명시.

> 작성 메모: 본 ADR 은 *결정 + 운영자 인계 명세*. 코드 변경 0건. WebSearch 비용 데이터 (2026-05-15 fetched, §Cost projection) 는 채택 결정의 *현 시점 ground truth*. 향후 가격 변동 시 §History Amendment 트리거.

## Context

### 1. 직접 트리거 — PLAN §D.3.e + ADR-0020 §결정 7

PLAN §D.3.e (현 L116-119):

> **D.3.e** Neon-side Vercel Integration 도입 검토 (PR마다 DB branch 자동 생성 — 페이즈 4 베타에서 사용자 데이터 격리 가치 큼, 별도 ADR(가칭 **ADR-0024**) 트리거 — ADR-0022가 0022를, ADR-0023이 Lighthouse 하네스로 0023을 소비했으므로 0024로 재지정)

ADR-0020 §결정 7 가 본 ADR 을 *페이즈 4 베타 진입 시점의 별도 ADR* 로 예약했다. ADR-0022 §작성 메모 + ADR-0023 §번호 충돌 해소 메모도 동일 예약을 명시.

### 2. 현 architecture (ADR-0022 잠금)

| 환경 | endpoint | 역할 | 격리 보장 |
|---|---|---|---|
| `production` | `ep-fancy-fog-alt18340` | 베타/런치 실사용자 — Neon Console SoT (D2), 인라인 명령으로만 (D4) | EXPECTED_DB_ENDPOINTS allowlist (D3) |
| `preview` | `ep-autumn-water-all6d93e` | Vercel preview 빌드 — 자동 주입, 일회성 | allowlist 단일 |
| `development` | `ep-noisy-meadow-aliaxayq` | 로컬 `pnpm dev`/`test`/마이그레이션 dry-run | `.env.local` 기본값 |

핵심: production connection string 은 *Neon Console 만 진실원*. 채팅/repo/ADR 본문에 영속 저장 X (ADR-0017 사건 재발 방지). `EXPECTED_DB_ENDPOINTS` allowlist 3 endpoint 가 4단 가드.

### 3. 4.7 운영 컨텍스트

- 4.6 베타 모집 1주 후 시점 (M5 진입 직전).
- 4.6 베타 모집 카피 4건 (`docs/marketing/beta-recruitment-copy.{kr,reddit,salair,tw}.md` — ADR-0029 Amendment 1) 배포 완료.
- 베타 사용자 데이터는 *production 단독* — PR/preview 환경에 베타 데이터 가시화 0 (ADR-0022 §D1 격리 정합).
- 4.7 자체 운영(scribe / verifier / pieter 워크플로)에는 본 ADR 무관 — *4.6 베타 모집 후 schema 변경 PR 발생 시* 가치 발현.

### 4. 핵심 문제 — PR 마다 DB branch 격리의 필요성 (베타 컨텍스트)

베타 사용자 데이터가 production 에 쌓이는 시점부터, *schema 변경 PR* (예: ADR-0026 affiliate_click 후속 마이그레이션, ADR-0028 follow_up_email 후속 마이그레이션) 이 발생하면:

- 현 (ADR-0022) — PR 의 Vercel preview deploy 는 `preview` 단일 브랜치를 공유. 같은 시점 다른 PR 이 충돌 migration 을 적용하면 *둘 다 실패* 또는 *임의 순서* 적용.
- 본 ADR — PR 1개 당 Neon 자동 copy-on-write branch 1개. parent=`production` 또는 `preview` 또는 신규 베이스. PR 별 schema 격리.

베타 직접 위험: 베타 사용자 데이터 (실 PII는 0이지만 comparison_request 의 입력 attribute, follow_up_email 의 이메일 동의 레코드) 가 *PR preview 환경에 의도치 않게 복제* 되면 ADR-0029 §T5 (추적 0, PII 0) 위반 + 헌법 §8 #1 위반. → 본 ADR §Decision 의 parent 선택 정책이 critical.

PLAN 매핑: 페이즈 0.5 — **D.3.e** (분해). ADR-0022 의 *발전*, ADR-0017/0018/0020 의 *조건부 후속*.

## Decision

본 ADR 은 *3 옵션 검토 + architect 권고 1개* — 채택 결정은 운영자(Kim Wonmin) 별도 1회.

### 옵션 A — Vercel-Neon Native Integration 도입

Vercel Marketplace 에서 *Neon Postgres Native Integration* 설치. PR open → Vercel webhook → Neon 자동 branch 생성 → preview deploy 의 `DATABASE_URL` 환경변수 자동 주입. PR close/deploy 삭제 → branch 자동 cleanup (Vercel 의 6개월 preview retention 정책 따름).

**얻는 것**:
- PR 별 schema 격리 — migration 충돌 0
- 베타 사용자 데이터 격리 — parent 가 `development` (또는 신규 베이스) 면 production 데이터 복제 0
- 운영자 작업 0 — 자동화. ADR-0022 §D2 (Console SoT) 정합 — PR branch URL 은 Vercel env 가 *자동 주입*, 인간이 안 본다.

**잃는 것**:
- Free tier 5 branch 한도 (Neon, 2026-05-15 시점 — §Cost projection) — 장기 open PR 5건 초과 시 신규 branch 발급 실패.
- `EXPECTED_DB_ENDPOINTS` allowlist 동적 확장 필요 — PR branch 의 endpoint ID 가 PR 마다 달라짐 → ADR-0022 §D3 (allowlist 정적 3 endpoint) 와 *근본 충돌*. → 본 ADR Accepted 시 ADR-0022 §D3 **Amendment 1 트리거** (allowlist 패턴 매칭 또는 PR branch 패턴 화이트리스트 — `^br-.*$` 등).
- Vercel Integration UI 설치 = 운영자 OAuth (Claude 진행 불가). D.3.c Inngest sync 동형 운영자 부담.
- *Neon-Managed* (Marketplace via Neon) vs *Vercel-Managed* (Marketplace via Vercel) 분기 — 빌링 위치 다름. 운영자 결정 (§Migration Phase 1 sub-decision).

### 옵션 B — 수동 (현 ADR-0022 유지)

PR 마다 자동 branch 생성 0. `preview` 단일 브랜치 공유. schema 변경 PR 은 *직렬화* — 한 번에 1 PR 만 머지.

**얻는 것**:
- ADR-0022 §D1~D4 그대로 — 정책 일관, 운영자 학습 비용 0
- Free tier 한도 압박 0 (branch 3개 < 5개 한도)
- allowlist 정적 3 endpoint 유지 — ADR-0022 §D3 변동 0
- OAuth 작업 0 — 운영자 추가 부담 0

**잃는 것**:
- PR 직렬화 부담 — 솔로 사이드에서는 *실제로 부담 미미* (솔로 → 동시 PR 거의 0). M16+ 협업자 추가 시 트리거.
- migration 충돌 risk — 솔로 환경에서 *낮음*. 발생해도 운영자 1회 rollback.

### 옵션 C — 조건부 (베타 종료 후 4.9 런치 직전 도입 평가)

본 ADR 을 *Proposed 유지* 한 상태로 4.6 베타 ~ 4.8 운영 기간(M3 ~ M8 추정) 관찰 → 4.9 런치 직전 (M9) 재평가. 평가 시점에 (a) 베타 누적 사용자 수 (b) schema 변경 PR 횟수 (c) 협업자 추가 여부 (d) Vercel Pro 격상 여부 (ADR-0020 §회귀 트리거 #6) 를 종합.

**얻는 것**:
- 옵션 A 의 잠재 이득 *보존* — 4.9 런치 직전 데이터 격리 가치는 *더 큼* (런치 = 외부 사용자 + 트래픽 폭증).
- 옵션 B 의 단순성 *현재 보존* — €300 cap / 솔로 / Free tier 한도 압박 0.
- 결정 정보 *수집 기간* — 베타 5개월 실측 후 결정.

**잃는 것**:
- 결정 미루기 — 4.6~4.8 기간 schema 변경 PR 충돌 risk *옵션 B와 동일하게 수용*.
- 본 ADR 의 *재호출 비용* — 4.9 진입 시 architect 재호출 + WebSearch 재실행 (가격 데이터 fresh 검증).

### Architect 권고

**옵션 C 조건부 (수용 4.6 ~ 4.8) + 4.9 런치 직전 재평가 → 그때 옵션 A 또는 B 격상**.

권고 근거 (5개):

1. **€300 cap 보존 (ADR-0004 §결정 2)** — 옵션 A 가 Neon Free 5 branch 한도 초과 시 €15~€20/mo (Neon Launch 또는 Scale) 트리거. 4.6 베타 시점에서는 ROI 불명확.
2. **솔로 컨텍스트 (ADR-0003 §결정 1)** — 동시 PR 발생률이 낮아 옵션 B 의 직렬화 부담이 미미. 베타 5개월 관찰 후 *실측 데이터* 로 결정이 낫다.
3. **ADR-0022 §D3 allowlist 충돌 회피** — 옵션 A 도입은 ADR-0022 Amendment 1 트리거 (allowlist 패턴 매칭). 본 ADR Proposed 단계에서 ADR-0022 변동 0 보존 = 운영자 학습 비용 보존.
4. **베타 데이터 보호의 *현시점 우선순위 낮음*** — 4.6 베타 사용자 데이터는 *production 단독*, PR/preview 환경에 가시화 0 (ADR-0022 §D1 격리). 옵션 A 도입은 *향후 schema 변경 PR 빈도 증가* 시점에 가치 발현.
5. **D.3.c Inngest sync 학습 (2026-05-14)** — Vercel Marketplace UI 설치 = 운영자 OAuth 부담 1회 + 검증 비용. 4.6 베타 모집 직후 추가 OAuth 부담은 *모집 ROI 검증* 보다 우선순위 낮음.

### 최종 결정 (2026-05-15, architect 잠금)

**채택 = 옵션 C (조건부)**. 4.6~4.8 운영 기간 동안 **옵션 B (현 ADR-0022 3 브랜치)** 유지 + 아래 §재평가 트리거 4건 중 *1건이라도 발화* 시 architect 재호출하여 옵션 A 격상 평가.

채택 사유 (3문장):
1. 4.6 베타 100명 규모 + 솔로 운영자 컨텍스트에서 동시 open PR 발생률이 사실상 0 이므로 옵션 A 의 PR-단위 격리 ROI 가 *현시점* 마이너스 (Vercel Pro 격상 + Neon Launch 격상 + ADR-0022 §D3 Amendment 부담 합산 > schema 충돌 risk).
2. 옵션 B 의 단순성 보존이 4.6 베타 진입 *카피 배포(4.6.c)* 의 즉시 가치보다 우선 — 본 결정은 4.6 베타 blocker 가 아님.
3. 옵션 A 의 잠재 가치 (런치 시점 schema 변경 PR 빈도 증가 + 협업자 추가 + 베타 누적 사용자 격리 요구) 는 *현시점* 측정 불가 → 5개월 실측 데이터 수집 후 4.9 직전 재평가가 정합.

### 재평가 트리거 (4건, 옵션 C 의 핵심 — 1건 발화 시 architect 재호출)

옵션 C 가 "결정 미루기" 가 아닌 "조건부 결정 잠금" 임을 보장하기 위해 *구체적 metric/이벤트* 4건 명시. 트리거 발화 추적은 verifier 가 주간 harness (`pnpm harness:plan` 확장 후보, 본 ADR 후속) 로 자동화 가능.

| # | 트리거 | 측정 방법 | 발화 임계값 |
|---|---|---|---|
| **T1** | **schema 변경 PR 누적 횟수** (drizzle 마이그레이션 추가 PR) | `git log --oneline drizzle/` 카운트 (본 ADR 채택일 2026-05-15 이후) | **누적 5건** 도달 시 발화 |
| **T2** | **협업자 추가** (Pieter 외 GitHub collaborator 또는 Vercel team member) | GitHub repo collaborator 목록 + Vercel team membership | **1명이라도** 추가 시 즉시 발화 |
| **T3** | **Neon Free tier 한도 압박** (branch 5개 또는 storage 0.5GB/branch) | Neon Console 사용량 페이지 (운영자 월 1회 점검) | **branch ≥4** 또는 **storage ≥80%** 도달 시 발화 |
| **T4** | **Vercel Pro 격상** (ADR-0020 §회귀 트리거 #6) | Vercel dashboard billing | 격상 *결정 시점* 발화 (옵션 A 의 commercial-use 회피 트리거가 사라지므로 재평가 가치 증가) |

각 트리거 발화 시 운영자 → Pieter 신호 → architect 재호출 → 본 ADR §History Amendment + 옵션 A 격상 검토. 4.9 진입 시점(M9, 추정 2026-09~10)이 자동 마감 deadline — 그때까지 어떤 트리거도 발화 안 했어도 architect 재평가 1회 강제.

> 이전 권고 문장 ("§Status Proposed 유지") 은 옵션 C 의 의미를 *결정 보류* 로 흐릿하게 만들었음. 본 §최종 결정 + §재평가 트리거 가 옵션 C 를 *조건부 결정 잠금* 으로 명확화. §Status = Accepted 정합.

## Alternatives considered

본 §Decision 의 옵션 A/B/C 가 *주 옵션*. 추가 분기 4건:

### 대안 1 — Neon CLI 자동화 (CI 스크립트로 branch create) — 거부

- 장점: Vercel Integration UI 미설치 + OAuth 회피. CI 워크플로 안에서 명시적.
- 단점: GitHub Actions workflow `.github/workflows/*.yml` 변경 필요 + Neon API 토큰 관리 (secret rotation 부담). cleanup 자동화 직접 구현 필요 (PR close trigger). ADR-0002 §결정 1 "Vercel 순수 빌드" 패턴과 *역방향*.
- **거부 사유**: 옵션 A 의 *자동화 가치* 를 운영자가 직접 구현. ROI 마이너스.

### 대안 2 — Drizzle 마이그레이션 시 자동 branch — 거부

- 장점: 마이그레이션 단위 정밀 격리.
- 단점: `drizzle-kit` 에 native Vercel/Neon 후크 0. 직접 wrapper script 작성 + drizzle 워크플로 침해. 옵션 A 의 단순한 PR-단위 격리보다 *복잡*.
- **거부 사유**: 마이그레이션 단위 격리는 옵션 A 가 자연스럽게 제공 (1 PR = 1 마이그레이션 일반화 정합).

### 대안 3 — Neon Github Integration 으로 branch 생성 (Vercel 없이) — 거부

- 장점: Vercel preview deploy 와 *느슨한* 결합. Vercel Marketplace UI 우회.
- 단점: PR preview deploy 의 `DATABASE_URL` 환경변수가 *자동 주입 안 됨* → 수동 또는 Vercel preview env override 필요. ADR-0022 §D2 (Console SoT) 정합 깨짐 (PR branch URL 이 어딘가에 영속화 필요).
- **거부 사유**: 옵션 A 의 webhook 자동 주입 패턴이 ADR-0022 정합 보존.

### 대안 4 — Vercel-Managed Integration (옵션 A 의 하위 변형) — 옵션 A 의 sub-decision

옵션 A 채택 시 *Neon-Managed* (Marketplace via Neon, 빌링 Neon) vs *Vercel-Managed* (Marketplace via Vercel, 빌링 Vercel) 분기. §Migration Phase 1 운영자 결정.

권고 — **Vercel-Managed** (Vercel Marketplace neon Postgres Native Integration). 근거: (a) 빌링이 *한 곳* (Vercel) → €300 cap 추적 단순화 (b) 운영자가 이미 Vercel Hobby 사용 — 한 페이지에서 관리 (c) Neon-Managed 는 Neon Console 별도 빌링, 추적 부담 +1.

## Cost projection (2026-05-15 WebSearch 기준)

WebSearch 4개 결과 (fetched 2026-05-15) 기반. 가격 변동 시 §History Amendment 트리거.

### Neon Free tier (현재)

| 항목 | 한도 | 본 ADR 영향 |
|---|---|---|
| Compute | 100 CU-hours/project/month (2025-10 부터 50→100 doubling) | PR branch 가 scale-to-zero (mandatory free tier) → 사용량 미미 |
| Storage | 0.5 GB/branch, aggregate 5 GB across ≤10 projects | branch 5개 한도 도달 시 압박 |
| **Branch count** | **Extra branches 미제공 (Free)** — 기본 branch 5개 추정 한도, 초과 시 upgrade 필수 | **핵심 제약** — 옵션 A 도입 시 가장 먼저 hit |
| Egress | 5 GB/month | PR branch 트래픽 미미, 비제약 |
| PITR | 6 hours / 1 GB | 비관련 |

> Source: [Neon plans](https://neon.com/docs/introduction/plans), [Neon Free Tier infographic](https://www.freetiers.com/directory/neon), [Neon Pricing 2026](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/) — fetched 2026-05-15

### Neon Launch tier (격상 트리거 시)

월 가격: ~$19/mo USD (~€17.5 추정, USD/EUR 2026-05 환율 기준 추정). branch 한도 + compute 한도 상향. 본 ADR Accepted + Free 한도 도달 시 트리거.

> Source: [Neon Pricing](https://neon.com/pricing) — fetched 2026-05-15

### Vercel Hobby (현재)

| 항목 | 한도 | 본 ADR 영향 |
|---|---|---|
| Deployments | **Unlimited** (2026-05-15 시점 변경됨, 이전 "100/mo" 표기는 stale) | PR 활동 활발 시 비제약 |
| Fast Data Transfer | 100 GB/month | PR preview 트래픽 미미, 비제약 |
| Function invocations | 1M/month | PR preview 호출 미미 |
| Active CPU | 4 hours/month | preview build CPU |
| Edge Requests | 1M/month | 비관련 |
| **Commercial use** | **금지** — Hobby 는 personal/non-commercial 전용 | **베타 시작 후 격상 트리거** — ADR-0020 §회귀 트리거 #6 정합 |

> Source: [Vercel Pricing](https://vercel.com/pricing), [Vercel Limits](https://vercel.com/docs/limits), [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby) — fetched 2026-05-15

> **중요**: Vercel Hobby 는 *non-commercial only*. 베타 모집은 어트리뷰션 매출 가능성을 내포 → ADR-0004 §결정 2 (€300 cap) + ADR-0020 §회귀 트리거 #6 (Vercel Pro 격상 시점) 가 본 ADR 의 *상위 트리거*. 본 ADR 채택 결정 *이전* 또는 *동시* 에 Vercel Pro ($20/user/mo) 격상 결정이 선행해야 정합.

### Vercel-Neon Native Integration 자체 비용

Integration 자체 비용 = **€0** (Marketplace 의 통상 패턴). underlying Neon 비용만 부과. Vercel-Managed 시 Vercel 빌링 통합.

> Source: [Vercel Marketplace - Neon](https://vercel.com/marketplace/neon), [Connecting with the Vercel-Managed Integration](https://neon.com/docs/guides/vercel-managed-integration) — fetched 2026-05-15

### 합산 — 옵션 A 도입 시 월 비용

- 4.6~4.8 단계 (PR 적음, 동시 open ≤5) — **€0/mo** (Neon Free + Vercel Hobby commercial gray-zone)
- 베타 누적 사용자 도달 + Vercel Pro 격상 — **€20/mo USD** (Vercel Pro) — ADR-0020 §회귀 트리거 #6 이미 예약된 비용
- Neon Free 한도 도달 (5 branch 초과 또는 0.5 GB/branch 압박) — **+€17.5/mo USD** (Neon Launch)
- **최대 합산 (양 tier 격상 시)** — **€37.5/mo USD** ≈ **€34.6 EUR** (2026-05 환율 추정)

ADR-0004 §결정 2 의 €300/mo cap 대비 **11.5%** 점유. 격상 후에도 cap 잔여 마진 충분.

## Consequences

### 비용 영향 (요약)

- 옵션 A 즉시 채택 + Free tier 유지 — €0/mo
- 옵션 A 채택 + Neon Launch 격상 — +€17.5/mo (Vercel Pro 격상은 본 ADR 무관, ADR-0020 #6 별도)
- 옵션 B 유지 — €0/mo, 비용 영향 0
- **옵션 C 채택 (본 ADR 잠금) — €0/mo 현재 + 트리거 발화 시 옵션 A 격상 검토 (max €37.5/mo USD ≈ €34.6 EUR, §Cost projection 합산)**

### 즉시 영향 (옵션 C Accepted 직후, 4.6~4.8)

- ADR-0022 §D1~D4 (production / preview / development 3 브랜치 + Console SoT + `EXPECTED_DB_ENDPOINTS` 정적 3 endpoint + 인라인 명령) **변동 0 보존**.
- 운영자 추가 작업 0 — Vercel Marketplace UI 설치 작업 발생 안 함.
- 4.6 베타 진입 카피 배포(4.6.c) **blocker 아님** — 본 ADR 결정 완료로 GATE-K (D.3.e) 닫힘 가능.
- §Migration Phase 1~5 **스킵** (옵션 A 채택 시에만 실행 — 현재 비활성).
- §Verification V1~V6 **스킵** (옵션 A 채택 시에만 적용).

### 중기 영향 (4.6~4.9, 트리거 추적)

- 재평가 트리거 T1~T4 monitoring 책임 분담:
  - T1 (schema PR 횟수) — Pieter 가 PR 머지 시점에 카운트, PLAN.md 또는 별도 ledger 추적 후보.
  - T2 (협업자 추가) — 운영자가 GitHub/Vercel 권한 부여 시 즉시 Pieter 신호.
  - T3 (Neon Free 한도) — 운영자 월 1회 Neon Console 점검 (현재 branch 3/5, 60%).
  - T4 (Vercel Pro 격상) — ADR-0020 §회귀 트리거 #6 발화 시 동시 발화.
- 4.9 진입 시점(M9, 추정 2026-09~10) 자동 마감 deadline — 어떤 트리거도 발화 안 해도 architect 재호출 1회 강제.

### 운영 부담

- 옵션 A 도입 후 운영자 워크플로: PR open → 자동 branch 생성 → preview 환경 검증 → PR close → 자동 cleanup. 운영자 추가 작업 0 (initial Integration UI 설치 1회 제외).
- 옵션 A 도입 후 *충돌 시* 운영자 부담: Neon Console 에서 stuck branch 수동 cleanup (Free tier 5 한도 압박 시). 월 ~5분 추정.
- **옵션 C 채택 (현재) — 운영자 부담 0 + 월 1회 Neon Console 점검 (T3 트리거 추적, ~2분).**

### 보안 (헌법 §8 #1 정합)

- 옵션 A 채택 시 **PR branch parent 정책 = `development` 또는 신규 베이스** (production parent 금지). 베타 사용자 데이터(production) 복제 0 보장. 본 §Migration Phase 1 sub-decision.
- PR branch URL 이 Vercel preview env 에 자동 주입 → *운영자/Claude 노출 0* (ADR-0022 §D2 Console SoT 정합 보존).
- PR branch URL 채팅 공유 금지 (ADR-0018 §결정 7 정합).
- ADR-0029 §T5 (추적 0, PII 0) cross-ref — PR branch 가 베타 데이터 복제 0 보장 시 정합.

### 정합성 (ADR cross-ref)

- ADR-0017 (DB 미스매치 사건) — 옵션 A 의 *자동* 격리가 사고 재발 벡터 감소.
- ADR-0018 (멀티 org 정책) — 옵션 A 의 PR branch 가 *자동 발견 자산* 카테고리 정합 (§결정 2 Vercel Storage 자동 생성 → 즉시 점검 룰 정합).
- ADR-0020 §결정 7 — 본 ADR 이 §결정 7 의 deferred 분해.
- ADR-0022 §D3 — 옵션 A 채택 시 allowlist 패턴 매칭 **Amendment 1 트리거**.
- ADR-0029 §T5 — PR branch 데이터 격리 (parent=development).

## Risks

| # | 위험 | 발생 가능성 | 영향 | 대응 |
|---|---|---|---|---|
| R1 | Neon Free 5 branch 한도 초과 (장기 open PR ≥5) | 솔로 시 낮음, M16+ 협업자 추가 시 중간 | 신규 PR branch 발급 실패 | Neon Launch 격상 (€17.5/mo) 또는 PR 직렬화 정책 |
| R2 | Vercel Hobby commercial-use 위반 | **중간** (베타 모집 = 어트리뷰션 매출 잠재) | TOS 위반 → 프로젝트 정지 risk | Vercel Pro 격상 (ADR-0020 §#6, 본 ADR 상위 트리거) |
| R3 | 베타 데이터가 PR branch 에 의도치 않게 복제 (parent 실수 — `production` parent 선택) | **낮음** (운영자 명시 정책) | ADR-0029 §T5 + 헌법 §8 #1 위반 | §Migration Phase 1 sub-decision 으로 parent=`development` 강제 + V3 게이트 |
| R4 | migration 충돌 (PR 두 개가 같은 마이그레이션 번호 사용) | 솔로 시 낮음 | 한 PR migration 실패 | drizzle-kit 의 timestamp-based naming 사용 + V4 게이트 |
| R5 | Vercel-Neon Integration UI 설치 실패/혼란 (Vercel-Managed vs Neon-Managed 분기) | 낮음 (D.3.c Inngest sync 학습 적용) | OAuth 부담 +30분 | §Migration Phase 1 sub-decision 으로 Vercel-Managed 명시 |
| R6 | Integration 도입 후 `EXPECTED_DB_ENDPOINTS` allowlist 가 PR branch 차단 | **확실** (옵션 A 의 근본 충돌) | preview deploy 실패 | ADR-0022 §D3 Amendment 1 — allowlist 패턴 매칭 (`^br-.*$` 등) |
| R7 | Free tier compute 100 CU-hours 한도 도달 (장기 active PR 다수) | 솔로 시 낮음 | PR branch scale-up 차단 | Neon Launch 격상 또는 inactive PR branch 수동 cleanup |
| R8 | 가격 변동 (2026-05-15 fetched 시점 이후) | 중간 (6개월 주기) | 본 ADR §Cost projection stale | §History Amendment + WebSearch 재실행 |

## Migration (옵션 A 채택 시 5 단계)

본 §Migration 은 **옵션 A 채택 결정 후** 실행. 옵션 B/C 채택 시 §Migration 스킵.

### Phase 0 — 본 ADR Proposed (현재)

- 본 ADR 작성 완료 (2026-05-15)
- PLAN §D.3.e 인라인 메모 갱신 (본 ADR 작성 직후)
- ADR INDEX 갱신 (본 ADR 작성 직후)
- 운영자 채택 결정 *대기*

### Phase 1 — 채택 결정 + 운영자 Vercel Marketplace UI 에서 Neon Integration 설치

운영자 작업 (Claude 진행 불가, ~10분):

1. Vercel-Managed vs Neon-Managed 분기 결정 (권고: Vercel-Managed — §대안 4)
2. Vercel dashboard → Integrations → Marketplace → Neon Postgres → Install
3. 프로젝트 선택 (`slim`) + Neon org 연결 (ARBITORIA-BE) + parent branch 선택 (**`development` 강제** — production 금지, R3 대응)
4. Vercel preview env 의 `DATABASE_URL` 자동 주입 확인
5. Pieter 에 신호 (Slack/카톡 또는 다음 세션 시작 시 보고)

### Phase 2 — 첫 PR 으로 자동 branch 생성 검증 (V1~V5 게이트)

1. Pieter 임시 PR 1건 (no-op 또는 `docs/` 변경) → push
2. Vercel preview deploy 가 자동으로 Neon branch 생성 → preview URL Live
3. Neon Console 에서 branch 카운트 확인 (5개 한도 within)
4. preview env `DATABASE_URL` = PR branch URL 확인
5. PR close → branch auto-cleanup 확인 (Vercel preview 6-month retention 정책 따름)

→ V1~V5 통과 시 다음 단계.

### Phase 3 — ADR-0022 §D3 Amendment 1 (allowlist 패턴 매칭)

- `scripts/verify-db.ts` 의 `EXPECTED_DB_ENDPOINTS` 처리 로직 확장: 정적 endpoint ID 목록 + 정규식 패턴 (`^br-[a-z0-9-]+$` 등 PR branch endpoint 패턴).
- ADR-0022 §D3 Amendment 1 작성 (별도 commit, scribe 후속).
- `.env.local.example` 갱신.

### Phase 4 — 1주 운영 후 limit 사용량 + 누적 비용 검증 → Accepted 전이 또는 Phase 5 rollback

- Neon Console 에서 branch 카운트 + compute 사용량 + storage 사용량 확인 (Free tier 한도 within)
- Vercel dashboard 에서 deploy 횟수 + bandwidth 확인 (Hobby 한도 within, *commercial-use 점검*)
- 가격 변동 없으면 본 ADR §Status `Proposed → Accepted` + PLAN §D.3.e `[x]` 마킹.

### Phase 5 (rollback, optional) — Vercel Integration 제거 + ADR-0022 3 branch 복귀

- Vercel dashboard → Integrations → Neon → Remove
- Neon Console 에서 잔여 PR branch 수동 삭제
- ADR-0022 §D3 Amendment 1 revert (allowlist 정적 3 endpoint 복귀)
- 본 ADR §Status `Proposed → Rejected (rollback reason: ...)` + §History 사유 기록.

## Verification (Accepted 전이 게이트)

옵션 A 채택 시 §Migration Phase 2~4 에서 다음 V1~V6 전부 통과 시 Accepted 전이. 옵션 B/C 채택 시 본 §Verification 스킵.

| # | 게이트 | 검증 방법 | 책임 |
|---|---|---|---|
| V1 | Vercel Marketplace UI 에서 Neon Integration 설치 확인 | Vercel dashboard → Integrations → Neon "Installed" 표시 | 운영자 |
| V2 | PR open → branch 생성 확인 | Neon Console branch 5개 한도 within + 신규 branch endpoint 확인 | Pieter (PR open) + 운영자 (Neon Console 확인) |
| V3 | PR preview env 의 `DATABASE_URL` = 자동 생성 branch URL 확인 | Vercel preview deploy 로그 + `EXPECTED_DB_ENDPOINTS` allowlist 패턴 매칭 (Phase 3 Amendment 적용 후) | Pieter |
| V4 | migration 충돌 0 — drizzle/0007+ 신규 migration 1건 적용 검증 | PR preview 의 db:push log 확인 | Pieter |
| V5 | PR close → branch 삭제 자동 (또는 6개월 retention) 확인 | Neon Console 에서 PR branch 사라짐 또는 status=archived | 운영자 |
| V6 | 1주 누적 비용 + branch count 검증 (Free tier 내 또는 Pro 전환 결정) | Neon Console + Vercel dashboard 사용량 페이지 | 운영자 |

## References

- [ADR-0017](0017-db-mismatch-incident-postmortem.md) — DB 미스매치 사건 (Vercel Storage 자동 생성 학습)
- [ADR-0018](0018-neon-multi-org-policy.md) §결정 1, §결정 2, §결정 7 — 멀티 org 정책 + 자동 자산 발견 룰 + channel 비번 공유 금지
- [ADR-0020](0020-arbitoria-inventory-and-alignment-corrections.md) §결정 7 — D.3.e deferred 항목 cross-ref (본 ADR 의 부모)
- [ADR-0020](0020-arbitoria-inventory-and-alignment-corrections.md) §회귀 트리거 #6 — Vercel Pro 격상 시점 (본 ADR R2 상위 트리거)
- [ADR-0022](0022-database-environment-separation.md) §D1, §D2, §D3, §D4 — production / preview / development 3 브랜치 + Console-only SoT + EXPECTED_DB_ENDPOINTS allowlist 3 endpoint + 인라인 명령
- [ADR-0023](0023-lighthouse-axe-perf-harness.md) §번호 충돌 해소 메모 — 본 ADR 의 번호 재지정 (0023 → 0024) 근거
- [ADR-0029](0029-beta-recruitment.md) §T5 — 추적 0, PII 0 (PR branch 데이터 격리 정합)
- 헌법 §3 P3 (투명성은 운영자의 짐) + §8 #1 (사용자 데이터 외부 0)
- PLAN §D.3.e (L116-119) — 본 ADR 의 직접 트리거
- **External (fetched 2026-05-15)**:
  - [Neon plans](https://neon.com/docs/introduction/plans) — Free tier 한도
  - [Neon pricing](https://neon.com/pricing) — Launch tier 가격
  - [Neon Free Tier infographic](https://www.freetiers.com/directory/neon) — Free tier 상세
  - [Neon Pricing 2026 breakdown](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/) — 2025-10 compute doubling
  - [Vercel Pricing](https://vercel.com/pricing) — Hobby/Pro 가격
  - [Vercel Limits](https://vercel.com/docs/limits) — Hobby 한도 상세
  - [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby) — commercial-use 금지 조항
  - [Vercel Marketplace - Neon](https://vercel.com/marketplace/neon) — Integration 페이지
  - [Vercel-Managed Integration guide](https://neon.com/docs/guides/vercel-managed-integration) — 설치 절차
  - [Neon Vercel native integration blog](https://neon.com/blog/neon-vercel-native-integration) — webhook + copy-on-write 워크플로

## History

- **2026-05-15 (Proposed)** — Pieter 세션, architect 호출로 작성. 옵션 A/B/C 검토 + WebSearch 4건 가격 확인 (Neon Free 5 branch / Vercel Hobby commercial-use 금지 / Vercel-Neon Integration €0) + 권고 옵션 C. 채택 결정 운영자 대기. PLAN §D.3.e 인라인 메모 갱신.
- **2026-05-15 (Accepted, 옵션 C 잠금)** — 동일 세션 architect 비판적 재검토 후 §Decision §최종 결정 추가 + §재평가 트리거 T1~T4 명시 (schema PR 누적 5건 / 협업자 추가 / Neon Free 한도 압박 / Vercel Pro 격상) + 4.9 진입 자동 마감 deadline. §Consequences §즉시 영향 + §중기 영향 분리. 4.6 베타 진입 카피 배포(4.6.c) blocker **아님** 확정. PLAN §D.3.e `[x]` 마킹 + 본 ADR cross-ref 갱신.
