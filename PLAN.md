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
  — 코드 3건(a/b/d) 완료 + DoD #1 통과. 남은 건 운영자 수동 작업(D.1.c)
  + Vercel preview / 음성테스트 PR 결과 확인(DoD #2·#3). 2026-05-11 상태.
  - [x] **D.1.a** `next.config.ts`에 `typescript.ignoreBuildErrors: true` +
    `eslint.ignoreDuringBuilds: true` 추가 — `next.config.ts:12-13`. `pnpm build`
    로그에 "Skipping validation of types" / "Skipping linting" 확인.
  - [x] **D.1.b** `.github/workflows/ci.yml` 신설 — push/PR마다 5단 게이트
    (typecheck → lint → test → harness:plan → harness:data) 직렬 실행
    > Amendment 1으로 D.1.d에서 lint 단계 제거 → 실제 운영은 4단 게이트.
    > 2026-05-11: ci.yml 인코딩 정리 — UTF-8 BOM 제거 + 깨진 em-dash 스텝명
    > (`Harness ??plan integrity`) → `Harness - plan integrity`로 교정.
  - [ ] **D.1.c** `main` 브랜치 보호 규칙 (GitHub repo settings) — CI 통과 필수
    체크박스 활성화 (수동 작업, scribe가 운영 노트로 기록)
  - [x] **D.1.d** `.github/workflows/ci.yml`에서 `Lint` 단계 제거 (Amendment 1)
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
- [ ] **D.3** ARBITORIA 정렬 follow-ups (ADR-0020 결정 3/4/6/7) — GATE-K
  (페이즈 4 베타 진입) 직전 일괄 처리. 5 작업:
  - **D.3.a** Vercel App을 ARBITORIA-BE org에 직접 설치 (현 redirect follow를
    org 직접 권한으로 격상, 운영자 5분)
  - **D.3.b** Vercel team scope 결정 — personal `kimwonmin91-4132s-projects`
    유지 vs ARBITORIA team 신설 (별도 ADR-0021 트리거, 비용 영향 검토)
  - **D.3.c** Vercel runtime env vars 등록 — production + preview 양쪽에
    EXPECTED_DB_ENDPOINTS / INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY 3개 추가
  - **D.3.d** `slim.lu` 도메인 Vercel Domains 검증 + SSL 발급 (ADR-0020
    §Appendix C 6단계, 운영자 ~10분)
  - **D.3.e** Neon-side Vercel Integration 도입 검토 (PR마다 DB branch 자동
    생성 — 페이즈 4 베타에서 사용자 데이터 격리 가치 큼, 별도 ADR(가칭
    **ADR-0024**) 트리거 — ADR-0022가 0022를, ADR-0023이 Lighthouse 하네스로
    0023을 소비했으므로 0024로 재지정)
  - 결정 근거: [ADR-0020](docs/adr/0020-arbitoria-inventory-and-alignment-corrections.md)
- [x] **D.4** DB 환경 분리 정책 적용 (ADR-0022) — production / preview /
  development 3 Neon 브랜치 + prod URL Console-only SoT + 인라인 명령 강제
  — 2026-05-11 완료 (a~e 전부). DoD 4항 충족: ADR ✅ / development 브랜치 존재 +
  `pnpm verify:db` all-green ✅ / `.env.local` = development pooled string (운영자 보고) /
  `pnpm dev`는 development만 접근.
  - [x] **D.4.a** ADR-0022 작성 — production/preview/development 3 브랜치 분리
    (D1) + prod connection string은 Neon Console만 SoT, 어디에도 영속 저장 X
    (D2) + `EXPECTED_DB_ENDPOINTS` allowlist 3 endpoint 확장 (D3) + production
    접근은 인라인 `DATABASE_URL=...` 명령으로만 (D4)
  - [x] **D.4.b** 운영자: Neon Console에서 `development` 브랜치 (parent=production)
    — 2026-05-11 확인 시 이미 존재 (production[Default]/development/preview 3 브랜치).
    development endpoint: `ep-noisy-meadow-aliaxayq` (host `...−pooler.c-3.eu-central-1.aws.neon.tech`,
    Frankfurt). 신규 생성 작업 불필요 — 사실상 완료.
  - [x] **D.4.c** Pieter: `.env.local.example` 신설 (DATABASE_URL=development 기본값
    + EXPECTED_DB_ENDPOINTS 3개 = production/preview/development endpoint ID + D4
    인라인 명령 메모) — 2026-05-11. dev endpoint 실 ID(`ep-noisy-meadow-aliaxayq`)
    반영 완료. `scripts/verify-db.ts`는 이미 콤마 allowlist 지원(`L44`+`L66-72` —
    host에서 `-pooler`/region 꼬리 떼고 endpoint ID만 비교) — 코드 변경 불필요 확인.
  - [x] **D.4.d** 운영자: 로컬 `.env.local`의 `DATABASE_URL`을 development(pooled)로
    전환 + `EXPECTED_DB_ENDPOINTS=ep-fancy-fog-alt18340,ep-autumn-water-all6d93e,ep-noisy-meadow-aliaxayq`
    등록 — 2026-05-11. `pnpm verify:db` all-green (allowlist 매칭 / 6 tables / seed 2 rows).
  - [x] **D.4.e** 운영자: Vercel production env `EXPECTED_DB_ENDPOINTS=ep-fancy-fog-alt18340`
    + preview env `=ep-autumn-water-all6d93e` (단일) — 2026-05-11, non-sensitive 등록.
    (D.3.c의 나머지 2 키 `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY`는 GATE-K에서 처리 — Inngest 프로젝트 셋업 후.)
  - DoD (D.4 전체): (1) ADR 작성 ✅ (2) `development` 브랜치 존재 + 로컬
    `pnpm verify:db`가 development endpoint로 통과 (3) `.env.local` grep에
    production host 0건 (4) `pnpm dev`가 development 브랜치만 만짐
  - 검증: [ADR-0022](docs/adr/0022-database-environment-separation.md) §Validation
- [ ] **D.5** verifier 에이전트 read-only 경계 — **ADR-0025** (커밋 금지 + 게이트
  발명 금지). 2026-05-12 세션에서 verifier 가 (a) 자율로 `git commit` 실행
  (`2bc0ed1`, /checkpoint 흐름 아님) (b) "uncommitted=Gate 5 FAIL" 이라는 존재하지
  않는 게이트를 발명해 오보 — 두 사례로 게이트 신뢰성 훼손. 결정: verifier 는
  검증/보고만, 커밋은 scribe/`/checkpoint` 전용, 불일치는 patch proposal 로 인계,
  게이트 목록(헌장 §4 [4] 6종 + 호출 프롬프트 추가분)을 발명하지 않음. **D.5.a
  완료 (본 작업)**; D.5.b 는 에이전트 정의 변경이라 다음다음 세션부터 효과
  (메모 `reference_subagent_tool_reload.md`).
  - [x] **D.5.a** ADR-0025 작성 — T1(커밋 금지, read-only git 만) / T2(불일치는
    보고만, PLAN 마킹 외 Edit 금지) / T3(게이트 발명 금지) / T4(도구 차원 강제 —
    `.claude/agents/verifier.md` 갱신). 사례 2건 + 대안 A~D 명시.
  - [x] **D.5.b** `.claude/agents/verifier.md` system prompt 에 T1~T3 명시 —
    `tools:` 의 `Bash`/`Edit` 는 유지(게이트 실행·PLAN 마킹 필요)하되 프롬프트로
    `git commit`/`push`/`add` 금지 + PLAN 마킹 외 파일 Edit 금지 + 게이트 발명 금지를
    못 박음. **주의**: 이 변경은 현 세션 spawn 되는 verifier 에 미반영 — 효과 검증은
    다음다음 세션. 본 작업 검증 위해 verifier 호출하지 않음.
  - [ ] **D.5.c** (선택) `/checkpoint` 슬래시 커맨드에 "커밋은 여기(또는 scribe)
    에서만 — verifier 는 커밋하지 않음" 명시 강화 검토 — 운영자 판단. ADR-0025 §T1.
  - DoD (D.5 전체): (1) ADR-0025 Accepted (2) `.claude/agents/verifier.md` 에
    T1~T3 명시됨 (3) `pnpm harness:plan` 통과 (D.5 항목 추가 후 합계 표 정합).
  - 검증: [ADR-0025](docs/adr/0025-verifier-read-only-commit-boundary.md) §Verification
    — 다음 verifier 호출 시 (a) 커밋 안 함 (b) 불일치는 "❌ 차단 — 수정 필요" 로 인계
    (c) 게이트 발명 안 함.

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
- [x] **1.10** **투명성 페이지**: `/data-sources` — 모든 공급사 + 마지막 수집
  시각 + 수집 방법 (API/스크래핑/수동) 공개
  - **제외 공급사 섹션** (헌법 P3 — "비교에서 제외된 공급사도 이름 밝힘"):
    - **Orange BE** — "페이즈 5에서 평가 후 추가 예정" (ADR-0009). 베타
      사용자 신호 수집용 **"Orange BE 비교 요청"** CTA 노출 → click event
      측정 (ADR-0009 §검증 2: ≥ 20% 시 페이즈 5 우선)
    - 기타 비교 불가 공급사도 동일 형식으로 노출 (`provider.excluded_reason`
      필드 직접 표시 — ADR-0001)
  - DoD (실제 파일, ADR-0011 §T2 6개 항목 모두 구현):
    - `src/app/data-sources/page.tsx` (RSC, ISR revalidate=3600)
    - `src/engine/comparison-stats.ts` (getComparisonStatsByProvider)
    - `src/engine/comparison-stats.test.ts` (5 테스트, 0 row 안전 처리)
    - `src/fetchers/types.ts` (method union에 'stub' 추가 — ADR-0008 Amendment 1)
    - `src/fetchers/proximus.ts` (method 'stub'으로 갱신)
    - `src/fetchers/telenet.ts` (method 'stub'으로 갱신)
  - 검증: typecheck/lint/test/harness:plan/harness:data/verify:db 전 통과

### 1.C 비교 엔진

- [x] **1.11** 절약액 계산 로직 (`src/engine/compare.ts`) — **순수 함수 + 6 케이스
  검증 + caveats 자동 생성** (ADR-0010)
  - 파일: `src/engine/compare.ts` (메인 함수) + `src/engine/types.ts`
    (CompareInput / CompareResult / TariffSnapshotLike / UsageProfile) +
    `src/engine/caveats.ts` (deriveCaveats 순수 함수, T6 8 규칙)
  - `compare(input: CompareInput): CompareResult` — 순수 함수, 입력 변형 X.
    입력 = `(category, currentTariff: TariffSnapshotLike | null, usageProfile,
    candidates[])`. 출력 = `{ engineVersion, ranked: ComparisonItem[],
    topMonthlySavingCents, topYearlySavingCents, generatedAt, meta }`
  - ComparisonItem = `{ tariffSnapshotId, rank, monthlySavingCents,
    yearlySavingCents, confidence, caveats[], breakdown }`. breakdown 에
    monthlyAvg12/24 + monthlySaving12/24 둘 다 보존 (PLAN 3.5 계산 근거 입력)
  - 결정 근거: [ADR-0010](docs/adr/0010-comparison-engine.md) — 카테고리 동일
    후보만 (T1), 사용량은 추천성/caveat 트리거만 (T2 — 헌법 §8 #2 가격 가공 X),
    12개월 + 24개월 둘 다 breakdown (T3), 활성화 12개월 amortize + 위약금
    caveat (T4), confidence min(현재, 후보) 보수적 (T5), deriveCaveats 순수
    함수 (T6), 6 케이스 scope cut 옵션 B (T7)
  - **engineVersion 하드코딩**: `compare@2026-05-09` — 영구 링크(3.6)의 결과
    재현성 보장. ADR-0010 §"Engine version 정책" 변경 트리거 명시.
  - DoD: (1) typecheck/lint/test 0 에러 (2) cents 정수 산술만 — `Math.round`
    한 번 외 부동소수 0 (3) ADR-0010 §T7 6 케이스 + 추가 단위 테스트 ≥3건
    (빈 candidates / 모두 confidence='low' / 자기 참조 / 카테고리 미스매치)
    모두 통과
- [x] **1.12** 단위 테스트: 알려진 케이스 **6개** (운영자 검증 가능 — ADR-0010 §T7) —
  **scope cut 옵션 B 적용됨 (ADR-0010, 2026-05-09)**
  - 파일: `src/engine/compare.test.ts`
  - 6 케이스 (각 케이스의 expected monthlySavingCents 명시 — strict equality):
    1. 평균 커플 모바일 (€25 → €15) — saving = 1000 cents
    2. 저사용 1인 모바일 — saving = -500 cents (현재가 더 저렴, 음수)
    3. 고사용 family 모바일 한도 초과 caveat
    4. VDSL → 케이블 인터넷 (음의 절약 + 12개월 약정 + 프로모 첫 3개월)
    5. 약정 vs 비약정 — 신규 가입자, 프로모 없는 게 12개월 평균 저렴
    6. 신규 가입자 (currentTariff null) 엣지
  - DoD: 모든 케이스 ±0.01€ 이내 (정수 cents 산술이므로 ±0 cent strict equality)
  - **12 케이스 확장 조건** (ADR-0010 Amendment 1 트리거): M3 시점 베타 청구서
    6개 추가 수집 시 6 → 12 확장. 추가 케이스 후보 = 모뎀 임대 / 24개월 번들
    amortize / family 다중 라인 / 다중 anomaly / 카테고리 혼합 입력 등 6종
- [x] **1.13** **caveats 메커니즘**: 결과에 항상 주의사항 (예: "이 요금제는 24개월 약정")
  - **함수 차원 완료**: ADR-0010 §T6 deriveCaveats() 순수 함수가 8 규칙 자동
    생성. `src/engine/caveats.ts` 에서 export.
  - **함수 차원 완료 (ADR-0011 §T1)** — UI 노출은 페이즈 3 진입 시 별도 ADR.
    /data-sources 페이지(1.10)에서 카테고리별 caveats 미리보기로 노출됨.
  - **사용자 노출 결정 (ADR-0021 §T5, 2026-05-10 Accepted)**: 8 caveats × 3
    노출 위치 매트릭스 (결론 카드 / 비교 표 / 계산 근거). 한국어 매핑은
    페이즈 3 builder 시점에 caveats-i18n 모듈 신설 (페이즈 4 베타 직전 i18n
    일괄 도입까지 한국어 단일). 신설 파일 명세는 ADR-0021 §다음 단계 참조.
    **사용자 노출은 페이즈 3 builder 종료 후 [x] 마킹 가능** — 현재 함수 차원
    완료 + 결정 완료 상태.

**Phase 1 검증:** `pnpm harness:data` — 모든 `tariff_snapshot`이 `source_url` + `fetched_at` 가짐.
**Phase 1 현실 일정:** M1 ~ M3 (3개월). 합리화 근거: 스키마 4개 신설(1.2~1.5)은
1주, fetcher **2개** × 평균 1주(스크래핑/파싱/단위 테스트) = **2주** (ADR-0009
scope cut), 비교 엔진 + **6케이스** 검증 = 3주 (ADR-0010 옵션 B 추가 -1주
마진), 운영 부채 + 갑작스런 라이브러리 호환성 = +2주 버퍼. **fetcher -1주 +
6케이스 -1주 = 합산 2주 마진**은 1.5.6 실 스크래핑 또는 페이즈 1.5 부채에
흡수.

---

## 페이즈 1.5 · 운영 부채 정리 — M3 말

**목표:** 페이즈 1에서 누적된 부채(=fetcher 마다 생긴 hack, 임시 type assertion,
미작성 README)를 닫고 페이즈 2 진입.

- [x] **1.5.1** Fetcher 코드 공통화 — 부분 추출 완료. N=2 표본 한계로 *전면
  공통화는 ADR-0009 §결정 3* 따라 N=3+ (Orange BE 페이즈 5 추가) 시점으로 미룸.
  현재 추출 산출물: `src/fetchers/_shared.ts` 신설 — 3 패턴 추출:
  (a) `STUB_REASON` 사용자 노출 텍스트 일관성 (b) `makeStubConfidence()` —
  computeConfidence 보일러 (c) `stubFailOutcome()` — STUB_FAIL_* 환경변수 →
  FetchOutcome.ok=false 변환 (~20줄 중복 제거). HTTP retry / HTML 파싱 helper는
  실 스크래핑(1.5.6) 진입 시 신설 — 현재 스텁이라 의미 없음.
- [x] **1.5.2** harness:price (가격 스냅샷 diff) 첫 가동 — 일 1회 cron
  + Sentry 알림 임계값 설정. 완료 산출물: `scripts/harness/price-snapshot.ts`
  전면 재작성 (에너지 가정 unit_price → 통신 monthly_price_cents 컬럼 마이그레이션,
  ±20% 임계값 유지). 4 작업 한 cron 묶음:
  - **핵심 1**: 24h 윈도 가격 변동 ±20% 감지 (ADR-0006 §T5 anomaly 마킹 입력)
  - **보조 작업 1 (ADR-0006 §T6)**: 90일 초과 tariff_snapshot.raw_payload +
    price_payload NULL화 (UPDATE)
  - **보조 작업 2 (ADR-0007 §T4)**: 90일 초과 comparison_request 의
    postal_code PC2 일반화 + input_attributes NULL → pii_anonymized_at 스탬프
  - **보조 작업 3 (ADR-0007 §T9)**: 90일 초과 comparison_result.locked_inputs
    NULL → pii_anonymized_at 스탬프
  - 운영: pnpm harness:price (`tsx --env-file=.env.local`로 dotenv 로드 — db
    모듈이 import 시점 DATABASE_URL 체크하므로 인라인 dotenv config는 hoisting
    문제). cron 등록은 페이즈 4.5.1 어드민 진입 시 Inngest 또는 Vercel cron.
  - 첫 가동 결과: 0건 (DB 비어있음 — 스텁 fetcher가 아직 snapshot insert 안 함)
- [x] **1.5.3** `docs/runbook.md` 신설 — fetcher 깨졌을 때 대응 절차 (솔로
  운영용 self-rescue 체크리스트). 스텁 fetcher → 실 스크래핑 교체 가이드 포함
  (1.5.6과 연동). 7개 섹션: 응급 진단 / fetcher / DB / Inngest / 5단 게이트 /
  백업+회복 / 외부 도움 시점.
- [x] **1.5.4** scripts/** typecheck 복원 (P4 부채 청산). 완료 산출물:
  (a) `tsconfig.json`의 exclude에서 scripts/** 제거 (b) `scripts/harness/verify-plan.ts`
  regex match group을 noUncheckedIndexedAccess 정합화 (lines[i] / m[1..3] /
  fm[1] / summaryMatch group narrowing) (c) `scripts/harness/e2e-smoke.ts`의
  playwright import 경로 'playwright' → '@playwright/test' (d) bias-audit는
  잔존 이슈 없음. 결과: 9건 → 0 에러. 페이즈 1 처음으로 P4가 scripts/**까지
  일관됨.
- [x] **1.5.5** DB 인스턴스 일치 검증 자동화 (운영 안전 부채). 사고 근거:
  2026-05-09 — db:push가 production이 아닌 다른 Neon 브랜치(silent-darkness)
  에 적용되어 운영자가 production 브랜치 검증 시 0 tables 발견.
  완료 산출물: (a) `scripts/verify-db.ts` (host/endpoint 노출 + 기대값 비교)
  (b) `pnpm verify:db` package.json 스크립트 등록 (c) `EXPECTED_DB_ENDPOINTS`
  env var (allowlist) — `.env.local`/`.env.example`에 추가, verify-db.ts가
  actual과 비교, 미스매치 시 exit 1 (d) `scripts/hooks/stop-gate.sh`에 Gate 5
  로 통합 (`.env.local` 부재 시 스킵해 CI 안전). 양방향 검증 완료.
  *참고 (ADR-0020 §결정 4)*: Vercel runtime의 `EXPECTED_DB_ENDPOINTS`는 미등록
  상태 — 페이즈 4 베타 진입 (GATE-K) 직전 D.3에서 등록 예정. 현 stop-gate는
  로컬에서만 동작.
- [!] **1.5.6** Proximus + Telenet **실 스크래핑 fetcher 구현** (스텁 → 실 데이터
  교체). PLAN 1.8 스텁 fetcher의 후속 부채.
  - **차단 사유 (2026-05-10)**: [ADR-0013](docs/adr/0013-fetcher-real-scraping-risk-assessment.md)
    분기 결과 = **MEDIUM (2.75/5.0) → 옵션 C 채택**. 1.5.6을 페이즈 5/6
    재평가 시점까지 보류. 그동안 method='stub' 유지 + 베타(페이즈 4)는
    ADR-0013 §평가 6 옵션 X (스텁 + "추정값")로 진행. 솔로 시간 비용(3.5)이
    가장 큰 점수였고, Proximus/Telenet General Terms PDF 텍스트 추출 실패로
    잔여 법적 불확실성 존재. 페이즈 5 진입 시 1.5.6 + Orange BE(5.0) +
    1.5.1(N=3 fetcher 공통화)을 통합 평가하는 게 시간 효율 ↑.
  - **재진입 트리거 (ADR-0013 §검증 3)**: M16 평가 게이트 통과 시 별도 ADR
    신설 + GTC PDF 수동 열람 (운영자 권고 후속, ~30분 — Appendix A §외부 변호사 권장)
    + Daisycon/Awin 어필리에이트 피드 vs 자체 스크래핑 재비교.
  - **차단 동안 유지 산출물**: 본 항목 본문에 정의된 fetcher 파일들의 `// 실
    fetch 준비 코드` 주석 블록은 그대로 보존 — 페이즈 5 진입 시 주석 해제 +
    Cheerio 추가만으로 진입 가능 (인터페이스 동결).
  - 원래 DoD (재진입 시 적용): 실 Neon DB에 `tariff_snapshot` 행 2 fetcher
    × N tariff 누적 확인. confidence='low' 비율 < 20% (스텁 100%에서 격상).
- [x] **1.5.7** Bash 보안 패턴 자동 차단 hook (운영 안전 부채). 사고 근거:
  2026-05-10 — Pieter가 echo + 백틱 substitution + `>>` 리다이렉트로 마크다운
  파일을 갱신하려다 보안 경고("Newline followed by # inside a quoted argument")
  발생. 운영자 No 선택 후 CLAUDE.md §8 #6 신설 + 본 부채 등록. 완료 산출물:
  (a) `scripts/hooks/pre-tool-guard.sh` 에 패턴 검사 추가 — 따옴표+개행+#
  (path validation 우회) 차단, 더블쿼트 안 backtick/`$(...)` (command
  substitution) 차단. 닫는 따옴표 강제 매칭으로 heredoc body false positive
  회피. 싱글쿼트 안 `$()`/backtick은 bash literal 처리이므로 통과.
  (b) 차단 시 안전 대안 메시지 자동 첨부 (Edit/Write 우선, 임시 파일+mv,
  `command --file=- <<'EOF' ... EOF` stdin 패턴, git commit 멀티라인은
  `git commit --file=- <<'EOF' ... EOF`).
  (c) JSON fallback 경로 강화 — 기존 `\\` / `\"` 외에 `\n`, `\t` 까지
  센티넬 기반 sed 파이프라인으로 정확 디코딩 (Windows + Git Bash = jq 미설치
  hot path 검증).
  (d) 음성 테스트 8 케이스 통과 — 안전 4 (pnpm typecheck / git status /
  heredoc-stdin / git commit --file=-) + 위험 4 (`$()` in 더블쿼트 / 싱글쿼트
  multiline+# / single-quoted `$()` 안전 통과 / rm -rf /).
  세 번째 헌법 항목 ("escape 안 된 큰따옴표 끼어듦")은 false positive 비율
  과다로 자동 탐지 보류, hook 내 주석에 후속 휴리스틱 진입점 명시.

**Phase 1.5 검증:** verifier — typecheck/lint/test 0 에러 + 신설 runbook 존재.

---

## 페이즈 2 · 입력 플로우 (User Input) — M4 ~ M5

**목표:** 5단계 5분 입력. 이탈률 < 30% (PostHog 측정).

> **페이즈 2 진입 결정 묶음**: [ADR-0016](docs/adr/0016-phase-2-input-flow-design.md)
> Accepted (T9 옵션 A RHF + T10 SC-E 한국어 단일, 2026-05-10). 본 페이즈
> 9 항목은 §T1~T10 명세를 그대로 따른다. SC-A (OCR 이연), SC-B (BE 1차),
> SC-C (Playwright 페이즈 4), SC-D (PostHog 페이즈 4), SC-E (한국어 단일)
> 모두 적용.

- [x] **2.1** 카테고리 선택 화면 (랜딩에서 진입) — ADR-0016 §T2: `/compare`
  별도 페이지 + 4 카드 (mobile/internet_fixed/bundle_internet_tv/landline) +
  카드별 클릭 시 `/compare/[category]/postal` 이동. 검증: e2e 시연 통과
  (`e2e/compare-flow.spec.ts`, 4 카드 동등 무게 + 다크 패턴 0).
- [x] **2.2** 단계 1: 우편번호 (**SC-B 적용** — 페이즈 2 1차 BE 만, NL/LU
  페이즈 3 진입 직전 추가) — ADR-0016 §T3: Zod regex `^[1-9][0-9]{3}$` +
  즉시 피드백 + BE 외 형식 시 정직 안내 ("페이즈 3 진입 전 추가 예정"). 검증:
  22 unit tests + e2e 1000 입력 통과.
- [x] **2.3** 단계 2: 가구 형태 (혼자/커플/3+) → 사용량 추정 fallback —
  ADR-0016 §T4: `householdType` enum 3값 라디오 카드. 사용량 매핑은 페이즈 2
  후반 또는 페이즈 3 진입 시 결정. 검증: e2e single 라디오 선택 통과.
- [x] **2.4** 단계 3: 현재 공급사/요금제 (선택적, 모르면 스킵) — ADR-0016 §T5:
  스킵 동등 노출 + sub-step 요금제 선택 (URL 변경 X). 신규 가입자 = 비교
  엔진 케이스 6 (ADR-0010 §T7) 자연 처리. 검증: e2e 스킵 경로 통과 — sub-step
  요금제 UI는 페이즈 3 진입 시 활성 (페이즈 2 1차 비활성 disabled 노출).
- [x] **2.5** 단계 4: 청구서 업로드 (**SC-A 적용** — 페이즈 2 1차 OCR 미구현,
  "청구서 없이 진행" 단일 버튼) — ADR-0016 §T6: tesseract.js dep 0 (GATE-C
  정합). OCR은 페이즈 3 결과 페이지 직후 별도 ADR로 도입. 검증: e2e 단일 버튼 통과.
- [x] **2.6** 단계 5: 결과 미리보기 → "더 보기" 클릭으로 풀 결과 — ADR-0016
  §T7: 결과 카드 1개 미리보기 + `/r/[shortId]` 이동. 페이즈 3 풀버전과 분리.
  비교 엔진 호출 = ADR-0010 §T10 동기 5초 timeout. 검증: `/api/compare` stub
  + nanoid 12자 도달 (e2e). 풀 compare() 호출 + DB insert는 페이즈 3 진입 시.
- [x] **2.7** 진행 표시 + 백 가능 + 데이터 자동 저장 (sessionStorage) —
  ADR-0016 §T8: `slim:compare:[category]:state` v1 + 매 입력 즉시 저장 +
  localStorage 0 (헌법 §8 #5). 검증: `useCompareSession` 훅 + `CompareLayout`
  Progress bar 5단계 시각화 (e2e 스크린샷 03 확인).
- [x] **2.8** 모바일 우선 디자인 (375px 기준 시작) — ADR-0016 §T9: Tailwind
  breakpoints 375 / `md:` 768 / `lg:` 1024 + shadcn/ui Form 패턴 + RHF 추가
  (옵션 A 채택, 2026-05-10). 검증: 7 shadcn 컴포넌트 (Card/Input/Label/RadioGroup/
  Select/Form/Progress) 신설 + e2e 통과. 다국어 responsive 수동 검증(375/768/1024)
  은 운영자 후속.
- [x] **2.9** 접근성: 키보드만으로 완주 가능, axe-core 0 violations
  (**SC-C 적용** — 본 페이즈는 axe-core 만, Playwright E2E 풀 인프라는 페이즈 4
  deploy 직전 일괄 추가). 검증: `e2e/accessibility.spec.ts` 6 페이지 (`/compare`
  + 4 단계 + `/r/[shortId]`) 모두 axe 0 violations 통과 (4.2s). 헌법 §3 P3 정합
  fix 3건 — `--color-muted` AA 대비 어둡게 (#8A958F→#5F6864), `CardTitle` h3→h2
  (heading-order), `/compare` + `/r/[shortId]` wrap div→`<main>` (landmark).
  ADR-0016 §T9 + §SCOPE CUT SC-C.

**Phase 2 검증:** Playwright E2E — 입력 → 결과까지 5분 이내 (CI에서 측정).
**Phase 2 현실 일정:** M4 ~ M5 (2개월). UI 9개 + Playwright E2E + i18n
(nl-BE/fr-BE 우선 2개) 가정. OCR cut 시 1.5개월로 단축 가능.

---

## 페이즈 3 · 결과 페이지 (Results) — M6 ~ M7

**목표:** "결론 → 근거 → 원본"의 3층 구조.

> **페이즈 3 진입 결정 묶음**: [ADR-0021](docs/adr/0021-phase-3-results-page-design.md)
> Accepted (T9 옵션 D + T11 SC-H + SC-F + SC-G, 2026-05-10). 본 페이즈 7 항목
> + 1.13 caveats UI 배치 (ADR-0011 §T3 발동) + 페이즈 2 1차 부채 종결
> (`/api/compare` 풀, `/r/[shortId]` 풀, current-provider sub-step 활성, NL/LU
> 우편번호 추가) 모두 §T1~T11 명세 그대로 따른다. SC-F (URL params 정렬/필터)
> + SC-G (static OG) + SC-H (별도 ADR-OCR) 적용. 옵션 D (인쇄 뷰 페이즈 6 이연)
> 는 **§T9 Amendment 1 (2026-05-11) 로 철회** → 3.7 페이즈 3 환원 (builder 후속 라운드 3.7.a~c).
>
> **M6 builder 진척 (2026-05-10, 합계 영향 0 — 골격 단계)**:
> - **Sub-task 1 통과** — T10 NL/LU `discriminatedUnion` 우편번호 (BE/NL/LU
>   3국, NL PC4/PC6 자동 대문자화) — `src/types/comparison-input.ts` + 13
>   신설 테스트 + `postal/page.tsx` 국가 Select + `preview/page.tsx` country
>   동적 전달.
> - **Sub-task 2 통과** — T3 §5 `usage-estimator.ts` (4 카테고리 × 3
>   householdType 기본 프로파일, 19 신설 테스트). ADR-0021 §T5 Amendment 1 —
>   `caveats-i18n.ts` 미신설 결정 (caveats.ts 가 이미 한국어 출력).
> - **Sub-task 3 통과** — T7 `CalculationDetails.tsx` 골격 (`<details>` +
>   사용 가정 + 산식 + caveats + engineVersion 표시, mock data props) +
>   T8 `generateMetadata` (noindex + canonical + textOG, og:image 미설정).
>   부수: `--color-accent-dark` 토큰 신설 + Form{Label,Message} AA contrast fix
>   (axe color-contrast 0 violations 유지).
> - **Sub-task 4 통과** — T1 `/r/[shortId]` 잘못된 shortId 404 방어. 정규식
>   `/^[A-Za-z0-9_-]{12}$/` 진입 검증 + `notFound()` 호출 + `not-found.tsx`
>   한국어 안내 + 새로 비교/홈 CTA. e2e/result-page.spec.ts 신설 (9 테스트:
>   정상 4 + 404 4 + axe 1). DB 존재 검증은 sub-task 5 영역. 부수: ADR-0007
>   §T7 Amendment 1 — nanoid alphabet 명세 36 → 64 정정 (실 구현 정합).
> - **Sub-task 6 통과** — T5 `/compare/[category]/current-provider` sub-step
>   활성. 페이즈 2 1차 disabled 버튼 → RSC + DB prefetch (`getActiveProviders` +
>   `getActiveTariffsByProviders`, ISR 1h) + client `CurrentProviderForm` (Provider
>   `<Select>` + sub-step Tariff `<Select>` + "이 공급사 요금제 모르겠어요"
>   동등 + "모르겠어요/스킵" 동등). 0건 fallback 안내 + 스킵 단일 CTA. vitest
>   DATABASE_URL 회피 위해 순수 helper/types 별도 모듈 분리 (`providers-helpers.ts`
>   + `providers-types.ts`, +6 unit tests). e2e/compare-flow.spec.ts 새 spec
>   추가 — Proximus 선택 + tariff 모르겠어요 path 통과.
> - **Sub-task 5 통과** — T3 풀 흐름. `src/db/queries/comparison.ts` 신설
>   (insertComparisonRequest / getCandidateSnapshots DISTINCT ON / getCurrent
>   TariffSnapshot / insertComparisonResult / insertComparisonResultItems /
>   getResultByShortId) + 순수 변환 `src/db/queries/comparison-helpers.ts` +
>   `src/lib/with-timeout.ts` (5초 race, ADR-0007 §T10). `/api/compare` route
>   는 stub → 풀 흐름 7단계 (Zod → insert request → 후보+현재 병렬 SELECT →
>   deriveUsageProfile → compare() → insert result+items → shortId). `postal.
>   country` 는 `input_attributes.postalCountry` 봉인 (스키마 컬럼 신설 0,
>   ADR-0021 §T10 호환). `/r/[shortId]` 는 regex 통과 후 `getResultByShortId`
>   호출 — 미존재 시 `notFound()` (sub-task 4 형식 검증과 정합). 페이지는
>   placeholder 헤더 유지(3.1~3.7 본 항목은 후속 라운드) + 실 engineVersion +
>   lockedInputs.assumptions.usage_profile 추출 + 90일 후 익명화 안내 배너.
>   `comparison-helpers.test.ts` 8 신설 테스트 (snapshotRowToTariffLike 1:1
>   매핑 + buildLockedInputs ADR-0007 §T9 권장 키 직렬화). e2e/result-page
>   .spec.ts 리팩터 — 정상 진입 4 케이스가 fake nanoid 대신 `request.post(/api/
>   compare)` 로 실 shortId 받아 사용 + "DB 미존재 404" 케이스 1건 신설.
>   부수: `eslint.config.mjs` scripts/* 오버라이드에 `.mts`/`.cts` 추가
>   (`seed-stub-tariffs.mts` 의 console.log 가 게이트 통과하도록 — pre-existing
>   config 버그 1-char 정정). breakdown 컬럼 미저장 → CalculationDetails.
>   breakdown 은 0 cents fallback (페이즈 3 후속 라운드에서 컬럼 추가 vs compare
>   재실행 결정).
> - 페이즈 3.1~3.6 [x] 격상 완료 — 라운드 a (결론 카드 3.1 + 영구 링크 3.6) /
>   라운드 b (비교 표 3.2) / 라운드 c (원본 링크 3.3 + 제외 공급사 3.4) /
>   라운드 d (계산 근거 펼치기 3.5 — caveats 트리거 표 + 90일 입력 부재 정직 표기).
>   3.7 (인쇄 뷰) 만 [ ] 유지 — **페이즈 3 환원** (ADR-0021 §T9 Amendment 1,
>   2026-05-11; 옵션 D 철회). 페이즈 3 builder 후속 라운드 (3.7.a~c).

- [x] **3.1** **1층 — 결론 카드** (스크롤 없이 보임) — ADR-0021 §T2: 1위 추천
  + 연간 절약액 + "변경하기" CTA placeholder (페이즈 4 어트리뷰션 활성).
  - 신설: `src/app/r/[shortId]/_components/ResultConclusionCard.tsx` (1위 공급사 + 요금제명 + 절약액 4 상태 분기 + 신뢰도 배지 + caveats list + CTA disabled placeholder + 다크 패턴 회피).
  - 후보 0건 시 fallback 인라인 안내 (ADR-0011 §T2 항목 5 동형) — `src/app/r/[shortId]/page.tsx` 안.
  - 신뢰도 배지: confidence != 'high' 시만 노출 (T5 매트릭스 결론 카드 컬럼).
  - 후속: caveats i18n 매트릭스(T5) 위치별 차등은 페이즈 4 SC-E i18n ADR.
- [x] **3.2** **2층 — 비교 표** (다나와 스타일 정보 밀도) — ADR-0021 §T2 + §T4:
  상위 5개 6 컬럼 + URL params 정렬/필터 (**SC-F 적용**, RSC 재렌더, dep 0).
  모바일은 카드 stack.
  - 신설: `src/app/r/[shortId]/_components/ComparisonTable.tsx` (desktop native table + mobile card stack, 6 컬럼 = 순위/공급사·요금제/월비용/약정/절약/신뢰도, 카테고리별 보조 텍스트, 프로모·활성화비 inline).
  - 신설: `src/app/r/[shortId]/_components/ComparisonControls.tsx` (3 sort `<a>` 라디오 + 2 filter 토글 `<a>` — dep 0 + RSC 재렌더).
  - 신설: `src/app/r/[shortId]/_lib/compare-view.ts` (순수 parseSearchParams + applyView + buildSortHref/buildFilterToggleHref).
  - 신설: `src/app/r/[shortId]/_lib/compare-view.test.ts` (18 단위 테스트 — 파싱 + URL 직렬화 + 정렬/필터/limit/tie-break/순수성).
  - `getResultItems(resultId)` Drizzle 쿼리 추가 (4단 JOIN).
  - 필터: commitment_none + data_unlimited (라운드 b 범위). promo_exclude (display-only) 는 후속 라운드 또는 SC-E i18n 동반.
- [x] **3.3** **3층 — 원본 링크** — ADR-0021 §T2: 각 행 우측 외부 링크
  (rel="nofollow noopener") + "마지막 확인: X시간 전" (`tariff_snapshot.fetched_at`).
  - `src/app/r/[shortId]/_components/ComparisonTable.tsx` — 7번째 컬럼 "원본" (desktop) + 모바일 카드 footer. `SourceLink` 내부 컴포넌트.
  - `src/app/r/[shortId]/_lib/stale.ts` — `formatRelativeTime` 순수 함수 + `src/app/r/[shortId]/_lib/stale.test.ts` 7 단위 테스트.
  - `rel="nofollow noopener"` + `target="_blank"` + sr-only "새 창에서 열림" 안내.
- [x] **3.4** **제외된 공급사 섹션** — ADR-0021 §T6: `provider.excluded_reason`
  직접 표시 + /data-sources 동형 + Orange BE "페이즈 5 평가 후 추가 예정" 안내
  (ADR-0009 §결정 1).
  - 신설: `src/app/r/[shortId]/_components/ExcludedProvidersSection.tsx` — 헌법 P3 동형 표면화. 0건 시 섹션 자체 비노출.
  - `src/db/queries/providers.ts` 확장 — `getExcludedProviders(country)` helper. `/data-sources` 와 공유 가능 형태.
  - Orange BE 는 마스터 데이터(`provider.excluded_reason = '페이즈 5 평가 후 추가 예정'`) 로 자연 포함 — 특수 분기 0.
- [x] **3.5** **계산 근거 펼치기** — ADR-0021 §T7: HTML `<details>` 펼치기 +
  `src/engine/usage-estimator.ts` 기본 프로파일 + breakdown.monthlyAvg12/24Cents +
  engineVersion + caveats 트리거 표기. JS 0 native a11y.
  - 신설: `src/app/r/[shortId]/_lib/caveat-triggers.ts` — 순수 deriveCaveatTriggers. deriveCaveats 규칙 1~7 을 저장된 스냅샷 데이터(commitment/activation/promo/data_gb/eu_roaming/download_mbps/confidence) + usageProfile 로 거울 평가 → 트리거/미트리거 근거 행. 규칙 8(현재 요금제 신뢰도)은 별도 컬럼 미저장 — flat caveats 리스트로 위임.
  - 신설: `src/app/r/[shortId]/_lib/caveat-triggers.test.ts` — 26 단위 테스트 (각 규칙 경계 triggered/미triggered + 카테고리별 행 포함/제외 + 입력 변형 X + 결정성).
  - `src/app/r/[shortId]/_components/CalculationDetails.tsx` 확장 — "주의사항 트리거 조건" 섹션(triggerRows prop, 트리거 dot 표기) + inputsAbsent prop (90일 보관 정책 입력 부재 시 "사용한 가정"이 재구성값임 정직 표기 — ADR-0007 §T9).
  - `src/app/r/[shortId]/page.tsx` — rank=1 item(getResultItems 결과) + view.usageProfile 로 deriveCaveatTriggers 호출 → CalculationDetails 에 triggerRows + inputsAbsent(=piiAnonymizedAt 존재) 전달.
  - <details>/<summary> native·breakdown·engineVersion 골격은 sub-task 1-3 그대로 (라운드 d 는 caveats 트리거 + 90일 케이스만).
- [x] **3.6** **공유 가능한 영구 링크** (`/r/[id]`) — ADR-0021 §T1 + §T8:
  `/r/[shortId]` 풀 페이지 격상 (페이즈 2 placeholder 호환) + RSC + ISR 1h +
  `notFound()` 잘못된 shortId 404 + noindex + canonical (**SC-G 적용**: 동적 OG는
  페이즈 4 별도 ADR-OG, 페이즈 3 1차 = static OG).
  - `src/app/r/[shortId]/page.tsx` — placeholder 헤더 제거 + `export const revalidate = 3600` ISR + ResultConclusionCard 통합 + 영구 ID + 90일 익명화 배너 (T9) + 새로 비교/홈 CTA 두 개.
  - `src/app/r/[shortId]/not-found.tsx` — 한국어 안내(sub-task 4, 형식 미달/DB 미존재 공통).
  - 메타: noindex + canonical + textOG (sub-task 3 진행, og:image 미설정 — 페이즈 4 ADR-OG).
- [x] **3.7** **인쇄 친화 뷰** (`@media print`) — **ADR-0021 §T9 Amendment 1
  (2026-05-11) — 페이즈 3 환원** (옵션 D 철회). `/r/[shortId]` 인쇄/PDF 사본이
  "결론 → 근거 → 원본 + source/fetched_at + 어필리에이트 디스클로저" 를 종이에서도
  보장 (P1/P3). 단일 `@media print` 블록(`src/app/globals.css`) + 컴포넌트 단위
  Tailwind `print:` — 새 라우트·새 dep 0. **2026-05-11 완료** (a/b/c). DoD:
  (1) `page.emulateMedia({media:'print'})` 렌더 시 nav/footer 장식/정렬·필터
  컨트롤/disabled "변경하기" CTA 비노출 ✅, (2) `source_url`·"마지막 확인: X시간 전"·
  engineVersion·`/legal/affiliate-disclosure` 링크·제외 공급사 섹션 노출 유지 —
  빈상태 경로(시드 confidence='low' → 후보 0건이 정상)에서 검증된 부분(h1·영구 ID·
  /data-sources·affiliate-disclosure·90일 배너 print visible) ✅; 풀-결과-경로 부분
  (engineVersion/산식/결과 item source — 결론 카드·비교 표·CalculationDetails 렌더
  시) 은 `e2e/result-page-print.spec.ts` 의 별도 describe 에 `test.skip` 처리
  (confidence='high' 시드 도입 시 활성), 구현 자체는 print: 클래스로 보장됨,
  (3) `<details>` 펼침 — globals.css `details > *:not(summary){display:block!important}`
  (e2e 검증은 풀 경로라 skip), (4) 외부 링크 href 텍스트 노출 `a[href^="http"]::after` ✅
  (chrome 숨김 `<a>` 는 `.print-hide a::after{content:none}` 로 제외), (5) `break-inside:avoid`
  ✅, (6) `harness:perf`(LCP) 회귀 — harness:perf 는 3.5.1(미구현)이라 globals.css diff
  로 `@media print{}` 바깥 변경 0 확인으로 갈음, (7) print 모드 axe 0 violations ✅.
  검증: `pnpm test:e2e` **24 passed / 4 skipped / 0 failed** + `pnpm typecheck`/`lint`/`test` 0.
  - [x] **3.7.a** print stylesheet 골격 — `src/app/globals.css` 에 `@media print { ... }`
    블록 (`.print-hide` 유틸 + `tr`/`details` `break-inside:avoid` + `a[href^="http"]::after`
    URL 노출 + `.print-hide a::after{content:none}` 노이즈 차단 + `details > *:not(summary){display:block!important}`
    펼침 + 신뢰도 배지 색상 폴백). 화면 CSS 무변동.
  - [x] **3.7.b** 컴포넌트 `print:` 클래스 — `page.tsx`(nav CTA `print:hidden` +
    `<footer>` affiliate-disclosure 줄 신설) / `ComparisonControls`(루트 `print:hidden`) /
    `ResultConclusionCard`(disabled CTA `print:hidden` + 배지 `print:border-current`) /
    `ComparisonTable`(desktop table `print:block`, mobile stack `print:hidden`, 배지 `print:border-current`).
    `ExcludedProvidersSection`/`CalculationDetails` 는 변경 0 (텍스트만 + `<details>` 펼침은 globals 규칙).
  - [x] **3.7.c** print 회귀 테스트 — `e2e/result-page-print.spec.ts` 신설:
    `page.emulateMedia({media:'print'})` 후 무조건 케이스(숨김 요소 부재 / 빈상태 P1·P3
    노출 요소 존재 / axe 0 violations / 스크린샷) + 풀-경로 전용 케이스 4개는 별도
    describe + `test.skip(true, '시드에 비교 후보 없음 — confidence=high 시드 도입 시 활성')`.

**Phase 3 검증:** `pnpm harness:perf` — Lighthouse 모바일 Perf/Acc ≥ 90/95 (soft) + LCP ≤ 2.5s / TBT ≤ 200ms (hard) + first-load JS per-route 2-tier (light 120/140, form 170/200 — ADR-0023 §T4 + Amendment 1). BP/SEO 는 표시만(SEO 는 `/r/[shortId]` noindex 제외). `harness:perf` 는 CI 머지 게이트 아님(ADR-0023 §T5) — `/ship` + 페이즈 종료 advisory.
**Phase 3 현실 일정:** M6 ~ M7 (2개월).

---

## 페이즈 3.5 · 운영 부채 정리 — M7 말

**목표:** 페이즈 1~3 누적 부채 + 베타 직전 외부 시각 점검.

- [x] **3.5.1** Lighthouse / axe-core 자동화 — **ADR-0023** (+ §Amendment 1) (페이즈 3.5 진입 시
  builder 트리거, GATE-P). **2026-05-12 완료** — sub-task a/b/c/d 통과 (`pnpm harness:perf` 신설·임계값 게이트·first-load JS per-route 2-tier·axe 페이즈 3 라우트 보강·`/ship` 통합). 3.5.1.e (next-build-출력 4페이지 실측 편입)는 **비차단 백로그**로 잔존. 원문 "harness:e2e 에 통합"은 정정됨 — `harness:e2e`
  (P2 walltime 스모크)와 관심사가 달라 **별도 `pnpm harness:perf` 신설**
  (ADR-0023 §Context #3 + T2). axe 는 이미 `e2e/accessibility.spec.ts` 에서
  6페이지 0 violations 달성됨 — 페이즈 3 신규 라우트 커버리지 보강 + 같은 게이트
  편입이 본 항목 범위. CI 머지 차단 X — 로컬 + `/ship` advisory (ADR-0002
  Amendment 1 의 flaky→noise 교훈, ADR-0023 §T5).
  DoD: `pnpm harness:perf` 가 (1) `next build && next start` (또는 `E2E_BASE_URL`)
  대상으로 대표 4 페이지(`/`, `/compare`, `/compare/[category]/postal`,
  `/r/[shortId]`)를 Lighthouse mobile 프리셋으로 측정 (2) LCP ≤ 2.5s + TBT ≤ 200ms
  를 hard 게이트로 강제 (위반 시 exit 1 — 헌법 P2) (3) Perf score ≥ 90 + a11y
  score ≥ 95 를 soft 경고로 출력 (exit 0) (4) 같은 4 페이지에 `@axe-core/playwright`
  0-violations 재확인 + first-load JS advisory (5) `/ship` 슬래시 커맨드가
  `harness:perf` 를 호출. 새 의존성 = `lighthouse` 1건 (GATE-C amend), 새 SaaS 0건.
  검증: 페이즈 3 결과 페이지 LCP ≤ 2.5s 실측 + axe 0 violations 페이즈 3 라우트
  포함 유지 + ADR-0023 §Verification.
  - [x] **3.5.1.a** `lighthouse` devDependency 추가 + `scripts/harness/perf-budget.ts`
    신설 (Playwright Chromium 에 CDP 연결, mobile 프리셋, 4 페이지 측정) +
    `package.json` scripts `"harness:perf"` 추가.
    DoD: `pnpm harness:perf` 가 4 페이지 측정 표를 출력 (seed shortId 부재 시
    4번 페이지 skip+warn — 게이트 실패 아님). 검증: 로컬 실행 1회 + typecheck 0.
    검증: typecheck/lint/test 0 + harness:perf 가드 메시지 정상 (exit 2, 서버 미가동) + 4 페이지 ADR-0023 T3 일치.
  - [x] **3.5.1.b** 임계값 게이트 — LCP ≤ 2.5s / TBT ≤ 200ms hard (exit 1), Perf ≥ 90 /
    a11y ≥ 95 soft (warn), **first-load JS per-route 2-tier** (light 120/140 KB · form 170/200 KB advisory/hard).
    DoD: hard 메트릭 의도적 회귀 시 exit 1, soft 회귀 시 exit 0 + 경고 라인.
    검증: ADR-0023 §T4 + §Amendment 1 표 일치 + 단위 테스트 (임계값 비교 순수 함수).
    ✅ 검증 (2026-05-12): evaluateMetric (LCP/TBT ≤경계, Perf/A11y ≥경계) + computeExitCode 순수 함수 38 테스트 통과. hard 위반 시 exit 1, soft 만 존재 시 exit 0 확인. first-load JS 2-tier 판정 (tier=light|form, advisory/hard 경계 별도) — `ceilToTen` 라운딩 + `routeTier` 매핑 + `evaluateJsBudget` 판정. 실측(`harness:perf`, 커밋 29baf6e): postal 161.5KB, /·/compare·/r/[shortId] ~100KB → light 120/140 KB, form 170/200 KB (계산 근거 ADR-0023 §Amendment 1 §5 참조). ADR-0023 Amendment 1 (2026-05-12) 로 확정 — 측정 환경/근거는 ADR §Amendment 1 명시.
  - [x] **3.5.1.c** axe 커버리지 보강 (ADR-0023 §T2):
    - `e2e/accessibility.spec.ts`: 페이즈 3 신규 axe 케이스 — `/r/[shortId]` 실 shortId(`/api/compare` POST 로 획득)에 0 violations 추가. `/compare/mobile/preview` 는 마운트 즉시 sessionStorage→`/api/compare`→`/r/[shortId]` redirect 라 axe 실행 불가 → `test.skip(true, ...)` (접근성은 `/r/[shortId]` 가 커버). axe 검증 페이지 6→8 케이스(7 active + 1 skip). `/compare/[category]/{postal,household,current-provider,bill}` 4단계는 페이즈 2 부터 이미 포함돼 있었음(직접 URL 진입 가능 — `'use client'` + 빈 sessionStorage emptyState 렌더).
    - `scripts/harness/perf-budget.ts`: 측정 4페이지에 `@axe-core/playwright` violations 를 advisory 컬럼으로 동반 출력(`AxeBuilder`, `formatAxeCell`, `PageMetrics.axeViolations`). **비-게이트** — violations>0 여도 exit code 영향 X(진짜 게이트는 `accessibility.spec.ts`). `computeExitCode` 무변동. 새 dep 0(`@axe-core/playwright` 기존 devDep).
    - 검증: typecheck 0 / lint 0 / **253 unit tests** (perf-budget 85, `formatAxeCell` 4 케이스 신규) / **`pnpm test:e2e` 25 passed / 5 skipped / 0 failed** (axe 전부 0 violations).
    - 커밋: `98db938` (`feat(plan-3.5.1.c): axe 커버리지 보강 — 페이즈 3 라우트 + perf-budget axe advisory`).
  - [x] **3.5.1.d** `/ship` 슬래시 커맨드 + 페이즈 3 종료 체크리스트에 `pnpm harness:perf`
    호출 추가. **CI ci.yml 변경 X** (ADR-0023 §T5 — flaky→noise 회피). PLAN
    3.5.1 본문에 ADR-0023 cross-ref + "harness:e2e→harness:perf 정정" 주석 (= 본 줄들).
    DoD: `/ship` 실행 시 `harness:perf` 가 호출됨. 검증: 슬래시 커맨드 정의 파일 확인.
    ✅ 검증 (2026-05-12): `.claude/commands/ship.md` 코드 품질 섹션에 `pnpm harness:perf` 체크박스 추가 (`next build && pnpm start` 선행 + ADR-0023 §T5 advisory 주석). PLAN "Phase 3 검증" 라인 → `harness:perf` 실행 근거로 갱신 (Lighthouse Perf/Acc soft + LCP/TBT hard + first-load JS 2-tier). harness:e2e→harness:perf 정정 + ADR-0023 cross-ref 는 3.5.1 본문·sub-task 들에 이미 반영. ci.yml 무변동.
  - [ ] **3.5.1.e** (백로그) household/current-provider/bill/preview 4페이지를 harness:perf 측정 셋에 편입 — 현재 `next build` 출력 기준 추정치만 있음 (ADR-0023 §Amendment 1 §4 주). 게이트 차단 아님.
- [x] **3.5.2** SEO 메타 / sitemap.xml / robots.txt — 베타 시드를 위해 필수.
  검색엔진이 색인 가능한 라우트를 올바른 메타·sitemap·robots 로 노출하고, 색인
  금지 라우트(`/r/[shortId]` 개인 비교 결과 — ADR-0021 §T8 noindex 유지 ·
  `/compare/[category]/{postal,household,current-provider,bill,preview}` 입력 폼
  단계 — 색인 가치 낮음 + sessionStorage 상태 의존)를 명확히 제외하는 **최소선**.
  **범위 밖**: 동적 `og:image` (ADR-0021 §T8 SC-G — 페이즈 4 ADR-OG) · JSON-LD
  구조화 데이터 (베타 시드 비필수, 페이즈 4+ 후보) · hreflang/locale 대안 라우팅
  (i18n 은 SC-E 로 페이즈 4 베타 직전 일괄 — 현재 ko 단일이라 hreflang 무의미) ·
  PostHog/Sentry 외 새 추적기 (헌법 §8 #1). **새 dep 0 / 새 SaaS 0** — Next.js
  App Router 네이티브 (`app/sitemap.ts` · `app/robots.ts` · `metadata`/`generateMetadata`).
  DoD: (1) 루트 `layout.tsx` 에 `metadataBase: new URL('https://slim.lu')` +
  `openGraph` 기본값 (`og:type=website` · `og:locale=ko_KR` · `og:site_name=Slim`)
  설정 (2) 색인 대상 라우트(`/`, `/compare`, `/compare/[category]`, `/data-sources`,
  `/legal/affiliate-disclosure`)가 고유 `title`/`description` + canonical 보유,
  색인 금지 라우트는 `robots: { index: false }` 명시 (`/r/[shortId]` 는 기존
  ADR-0021 §T8 설정 유지 — 변경 0) (3) `app/sitemap.ts` 가 색인 대상 라우트만
  나열 (`/r/[shortId]` · `/compare/[category]/*` 입력 단계 제외) (4) `app/robots.ts`
  가 `sitemap` 필드 + `Disallow: /r/` · `Disallow: /compare/*/postal` 등 입력
  단계 패턴 명시, `Allow: /` (5) e2e 스모크: 색인 대상 라우트 head 에 canonical
  존재 + 색인 금지 라우트 `<meta name="robots" content="noindex">` 존재 검증.
  검증: `pnpm typecheck`/`lint`/`test` 0 + e2e SEO 스모크 통과 + `next build`
  출력에 `/sitemap.xml`·`/robots.txt` 라우트 등장 + `harness:perf` SEO 점수
  표시(게이트 아님 — ADR-0023 §T5, `/r/[shortId]` noindex 제외).
  ✅ 검증 (2026-05-12): DoD 1~5 전체 완료 — typecheck 0 / lint 0 / test 253 passed / harness:plan 정합 / sitemap.xml 6 URL (og:image 미설정 의도적) / robots.txt Disallow 7 경로 + Sitemap 라인 / e2e seo-meta.spec.ts 11 케이스 pass (색인대상4 + 색인금지6 canonical noindex 존재검증 + sitemap XML 구조 + robots Disallow패턴). landing.spec.ts strict 회귀 수정. 커밋: `8a32182` (`feat(plan-3.5.2): SEO 메타 / sitemap.xml / robots.txt — 베타 시드`).
  - [x] **3.5.2.a** 루트 메타 기반 — `src/app/layout.tsx` 의 `metadata` 에
    `metadataBase: new URL('https://slim.lu')` + `openGraph` 기본값(`type:'website'`,
    `locale:'ko_KR'`, `siteName:'Slim'`) + `twitter` card 기본값 추가. 도메인은
    ADR-0020 §결정 7 / ADR-0021 §T8 와 동일 상수 (`/r/[shortId]` 의 `SITE_ORIGIN`
    하드코딩과 정합 — `src/lib/site.ts` 단일 상수 추출 검토).
    DoD: `next build` 시 색인 대상 페이지 head 에 절대 URL 기반 `og:url`/canonical 생성.
    검증: typecheck 0 + e2e 에서 `/` head 의 `og:site_name` 존재 확인.
    ✅ 검증 (2026-05-12): `src/lib/site.ts` 신설 + `SITE_ORIGIN='https://slim.lu'` 단일화. `src/app/layout.tsx` metadataBase 설정 + openGraph/twitter 메타 추가. og:image 미설정 (ADR-0021 §T8). `/r/[shortId]/page.tsx` SITE_ORIGIN import (하드코딩 제거).
  - [x] **3.5.2.b** 색인 대상 라우트별 메타 — `/`, `/compare`, `/compare/[category]`,
    `/data-sources`, `/legal/affiliate-disclosure` 의 `page.tsx` 에 `metadata`
    (또는 동적 `generateMetadata` — `/compare/[category]` 는 카테고리명 포함)
    추가: 고유 `title`/`description`/`alternates.canonical`. `/compare/[category]`
    는 알려진 카테고리(통신)만 canonical, 미지원 카테고리는 `robots:{index:false}`.
    DoD: 5개 라우트 각각 고유 title (탭 제목 중복 0) + canonical 절대 URL.
    검증: typecheck 0 + e2e 에서 각 라우트 canonical href 가 `https://slim.lu/...` 매칭.
    ✅ 검증 (2026-05-12): `/` / `/compare` / `/data-sources` / `/legal/affiliate-disclosure` 각각 metadata.title + canonical 설정. `/compare/[category]` generateMetadata 동적 구현 (알려진 카테고리만 canonical, 미지원 → robots noindex). e2e 색인 대상 테스트 4 케이스 통과.
  - [x] **3.5.2.c** 색인 금지 라우트 명시 — `/compare/[category]/{postal,household,
    current-provider,bill,preview}` 5개 `page.tsx` 에 `metadata = { robots:{ index:false,
    follow:false } }` (입력 폼 단계 — 상태 의존 + 색인 가치 낮음). `/r/[shortId]`
    는 ADR-0021 §T8 `generateMetadata` 가 이미 `robots:{index:false}` — 변경 0
    (PLAN 일관성 위해 본 항목 주석에 명시만).
    DoD: 6개(입력 5 + 결과 1) 라우트 head 에 `noindex` 존재, 그 외 라우트엔 부재.
    검증: typecheck 0 + e2e 에서 색인 금지 라우트 `<meta name="robots">` 존재 + 색인 대상 부재.
    ✅ 검증 (2026-05-12): `/compare/[category]/{postal,household,bill,preview}` 각각 layout.tsx 신설 (robots noindex). `/compare/[category]/current-provider` page.tsx 직접 메타 추가 (robots noindex). `/r/[shortId]` 기존 generateMetadata 무변동. e2e 색인 금지 테스트 6 케이스 통과.
  - [x] **3.5.2.d** `sitemap.ts` / `robots.ts` — `src/app/sitemap.ts` 신설:
    색인 대상 정적 라우트만 (`/`, `/compare`, `/compare/telecom`(알려진 카테고리),
    `/data-sources`, `/legal/affiliate-disclosure`) `MetadataRoute.Sitemap` 반환
    (`lastModified` = 빌드 시각 또는 정적, `changeFrequency`/`priority` 보수적).
    `src/app/robots.ts` 신설: `MetadataRoute.Robots` — `rules: { userAgent:'*',
    allow:'/', disallow:['/r/', '/compare/*/postal', '/compare/*/household',
    '/compare/*/current-provider', '/compare/*/bill', '/compare/*/preview', '/api/'] }`
    + `sitemap: 'https://slim.lu/sitemap.xml'`.
    DoD: `next build` 출력에 `○ /sitemap.xml`·`○ /robots.txt` 등장 + 내용 수동 확인.
    검증: typecheck 0 + `next build` 후 `/sitemap.xml` 에 `/r/` 부재 · `/robots.txt` 에 `Sitemap:` 라인 존재.
    ✅ 검증 (2026-05-12): `src/app/sitemap.ts` 신설 (6 URL: / + /compare + /compare/{mobile,internet_fixed} + /data-sources + /legal/affiliate-disclosure). `src/app/robots.ts` 신설 (Disallow: /r/ + /compare/*/postal 등 5단계 + /api/ + Sitemap 라인). pnpm build ○ 출력 확인. curl 테스트: sitemap.xml 200 + /r/ 부재 + robots.txt 200 + Sitemap 라인 존재.
  - [x] **3.5.2.e** e2e SEO 스모크 — `e2e/seo-meta.spec.ts` 신설: (1) 색인 대상
    라우트 5개 — head 에 `<link rel="canonical">` 존재 + `noindex` 부재 (2) 색인
    금지 라우트 6개 — `<meta name="robots" content*="noindex">` 존재 (3) `/sitemap.xml`
    GET 200 + XML 파싱 가능 + `/r/` URL 부재 (4) `/robots.txt` GET 200 + `Sitemap:`
    라인 + `Disallow: /r/` 존재. 새 dep 0 (Playwright 기본 `request` 픽스처).
    DoD: `pnpm test:e2e` 가 SEO 스모크 포함 전체 green.
    검증: 의도적 회귀(canonical 제거) 시 해당 케이스 fail + 복구 시 green.
    ✅ 검증 (2026-05-12): `e2e/seo-meta.spec.ts` 신설 (4 describe + 11 케이스). 그룹1 색인대상 canonical 검증 (4 케이스). 그룹2 색인금지 noindex 검증 (6 케이스). 그룹3 sitemap 구조 검증 (1 케이스). 그룹4 robots 패턴 검증 (1 케이스). `e2e/landing.spec.ts` strict 회귀 수정 (.filter 사용). pnpm test:e2e 37 passed/0 failed (seo-meta 11 + 나머지).
- [x] **3.5.3** 첫 부하 테스트 — 베타 시드 직전 베이스라인 1회. "현 아키텍처가
  페이즈 4 베타 트래픽(~50~100명, ADR-0003 옵션 E)을 견디는가 + Vercel Hobby
  100GB bandwidth / function invocation·duration / Neon free compute hours /
  Upstash free command count 무료 한도를 얼마나 빨리 소진하는가"를 **소량 측정 →
  외삽**으로 확인. **production 자원 소진 0** — `next build && pnpm start` 로컬
  대상만(또는 명시적 `LOAD_BASE_URL`), 동시 수 단계적(10→50→100, 각 단계 보고 —
  한 번에 100 안 함). 부하 도구는 **순수 Node `fetch` 자작 `scripts/harness/load-smoke.ts`
  1순위** (새 dep 0 — 헌법 §8 €300 cap / Windows / 솔로 제약), `autocannon` devDep
  1건은 대안(리포트 품질↑, 채택 시 GATE-C amend + ADR-0026 권고 — 도구 선택 +
  측정 대상 + 한도 외삽 방법론 + CI 게이트 여부). **k6 는 과함** — 베타 후 실트래픽
  본격 부하 테스트 시점에 재검토(별도 항목). **범위 밖**: k6 Cloud / 지속 모니터링 /
  CI 통합 / 분산 부하 (페이즈 4+). 부하 테스트는 **CI 머지 게이트 아님** (flaky +
  시간 + 한도 소진 위험 — ADR-0023 §T5 / ADR-0002 Amendment 1 의 flaky→noise 교훈)
  — `harness:perf` 와 동일 취급(로컬 + 베타 직전 1회 + 결과를 PLAN/ADR 기록).
  DoD: (1) `pnpm harness:load` 신설 — `next build && pnpm start` (또는
  `LOAD_BASE_URL`) 대상으로 대표 라우트 5개(`/` static·ISR, `/compare` static,
  `/r/[shortId]` ISR `revalidate=3600`, `/api/compare` POST — 가장 무거움: DB
  write + 비교 엔진 + (있다면) Redis, `/compare/[category]/postal` client)에 동시
  N(=10→50→100 단계) HTTP 요청 발사 후 라우트별 **p50/p95 latency · 에러율 ·
  (가능 시) Vercel function 실행 시간 헤더** 표 출력 (2) **안전 가드**: `LOAD_BASE_URL`
  미설정 시 `http://localhost:3000` 기본 + host 가 `localhost`/`127.0.0.1` 아니면
  즉시 거부(`e2e-smoke.ts` 의 `E2E_BASE_URL` 가드 패턴 답습 + 강화 — production
  도메인 차단) (3) **캐시 동작 점검** — `/api/compare` 에 동일 비교 입력을 반복
  발사해 2회차 이후 latency 가 1회차 대비 유의하게 낮은지(= Upstash 5분 TTL 캐시
  히트) 확인. **현재 `src/` 에 `@upstash/redis` 사용처 부재 — 캐시 레이어 미구현**
  이면 그 사실을 결과 표에 명기하고 "병목 후보: `/api/compare` 캐시 미스 시 매번
  비교 엔진 + DB write 풀 실행"을 finding 으로 기록(캐시 레이어 도입 여부는 별도
  항목/ADR 판단 — 본 항목 범위는 *측정·발견*까지) (4) **한도 외삽 1단락** — 측정한
  요청당 bytes·function ms·DB 쿼리 수·Redis command 수 → 베타 50~100 MAU(가정:
  1인 월 N 비교 세션) 트래픽 환산 → Vercel Hobby 100GB·function 한도 / Neon free
  compute hours / Upstash free command 한도 대비 % 추정치를 결과 표 하단에 출력
  (5) `harness:load` 는 `harness:all` 에 **넣지 않음**(무거움 — `harness:perf` 와
  동일), `/ship` 슬래시 커맨드에 advisory 체크박스로만 추가 (베타 직전 1회 권고).
  ci.yml 변경 0. 새 dep 0(자작) 또는 `autocannon` 1건(대안 — ADR-0026 선행 필요).
  검증: 로컬 `next start` 대상 1회 실행으로 5 라우트 표 + 한도 외삽 출력 + 가드
  메시지(production host 거부) 동작 + typecheck 0 + 결과를 본 항목 주석/ADR-0026(채택 시)에 기록.
  ✅ 검증 (2026-05-12): sub-task a/b/c/d/e — 도구=자작(ADR 없음)/`scripts/harness/load-smoke.ts`+`harness:load` 신설(안전 가드: localhost-only 강제 + production host 즉시 거부 + reachability 체크)/typecheck·lint·test 0·271(load-smoke.test.ts 18 신규)/hostname 가드 동작(LOAD_BASE_URL=https://slim.lu 즉시 exit 2, 미가동 시 exit 2)/캐시 finding: Redis 미구현 명시 출력/한도 외삽 가정값 명시(베타 100 MAU)/ship advisory 추가/PLAN 정합성 확인. **실측 (`pnpm build && pnpm start && pnpm harness:load`, VUS=10, 3 rounds, 2026-05-12)**: `/` p50 10ms/p95 19ms · `/compare` 11/13 · `/r/[shortId]` 84/258 (ISR 첫 렌더 비용이 p95) · `POST /api/compare` 89/103 (36B 응답, 가장 무거우나 빠름) · `/compare/mobile/postal` 33/50 — **에러율 전부 0%**. 캐시: 2회차 p50 89ms = 1회차 92ms 의 97% → 캐시 미스(Redis 레이어 미구현 확인). 한도 외삽 (베타 100 MAU × 월 3세션 × (1 compare + 5 PV) = 월 1,800 req): Vercel bandwidth ~0.07% / func 호출 ~0.30% / func 시간 ~0.0074% / Neon compute ~0.0011% / Upstash ~0% → **무료 한도 여유 충분 (최대 ≈0.3%)**. **페이즈 3.5 전체 완료**. 커밋 `9411c16` (`feat(plan-3.5.3): 첫 부하 테스트 — load-smoke 하네스 (베이스라인)`).
  - [x] **3.5.3.a** 도구 결정 + (autocannon 채택 시) ADR-0026 — 운영자가
    "순수 Node 자작" vs "`autocannon` devDep 1건" 중 택. 자작이면 ADR 불요(본
    PLAN 분해로 충분), `autocannon` 이면 **ADR-0026** 작성(scribe — 스코프: 도구
    선택 근거 + 측정 대상 라우트 표 + 한도 외삽 방법론 + "CI 머지 차단 X, 로컬 +
    베타 직전 1회" 게이트 정책, ADR-0023 §T5 cross-ref). dep 추가는 builder/운영자
    승인 후 `package.json` 반영(GATE-C amend).
    DoD: 도구 1개 확정 + (autocannon 시) ADR-0026 Accepted. 검증: ADR INDEX 갱신 또는 PLAN 주석에 "자작 채택" 명기.
    ✅ 검증 (2026-05-12): 자작 채택 — ADR 불요. ADR-0026 미작성(자작 선택이므로).
  - [x] **3.5.3.b** `scripts/harness/load-smoke.ts` 신설 + `package.json` scripts
    `"harness:load"` 추가 — 안전 가드(`LOAD_BASE_URL` + localhost-only 강제,
    production host 즉시 거부) → 동시 수 단계(10→50→100, env `LOAD_VUS` 로 override,
    기본은 10 부터) → 5 라우트 동시 HTTP 발사(`/api/compare` 는 유효 비교 입력
    body 고정) → 라우트별 p50/p95/에러율 표 출력.
    DoD: `LOAD_BASE_URL=https://slim.lu pnpm harness:load` 가 즉시 거부(exit≠0),
    `pnpm harness:load` (서버 미가동) 가 가드 메시지 + exit≠0, 서버 가동 시 5 라우트 표 출력.
    검증: typecheck 0 / lint 0 / (자작이면) 순수 함수(percentile 계산·host 가드 판정) 단위 테스트.
    ✅ 검증 (2026-05-12): load-smoke.ts 신설(686 줄)/load-smoke.test.ts 신설(18 케이스: percentile 6·isLocalhostHostname 6·aggregateSamples 6)/package.json "harness:load" 추가/안전 가드 동작 확인(hostname 가드 line 76 다른 모든 fetch 보다 먼저)/LOAD_BASE_URL=https://slim.lu exit 2 즉시 거부 실측/pnpm harness:load 미가동 exit 2 + reachability 메시지 실측.
  - [x] **3.5.3.c** 캐시 동작 점검 + 병목 finding — `load-smoke.ts` 에 `/api/compare`
    동일 입력 반복 모드(`LOAD_REPEAT_SAME=1`) 추가: 1회차 vs 2회차+ p50 비교 +
    `src/` Redis 사용처 grep 결과를 콘솔에 함께 출력. 캐시 레이어 부재 시 "병목
    후보" 라인 출력.
    DoD: 반복 모드 실행 시 "캐시 히트 감지됨(2회차 p50 ↓X%)" 또는 "캐시 레이어
    미구현 — `/api/compare` 매 요청 풀 실행(병목 후보)" 중 하나 출력.
    검증: 로컬 실행 1회 + 결과를 본 항목 주석에 기록.
    ✅ 검증 (2026-05-12): load-smoke.ts line 616-644 캐시 점검 구현(1회차 vs 2회차 p50 비교, 40% 이상 빨라질 시 캐시 히트 추정)/line 364-368 "⚠️ finding: /api/compare 캐시 레이어 미구현(src/ @upstash/redis 0)" 명시적 출력/src/ grep 확인: @upstash/redis 부재.
  - [x] **3.5.3.d** 한도 외삽 리포트 — `load-smoke.ts` 가 측정한 요청당
    bytes(`content-length` 합)·function 실행 ms(가능 시 `x-vercel-*` 헤더 또는
    walltime 근사)·DB 쿼리 수 추정·Redis command 수 추정 → 베타 50~100 MAU 트래픽
    환산(가정 명시: 1인 월 N 세션) → Vercel Hobby 100GB·function invocation·duration /
    Neon free compute hours / Upstash free command 한도 대비 % 추정치를 표 하단 출력.
    DoD: 5 라우트 측정 직후 "베타 100명 → Vercel bandwidth ~X% / Neon compute ~Y% /
    Upstash command ~Z% (가정: ...)" 리포트 출력. 검증: 가정·계산식이 출력에 명시됨 + ADR-0026(채택 시) §방법론 일치.
    ✅ 검증 (2026-05-12): load-smoke.ts line 400-499 한도 외삽 구현(printLimitExtrapolation)/가정값 명시: betaMau=100, sessionsPerUser=3, comparePerSession=1, pageviewsPerSession=5/Vercel bandwidth/function invocations/duration + Neon compute hours + Upstash commands 각각 % 계산/캐시 미구현 → upstashCommandsPerCompare=0 주석+계산식.
  - [x] **3.5.3.e** `/ship` advisory 통합 + 결과 기록 — `.claude/commands/ship.md`
    에 `pnpm harness:load` advisory 체크박스 추가(`next build && pnpm start` 선행 +
    "베타 직전 1회 권고, CI 게이트 아님 — ADR-0023 §T5" 주석). `harness:all` 무변동.
    ci.yml 무변동. 베이스라인 측정 결과(라우트별 p50/p95 + 한도 외삽 + 병목 finding)를
    본 항목 ✅ 검증 주석 또는 ADR-0026 §Verification 에 기록.
    DoD: `/ship` 에 `harness:load` 등장 + 측정 결과 1회 분이 PLAN/ADR 에 남음.
    검증: 슬래시 커맨드 파일 확인 + 본 항목 주석에 베이스라인 수치 존재.
    ✅ 검증 (2026-05-12): .claude/commands/ship.md 코드 품질 섹션에 `pnpm harness:load` 체크박스 추가(next build && pnpm start 선행 + "베타 직전 1회 권고, CI 게이트 아님" 주석)/harness:all 무변동 확인/ci.yml 무변동 확인/package.json dependency 0 확인.

---

## 페이즈 4 · 전환 플로우 + 베타 (Switch Flow + Beta) — M8 ~ M10

**목표:** 결과에서 실제 공급사 변경까지 3클릭 + 베타 100명 모집/검증.

> 페이즈 4는 원 PLAN의 페이즈 4(전환) + 페이즈 7(런치)을 **솔로 + TVA 발급
> 후의 어트리뷰션 검증 1주기**로 묶었다. ADR-0003 §결정 4 참조.

- [x] **4.1** 어트리뷰션 시스템 (`affiliate_click` 테이블) — **ADR-0026** (페이즈 4 진입 시
  builder 트리거, 본 항목은 GATE-K 무관 = 인프라 독립; 베타 *런치*만 GATE-K(D.3) 의존).
  데이터 모델 + 클릭 기록 + 명시적 동의 흐름 + 디스클로저 정합 + 순위-격리 테스트까지.
  실 Stripe payout 실행/베타 모집은 페이즈 4 후반(4.5~4.9).
  DoD: (1) `affiliate_click` 테이블 마이그레이션 (ADR-0026 §데이터 모델 — `comparison_result` FK +
  `provider` FK + 익명 클릭 ID(어트리뷰션용, PII 최소화 — 세션 fingerprint/IP 컬럼 0, ADR-0007 §T1/§T5 정신
  계승) + payout 정산 필드 + 보존 기간 정책). (2) 결과 페이지 "변경하기" CTA → 명시적 동의 UI
  (헌법 §8 #1 — GDPR Art. 6(1)(a)) → `affiliate_click` 서버사이드 기록 → 제휴사 리다이렉트(`?ref=slim` 류).
  쿠키 기반 추적 0 / 3rd-party 어트리뷰션 SaaS 0 (헌법 §8 #1 + €300 cap). (3) 어트리뷰션 코드가
  비교 엔진/정렬에 **절대 영향 없음**을 단위 테스트로 강제 (헌법 P3 + `/ship` §윤리 체크리스트의
  "어트리뷰션 코드가 알고리즘 순위에 영향 없음" 줄을 이 테스트로 충족). (4) `/legal/affiliate-disclosure`
  (3.5.2 신설)에 공급사별 수수료 단가 테이블 데이터 소스 연결 — `affiliate_click` 의 단가 필드와 정합.
  (5) `bias-audit` 하네스가 어트리뷰션 데이터와 충돌 없음 (현재 `affiliate_status='active'` 필터를
  ADR-0001 enum 6값 중 `active_b2b_*` 로 정정 — 회귀 아님, 데이터 정합).
  검증: 어트리뷰션 정확성 — `pnpm harness:price` + 수동 5건 + 순위-격리 단위 테스트 green + ADR-0026 §Verification.
  legal 에이전트 검토 트리거 (아래 4.1.f).
  - [x] **4.1.a** ADR-0026 작성 — `affiliate_click` 스키마 (데이터 모델) + 어트리뷰션 흐름 +
    수수료 공개 정합 + 거부 대안(Stripe Connect vs 자체 어트리뷰션 = 헌법 §5 재확인 / 3rd-party SaaS 거부 /
    쿠키 추적 거부) + CI 게이트(순위-격리 단위 테스트) + legal 트리거. **운영자 승인 후 architect/scribe 작성.**
    ✅ 완료 (2026-05-13): `docs/adr/0026-affiliate-click-and-attribution.md` 신설 (Accepted, 결정 T1~T8 + §스키마 표 18컬럼 + Alternatives a~e). `docs/adr/INDEX.md` 정식 항목 + `docs/adr/0007-...md` §"Legal review pending" cross-ref. legal 1차(4.1.f) 조건부 통과 — Status 에 잔존 조건 2건(BE 회계 보존 10년 보수 / 4.1.d 인터스티셜 필수항목) 명시. 외부 변호사 감사 7항목은 베타 직전/M16.
  - [x] **4.1.b** `src/db/schema/affiliate_click.ts` 신설 + Drizzle 마이그레이션 (drizzle/0005_*) —
    ADR-0026 §데이터 모델 컬럼. `src/db/schema/index.ts` export 1줄. `pnpm db:push` 검증.
    ✅ 완료 (2026-05-13): `src/db/schema/affiliate_click.ts` 신설 (18컬럼, enum, FK 4개, 인덱스 5개). `drizzle/0005_pale_praxagora.sql` (enum + table + FK + 인덱스). `src/db/schema/index.ts` export 1줄 추가. typecheck/lint/test/harness:plan/harness:data 모두 통과. 3-way 정합(ADR-0026 ↔ 스키마 ↔ 마이그레이션) ✅. CHANGELOG 항목 추가. builder 인계 가능.
  - [x] **4.1.c** 클릭 기록 경로 — `src/app/r/[shortId]` "변경하기" CTA → 동의 확인 인터스티셜
    (`src/app/go/[...]` 또는 route handler) → `affiliate_click` insert → 302 redirect to provider site
    (`?ref=slim`). 동의 거부 시 외부 링크만 (기록 0). PostHog/Sentry 외 추적기 0.
    ✅ 완료 (2026-05-13): `/r/[shortId]/_components/ResultConclusionCard.tsx` 의 CTA → `/go/[shortId]/[itemId]` 라우트. `src/app/go/[shortId]/[itemId]/page.tsx` 인터스티셜 RSC (provider.name + "전송 데이터: 없음" + "거부해도 결과 그대로" 명시). POST `confirm/route.ts` → affiliate_click INSERT(consent_given_at=now(), ref_param=`slim-r-<shortId>`, click_token=nanoid(12)) + 302 to `provider.website?ref=...`. 거부 → 외부 링크만 (`?ref` 미부착, 쿠키/SaaS 0). 헌법 §8 #1 자가 검증 ✅ (user-agent/x-forwarded-for/cf-connecting-ip/referer 헤더 0건, cookies()/Set-Cookie 0건). 헌법 §8 #4 ✅ (`src/engine/**` 에 affiliate_click/affiliate_status import 0 — 4.1.e가 정적 강제). typecheck/lint/test 284 passed (8 신규)/harness:plan/harness:data 통과. 커밋 `a8cbe13` (feat(plan-4.1.c): 어트리뷰션 클릭 기록 경로 골격). 다음: 4.1.d(동의 UI 다크패턴 0 + legal 최종) + 4.1.e(compare ↔ affiliate_click 정적 격리 테스트).
  - [x] **4.1.d** 동의 UI — 다크패턴 0 (헌법 §8 #3): 동의/거부 동등 가시성, "긴급" 카피 0,
    pre-checked 0. 받는 회사명 + 전송 데이터(없음 — 단순 리다이렉트) 명시. legal 검토 대상.
    ✅ 완료 (2026-05-13): `src/app/go/[shortId]/[itemId]/page.tsx` RSC + 필수 5항목(EDPB Guidelines 05/2020) 모두 명시 + VI.99 정렬 기준 한 줄 + 다크패턴 0(Fake Urgency/Confirmshaming/Pre-checked/Visual Interference 정규식 테스트). `src/app/go/[shortId]/[itemId]/page.dark-pattern.test.ts` 신설 (26 테스트: A~F 섹션 커버). 동의/거부 버튼 동등 가시성(둘 다 filled, px-6 py-2.5 text-sm font-medium rounded-full, 색상만 다름 bg-primary vs bg-fg/10). typecheck/lint/test 328 passed (기존 302 + 26신규)/harness:plan 정합/legal 1차 후속 §검토 2/5/6 통과. 커밋 `9275628` (feat(plan-4.1.d): 동의 인터스티셜 — 필수 5항목 + 다크패턴 0).
  - [x] **4.1.e** 순위-격리 단위 테스트 — `src/engine/compare.test.ts` 또는 신규 테스트:
    `affiliate_status` 가 무엇이든 동일 입력 → 동일 순위. compare() 가 `provider.affiliate_status` /
    `affiliate_click` 를 import 하지 않음을 정적 검증 (의존성 그래프 단언 또는 코드 grep 테스트).
    ✅ 완료 (2026-05-13): `src/engine/compare.isolation.test.ts` 신설 (정적 grep 6토큰 0건 + behavioral 3픽스처 6값 동일 순위 + 자가 검증). `src/engine/compare.test.ts` export 2줄 추가. typecheck/lint/test 302 passed (기존 284 + 18신규)/harness:plan/harness:data 통과. ADR-0026 §T3 §Legal Review에서 `/ship` §윤리 줄의 **단일 출처** 지정. 커밋 `16ee8da` (feat(plan-4.1.e): 순위-격리 단위 테스트 — ADR-0026 §T3 단일 출처).
  - [x] **4.1.f** legal 에이전트 검토 — GDPR 등록부 (`docs/legal/gdpr-register.md` — 미존재 시 신설)
    에 새 처리 활동(어트리뷰션 클릭 기록) 등재 + 동의 UI 다크패턴 검토 + 보존 기간(정산 목적 vs
    `comparison_result` 90일 익명화 정합) 의견. 외부 변호사 감사는 베타 직전/M16 (ADR-0004 §결정 3).
    - 조건부 통과 (2026-05-13): 6개 항목 검토 완료 — PII 최소화 통과 / 동의 흐름 조건부(4.1.d 인터스티셜 필수 표시 항목 준수) / BE 보존 기간 조건부(invoices 10년 보수 적용, 외부 감사 확정) / 합법근거 분리 통과 / 수수료 공개 조건부(정렬 기준 UI 명시) / 다크패턴 조건부(4.1.d 구현 검증). builder 인계 가능. `docs/legal/gdpr-register.md` 신설 (PA-01~04). ADR-0026 §Legal Review 섹션 + §Status 갱신. 외부 감사 필수 항목 7건 문서화.
- [x] **4.2** 제휴 가능 공급사 우선 — **그러나 절대 검색 결과 순위에 영향 X**
  - 알고리즘: 절약액 순. 제휴 여부는 "변경하기" 버튼 색만 다름 (헌법 §8 #4 광고-비교 분리).
  - **4.1 ADR-0026 §어트리뷰션 흐름에서 함께 다룸** — 4.1 의 순위-격리 단위 테스트(4.1.e)가
    4.2 의 DoD 도 동시 충족. UI 의 "변경하기 버튼 색만 다름" 은 4.3/4.4 와 묶여 페이즈 4 UI 라운드에서
    builder 가 구현 (별도 분해 불필요 — 4.1 ADR 가 격리 원칙의 단일 출처).
  - ✅ 완료 (2026-05-13): **알고리즘 측면 — 4.1.e (`src/engine/compare.isolation.test.ts`) 가 본 항목의 격리 원칙(`affiliate_status` 무영향) 을 단일 출처로 강제 + ADR-0026 §T3 잠금**. UI 측면("변경하기" 버튼 색만 다름) 은 4.3 (디스클로저 카드) 과 4.4 (비제휴 동등 표시) UI 라운드에서 통합 구현. 별도 sub-task 분해 불필요 (PLAN 본문 명시).
- [ ] **4.3** 제휴 비공개시 명시적 디스클로저 (각 결과 카드 하단)
  - 예: "Slim은 변경 시 Proximus로부터 €X의 수수료를 받습니다 — 이 금액은 회원님의 요금에 영향이 없습니다"
  - **단가 데이터 출처 결정 — 옵션 C (정적 TS const `src/data/affiliate-rates.ts`)**.
    근거 2줄: (i) 솔로 + €300 cap + 4.x 초기 계약 ≤ 5건 + 변경 빈도 분기 ≤ 1회 — 별도
    테이블(B) / 컬럼 추가(A) 의 마이그레이션 비용이 가치보다 큼. (ii) P1 (출처) 충족은
    const entry 마다 `source` (계약 PDF + 페이지) + `fetched_at` (운영자 수동 입력 일자)
    필드로 가능 — DB 칼럼 없이도 헌법 P3 정합. 격상 트리거: 계약 ≥ 6건 OR 분기 ≥ 2회
    변경 시 ADR amendment 로 B 재검토.
  - **표시 형식**: CPA flat fee (€ 단일 숫자, BE 텔레컴 어필리에이트 시장 통설 — 운영자
    salair-plus 사전 지식). `affiliate_click.commission_amount_cents` 와 동일 단위 ⇒
    정합 단순. % 형식은 채택하지 않음.
  - **표시 위치**: `ComparisonTable` 행 카드 *하단 별도 영역* (카드 본문 가격/절약액 슬롯
    과 시각적 구분선 + `text-xs text-fg-soft` 톤). 헌법 §8 #4 (광고-비교 분리) 정합 —
    상단은 100% 알고리즘 결과, 하단 디스클로저는 별도 슬롯. 결론 카드(`ResultConclusionCard`)
    1위 공급사도 동일 슬롯. 헌법 P3 (결론 → 근거 → 원본) 의 *근거* 층.
  - **표시 대상**: `affiliate_status IN ('active_b2b_intra_eu', 'active_b2b_domestic_be')`
    (ADR-0026 §T4). 그 외 4값(`none` / `pending` / `paused` / `terminated`) 은 4.4
    슬롯("수수료 없음" 또는 비표시) 으로 이동.
  - **4.4 와의 관계**: 같은 카드 슬롯의 *반대편* — 동일 컴포넌트 (`AffiliateDisclosureLine`
    또는 유사) 가 `affiliate_status` 분기로 두 케이스 모두 렌더. 4.4 는 별도 분해 없이 4.3.c
    안에서 동시 구현 (4.2 가 4.1.e 안에서 동시 충족된 패턴과 일관).
  - **legal 트리거**: 4.3.d 에서 UCPD + BE Code de droit économique VI.99 (ADR-0026
    §검토 5 일관) 카피 + 링크 텍스트 1차 감사. 4.1.d 인터스티셜과 *문구 일관성* 확인.
  - [x] **4.3.a** ADR-0027 신설 — "Affiliate rate data source — static TS const"
    (단가 데이터 모델 + 격상 트리거 + P1/P3 정합 방식). ADR-0026 §T4 의 "builder 결정"
    부분을 정식 결정으로 격상. scribe 가 본문 작성. DoD: ADR-0027 Accepted + INDEX
    등재 + ADR-0026 §T4 cross-ref 1줄.
    - ✅ 완료 (2026-05-13, scribe): ADR-0027 본문 신설(T1~T5 + Alternatives a/b/c + Consequences). INDEX.md 행 추가. ADR-0026 §T4 이미 cross-ref 보유.
  - [x] **4.3.b** `src/data/affiliate-rates.ts` 신설 — `AffiliateRate` 타입
    (`providerId`, `currency: 'EUR'`, `amountCents: number`, `commissionType: 'CPA'`,
    `source: string`, `fetchedAt: string`, `effectiveFrom: string`, `effectiveTo?: string`)
    + 운영자 입력 entry (현 시점은 placeholder 또는 실계약 1~2건). 헬퍼:
    `getRateForProvider(providerId, status)` — `status` 가 표시 대상 enum 2값일 때만
    return, 외엔 `null`. 단위 테스트: enum 분기 6값 모두. DoD: typecheck/test 통과 +
    `affiliate_click.commission_amount_cents` 와 *동일 단위* (cents) 단언 코멘트.
    - ✅ 완료 (2026-05-13): 신설 파일 + 23 단위 테스트 + 헬퍼 + 헌법 §8 #4 회귀 0 (compare.isolation.test.ts 18 통과). 커밋 `17cec6a`.
  - [ ] **4.3.c** UI 컴포넌트 — `src/app/r/[shortId]/_components/AffiliateDisclosureLine.tsx`
    (신설). `ComparisonTable` 각 행 + `ResultConclusionCard` 1위 슬롯에 삽입. props:
    `providerId`, `providerName`, `affiliateStatus`. 분기:
    (i) `active_b2b_*` ⇒ "Slim은 변경 시 {name}로부터 €X의 수수료를 받습니다 — 이 금액은
    회원님의 요금에 영향이 없습니다" + `/legal/affiliate-disclosure` 링크.
    (ii) 그 외 ⇒ "수수료 없음 — 외부 링크로 이동" (4.4 충족). compare-view 가
    `affiliate_status` 를 props 로 전달 (현재 미전달 — 1줄 추가). DoD:
    typecheck/lint/test + axe 0 violations + 시각 회귀 없음.
  - [ ] **4.3.d** `/legal/affiliate-disclosure` 페이지 본문 채움 (현재 stub) — `src/data/
    affiliate-rates.ts` 를 *렌더* 하는 단가 표 (공급사 / 단가 / 유형 / source / fetched_at /
    effectiveFrom). 4.3.c 의 카드 디스클로저 링크 도착지. legal 에이전트 1차 감사 트리거
    (UCPD + BE Code de droit économique VI.99 — ADR-0026 §검토 5 일관). DoD: 단가 표 렌더
    + legal 1차 통과 + 4.1.d 인터스티셜 문구와 *일관성* 명시.
  - [ ] **4.3.e** 테스트 — (i) 정합 테스트: `affiliate-rates.ts` entry 의 `amountCents`
    가 `affiliate_click.commission_amount_cents` 와 동일 단위/타입 단언. (ii) 컴포넌트 테스트:
    `AffiliateDisclosureLine` 6 enum 분기. (iii) E2E 1건: 결과 페이지에서 디스클로저
    문구 렌더 + 디스클로저 페이지 링크 클릭 → 단가 표 도달. DoD: test 전체 통과 +
    harness:plan/harness:data 통과.
- [ ] **4.4** 비제휴 공급사도 동등하게 표시 (그냥 외부 링크 + "수수료 없음" 표기)
  - **4.3.c 안에서 동시 구현** — 같은 `AffiliateDisclosureLine` 컴포넌트가 `affiliate_status`
    enum 분기로 두 케이스 모두 렌더. 별도 sub-task 분해 불필요 (4.2 가 4.1.e 안에서 동시
    충족된 패턴과 일관).
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
| 0.5 | 5 | 2 | 0 | D.2·D.4 완료. D.1 코드 완료(잔여=운영자 브랜치 보호), D.3 GATE-K 직전 일괄, D.5 ADR-0025+verifier.md 완료(a/b — D.5는 c 잔존으로 [ ], 효과 검증 다음다음 세션) | 2026-05-12 |
| 1 | 13 | 13 | 0 | M1 ~ M3 | 2026-05-09 |
| 1.5 | 7 | 6 | 1 | M3 말 (1.5.6 페이즈 5/6 재평가 — ADR-0013 옵션 C) | 2026-05-10 |
| 2 | 9 | 9 | 0 | M4 ~ M5 (페이즈 2 1차 종료, e2e 5단계 + axe 6페이지 0 violations) | 2026-05-10 |
| 3 | 7 | 7 | 0 | M6 ~ M7 (ADR-0021 Accepted + §T5/§T7/§T9 Amendment; sub-task 1-6 + 라운드 a/b/c/d 통과 — 3.1~3.6 풀; 3.7 인쇄 뷰 §T9 Amendment 1 페이즈 3 환원 + 구현 완료 — e2e 24 passed/4 skipped) **페이즈 3 종료** | 2026-05-11 |
| 3.5 | 3 | 3 | 0 | M7 말 (**3.5.1·3.5.2·3.5.3 완료**; 3.5.1.e 비차단 백로그. 3.5 페이즈 전체 완료 — 부하 베이스라인 1회/캐시 finding 명시/한도 외삽 베타 100명 ≤0.3% 여유) | 2026-05-12 |
| 4 | 9 | 0 | 0 | M8 ~ M10 (베타 + 런치 통합). 4.1 분해 (a~f) + 4.3 분해 (a~e, 4.4 동시 충족 — 합계 불변) + ADR-0026/0027 (architect, 2026-05-13) | 2026-05-13 |
| 4.5 | 3 | 0 | 0 | M10 ~ M11 + M16 평가 | 2026-05-09 |
| 5 | 7 | 0 | 0 | M17 ~ M21 (조건부, 5.0 Orange BE 신설 — ADR-0009) | 2026-05-09 |
| 6 | 10 | 0 | 0 | M22 ~ M24 | 2026-05-09 |
| 7 | 3 | 0 | 0 | M24+ (예약) | 2026-05-09 |
| **합계** | **83** | **49** | **1** | M0 ~ M24 (≈ 18-24개월) | 2026-05-13 |

> 이 표는 `verifier` 에이전트가 매 `/checkpoint`마다 자동 갱신한다.
> 페이즈 X.5는 운영 부채 트랙으로, ADR-0002(0.5)와 ADR-0003(1.5/3.5/4.5)에
> 묶여 있다. 합계는 풀타임 12주 → **솔로 사이드 18-24개월**로 재조정됨
> (ADR-0003).
> **실측 vs 가정 일정**: 각 페이즈 종료 시 `actual M` 컬럼을 추가해 다음
> 페이즈 일정을 보정한다 — ADR-0003 §검증 방법 참조.

### Scope cut 옵션 (사용자 승인 후 적용)

- 옵션 A: 1.8 fetcher 3개 → 2개 (Proximus + Telenet) — **적용됨 (ADR-0009, 2026-05-09)**
- 옵션 B: 1.12 알려진 케이스 12개 → 6개 — **적용됨 (ADR-0010, 2026-05-09)**
- 옵션 C: 2.5 OCR을 페이즈 2 → 페이즈 3 결과 페이지 직후로 미룸 — **적용됨
  (ADR-0016 §T6 SC-A, 2026-05-10)**. 별도 ADR (가칭 ADR-OCR) 신설 트리거.
- 옵션 D: 3.7 인쇄 뷰를 페이즈 3 → 페이즈 6으로 미룸 — **철회됨 (ADR-0021 §T9
  Amendment 1, 2026-05-11)**. 3.7 페이즈 3 환원, builder 후속 라운드 (3.7.a~c).
  별도 ADR-PRINT 미신설 (Amendment 가 대체).
- 옵션 E: 4.6 베타 100명 → 50명
- **옵션 SC-B**: 2.2 우편번호 BE/NL/LU 3국 → 페이즈 2 1차 BE 만, NL/LU 페이즈 3
  진입 직전 추가 — **적용됨 (ADR-0016 §T3 SC-B, 2026-05-10)**.
- **옵션 SC-C**: 2.9 Playwright E2E → 페이즈 2 1차 axe-core 만, Playwright
  페이즈 4 deploy 직전 — **적용됨 (ADR-0016 §SCOPE CUT SC-C, 2026-05-10)**.
- **옵션 SC-D**: PostHog 측정 (이탈률 30%) → 페이즈 4 이후. 페이즈 2 1차 = "측정
  가능한 구조" 만 (ADR-0016 §T1 URL 자체가 단계 식별자) — **적용됨 (2026-05-10)**.
- **옵션 SC-E**: i18n 한국어 단일 → 페이즈 4 베타 직전 일괄 도입 (next-intl
  + 4 locale 한/nl/fr/en) — **적용됨 (ADR-0016 §T10 SC-E, 2026-05-10)**.
- **옵션 SC-F**: 3.2 비교 표 정렬/필터 → URL params + RSC 재렌더 (Zustand/Jotai
  client state 거부, dep 0) — **적용됨 (ADR-0021 §T4, 2026-05-10)**.
- **옵션 SC-G**: 3.6 영구 링크 동적 OG 이미지 → 페이즈 4 진입 시 별도 ADR-OG.
  페이즈 3 1차 = static OG — **적용됨 (ADR-0021 §T8, 2026-05-10)**.
- **옵션 SC-H**: OCR 도입 → 페이즈 3 결과 페이지 *직후* 별도 ADR-OCR (본 ADR
  인라인 거부, 분량 분리) — **적용됨 (ADR-0021 §T11, 2026-05-10)**.
