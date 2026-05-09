# Slim — 마스터 플랜

> **단일 출처 (Single Source of Truth).** 모든 작업은 이 파일의 항목과 매칭된다.
> 매칭 안 되는 작업은 시작하기 전에 이 문서에 추가한다.
>
> 진행 표기: `[ ]` 미시작 · `[~]` 진행 중 · `[x]` 완료 · `[!]` 차단됨
>
> 자동 검증: `pnpm harness:plan` (PLAN.md ↔ 실제 파일 정합성)
>
> **현실 기준 (2026-05-09):** 운영자 = Kim Wonmin (솔로, 사이드, 개발 3개월,
> 월 €300 ALL-IN, TVA 대기 중). 따라서 페이즈별 일정은 풀타임 주차가 아니라
> **솔로 사이드 월(=M1, M2…)** 단위로 표기한다. 결정 근거는
> [ADR-0003](docs/adr/0003-plan-realism-solo-side.md). 카테고리 우선순위는
> 동 ADR §결정 1 참조.

---

## 페이즈 0 · 기반 (Foundation) — 완료 (M0)

**목표:** Pieter가 어떤 작업이든 시작할 수 있는 환경.

- [x] **0.1** 모노레포 초기화 (`pnpm init` + workspaces)
  - DoD: `pnpm install`이 0 에러로 끝난다
- [x] **0.2** Next.js 15 (App Router) + TypeScript strict
  - DoD: `pnpm typecheck` 0 에러 / strict, noUncheckedIndexedAccess 활성
- [x] **0.3** Tailwind 4 + shadcn/ui + 디자인 토큰
  - DoD: `<Button>`, `<Card>`, `<Input>` 3종이 `Slim` 브랜드 색으로 렌더
  - 토큰: `--color-bg`, `--color-fg`, `--color-primary`, `--color-accent` (CLAUDE.md 색상)
- [x] **0.4** Drizzle + Neon Postgres 연결
  - DoD: `pnpm db:push`로 빈 스키마 마이그레이션 성공
- [x] **0.5** ESLint + Prettier + lint-staged + husky
  - DoD: 커밋 시 자동 lint
- [x] **0.6** Vitest + Playwright 셋업
  - DoD: `pnpm test`, `pnpm test:e2e` 둘 다 빈 테스트로 통과
- [x] **0.7** `.claude/` 워크플로우 활성화 (이 문서, agents, hooks, harness)
  - DoD: `/verify-plan` 슬래시 커맨드가 응답한다

**Phase 0 검증:** `pnpm harness:plan && pnpm typecheck && pnpm test`

---

## 페이즈 0.5 · 운영 부채 정리 (Operational Debt) — M0 잔여

**목표:** 페이즈 0 종료 시점에 표면화된 운영 부채를 페이즈 1 시작 전에 닫는다.
규모는 작지만 P4 강제 위치(=헌법) 와 직결되어 ADR-0002로 결정 기록됨.

> 헌장: [ADR-0002](docs/adr/0002-build-gate-ownership.md) — Build gate 책임
> 분리 + Hook jq fallback 통일. **Amendment 1 (2026-05-09)**: CI lint 단계
> 제거 → D.1.d 신설.

- [ ] **D.1** Vercel build gate 책임 분리 (ADR-0002 Decision 1 + Amendment 1)
  - **D.1.a** `next.config.ts`에 `typescript.ignoreBuildErrors: true` +
    `eslint.ignoreDuringBuilds: true` 추가
  - **D.1.b** `.github/workflows/ci.yml` 신설 — push/PR마다 5단 게이트
    (typecheck → lint → test → harness:plan → harness:data) 직렬 실행
    > Amendment 1으로 D.1.d에서 lint 단계 제거 → 실제 운영은 4단 게이트.
  - **D.1.c** `main` 브랜치 보호 규칙 (GitHub repo settings) — CI 통과 필수
    체크박스 활성화 (수동 작업, scribe가 운영 노트로 기록)
  - **D.1.d** `.github/workflows/ci.yml`에서 `Lint` 단계 제거 (Amendment 1)
    — GitHub Actions ubuntu-latest에서 `pnpm lint`가 ESLint 9 +
    `@next/eslint-plugin-next` 호환성 이슈로 매번 실패. lint는 로컬
    stop-gate 단독 책임으로 환원. `continue-on-error: true` 등 거짓 안전
    신호 옵션은 거부됨 (ADR-0002 Amendment 1 §거부된 대안 참조).
    - DoD: (1) ci.yml에서 `Lint` 단계 라인 완전 제거 (2) 다음 push에서
      GitHub Actions 워크플로가 ✅로 끝남 (typecheck/test/harness 모두
      통과 가정) (3) `pnpm lint`는 로컬 + Husky pre-commit에서 여전히
      강제됨을 verifier가 확인
  - DoD (D.1 전체): (1) `next build` 로컬 통과 (2) Vercel preview 배포 1회
    성공 (3) 의도적으로 typecheck를 깨는 PR이 GitHub Actions에서 ❌로 차단됨
    (4) D.1.d 적용 후 ci.yml이 4단 게이트로 안정 동작
  - 검증: ADR-0002 §검증 방법 1 + Amendment 1 §결과
- [x] **D.2** Hook jq fallback 통일 (ADR-0002 Decision 2)
  - [x] **D.2.a** `scripts/hooks/pre-tool-guard.sh:10`의 jq 의존 제거 — `_lib.sh`
    의 fallback 패턴(또는 동등한 인라인 sed/awk)으로 `tool_input.command` 추출
  - DoD: jq 부재 환경(Windows + PATH에서 jq 제거)에서 `rm -rf /` 입력 시
    차단 메시지 정상 출력
  - 검증: ADR-0002 §검증 방법 2

**Phase 0.5 검증:** `pnpm harness:plan && pnpm typecheck && pnpm lint &&
pnpm test` + 위 DoD 모두 충족.

---

## 페이즈 1 · 데이터 레이어 (Data Foundation) — M1 ~ M3

**목표:** 한 카테고리(=**통신, 모바일/인터넷 BE**)에서 100% 정확한 가격 비교가
가능한 데이터 파이프라인.

> **카테고리 선택 근거 (ADR-0003 §결정 1)**: 베네룩스에는 이미 CREG/VREG가
> 인증한 에너지 비교 도구(Energyprice.be, V-test, DareToCompare)가 존재해
> *정면 승부 시 차별화가 약하다*. 반면 통신(모바일+인터넷)은 BE/NL 양쪽에서
> 통합 비교 도구가 분산되어 있고, 어필리에이트 단가가 €15~€120(인터넷 LTV
> 큼)으로 안정적이라 솔로 수익 모델에 더 적합. 자세한 트레이드오프는
> ADR-0003 참조. **에너지는 페이즈 5에서 검토** (페이즈 4 후 6개월 평가).

### 1.A 스키마

- [x] **1.1** `provider` 테이블 (공급사 마스터)
  - 필드: `id`, `country` (BE/NL/LU), `name`, `legal_name`, `vat_id`, `website`, `affiliate_status`
- [x] **1.2** `tariff` 테이블 (요금제) — **통신 BE 가정** (ADR-0005)
  - 필드: `provider_id`, `category` (mobile/internet_fixed/bundle_internet_tv/landline), `name`, `slug`, `currency` (EUR), `monthly_price_cents` (BIGINT), `activation_fee_cents`, `modem_rental_cents`, `commitment_months` (0=없음), `early_termination_fee_cents`, `promo_price_cents`, `promo_months`, `promo_description`, `attributes` (JSONB; 카테고리별 변동 속성 — Zod 검증), `is_active`, `last_seen_at`, `source_url`
  - 결정 근거: [ADR-0005](docs/adr/0005-tariff-schema-telecom.md) — 단일 테이블 + JSONB attributes (T1), BIGINT cents (T2), 시계열은 1.3 단독 (T5)
- [x] **1.3** `tariff_snapshot` 테이블 (가격 시계열) — **마스터/스냅샷 분리** (ADR-0006)
  - 필드: `id`, `tariff_id` (FK CASCADE), `fetched_at` (NOT NULL), `source_url` (NOT NULL), `monthly_price_cents` (BIGINT, NOT NULL), `activation_fee_cents` (default 0), `modem_rental_cents`, `promo_price_cents`, `promo_months`, `price_payload` (jsonb 미러), `raw_payload` (jsonb 정규화 only), `confidence` enum (high/medium/low) + `confidence_reason`, `is_anomaly` boolean + `anomaly_reason`, `created_at`
  - 인덱스: `(tariff_id, fetched_at DESC)` (T7 비교 엔진 hot path) · `(is_anomaly)` · `(fetched_at DESC)`
  - 리텐션: 90일 후 `raw_payload` + `price_payload` NULL화 — 메타 영구 보존 (T6, 1.5.2 cron 보조)
  - 결정 근거: [ADR-0006](docs/adr/0006-tariff-snapshot-schema.md) — Append-only (T1), 평탄화 5컬럼 + JSONB 미러 (T2), 정규화 JSON only (T3), confidence enum + reason (T4), anomaly 컬럼 + 비교 엔진 자동 제외 (T5), 90일 리텐션 (T6), DISTINCT ON 쿼리 (T7)
  - DoD: (1) `pnpm harness:data` Rule 4 통과 (`schema-tariff-snapshot-missing` warn 해소) (2) `pnpm db:generate`로 `drizzle/0002_eminent_sunset_bain.sql` 생성 — `CREATE TYPE confidence` + `CREATE TABLE tariff_snapshot` + FK + 인덱스 3개 (3) typecheck/lint/test 0 에러
- [x] **1.4** `comparison_request` (사용자 입력) — **익명 우선 + GDPR 최소화** (ADR-0007)
  - 파일: `src/db/schema/comparison_request.ts`
  - 필드: `id` (uuid PK, 익명 — T1), `user_account_id` (uuid NULL — 페이즈 6 회원 결합 대비), `category` (tariff_category enum 재사용), `postal_code` (text NOT NULL — PC4), `household_type` enum (single/couple/family_3_plus), `current_provider_id` (uuid NULL → provider SET NULL), `input_attributes` (JSONB; 카테고리별 사용량 — Zod 단일 출처는 1.7에서 src/types/comparison-input.ts 신설), `created_at`, `pii_anonymized_at` (T4 cron 갱신 시각)
  - **IP / fingerprint 컬럼 0** (헌법 §8 #1 / #5 — T5)
  - 인덱스: `(category, postal_code)` (비교 엔진 hot path) · `(created_at)` (T4 cron) · `(user_account_id)` · `(pii_anonymized_at)`
  - GDPR 정책: **합법근거 = Art. 6(1)(b) Contract performance** (1차) + (a) 어필리에이트 동의(페이즈 4.1) — T3. **리텐션** = 90일 후 `postal_code` PC2 일반화 + `input_attributes` NULL — T4. 1.5.2 cron 보조 작업.
  - 결정 근거: [ADR-0007](docs/adr/0007-comparison-request-result-schema.md) — 익명 UUID (T1), 평탄화 + JSONB (T2), 합법근거 (T3), 리텐션 분리 (T4), IP 컬럼 0 (T5)
  - DoD: (1) typecheck/lint/test 0 에러 (2) `pnpm db:generate`로 `drizzle/0003_silent_texas_twister.sql` 생성 — `CREATE TYPE household_type` + `CREATE TABLE comparison_request` + FK 1개 (provider SET NULL) + 인덱스 4개 (3) `pnpm harness:plan` + `pnpm harness:data` 통과
- [x] **1.5** `comparison_result` (+ `comparison_result_item`) — **결과 영구 + 영구 링크** (ADR-0007)
  - 파일: `src/db/schema/comparison_result.ts`
  - **comparison_result** 필드: `id` (uuid PK), `request_id` (uuid NULL → comparison_request SET NULL — T8), `short_id` (text UNIQUE NOT NULL — nanoid 12자, T7), `top_monthly_saving_cents` (bigint), `top_yearly_saving_cents` (bigint), `top_tariff_snapshot_id` (uuid → tariff_snapshot RESTRICT), `locked_inputs` (JSONB — T9 90일 후 NULL), `engine_version` (text NOT NULL — 비교 엔진 1.11 버전), `created_at`, `pii_anonymized_at`
  - **comparison_result_item** 필드 (1:N): `id`, `result_id` (uuid → comparison_result CASCADE), `rank` (integer NOT NULL), `tariff_snapshot_id` (uuid → tariff_snapshot RESTRICT), `monthly_saving_cents` (bigint NOT NULL), `yearly_saving_cents` (bigint NOT NULL), `caveats` (text[] — PLAN 1.13), `created_at`
  - 인덱스: result `short_id` UNIQUE (영구 링크 lookup) · `(request_id)` · `(created_at)` (B2B 집계) · `(pii_anonymized_at)` ; item `(result_id, rank)` · `(tariff_snapshot_id)` (역추적)
  - 영구 링크: `/r/[short_id]` (PLAN 3.6). nanoid 12 × alphabet 36 → 36^12 ≈ 4.7e18 공간.
  - GDPR 정책: result 자체 **영구 보존** (영구 링크 + B2B Insights M24+). `locked_inputs` PII 파생물은 90일 후 NULL — T9.
  - 결정 근거: [ADR-0007](docs/adr/0007-comparison-request-result-schema.md) — 1:N 자식 테이블 (T6), nanoid shortId (T7), requestId nullable+SET NULL (T8), lockedInputs 분리 + 90일 NULL (T9)
  - DoD: (1) typecheck/lint/test 0 에러 (2) `pnpm db:generate`로 `drizzle/0003_silent_texas_twister.sql` 에 `CREATE TABLE comparison_result` + `CREATE TABLE comparison_result_item` + FK 4개 + 인덱스 6개 포함 (3) `nanoid` 의존 추가 (`pnpm add nanoid`) (4) `pnpm harness:plan` 통과

### 1.B 데이터 수집

- [x] **1.6** Inngest cron 셋업 — **일 1회 06:00 UTC** (BE 07-08시), 무료 티어
  555배 안전 마진 (ADR-0008)
  - 파일: `src/lib/inngest.ts` (client) + `src/inngest/functions.ts` (cron) +
    `src/app/api/inngest/route.ts` (App Router endpoint)
  - 결정 근거: [ADR-0008](docs/adr/0008-fetcher-interface-and-cron.md) §T6 (일 1회
    + 수동 이벤트), §T7 (네트워크 step + DB step 분리 → 재시도 시 중복 insert
    방지), §T9 (App Router serve), §T10 (DB 싱글턴 + step별 logger)
  - 환경변수 (`.env.example` 갱신): `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
    (production 필수; dev는 `npx inngest-cli@latest dev` devserver 자동 fallback)
  - Cron: `TZ=UTC 0 6 * * *` (DST 회피) + `event: 'fetchers/run.requested'`
    수동 트리거 (어드민/dev `only` 필드로 특정 fetcher만)
  - 1.9 격리 메커니즘은 본 cron의 for-loop continue 패턴이 *자체*로 — 별도
    코드 작업 0
  - DoD: (1) typecheck/lint/test 0 에러 (2) `src/app/api/inngest/route.ts` 가
    GET/POST/PUT export (3) `pnpm dev` + Inngest devserver(`inngest-cli@latest
    dev`)에서 `daily-fetch-all` 함수 dashboard 발견 (4) registry 빈 배열 상태
    에서도 cron 실행이 ok 응답 (no-op 안전)
- [x] **1.7** Fetcher 인터페이스 정의 — **고정 모양 + discriminated union** (ADR-0008)
  - 파일: `src/fetchers/types.ts` (인터페이스) + `src/fetchers/index.ts` (registry)
  - `Fetcher` = `{ metadata: FetcherMetadata; fetch(): Promise<FetchOutcome> }`
  - `FetcherMetadata` = `{ providerSlug, displayName, country, method (api/scraping/manual), version, homepageUrl }` — /data-sources(1.10) 단일 출처
  - `FetchOutcome = { ok: true; result: FetchResult } | { ok: false; error: FetchError }` — type narrow 정확 + 부분 raw 보존
  - `FetchResult.data: TariffSnapshotInput[]` — 한 fetcher = 한 provider의 *모든* tariff 배열 (Inngest exec 보호)
  - `TariffSnapshotInput` 모양은 ADR-0005 + ADR-0006 스키마와 1:1 매핑 (cron persist step은 dumb mapper)
  - 결정 근거: [ADR-0008](docs/adr/0008-fetcher-interface-and-cron.md) §T1 (고정 모양 + 배열), §T2 (1 fetcher = 1 provider), §T3 (confidence 휴리스틱 + down-grade), §T4 (discriminated union), §T5 (metadata + registry 양립)
  - 1.8과 함께 신설 예정: `src/types/tariff-attributes.ts` (Zod, attributes 단일 출처) + `src/fetchers/confidence.ts` (computeConfidence 휴리스틱)
  - DoD: (1) typecheck/lint/test 0 에러 (2) `pnpm harness:data` Rule 1 통과 (`FetchResult` 식별자 보존) (3) `src/fetchers/types.test.ts` ≥4 테스트 (FetcherMetadata, TariffSnapshotInput mobile/internet, FetchResult, FetchOutcome union)
- [x] **1.8** Fetcher **2개** 실 구현 (**통신 BE — 모바일/인터넷**) — scope cut
  옵션 A 적용 ([ADR-0009](docs/adr/0009-scope-cut-fetcher-2-providers.md))
  - **스텁 fetcher 우선 채택** (실 스크래핑은 1.5.6 부채). FOUNDER.md 솔로
    사이드 컨텍스트에서 실 스크래핑은 셀렉터 깨짐 + 디버깅 sink. 스텁으로
    파이프라인(1.10~1.13) 통합 검증 먼저 진행. confidence='low' + stub=true로
    P1 정직성 유지.
  - **Proximus / Telenet** (BE 시장 합산 ≥ 75% 점유 — Telecompaper Q1 2025;
    Proximus ~43% + Telenet ~32%)
  - **Orange BE는 페이즈 5에서 평가 후 추가** (베타 `/data-sources` Orange BE
    CTA click ≥ 20% 또는 운영자 판단 — ADR-0009 §검증 2)
  - 파일: `src/fetchers/proximus.ts`, `src/fetchers/telenet.ts` (ADR-0008
    `Fetcher` 객체 export + `src/fetchers/index.ts` registry 추가)
  - 단위 테스트 2개: `src/fetchers/proximus.test.ts`, `src/fetchers/telenet.test.ts`
  - 신설: `src/types/tariff-attributes.ts` (Zod, ADR-0005 §결정 1) +
    `src/fetchers/confidence.ts` (computeConfidence, ADR-0008 §T3)
  - DoD: (1) typecheck/lint/test 0 에러 ✅ (2) `pnpm harness:data` Rule 1 통과
    (`FetchResult` 식별자 보존) ✅ (3) registry에 2 fetcher 등록 ✅
    (4~5: Inngest devserver + Neon DB 실 누적은 1.5.6 실 스크래핑 전환 시 재검증)
- [x] **1.9** Fetcher 실패 격리 (1개 실패해도 나머지는 진행)
  - ADR-0008 §T7 for-loop + continue 패턴이 격리 메커니즘 — 별도 코드 없음.
  - **STUB_FAIL_PROXIMUS=1** / **STUB_FAIL_TELENET=1** 환경변수로 격리 동작
    수동 검증 가능: 한 fetcher를 실패시켜도 다른 fetcher는 정상 진행됨을
    로그에서 확인. STUB_FAIL 케이스 포함 테스트:
    `src/fetchers/proximus.test.ts` + `src/fetchers/telenet.test.ts`
- [ ] **1.10** **투명성 페이지**: `/data-sources` — 모든 공급사 + 마지막 수집
  시각 + 수집 방법 (API/스크래핑/수동) 공개
  - **제외 공급사 섹션** (헌법 P3 — "비교에서 제외된 공급사도 이름 밝힘"):
    - **Orange BE** — "페이즈 5에서 평가 후 추가 예정" (ADR-0009). 베타
      사용자 신호 수집용 **"Orange BE 비교 요청"** CTA 노출 → click event
      측정 (ADR-0009 §검증 2: ≥ 20% 시 페이즈 5 우선)
    - 기타 비교 불가 공급사도 동일 형식으로 노출 (`provider.excluded_reason`
      필드 직접 표시 — ADR-0001)

### 1.C 비교 엔진

- [ ] **1.11** 절약액 계산 로직 (`src/engine/compare.ts`)
  - 순수 함수, 입력 = `(현재요금제, 사용량 프로파일, 후보 요금제[])`
  - 출력 = `Comparison[]` (각 항목에 `monthly_saving`, `yearly_saving`, `confidence`, `caveats[]`)
- [ ] **1.12** 단위 테스트: 알려진 케이스 12개 (실제 영수증 기반)
  - DoD: 모든 케이스 ±0.01€ 이내
  - **scope cut 옵션 B**: 6개로 축소 가능 (실 청구서 수집이 솔로에서 병목일 시)
- [ ] **1.13** **caveats 메커니즘**: 결과에 항상 주의사항 (예: "이 요금제는 24개월 약정")

**Phase 1 검증:** `pnpm harness:data` — 모든 `tariff_snapshot`이 `source_url` + `fetched_at` 가짐.
**Phase 1 현실 일정:** M1 ~ M3 (3개월). 합리화 근거: 스키마 4개 신설(1.2~1.5)은
1주, fetcher **2개** × 평균 1주(스크래핑/파싱/단위 테스트) = **2주** (ADR-0009
scope cut), 비교 엔진 + 12케이스 실 청구서 수집 = 4주, 운영 부채 + 갑작스런
라이브러리 호환성 = +2주 버퍼. **fetcher -1주 마진은 1.12 청구서 수집 또는
페이즈 1.5 부채에 흡수**.

---

## 페이즈 1.5 · 운영 부채 정리 — M3 말

**목표:** 페이즈 1에서 누적된 부채(=fetcher 마다 생긴 hack, 임시 type assertion,
미작성 README)를 닫고 페이즈 2 진입.

- [ ] **1.5.1** Fetcher 코드 공통화 — **2개** fetcher의 중복 추출 (HTTP retry,
  html 파싱 helper). N=2 표본은 패턴 검출이 약하므로 **추출 후보가 충분치
  않으면 대기** — Orange BE 페이즈 5 추가(N=3) 시 재진입 가능 (ADR-0009 §결정 3)
- [ ] **1.5.2** `pnpm harness:price` (가격 스냅샷 diff) 첫 가동 — 일 1회 cron
  + Sentry 알림 임계값 설정
  - **보조 작업 1 (ADR-0006 §T6)**: 90일 초과 `tariff_snapshot.raw_payload` +
    `price_payload` NULL화
  - **보조 작업 2 (ADR-0007 §T4)**: 90일 초과 `comparison_request` 의
    `postal_code` PC2 일반화 + `input_attributes` NULL → `pii_anonymized_at`
    스탬프
  - **보조 작업 3 (ADR-0007 §T9)**: 90일 초과 `comparison_result.locked_inputs`
    NULL → `pii_anonymized_at` 스탬프
- [ ] **1.5.3** `docs/runbook.md` 신설 — fetcher 깨졌을 때 대응 절차 (솔로
  운영용 self-rescue 체크리스트). 스텁 fetcher → 실 스크래핑 교체 가이드 포함
  (1.5.6과 연동).
- [ ] **1.5.4** `scripts/**` typecheck 복원 (P4 부채) — `tsconfig.json`의
  `exclude: ["scripts/**"]` 제거. 선결 작업: (a) `verify-plan.ts`의 regex match
  group을 `noUncheckedIndexedAccess` 정합화 (b) `e2e-smoke.ts`의 playwright 타입
  import 경로 정리 (c) `bias-audit.ts` 잔존 type 이슈 정리. 9건 미만의 타입
  에러로 추정. 페이즈 1 진행 중에는 의도적으로 미뤄 둠 — 솔로 사이드 컨텍스트
  (FOUNDER.md) + 시간 배분 우선순위.
- [ ] **1.5.5** DB 인스턴스 일치 검증 자동화 (운영 안전 부채). 사고 근거:
  2026-05-09 — db:push가 production이 아닌 다른 Neon 브랜치에 적용되어 운영자가
  production 브랜치 검증 시 0 tables 발견. scripts/verify-db.ts 작성 + 강화 완료
  (host/endpoint 노출). 후속 작업: (a) verify-db.ts를 `pnpm verify:db` 스크립트로
  package.json 등록 (b) stop-gate.sh 또는 CI에 통합해 매 커밋 전 host 일치 확인
  (c) `.env.local.expected_host` 같은 *기대 host* 메모를 두고 verify-db.ts가
  실제 host와 비교 — 불일치 시 게이트 실패. 페이즈 1.5 진입 시 실행.
- [ ] **1.5.6** Proximus + Telenet **실 스크래핑 fetcher 구현** (스텁 → 실 데이터
  교체). PLAN 1.8 스텁 fetcher의 후속 부채.
  - `src/fetchers/proximus.ts`: 실 HTML fetch + 셀렉터 추출 로직. AbortController
    25s timeout 활성화. 파싱 경고 시 confidence='medium'.
  - `src/fetchers/telenet.ts`: 동일 패턴.
  - 셀렉터 안정성 검증 + sanity check 강화 → confidence='low' → 'medium'/'high'
    격상 목표.
  - `docs/runbook.md`(1.5.3)와 연동 — 셀렉터 깨짐 시 대응 절차.
  - DoD: 실 Neon DB에 `tariff_snapshot` 행 2 fetcher × N tariff 누적 확인.
    confidence='low' 비율 < 20% (스텁 100%에서 격상).

**Phase 1.5 검증:** verifier — typecheck/lint/test 0 에러 + 신설 runbook 존재.

---

## 페이즈 2 · 입력 플로우 (User Input) — M4 ~ M5

**목표:** 5단계 5분 입력. 이탈률 < 30% (PostHog 측정).

- [ ] **2.1** 카테고리 선택 화면 (랜딩에서 진입)
- [ ] **2.2** 단계 1: 우편번호 (BE/NL/LU 자동 인식)
- [ ] **2.3** 단계 2: 가구 형태 (혼자/커플/3+) → 사용량 추정 fallback
- [ ] **2.4** 단계 3: 현재 공급사/요금제 (선택적, 모르면 스킵)
- [ ] **2.5** 단계 4: 청구서 업로드 (선택적) — OCR로 사용량 추출
  - DoD: tesseract.js로 BE 통신 청구서 5종 읽기 성공률 > 80%
  - **scope cut 옵션 C** (추천): **OCR을 페이즈 5로 미룸**. M4-M5에는 수동
    입력만. OCR은 솔로에게 가장 큰 시간 싱크홀 — 청구서 5종 수집 + tesseract
    튜닝이 1-2개월 흡수. 베타에는 영향 없음.
- [ ] **2.6** 단계 5: 결과 미리보기 → "더 보기" 클릭으로 풀 결과
- [ ] **2.7** 진행 표시 + 백 가능 + 데이터 자동 저장 (sessionStorage)
- [ ] **2.8** 모바일 우선 디자인 (375px 기준 시작)
- [ ] **2.9** 접근성: 키보드만으로 완주 가능, axe-core 0 violations

**Phase 2 검증:** Playwright E2E — 입력 → 결과까지 5분 이내 (CI에서 측정).
**Phase 2 현실 일정:** M4 ~ M5 (2개월). UI 9개 + Playwright E2E + i18n
(nl-BE/fr-BE 우선 2개) 가정. OCR cut 시 1.5개월로 단축 가능.

---

## 페이즈 3 · 결과 페이지 (Results) — M6 ~ M7

**목표:** "결론 → 근거 → 원본"의 3층 구조.

- [ ] **3.1** **1층 — 결론 카드** (스크롤 없이 보임)
  - 1위 추천 + 연간 절약액 + "변경하기" CTA
- [ ] **3.2** **2층 — 비교 표** (다나와 스타일 정보 밀도)
  - 상위 5개, 컬럼: 공급사 / 월 비용 / 절약액 / 약정 / 데이터 한도 / 신뢰도
  - 정렬 가능, 필터 가능 (약정 없음만, 무제한 데이터만 등)
- [ ] **3.3** **3층 — 원본 링크**
  - 각 행에 "공식 요금제 페이지 보기" + "마지막 확인: X시간 전"
- [ ] **3.4** **제외된 공급사 섹션** — 왜 비교에서 빠졌는지 (P3)
- [ ] **3.5** **계산 근거 펼치기** — 사용한 가정, 사용량 수치, 적용 산식
- [ ] **3.6** **공유 가능한 영구 링크** (`/r/[id]`) — 결과 스냅샷 영구 보관
- [ ] **3.7** **인쇄 친화 뷰** (`@media print`) — 시니어 사용자 인쇄해서 비교
  - **scope cut 옵션 D**: 인쇄 뷰는 페이즈 6으로 미룸 (베타 영향 0)

**Phase 3 검증:** Lighthouse 모바일 ≥ 90 (Perf/Acc/BP/SEO).
**Phase 3 현실 일정:** M6 ~ M7 (2개월).

---

## 페이즈 3.5 · 운영 부채 정리 — M7 말

**목표:** 페이즈 1~3 누적 부채 + 베타 직전 외부 시각 점검.

- [ ] **3.5.1** Lighthouse / axe-core 자동화 — `pnpm harness:e2e`에 통합
- [ ] **3.5.2** SEO 메타 / sitemap.xml / robots.txt — 베타 시드를 위해 필수
- [ ] **3.5.3** 첫 부하 테스트 — Vercel Hobby 100GB bandwidth 한도 도달
  시뮬레이션 (k6 또는 단순 Playwright 100 동시)

---

## 페이즈 4 · 전환 플로우 + 베타 (Switch Flow + Beta) — M8 ~ M10

**목표:** 결과에서 실제 공급사 변경까지 3클릭 + 베타 100명 모집/검증.

> 페이즈 4는 원 PLAN의 페이즈 4(전환) + 페이즈 7(런치)을 **솔로 + TVA 발급
> 후의 어트리뷰션 검증 1주기**로 묶었다. ADR-0003 §결정 4 참조.

- [ ] **4.1** 어트리뷰션 시스템 (`affiliate_click` 테이블)
  - 누가 / 언제 / 어느 결과에서 / 어느 공급사로 갔는지
- [ ] **4.2** 제휴 가능 공급사 우선 — **그러나 절대 검색 결과 순위에 영향 X**
  - 알고리즘: 절약액 순. 제휴 여부는 "변경하기" 버튼 색만 다름
- [ ] **4.3** 제휴 비공개시 명시적 디스클로저 (각 결과 카드 하단)
  - 예: "Slim은 변경 시 Proximus로부터 €X의 수수료를 받습니다 — 이 금액은 회원님의 요금에 영향이 없습니다"
- [ ] **4.4** 비제휴 공급사도 동등하게 표시 (그냥 외부 링크 + "수수료 없음" 표기)
- [ ] **4.5** 전환 후 7일 이내 후속 메일 (선택 동의)
  - "변경 잘 됐나요?" — 변경 실패시 Slim이 자동 메일로 후속 (인적 switching service는 솔로에서 비현실)
- [ ] **4.6** **베타 모집** — Antwerpen / Brussels / Luxembourg 시티에서 100명
  - 채널: 한인 커뮤니티(Korean Society BE/NL/LU), Reddit r/belgium, salair-plus.com
    링크 (운영자 기존 자산), 한국어 트위터/스레드
  - **모집 카피의 정직성 (헌법 P3 + ADR-0009)**: "현재 BE 시장 ≥ 75% 점유 2개
    공급사(Proximus + Telenet)를 깊이 비교 중. Orange BE는 다음 페이즈에서
    추가." 솔로 신생 사이트의 *비교 좁은 폭 + 깊은 신뢰* 포지셔닝과 일관.
  - **scope cut 옵션 E**: 50명으로 축소 가능 (피드백 신호엔 충분)
- [ ] **4.7** 피드백 1주 + 반영
- [ ] **4.8** PR 매체 컨택 (베타 후) — De Tijd / FD / Tech.eu / Bright / Trends
  중 **3곳** (5곳은 솔로 부담 큼)
- [ ] **4.9** 런치 — 통신 카테고리만 BE 우선 오픈 (NL/LU는 페이즈 5에서)

**Phase 4 검증:** 어트리뷰션 정확성 — `pnpm harness:price` + 수동 5건 검증
+ 베타 NPS ≥ 30.
**Phase 4 현실 일정:** M8 ~ M10 (3개월). 어트리뷰션 + UI + 베타 모집/반영 +
PR이 솔로에서 병렬화 어려워 3개월 가정.

---

## 페이즈 4.5 · 운영 부채 + 평가 게이트 — M10 ~ M11

**목표:** 베타/런치 후 **6개월 평가**의 스타팅 포인트 마련. 페이즈 5 결정의
근거 데이터 수집.

- [ ] **4.5.1** 어드민 대시보드 v0 (`/admin`) — 일별 비교 수, 전환율, fetcher
  헬스 (페이즈 6.1의 축소판)
- [ ] **4.5.2** Sentry 알림 + Inngest 실패율 모니터
- [ ] **4.5.3** **6개월 평가 시작** — 페이즈 5 (멀티 카테고리)는 다음 조건이
  M16에 만족할 때만 시작:
  - 통신 BE에서 월 매출 ≥ €1,000 (CPA 어트리뷰션 검증됨)
  - 비교 → 변경 CVR ≥ 3% (벤치 기준 보수적)
  - fetcher 안정성 ≥ 95% (24h 신선도)
  - 운영자 시간 여유 ≥ 주 10h (사이드 유지 가능 신호)
  - 미달 시: 통신 카테고리 자체 개선에 페이즈 5 시간을 다시 투입

---

## 페이즈 5 · 카테고리 확장 (Multi-category) — **M16 평가 후 결정**

**목표:** 통신 BE 검증 후 **다음 카테고리 1개**를 추가. 5개 동시 확장은 솔로에서
비현실 — 1개씩 순차.

> ADR-0003 §결정 2에 따라 페이즈 5는 **페이즈 4.5의 게이트 통과 시에만 진입**.
> 미통과 시 통신 카테고리 깊이를 늘리거나 (NL/LU 확장), 운영 시간 / 예산 여유에
> 따라 보류한다. 즉 이 페이즈의 일정은 *조건부*다.

### 5.A 다음 카테고리 후보 (우선순위)

- [ ] **5.0** **Orange BE fetcher 추가** (ADR-0009 §결정 1) — 페이즈 4 베타
  `/data-sources` "Orange BE 비교 요청" CTA click ≥ 20% 시 우선. `src/fetchers/
  orange-be.ts` 신설 (ADR-0008 인터페이스 그대로) + `src/fetchers/orange-be.test.ts`
  + registry 1줄 추가. 추가 코드 ≈ 1주.
- [ ] **5.1** **에너지 BE** (M17 ~ M19 예상) — 통신 fetcher/엔진 재사용 가능,
  벤치마크(CREG 인증 도구) 분석 후 차별화 포인트(투명성 KPI, 가격 시계열
  그래프)로 진입
- [ ] **5.2** **모기지 / 대출** (M20+ 예상) — CPL 단가 €50~€150으로 큼, 그러나
  법무 부담(MiFID II / FSMA 등록)으로 legal 에이전트 사전 검토 필수
- [ ] **5.3** 보험 (자동차/주택) — 파트너 API 의존도 큼 (Yago/Wegus 컨택 필요),
  솔로 영업 부담 → **M24+ 또는 시드 모금 후로 미룸**
- [ ] **5.4** 금융 (계좌/카드), 여행 — **PLAN에서 대기열로 이동**, 매분기 재평가

### 5.B 공통 인프라

- [ ] **5.5** 카테고리별 입력 플로우 (재사용 가능 컴포넌트) — 페이즈 2의
  carousel 컴포넌트 추출
- [ ] **5.6** 카테고리간 교차 추천 ("통신 €120 절약하셨네요. 에너지도 비교해볼까요?")

**Phase 5 검증:** 도입한 카테고리에서 ≥ 80% 비교 가능률 (입력 5건 중 4건 이상
결과 표시).
**Phase 5 현실 일정:** M17 ~ M21 (조건부, 1 카테고리당 3-4개월).

---

## 페이즈 6 · 운영 인프라 (Operations) — M22 ~ M24

> 페이즈 6은 페이즈 5와 일부 병렬 가능 (운영자 시간 여유에 따라). 보수적으로
> 페이즈 5 후로 배치.

- [ ] **6.1** 어드민 대시보드 v1 (`/admin`)
  - 4.5.1의 v0를 정식 대시보드로 확장 — 카테고리별 평균 절약액 추가
- [ ] **6.2** Sentry 알림 — fetcher 실패율 > 20%면 페이지
- [ ] **6.3** 가격 변동 모니터링 — `pnpm harness:price`를 cron화 (1.5.2에서
  착수, 여기서 정식화)
- [ ] **6.4** GDPR 도구
  - 데이터 다운로드 (`/account/export`) + 삭제 (`/account/delete`)
- [ ] **6.5** 쿠키 동의 (CookieBot 무료 티어 또는 자체) — 베네룩스 GDPR + ePrivacy
- [ ] **6.6** Status 페이지 (`status.slim.eu`) — fetcher 헬스 공개
- [ ] **6.7** **Bias audit 운영화** — `pnpm harness:bias` cron (월요일 06:00 UTC) + Sentry 알림
- [ ] **6.8** **GDPR 처리 등록부** (`docs/legal/gdpr-register.md`) — legal 에이전트가 자동 갱신
- [ ] **6.9** **`/legal/affiliate-disclosure` 페이지** — 모든 파트너 + 단가 공개 (legal가 검증)
- [ ] **6.10** **외부 GDPR 감사 1회 (€800)** — 베타 직전이 아닌 **수익 발생
  ≥ €5,000/월 시점**에 시행. ADR-0004 §결정 3 참조.

**Phase 6 검증:** 외부 GDPR 감사 통과 — legal 자체 검토 후 외부 점검은 잔여 리스크만.

---

## 페이즈 7 · (예약) — M24+

> 원 PLAN의 페이즈 7(런치)는 페이즈 4로 흡수됨. 본 페이즈는 **시드 모금 평가
> 또는 풀타임 전환 평가**의 자리홀더로 예약. ADR-0004 §결정 6 참조.

- [ ] **7.1** M24 회고 — 매출 / 시간 / 만족도 / 시장 위치 평가
- [ ] **7.2** 시드 옵션 평가 (PMV / Innovation Industries / 매체 파트너십 C)
- [ ] **7.3** 풀타임 전환 vs 사이드 유지 결정 — 운영자 본업/거주/세무 상태 동반 검토

---

## 작업 추적 메타

| 페이즈 | 항목 수 | 완료 | 차단 | 현실 일정 (솔로 사이드) | 최종 업데이트 |
|---|---|---|---|---|---|
| 0 | 7 | 7 | 0 | M0 (완료) | 2026-05-09 |
| 0.5 | 2 | 1 | 0 | M0 잔여 | 2026-05-09 |
| 1 | 13 | 9 | 0 | M1 ~ M3 | 2026-05-09 |
| 1.5 | 6 | 0 | 0 | M3 말 | 2026-05-09 |
| 2 | 9 | 0 | 0 | M4 ~ M5 | 2026-05-09 |
| 3 | 7 | 0 | 0 | M6 ~ M7 | 2026-05-09 |
| 3.5 | 3 | 0 | 0 | M7 말 | 2026-05-09 |
| 4 | 9 | 0 | 0 | M8 ~ M10 (베타 + 런치 통합) | 2026-05-09 |
| 4.5 | 3 | 0 | 0 | M10 ~ M11 + M16 평가 | 2026-05-09 |
| 5 | 7 | 0 | 0 | M17 ~ M21 (조건부, 5.0 Orange BE 신설 — ADR-0009) | 2026-05-09 |
| 6 | 10 | 0 | 0 | M22 ~ M24 | 2026-05-09 |
| 7 | 3 | 0 | 0 | M24+ (예약) | 2026-05-09 |
| **합계** | **79** | **17** | **0** | M0 ~ M24 (≈ 18-24개월) | 2026-05-09 |

> 이 표는 `verifier` 에이전트가 매 `/checkpoint`마다 자동 갱신한다.
> 페이즈 X.5는 운영 부채 트랙으로, ADR-0002(0.5)와 ADR-0003(1.5/3.5/4.5)에
> 묶여 있다. 합계는 풀타임 12주 → **솔로 사이드 18-24개월**로 재조정됨
> (ADR-0003).
> **실측 vs 가정 일정**: 각 페이즈 종료 시 `actual M` 컬럼을 추가해 다음
> 페이즈 일정을 보정한다 — ADR-0003 §검증 방법 참조.

### Scope cut 옵션 (사용자 승인 후 적용)

- 옵션 A: 1.8 fetcher 3개 → 2개 (Proximus + Telenet) — **적용됨 (ADR-0009, 2026-05-09)**
- 옵션 B: 1.12 알려진 케이스 12개 → 6개
- 옵션 C: 2.5 OCR을 페이즈 2 → 페이즈 5로 미룸 (1-2개월 단축, 권장)
- 옵션 D: 3.7 인쇄 뷰를 페이즈 3 → 페이즈 6으로 미룸
- 옵션 E: 4.6 베타 100명 → 50명
