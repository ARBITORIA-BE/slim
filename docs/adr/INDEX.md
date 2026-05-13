# ADR Index

이 문서는 Slim 프로젝트의 모든 Architectural Decision Records를 인덱싱합니다.
각 ADR은 설계 결정의 근거, 대안 검토, 장단점을 기록합니다.

---

## 현황

| ID | 제목 | 상태 | 발행 |
|---|---|---|---|
| [ADR-0001](0001-provider-schema.md) | `provider` 테이블 스키마 (공급사 마스터) | Accepted | 2026-05-09 |
| [ADR-0002](0002-build-gate-ownership.md) | Build gate 책임 분리 + Hook jq fallback 통일 | Accepted (+ Amendment 1) | 2026-05-09 |
| [ADR-0003](0003-plan-realism-solo-side.md) | PLAN.md 리얼리즘 패스 — 솔로 사이드 + 카테고리 우선순위 + 운영 부채 트랙 | Accepted | 2026-05-09 |
| [ADR-0004](0004-monetization-solo-side-rebalance.md) | MONETIZATION.md 솔로 사이드 재조정 — €0 인건비, €300 인프라 cap, 보수적 매출 가정 | Accepted | 2026-05-09 |
| [ADR-0005](0005-tariff-schema-telecom.md) | `tariff` 테이블 스키마 (통신 BE) | Proposed | 2026-05-09 |
| [ADR-0006](0006-tariff-snapshot-schema.md) | `tariff_snapshot` 테이블 스키마 (가격 시계열) | Proposed | 2026-05-09 |
| [ADR-0007](0007-comparison-request-result-schema.md) | `comparison_request` + `comparison_result` 스키마 (GDPR + 익명성 + 영구 링크) | Proposed | 2026-05-09 |
| [ADR-0008](0008-fetcher-interface-and-cron.md) | Fetcher 인터페이스 + Inngest cron 인프라 | Proposed | 2026-05-09 |
| [ADR-0009](0009-scope-cut-fetcher-2-providers.md) | PLAN 1.8 fetcher 갯수 축소 — 3개 → 2개 (Proximus + Telenet) | Accepted | 2026-05-09 |
| [ADR-0010](0010-comparison-engine.md) | 비교 엔진 (compare) — 절약액 계산 + caveats + 6 테스트 케이스 | Proposed | 2026-05-09 |
| [ADR-0011](0011-data-sources-page-and-caveats-boundary.md) | `/data-sources` 투명성 페이지 + caveats 함수/UI 경계 (PLAN 1.10 + 1.13) | Accepted | 2026-05-09 |
| [ADR-0013](0013-fetcher-real-scraping-risk-assessment.md) | PLAN 1.5.6 실 스크래핑 진입 전 리스크 평가 + 분기 결정 (LOW/MEDIUM/HIGH) | Proposed (Appendix A 추가 — legal 에이전트, 2026-05-09) | 2026-05-09 |
| [ADR-0015](0015-vercel-integration-and-d1-closure.md) | Vercel 통합 운영 결정 + PLAN D.1 마감 게이트 | Proposed (GATE-H 대기) | 2026-05-10 |
| [ADR-0016](0016-phase-2-input-flow-design.md) | 페이즈 2 입력 플로우 설계 — 5단계 5분 / shadcn / 모바일 우선 | Accepted (T9 옵션 A + T10 SC-E, 2026-05-10) | 2026-05-10 |
| [ADR-0017](0017-db-mismatch-incident-postmortem.md) | DB 미스매치 사건 종결 보고 (silent-darkness + slim-prod hidden-recipe) | Accepted | 2026-05-10 |
| [ADR-0018](0018-neon-multi-org-policy.md) | Neon 멀티 organization 정책 + 자동 자산 점검 룰 | Accepted | 2026-05-10 |
| [ADR-0019](0019-arbitoria-three-platform-alignment.md) | ARBITORIA 3 플랫폼 (GitHub / Vercel / Neon) 정렬 | Accepted (+ Amendment A1/A2, Appendix A pending TVA) | 2026-05-10 |
| [ADR-0020](0020-arbitoria-inventory-and-alignment-corrections.md) | ARBITORIA 인벤토리 명시 + ADR-0019 진단 사실 정정 | Accepted | 2026-05-10 |
| [ADR-0021](0021-phase-3-results-page-design.md) | 페이즈 3 결과 페이지 설계 — 3층 구조 / caveats UI / `/api/compare` 풀 구현 | Accepted (T9 옵션 D + T11 SC-H + SC-F + SC-G, 2026-05-10) + Amendment 1 (2026-05-11, T9 인쇄 뷰 페이즈 3 환원) | 2026-05-11 |
| [ADR-0022](0022-database-environment-separation.md) | DB 환경 분리 정책 — production / preview / development 3 브랜치 + prod URL Console-only SoT | Accepted (2026-05-11 — D.4 완료, verify:db all-green, 커밋 4b7faab) | 2026-05-11 |
| [ADR-0023](0023-lighthouse-axe-perf-harness.md) | Lighthouse / axe-core 자동화 — `pnpm harness:perf` 신설 + 로컬 advisory 게이트 (CI 머지 차단 X) | Accepted (2026-05-11 — GATE-P 승인: lighthouse devDep + CI 머지 차단 X) + **Amendment 1 (2026-05-12)** — first-load JS budget 확정 (per-route 2-tier) | 2026-05-11 |
| _ADR-0024_ | _(예약) Neon-side Vercel Integration — PR마다 DB branch 자동 생성_ | _가칭 / 미작성 — 페이즈 4 베타 (GATE-K) 트리거. PLAN §D.3.e_ | — |
| [ADR-0025](0025-verifier-read-only-commit-boundary.md) | verifier 에이전트 read-only 경계 — 커밋 금지 + 불일치는 보고만 + 게이트 발명 금지 | Accepted (2026-05-12 — 운영자 직접 결정) | 2026-05-12 |
| [ADR-0026](0026-affiliate-click-and-attribution.md) | `affiliate_click` 테이블 + 어트리뷰션 모델 — 동의 흐름(GDPR Art. 6(1)(a)) / 수수료 공개 정합 / 순위-격리 단위 테스트 / `bias-audit` 정정 / GDPR 90일·7년 분리 보존 / legal 트리거 | Accepted (2026-05-12). Legal review 조건부 통과 (2026-05-13 — 4.1.a/f 완료). Builder 인계 가능. 외부 감사 = M16. | 2026-05-13 |

---

## 설명

### [ADR-0001: `provider` 테이블 스키마](0001-provider-schema.md)

**상태**: Accepted (verifier 통과: typecheck/lint/test/migration-sql/harness:plan 모두 통과)

**요약**: PLAN 항목 1.1의 첫 테이블. 베네룩스 공급사 마스터 데이터. 세무 처리(BTW 21% vs 0% 리버스 차지)를 분기하는 6값 `affiliate_status` enum으로 설계. VIES VAT ID 검증 시각 추적 (`vat_id_verified_at`). 비교 제외 사유 공개 (`excluded_reason`) — P3 투명성 강제.

**영향**: 1.2 `tariff`, 1.3 `tariff_snapshot`, 4.1 `affiliate_click` 후속 테이블의 기초.

### [ADR-0002: Build gate 책임 분리 + Hook jq fallback 통일](0002-build-gate-ownership.md)

**상태**: Accepted (verifier 통과: typecheck/lint/test/harness:plan/harness:data/build/ci.yml/jq-fallback 음성테스트 모두 통과). **Amendment 1 (2026-05-09)** — CI lint 단계 제거 (GitHub Actions ESLint 9 호환성). 4단 게이트로 축소.

**요약**: Vercel production build 실패(D.1) + Windows에서 `pre-tool-guard.sh`의 jq 의존(D.2)을 한 사이클로 묶어 정리. **옵션 C 채택**: `next.config.ts`에 `ignoreBuildErrors` + `ignoreDuringBuilds` 추가하여 Vercel을 순수 빌드 머신으로 환원하고, 검증 권한을 로컬 stop-gate + GitHub Actions CI 워크플로로 이중화. PreToolUse hook은 `_lib.sh`의 jq fallback 패턴으로 통일. **Amendment 1**: GitHub Actions에서 `pnpm lint`가 매번 실패 → CI에서 lint 단계 제거, lint는 로컬 stop-gate 단독 책임으로 환원. 거짓 안전 신호 회피 (`continue-on-error: true` 거부).

**영향**: 페이즈 0.5 D.1, D.2, **D.1.d** (Amendment 1)의 헌장. 헌법 P4 강제 위치를 hook 단일점 → hook + CI 이중점으로 격상 (단 lint는 hook 단일점 유지). 회귀 트리거: stop-gate 우회 push 발견 시 ADR 재검토 + lint 우회 push 발견 시 Amendment 2 검토.

### [ADR-0003: PLAN.md 리얼리즘 패스 — 솔로 사이드](0003-plan-realism-solo-side.md)

**상태**: Accepted (PLAN.md 본문 갱신 형태로 적용)

**요약**: 운영자 실제 상황(솔로 사이드, 개발 3개월, 월 €300, TVA 대기)에 맞춰 PLAN.md를 재조정. **6개 결정**: (1) 카테고리 우선순위 변경 — 에너지 → **통신 BE (Proximus/Orange BE/Telenet)**, 베네룩스 에너지 비교는 V-test/CREG-Scan/Energyprice/DareToCompare 4중 포화. (2) 페이즈 5는 **M16 평가 게이트** (매출 €1K/월 + CVR 3% + fetcher 95% + 시간 주 10h) 통과 시에만 진입. (3) 운영 부채 트랙(X.5)을 페이즈 1.5/3.5/4.5에 신설 — 페이즈 0.5 패턴 복제. (4) 원 페이즈 4(전환) + 페이즈 7(런치) → 새 페이즈 4로 통합. (5) 일정 단위 주차 → M (Month, 솔로 사이드). 12주 → **18-24개월 (M0~M24)**. (6) Scope cut 옵션 5개(A~E) 명시, 운영자 승인 시 적용.

**영향**: PLAN.md 페이즈 일정 / 카테고리 / X.5 트랙 / 작업 추적 메타 표 갱신. 항목 수 63 → 75. ADR-0004와 짝.

### [ADR-0004: MONETIZATION.md 솔로 사이드 재조정](0004-monetization-solo-side-rebalance.md)

**상태**: Accepted (MONETIZATION.md 본문 갱신 형태로 적용)

**요약**: 풀타임 4명 가정의 비용 모델(M3 €15K, M6 €45K, M12 €90K)을 솔로 사이드 €300/월 cap으로 재조정. **8개 결정**: (1) 인건비 €0 (사이드 전제). (2) 인프라 €300/월 cap, 무료 티어 한계 도달 시점 + 격상 트리거 명시. (3) 법무 자체(legal 에이전트) + 베타 직전 1회 외부 감사 €800. (4) 매출 가정 50% 다운 — M12 €1,800, M16 €3,750, M24 €15,400. (5) Slim Plus 시작 시점 페이즈 6 → M18+ 이연. (6) 시드 모금 M24+ 이연, Vlaio/LU 그랜트 TVA 직후 1주 결정. (7) Slim Insights B2B M24+ 이연. (8) `docs/MONETIZATION-ACTUALS.md` 신설 (분기 자동 갱신).

**영향**: MONETIZATION.md 비용/매출/마일스톤 게이트 재조정. **net positive 진입 시점 M6 → M8** (인건비 €0 효과로 더 빠름, 단 절대 매출 1/15~1/20 작음). ADR-0003과 짝. 회귀 트리거: 분기별 실제 비용/매출이 가정 ±50% 차이 시 Amendment.

### [ADR-0005: `tariff` 테이블 스키마 (통신 BE)](0005-tariff-schema-telecom.md)

**상태**: Proposed (verifier 통과 후 Accepted로 격상 예정)

**요약**: PLAN 1.2 두 번째 테이블. 통신 BE(모바일/인터넷/번들/유선) 한정. **6개 결정 (T1~T6)**: (T1) 단일 테이블 + JSONB `attributes` — 솔로 디버깅 용이성. (T2) 가격은 BIGINT cents — 1.12 ±0.01€ DoD 수학적 보장. (T3) `commitment_months INT` (0=없음) + `early_termination_fee_cents NULL`. (T4) 프로모는 평탄화 (`promo_price_cents`/`promo_months`/`promo_description`) — 어트리뷰션 단순화. (T5) `tariff` = 마스터 (`is_active`, `last_seen_at`), 시계열은 1.3 `tariff_snapshot` 단독. (T6) `tariff_category` enum 4값 (`mobile`, `internet_fixed`, `bundle_internet_tv`, `landline`).

**영향**: PLAN 1.2 원안 필드(`unit_price/fixed_fee/valid_from/valid_to`)를 통신 가정으로 재정의. 1.3 `tariff_snapshot`은 시계열만 책임. 1.7 fetcher 인터페이스 / 1.11 비교 엔진 / 1.12 12 케이스 / 4.1 `affiliate_click.tariff_id`의 모양을 결정.

### [ADR-0006: `tariff_snapshot` 테이블 스키마 (가격 시계열)](0006-tariff-snapshot-schema.md)

**상태**: Proposed (verifier 통과 후 Accepted로 격상 예정)

**요약**: PLAN 1.3 세 번째 테이블. ADR-0005 §결정 5(T5)의 마스터/스냅샷 분리 원칙을 직접 받아 *시계열 단독* 책임. **7개 결정 (T1~T7)**: (T1) Append-only insert — upsert/라운딩 없음, P3 사후 분석 가능. (T2) 평탄화 5컬럼 (monthly/activation/modem/promo) + JSONB `price_payload` 미러 — 비교 엔진 hot path 평탄화 + 진화 흡수. (T3) `raw_payload` = 정규화 JSON only (HTML 단편 X) — Neon free 0.5 GB 한계 대응. (T4) `confidence` 3값 enum + `confidence_reason` 텍스트 — UI 색상 매핑 + 운영자 자가 진단. (T5) `is_anomaly` boolean + `anomaly_reason` 텍스트, 1.5.2 harness:price 워커가 마킹, 비교 엔진 `NOT is_anomaly AND confidence != 'low'` 강제. (T6) 90일 후 `raw_payload` + `price_payload` NULL화 (메타 영구 보존), 1.5.2 cron 보조. (T7) `(tariff_id, fetched_at DESC)` 복합 인덱스 + DISTINCT ON 쿼리 — 마스터에 `current_snapshot_id` 추가 거부 (ADR-0005 §T5 분리 유지).

**영향**: PLAN 1.3 원안 5필드를 15컬럼으로 재정의. `harness:data` Rule 4 warn → 통과. 1.5.2 `harness:price` 워커 알고리즘의 출발점. 1.11 비교 엔진의 "최신 스냅샷" 쿼리 패턴 결정. 결과 페이지 3.5 계산 근거 펼치기의 영구 추적 보장.

### [ADR-0007: `comparison_request` + `comparison_result` 스키마 (GDPR + 익명성 + 영구 링크)](0007-comparison-request-result-schema.md)

**상태**: Proposed (verifier 통과 후 Accepted로 격상 예정 — 단 §Legal review pending 의 T3/T9는 베타 직전 또는 M16 게이트에서 외부 감사 권장)

**요약**: PLAN 1.4 + 1.5 두 테이블 동시 결정. FK + GDPR + 영구 링크가 얽혀 분리 설계 시 일관성이 깨지는 구조. **10개 결정 (T1~T10)**: (T1) 익명 UUID PK + `userAccountId` NULL 미리 (페이즈 6 회원 결합 대비, 세션 fingerprint 컬럼 0). (T2) 평탄화 4 + JSONB `inputAttributes` — Zod 단일 출처 `src/types/comparison-input.ts`. (T3) 합법근거 = **GDPR Art. 6(1)(b) Contract performance** (1차) + (a) Consent (어필리에이트 리다이렉트) — EDPB Guidelines 1/2024 / 2/2019 인용. (T4) 리텐션 분리 — request의 PII는 90일 후 PC2 일반화 + inputAttributes NULL, result는 영구 (영구 링크 + B2B Insights 호환). (T5) IP / fingerprint 컬럼 0 (헌법 §8 #1 / #5). (T6) `comparison_result` (1) ↔ `comparison_result_item` (N) — PLAN 3.2 비교 표 자연 매핑. (T7) 영구 링크 = nanoid 12자 (alphabet 36 × 12 = 4.7e18 공간). (T8) `requestId` nullable + `ON DELETE SET NULL` — GDPR 삭제 후에도 익명 결과 페이지 보존. (T9) `lockedInputs` JSONB = PII 파생물 봉인 + 90일 후 NULL. (T10) 비교 엔진 호출 = 동기 + 5초 timeout (Inngest 무료 티어 보호 + P2 5분 UX).

**영향**: PLAN 1.4 (5필드 → 10컬럼) + 1.5 (2테이블, 18컬럼 + 5 FK) 재정의. 1.5.2 cron에 90일 PII 일반화 보조 작업 3개 추가. 1.11 비교 엔진의 입출력 모양 / 1.13 caveats 메커니즘 / 3.5 계산 근거 / 3.6 영구 링크 / 4.1 어트리뷰션 (별도 ADR) / 6.4 GDPR 도구 / MONETIZATION D B2B Insights (M24+) 호환성을 한 번에 결정. **Legal review pending**: T3 합법근거 (Contract vs Legitimate interest 외부 견해) + T9 결과의 PII 판정 (Recital 26 익명 분류) — 베타 직전 또는 M16 게이트.

### [ADR-0008: Fetcher 인터페이스 + Inngest cron 인프라](0008-fetcher-interface-and-cron.md)

**상태**: Proposed (verifier 통과 후 Accepted로 격상 예정)

**요약**: PLAN 1.6 (Inngest cron) + 1.7 (Fetcher 인터페이스) 짝 결정. cron이 fetcher를 호출하므로 인터페이스 모양과 step 분할 정책이 한 ADR에 묶임. **10개 결정 (T1~T10)**: (T1) `FetchResult.data = TariffSnapshotInput[]` 고정 모양 — ADR-0005/0006 스키마와 1:1 매핑, fetcher가 매핑 책임. (T2) 1 fetcher = 1 provider의 *모든* tariff 배열 — Inngest free 50k exec/월 555배 안전 마진. (T3) Confidence는 표준 휴리스틱(`computeConfidence`) + fetcher down-grade override만 (up-grade 거부). (T4) Discriminated union 결과 — `{ ok: true; result } | { ok: false; error }`, 부분 성공 표현 + type-narrow + 1.9 격리 메커니즘. (T5) Metadata는 인터페이스 안 + registry는 `src/fetchers/index.ts` (둘 다 필요). (T6) Cron = 일 1회 `TZ=UTC 0 6 * * *` + `fetchers/run.requested` 수동 이벤트. (T7) Step 분할 = 네트워크 step + DB step 분리 (재시도 시 중복 insert 방지). (T8) Event = `fetchers/run.requested` (`only?` 필드로 디버깅). (T9) API route = `src/app/api/inngest/route.ts` + 두 환경변수 (INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY). (T10) DB 싱글턴 + step별 fresh logger.

**영향**: PLAN 1.6 / 1.7 본문 갱신 (5줄 → 각 12줄). `src/fetchers/types.ts` 진화 + `src/fetchers/index.ts` (registry) + `src/lib/inngest.ts` (client) + `src/inngest/functions.ts` (cron + persist) + `src/app/api/inngest/route.ts` 신설. 1.8 fetcher 3개가 *본 ADR만 따라가면* 통과. 1.9 격리는 §T7 for-loop continue 패턴 자체가 메커니즘 — 추가 코드 0. 1.10 `/data-sources`는 `registry.map(f => f.metadata)` + `tariff.lastSeenAt` 으로 자연 구성. 외부 의존성 0건 추가 (Inngest는 페이즈 0에서 이미 dep). **Amendment 1 트리거 (ADR-0011 §T2 항목 3)**: `FetcherMetadata.method` enum에 `'stub'` 추가 — PLAN 1.10 구현 시점 적용.

### [ADR-0009: PLAN 1.8 fetcher 갯수 축소 — 3개 → 2개 (Proximus + Telenet)](0009-scope-cut-fetcher-2-providers.md)

**상태**: Accepted (운영자 직접 결정, 2026-05-09 — Kim Wonmin)

**요약**: ADR-0003 §결정 6의 scope cut 옵션 A를 명시적으로 채택. **4개 결정**: (1) Orange BE 제외, Proximus + Telenet 2개 유지 — BE 통신 시장 합산 ≥ 75% 점유 (Telecompaper Q1 2025: Proximus ~43% + Telenet ~32%). 비교 의미를 잃지 않으면서 솔로 부담 -33%. Orange BE는 페이즈 5에서 평가 후 추가 (5.0 신설). (2) 페이즈 1 일정 1주 단축 (fetcher 3주 → 2주) — 1.12 청구서 12케이스 수집 또는 페이즈 1.5 부채 흡수에 마진. (3) 1.5.1 fetcher 공통화 가치 저하 (N=2 표본 약함) — Orange BE 페이즈 5 추가 시 N=3 회복. (4) 베타 모집 카피 + `/data-sources` 제외 공급사 섹션에 "Orange BE — 페이즈 5에서 평가 후 추가 예정" 명시 (헌법 P3). **거부 대안**: 3개 유지(시간 비용 vs 신호 가치 불균형) / 1개로 축소(비교 의미 0).

**영향**: PLAN 1.8 (3 → 2 fetcher, DoD 갱신) + 1.10 (제외 섹션에 Orange BE + CTA) + 4.6 (베타 모집 카피) + 5.0 (Orange BE 추가 신설 항목) + scope cut 옵션 A 라인 "적용됨" 마킹. 페이즈 5 항목 수 6 → 7. 합계 76 → 77. ADR-0008 인터페이스 결정 / ADR-0005 / ADR-0006 스키마 / MONETIZATION.md §A 단가 가정 변동 0. 검증: M16 평가 게이트 4개 신호 + 베타 `/data-sources` Orange BE CTA click ≥ 20% / Inngest free 무료 티어 사용량 0.27%.

### [ADR-0010: 비교 엔진 (compare) — 절약액 계산 + caveats + 6 테스트 케이스](0010-comparison-engine.md)

**상태**: Proposed (verifier 통과 후 Accepted로 격상 예정)

**요약**: PLAN 1.11 (절약액 계산 로직 = `src/engine/compare.ts`) + 1.12 (단위 테스트) 동시 결정. **scope cut 옵션 B 적용**: 12 → 6 케이스 (운영자 검증 가능). **7개 결정 (T1~T7)**: (T1) 카테고리 동일 후보만 비교 — 혼합 거부 (P1 정보 무결성). (T2) 사용량은 추천성/caveat 트리거만, 가격 가공 X — 헌법 §8 #2 직접 강제 (한도 초과 비용 추정 거부, 청구서 OCR 페이즈 5 진입 시 재논의). (T3) 12개월 + 24개월 두 시나리오 동시 계산 — `breakdown.monthlySaving12/24Cents` 둘 다 보존, PLAN 3.5 계산 근거 펼치기 입력. (T4) 활성화 비용은 12개월 amortize, 약정 위약금은 caveat — 사용자 약정 상태 미상 가정 (PLAN 2.4 선택 입력). (T5) Confidence 전파 = `min(현재, 후보)` 보수적 floor + ADR-0006 §T5 입력 단계 low/anomaly 자동 제외. (T6) `deriveCaveats(snapshot, profile, current?)` 순수 함수 — 8 규칙 매트릭스 (24m/12m 약정, 활성화, 프로모 12m 미만, mobile 한도 초과, EU 로밍, 4K 권장 미달, candidate medium, current 비-high). nl-BE 단일 문자열 (페이즈 2 i18n 도입 시 일괄 변환). (T7) 6 케이스 명세 — 평균 커플 / 저사용 1인 / 고사용 family / VDSL→케이블 / 약정 vs 비약정 / 신규 가입자. M3 베타 청구서 6개 추가 수집 시 Amendment 1로 12 케이스 확장. **engineVersion 하드코딩**: `compare@2026-05-09` — 영구 링크 (3.6) 결과 재현성 보장.

**영향**: PLAN 1.11 + 1.12 [x] 마킹 + scope cut 옵션 B "적용됨 (ADR-0010, 2026-05-09)". 1.13 caveats 메커니즘은 *함수 차원 완료* (deriveCaveats), *사용자 노출* 은 페이즈 3.5 결정으로 분리. `src/engine/compare.ts` + `src/engine/types.ts` + `src/engine/caveats.ts` + `src/engine/compare.test.ts` 신설. 페이즈 1 합계 9 → 11 완료, 전체 17 → 19. ADR-0007 `comparison_result.engineVersion` 컬럼이 본 ADR `ENGINE_VERSION` 상수를 그대로 기록. 1.5.6 실 스크래핑 후 confidence 격상 시 본 ADR 변경 0 (T5 floor 정책 그대로). 외부 의존성 0건 추가 (zod 이미 dep, 본 ADR은 zod 미사용).

### [ADR-0011: `/data-sources` 투명성 페이지 + caveats 함수/UI 경계 (PLAN 1.10 + 1.13)](0011-data-sources-page-and-caveats-boundary.md)

**상태**: Proposed (GATE-A 운영자 승인 통과 시 Accepted로 격상 예정)

**요약**: PLAN 1.10 (`/data-sources` 투명성 페이지) + 1.13 (caveats 메커니즘) 묶음 진입 결정. ADR-0010 §T6 `deriveCaveats()` 함수 차원 완료를 인용해 **1.13 [x] 마킹의 형식 근거**를 제공하고, 1.10 페이지의 표시 항목 6개를 못 박는다. **6개 결정 (T1~T6)**: (T1) PLAN 1.13은 *함수 차원* 완료로 [x] 마킹 가능 — UI 노출 (결과 카드 / 비교 표 / 계산 근거)은 페이즈 3 진입 시 별도 ADR. (T2) 1.10 표시 항목 6개 — (1) 공급사 정체성+국가+슬러그 (2) 마지막 fetch 시각 (3) fetch 방법 (api/scraping/manual + **`stub` 신설** — ADR-0008 Amendment 1 트리거) (4) 어필리에이트 가능 여부 + 순위 무영향 텍스트 (5) 비교 사용 횟수 (페이즈 1 시점 0 정직 노출 — `getComparisonStats` helper 신설) (6) 최근 1.13 caveats 미리보기 (고정 입력 → `deriveCaveats()` 호출). (T3) 페이즈 3 caveats UI 배치는 본 ADR 외부 결정 — 함수와 UI의 경계 명시. (T4) 디자인 정책 = 정보 밀도 우선 + shadcn/ui `<Table>` + 다크 패턴 0 + **새 의존성 0건 (GATE-C)**. (T5) i18n 정책 = 페이즈 1 한국어 단일 (SC-3) → 페이즈 2 nl-BE/fr-BE/en 일괄 도입. (T6) 라우트 = `src/app/data-sources/page.tsx` (RSC + ISR 1h) + helper `src/engine/comparison-stats.ts` 신설 + caveats 미리보기 (`src/engine/caveats-preview.ts` 또는 page.tsx 인라인, builder 자유도). **거부 대안**: 1.13 [ ] 유지 (페이즈 1 종료 게이트 차단) / affiliate_status 비공개 (P3 정면 위반) / 차트 라이브러리 추가 (GATE-C) / 페이즈 1부터 nl-BE/fr-BE 추가 (인프라 부재 + 시간 압박).

**영향**: PLAN 1.13 [x] 마킹 (verifier 책임, GATE-A 후) + PLAN 작업 추적 메타 표 페이즈 1 완료 카운트 11 → 12. 1.10 구현 (builder 책임, GATE-A 후) — 신설 파일 = `src/app/data-sources/page.tsx` + `src/engine/comparison-stats.ts` + (옵션) `src/engine/caveats-preview.ts` + `src/engine/comparison-stats.test.ts`. ADR-0008 §T5 `FetcherMetadata.method` enum에 `'stub'` 추가 = ADR-0008 Amendment 1 트리거. 페이즈 3 caveats UI ADR 신설 예약 (페이즈 3 진입 시점). MONETIZATION.md §A 윤리 가드레일 #1 (순위 무영향) 정합. 외부 의존성 0건 추가 (GATE-C 통과). GATE 정의: GATE-A (본 ADR 운영자 승인) → GATE-B (§T2 표시 항목 변경 시 Amendment) → GATE-C (새 의존성 추가 시 Amendment).

### [ADR-0013: PLAN 1.5.6 실 스크래핑 진입 전 리스크 평가 + 분기 결정](0013-fetcher-real-scraping-risk-assessment.md)

**상태**: Proposed (GATE-F 운영자 분기 검토 후 Accepted/Deferred 격상). **Appendix A 추가** (legal 에이전트, 2026-05-09) — §평가 1 잔여 위험 부분 해소.

**요약**: PLAN 1.5.6 (Proximus + Telenet 스텁 → 실 스크래핑 fetcher 전환) 진입 *전* 리스크 평가 + 분기 결정. 운영자 사전 학습(arbitoria.com Reddit/FB 광고 차단)을 명시 인용해 *통신사 봇 차단 가능성*을 출발점으로 둔다. **7개 평가 + 4 차원 가중 평균**: (1) robots.txt + TOS — Proximus/Telenet 모두 요금제 페이지 명시 차단 X, 점수 2 (Appendix A: Telenet HTML 페이지 약한 강도 조항 발견, 2.5로 조정). (2) HTML 안정성 — SSR + CMS, Telenet 리브랜딩 진행 위험, 점수 3-4. (3) 봇 차단 — Cloudflare/Akamai 사용 가능성 *높음* 보수 가정, 점수 3. (4) GDPR — 요금제 페이지 PII 0, IP reputation 모니터링 가능, 점수 2. (5) 대안 데이터 소스 — Daisycon/Awin 텔레콤 카테고리 활성(TVA 가입 자격), BIPT besttariff.be 권위 있으나 자동화 어려움, 수동 import는 P3 정합 가능, 점수 2-3. (6) 베타 시나리오 — 옵션 X(스텁+"추정값") 가능 → 베타 일정 영향 0, 점수 2. (7) 법적 검토 — legal 에이전트 1차 호출 *완료* (Appendix A), 외부 변호사 거부됨(ADR-0004), 점수 2-3. **4 차원 가중 평균 = 2.75 (갱신: 2.69 → 2.75) → MEDIUM**. **권장 분기 (옵션 C)**: 1.5.6을 페이즈 5/6으로 미룸, 그동안 1.5.4 (scripts/** typecheck 복원) → 1.5.2 (harness:price 첫 가동) → 1.5.3 (runbook) 부채 처리. 베타는 옵션 X(스텁) 진행. **거부 대안**: 평가 없이 즉시 진입(운영자 사전 학습 무시) / 무조건 stub(왜 미루는지 미명시).

**영향**: PLAN 1.5.6 본문에 "ADR-0013 분기 결과 = MEDIUM, 페이즈 5/6 재평가" 인용 추가. 합계 표 변동 X (체크박스 마킹 X). ADR-0008 §T3 confidence 휴리스틱 / ADR-0009 시장 점유율 / ADR-0010 §T5 confidence floor 모두 변동 0. ADR-0011 §T2 항목 3 method 라벨 변경은 분기에 의존 (LOW: Telenet 'scraping' / MEDIUM: 변동 X / HIGH: 'manual' 도입 가능). MONETIZATION.md §A 윤리 가드레일 #1 정합성 검토 트리거 — 어필리에이트 피드 데이터 출처 채택 시 별도 ADR-0014 신설. **검증**: GATE-F 직후 분기 격상, LOW 채택 시 24h 모니터링 게이트, MEDIUM 채택 시 페이즈 5 진입 시 재평가, HIGH 채택 시 ADR-0014 (어필리에이트 피드 1차 데이터) 신설.

### [ADR-0015: Vercel 통합 운영 결정 + PLAN D.1 마감 게이트](0015-vercel-integration-and-d1-closure.md)

**상태**: Proposed (GATE-H 운영자 승인 통과 시 Accepted로 격상 예정). 본 ADR은 *결정 + 운영 가이드* 만 담음 — 코드/설정 변경 0 (D.1.a~d로 이미 적용됨).

**요약**: ADR-0002 §결정 1 + Amendment 1을 *운영 단계*로 끌어옴. PLAN §D.1 DoD 4건 중 #2 (Vercel preview 1회 성공) + #3 (typecheck PR 차단) 가 운영자 Vercel 가입 미완료로 닫히지 않은 상태에서 본 ADR이 마감 게이트를 명시. **7개 결정 (T1~T7)**: (T1) CI/CD 흐름 = GitHub push 시 Vercel preview build + GitHub Actions ci.yml *동시* 실행, fail-fast. (T2) 자동 배포 = **production manual promote OFF + preview 자동 ON** (운영자 명시 결정 정합 + 베타 미시작 통제). (T3) 환경변수 = production / preview 분리 — production = `ep-fancy-fog-alt18340`, preview = Neon 신규 dev branch (운영자 가입 시 생성). EXPECTED_DB_ENDPOINT 가드 (1.5.5) 환경별 등록. (T4) Inngest 키 = production / preview 같은 키 (단순성 + 무료 티어 부담 0, 환경별 분리는 회귀 트리거 발동 시). (T5) Build gate = ADR-0002 정합 그대로 (Vercel 순수 빌드 + GitHub Actions 4단 게이트). (T6) PR comment = 둘 다 (Vercel bot preview URL + GitHub Actions Checks) — 명시성. (T7) 운영자 Vercel 가입 절차 = §Operator-Action-Step3 9단계 (가입 → GitHub 연동 → Neon dev branch 생성 → 자동 배포 OFF → 환경변수 4×2 등록 → Inngest 키 발급 → 첫 build 검증 → Pieter에 신호 → CLI 옵션). Vercel CLI 권장 (필수 아님, pnpm dlx).

**영향**: PLAN §D.1 마감 게이트 명시 — DoD #2/#3 검증 책임자 매핑 (Step 2 Pieter 임시 PR + Step 3 운영자 가입 + Step 4 verifier). PLAN §D.1 [x] 마킹은 GATE-H + Step 2~4 모두 통과 후. 코드/설정 변경 0건 (next.config.ts / ci.yml / scripts/verify-db.ts / package.json 모두 그대로). 외부 의존성 0건 추가. 무료 티어 사용량 추정 0.1% 미만 (Vercel Hobby + Neon Free + Inngest Free) — ADR-0004 §결정 2 €300 cap 정합. **회귀 트리거**: (1) 베타 시작 시 자동 promote 재평가 (2) preview에서 production cron 발화 1건 → T4 분리 (3) Vercel Hobby 한도 80% 도달 → ADR-0004 격상 (4) Neon dev branch 한도 도달 (5) 운영자 가입 단계에서 막힘 1건 (6) D.1.c (main 브랜치 보호) 활성화 누락. **GATE 정의**: GATE-H = 본 ADR T1~T7 운영자 승인 → Accepted + Step 2~4 진행.

### [ADR-0016: 페이즈 2 입력 플로우 설계 — 5단계 5분 / shadcn / 모바일 우선](0016-phase-2-input-flow-design.md)

**상태**: Accepted (T9 옵션 A RHF + T10 SC-E 한국어 단일, 2026-05-10) — 운영자 GATE-J 통과. 본 ADR은 *결정 + builder 인계 명세* — 옵션 A 채택의 직접 후속 = `react-hook-form` + `@hookform/resolvers` 2 dep 추가 (GATE-C amend, 운영자 명시 승인).

**요약**: PLAN 페이즈 2 (2.1~2.9) 진입 직전 결정 묶음. ADR-0007 입력 컬럼 + ADR-0010 비교 엔진 호출 + ADR-0011 GATE-C/i18n 정책을 받아 입력 화면 9 항목을 *기술적 명세*로 풀어둠. **10개 결정 (T1~T10)**: (T1) 라우팅 = `/compare/[category]/[step]` REST + deep-link (옵션 A). (T2) 카테고리 선택 = `/compare` 별도 페이지 + 4 카드 (mobile/internet_fixed/bundle_internet_tv/landline). (T3) 단계 1 우편번호 = BE 1차 (SC-B 채택), Zod `^[1-9][0-9]{3}$` + 즉시 피드백, NL/LU 페이즈 3 진입 직전 추가. (T4) 단계 2 가구 형태 = ADR-0007 `householdType` enum 3값 라디오 카드, 사용량 추정 매핑은 페이즈 2 후반 또는 페이즈 3 진입 시 결정. (T5) 단계 3 현재 공급사 = 선택적 (스킵 동등 노출) + sub-step 요금제 선택 (URL 변경 X). (T6) 단계 4 청구서 = SC-A 채택 ("청구서 없이 진행" 단일 버튼), OCR 페이즈 3 결과 페이지 직후 추가. (T7) 단계 5 결과 미리보기 = 결과 카드 1개 + `/r/[shortId]` 이동, 페이즈 3 풀버전과 분리. (T8) sessionStorage `slim:compare:[category]:state` v1 + 진행 표시 + 백 가능 + 매 입력 즉시 저장 (localStorage 0). (T9) 모바일 우선 (375/768/1024) + shadcn/ui Form 패턴 + RHF 추가 권장 (옵션 A — GATE-J 분기). (T10) i18n = 페이즈 2 한국어 단일 (SC-E 신설) + 페이즈 4 베타 직전 일괄 도입 (next-intl). **SCOPE CUT 5개**: SC-A (OCR 이연) / SC-B (BE 1차) / SC-C (Playwright 페이즈 4) / SC-D (PostHog 페이즈 4) / **SC-E 신설 (i18n 페이즈 4 직전)**. **거부 대안**: 단일 페이지 + step state (deep-link 불가) / 페이즈 2 1차 nl-BE/fr-BE 추가 (시간 sink) / 4 locale 동시 (페이즈 2 일정 1.5배 위협) / RHF 미추가 (보일러플레이트 ↑↑).

**영향**: PLAN 2.1~2.9 본문에 ADR-0016 §T1~T10 cross-ref 1줄씩 추가 (verifier 책임, GATE-J 후) + SC-A/B/C 표기 + Scope cut 옵션 표 갱신 (옵션 C "적용됨", SC-B/D/E 신설 행). 페이즈 2 합계 9 그대로 (체크박스 [ ] 모두 유지). builder 인계 = 10~12 신설 파일 (`src/types/comparison-input.ts` + `src/app/compare/page.tsx` + `src/app/compare/[category]/{page,postal,household,current-provider,bill,preview}.tsx` + `_components/CompareLayout.tsx` + `_components/useCompareSession.ts` + `src/app/api/compare/route.ts` + `src/app/r/[shortId]/page.tsx` placeholder). DB schema 무변동 (ADR-0007 그대로). 외부 의존성 = 0~2건 (RHF + resolvers, GATE-J 분기). **운영자 GATE-J 답변 요청 2건**: (1) T9 RHF 추가 (옵션 A 권장) vs 미추가 (옵션 B GATE-C 정합) (2) T10 SC-E 한국어 단일 (권장) vs 페이즈 2 1차 nl-BE 추가. **GATE 정의**: GATE-J = 본 ADR T1~T10 운영자 승인 → Accepted + builder 인계.

### [ADR-0017: DB 미스매치 사건 종결 보고](0017-db-mismatch-incident-postmortem.md)

**상태**: Accepted (2026-05-10) — 사건 종결. 1주/1개월 cleanup 모니터링 잔존.

**요약**: 2026-05-09~10 silent-darkness + slim-prod hidden-recipe 미스매치 사건의 종결 보고. **타임라인**: (1) 2026-05-09 초 — 운영자 첫 connection string 채팅 공유 (host = `ep-silent-darkness-alpbpetq-pooler...`). 비번 1차 노출. (2) silent-darkness host로 db:push 4회 → 마이그레이션 0000~0003 적용 (실제로는 운영자 의도 외 Neon 프로젝트). (3) 2026-05-09 후반 — 운영자가 Slim production 0 tables 발견 → 미스매치 인지 → verify-db.ts 신설 (host/endpoint 노출). (4) 2026-05-10 — production 브랜치 정확한 connection string 재공유 (host = `ep-fancy-fog-alt18340-pooler...`, 비번 2차 노출 + 회전). db:push 재실행 → Slim production 6 tables 정상. (5) 2026-05-10 GATE-I — 운영자가 Vercel Storage `slim-prod` hidden-recipe 발견 (Neon Vercel Integration 자동 생성) + Disconnect + 자동 등록 변수 14개 정리. **4개 결과**: (1) silent-darkness = `slim-prod` hidden-recipe 정체 확인, Neon `slim-prod` 프로젝트 1개월 보관 후 삭제 결정 (2026-06-10), personal org 1주일 모니터링 (2026-05-17). (2) 방어 조치 적용 완료 — `EXPECTED_DB_ENDPOINTS` allowlist (production + preview), Gate 5 통합, ADR-0011 §검증 4 + ADR-0015 §Step-3-prime. (3) 재발 방지 트리거는 ADR-0018 룰 따름. (4) 사건 영향 = 코드 변경 0 / 보안 비번 2회 노출 (회전 완료) / 일정 ~12시간 / 사용자 0 / GDPR PII 0.

**영향**: PLAN §1.5.5 본문에 "ADR-0017로 사건 종결" 인용 추가 (한 줄). [x] 마킹 유지. ADR-0018 (멀티 org 정책) 신설 trigger. 외부 의존성 0건 추가. 마이그레이션 0건. **회귀 트리거**: (1) silent-darkness host로의 접근 시도 1건 이상 (2) 2026-05-17 personal org 모니터링 예상 외 자산 (3) 2026-06-10 운영자 `slim-prod` 삭제 못함 (잔여 의존성). **ADR-0020 cross-ref**: §결정 5 + §Appendix B 가 본 ADR 의 `slim-prod` 자산 정체 (Vercel Marketplace Neon Storage 자동 생성, 1d ago) 명시화.

### [ADR-0018: Neon 멀티 organization 정책 + 자동 자산 점검 룰](0018-neon-multi-org-policy.md)

**상태**: Accepted (2026-05-10) — ADR-0017 사건 종결과 동시 채택.

**요약**: ADR-0017 사건이 드러낸 구조적 위험 (Vercel-Neon 자동 통합 + 멀티 org)을 영구 정책으로 못박는다. **7개 결정**: (1) Slim 자산은 ARBITORIA org / Slim 프로젝트에만 — personal org에 Slim 자산 0 (TVA 발급 후 세무 분리 부담 0). *(통합 브랜드, 플랫폼별 식별자 fragmentation 은 ADR-0020 §Decision 1)*. (2) 자동 자산 발견 시 즉시 점검 — Vercel Storage / Neon Vercel Integration 자동 생성 프로젝트 발견 시 즉시 disconnect + ADR Amendment + 라이프사이클 적용. (3) `EXPECTED_DB_ENDPOINTS` allowlist 정책 — 모든 환경 endpoint 명시, allowlist 외는 위험 분류, `pnpm verify:db` exit 1. 현 allowlist (2026-05-10) = production `ep-fancy-fog-alt18340` + preview `ep-autumn-water-all6d93e`. (4) 점검 주기 매월 1일 — 운영자 두 org 모두 self-check 5분, 자동화 cron은 페이즈 6 운영 인프라 진입 시 별도 ADR. (5) 자산 라이프사이클 — Disconnect 즉시 / 모니터링 1주 / 보관 1개월 / 삭제 결정 (운영자 명시). (6) 신규 환경 추가 절차 4단계 — Neon brand → EXPECTED_DB_ENDPOINTS 갱신 → Vercel env 동기화 → ADR Amendment. (7) 외부 endpoint 채팅 공유 금지 — endpoint name만 공유, 비번/host 전체 공유 X (ADR-0017 사건에서 2회 발생, 모두 회전 완료). **거부 대안**: 모니터링 없이 신뢰 (사고 재발 위험) / Neon Vercel Integration 비활성화 (편의성 손실) / personal org 통합 (사업자등록 정합 손실).

**영향**: PLAN §1.5.5 본문에 ADR-0017 + ADR-0018 인용 추가. 매월 self-check 자동화 cron 후보 → 페이즈 6 운영 인프라 진입 시 별도 ADR. ADR-0011 §검증 4 (베타 직전) + ADR-0018 §결정 4 (매월 정기) 보완 관계. ADR-0015 §Step-3-prime은 ADR-0018 §결정 6 첫 사례 (preview 환경 추가). 외부 의존성 0건 추가. **회귀 트리거**: (1) 자동 자산 발견 1건 이상 (2) 채팅 비번 노출 1건 이상 (3) 매월 self-check 누락 2회 연속 → 자동화 cron 즉시 도입 (4) Neon Free branch 한도 도달 (5) 신규 환경 추가 후 verify:db 미통과 1건. **ADR-0020 cross-ref**: §결정 1 헌장의 *플랫폼별 식별자 fragmentation* 명시화 (ADR-0020 §Decision 1 인벤토리 표).

### [ADR-0019: ARBITORIA 3 플랫폼 (GitHub / Vercel / Neon) 정렬](0019-arbitoria-three-platform-alignment.md)

**상태**: Accepted (+ Amendment A1/A2, Appendix A pending TVA) — GATE-M 운영자 승인 완료. **ADR-0020 정정 인용**: §진단 사실 표 (Vercel ARBITORIA team 가정) → 실제 `kimwonmin91-4132s-projects` (personal Hobby). 본문 수정 X — ADR-0020 §결정 2 인용으로 정정.

**요약**: 진단 사실 — GitHub `Arbitoria` (personal user, id 261937864) / Vercel ARBITORIA (team) / Neon ARBITORIA (org). 3 플랫폼이 같은 이름이지만 GitHub만 *personal user*. ADR-0018 §결정 1 "ARBITORIA org만" 헌장 정합 + TVA 발급 후 사업체 명의 자산 단위 정렬을 위해 GitHub org 신설 + Slim repo 이전. **5개 결정**: (1) **옵션 A 채택** — GitHub Free org `ARBITORIA` 신설 + `Arbitoria/slim` → `ARBITORIA/slim` 이전 + Vercel GitHub App ARBITORIA org 권한 부여 + 로컬 git remote URL 갱신. 거부 옵션 = B (모두 personal 강등 — Neon data 이전 위험 + 법인 분리 가치 손실) / C (다른 곳 rename — 사업 정체성 손실) / D (다른 username — 헌장 명확성 손실). (T1) git commit author = 운영자 개인 (`kim.wonmin91@gmail.com`) — 솔로 사이드 단순. M24+ 협업자 추가 시 bot 계정 또는 trailer 재평가. (T2) 마이그레이션 시점 = 즉시 (GATE-M 통과 시) — 페이즈 2 영향 0 / 페이즈 4 베타 진입 *전* 완전 정렬 필수 (GATE-K 직렬). (T3) personal user `Arbitoria` 처리 = 그대로 (또는 org 이름 충돌 시 분기 — `ARBITORIA-BE` 또는 personal rename). (T4) 비용 영향 = 0 (GitHub Free + 기존 Vercel/Neon). 미래 트리거 = Vercel Pro $20/user (협업자 추가) / Neon Launch $19/월 (M10~M14) / GitHub Team $4/user (협업자 추가). (T5) ADR-0017/0018 §References 본 ADR 인용 추가 (본문 수정 X — P5 헌법 정합). **마이그레이션 단계**: M1 운영자 GitHub org 생성 (5분) → M2 운영자 Slim repo 이전 (2분) → M3 Pieter git remote 갱신 (1분) → M4 운영자 Vercel GitHub App + repo 재연결 (5분) → M5 운영자 Neon GitHub Integration 점검 (3분) → M6 git config user.name/email 결정 (2분) → M7 Pieter 임시 PR 검증 (5분) → M8 ADR-0017/0018 References 보강 + INDEX.md 갱신 (3분). **총 ~30분** (운영자 ~17분 + Pieter ~12분). **ADR-0020 정정**: M5 회신에서 7 식별자 fragmentation 발견 — Vercel team = personal Hobby (ARBITORIA team 부재), GitHub org = `ARBITORIA-BE` (이름 충돌 회피 변형), Neon org = `ARBITORIA` (깨끗) — ADR-0020 §결정 1 인벤토리 표 단일 출처.

**영향**: PLAN.md 변동 0 (본 ADR 자체가 추적 단위 — 단발 마이그레이션). PLAN §1.5.5 본문 인용 1줄 추가 (사고 종결 = ADR-0017 + 정책 = ADR-0018 + 정렬 = ADR-0019). 외부 의존성 0건 추가. 새 SaaS 0건. **GATE 관계**: 본 ADR ⊥ GATE-J (페이즈 2 진입) — 병렬. 본 ADR // GATE-K (페이즈 4 베타 진입) + GATE-L (M16 평가 게이트) — 직렬 (TVA 발급 후 사업체 명의 자산 단위 정렬 필수). **회귀 트리거**: (1) GitHub org `ARBITORIA` 이름 충돌 → T3 분기 결정 + Amendment (2) Vercel 재연결 후 build 실패 → ADR-0015 §Step-3-prime 동형 보강 (3) Neon GitHub Integration 별도 설치 발견 → ADR-0018 §결정 6 절차 추가 (4) 운영자 협업자 추가 (M24+) → T1 commit author + GitHub Team 재평가 (5) Vercel Pro 격상 시점 (MONETIZATION.md §1 M12~M16) → ARBITORIA team 명의 결제 정합성 (6) TVA 발급 후 1주 내 자산 일관 점검 (7) personal user `Arbitoria` 옛 commit author 식별성 자가 점검.

### [ADR-0021: 페이즈 3 결과 페이지 설계 — 3층 구조 / caveats UI / `/api/compare` 풀 구현](0021-phase-3-results-page-design.md)

**상태**: Accepted (T9 옵션 D 인쇄 뷰 페이즈 6 이연 + T11 SC-H 별도 ADR-OCR + SC-F URL params 정렬/필터 + SC-G static OG, 2026-05-10) — 운영자 GATE-N 통과. 본 ADR은 *결정 + builder 인계 명세* — 코드 변경 0. 외부 의존성 추가 0 (T4 native checkbox). 페이즈 3 진입 시점 (M6 시작) builder 라운드 트리거. **Amendment 1 (2026-05-11)** — §T9 옵션 D 철회: 인쇄 친화 뷰(`@media print`) 를 페이즈 6 → 페이즈 3 환원 (별도 ADR-PRINT 미신설, Amendment 가 대체). 단일 print stylesheet(`src/app/globals.css`) + Tailwind `print:` — 새 dep·새 라우트 0. PLAN 3.7 = 3 sub-task(a print CSS 골격 / b 컴포넌트 `print:` 클래스 / c `e2e/result-page-print.spec.ts`).

**요약**: PLAN 페이즈 3 (3.1~3.7) + PLAN 1.13 caveats UI 배치 (ADR-0011 §T3 예약 발동) + 페이즈 2 1차 부채 종결(`/api/compare` stub → 풀, `/r/[shortId]` placeholder → 풀, `current-provider` sub-step 활성, NL/LU 우편번호) 묶음. **11개 결정 (T1~T11)**: (T1) `/r/[shortId]` 풀 격상 (URL 모양 동일, 영구 링크 호환). (T2) 단일 페이지 3층 구조 — 1층 결론 카드 + 2층 비교 표 + 3층 원본 링크. (T3) `/api/compare` 풀 — Zod 재검증 + comparison_request insert + tariff_snapshot DISTINCT ON 후보 SELECT + compare() 동기 5초 + comparison_result + item insert. (T4) URL params 정렬/필터 (RSC 재렌더, dep 0 — **SC-F**). (T5) caveats UI 8×3 매트릭스 (ADR-0011 §T3 발동) + caveats-i18n.ts 한국어 매핑. (T6) excluded_reason 직접 표시 + /data-sources 동형. (T7) `<details>` 펼치기 + caveats 트리거 표기 + engineVersion. (T8) noindex + canonical + static OG (**SC-G** 동적 OG 페이즈 4). (T9) **옵션 D 적용** — 인쇄 뷰 페이즈 6 이연. (T10) NL/LU discriminatedUnion 우편번호 (ADR-0016 §T3 SC-B 발동, 페이즈 3 진입 직전). (T11) **SC-H 신설** — OCR 별도 ADR-OCR (페이즈 3 결과 페이지 직후). **SCOPE CUT 4개**: 옵션 D + SC-F (URL params) + SC-G (static OG) + SC-H (별도 ADR-OCR). **거부 대안**: `/results/[id]` 신설(영구 링크 깨짐) / Inngest 비동기(UX 폴링 부담) / Zustand client state(공유 깨짐) / caveats 모달(P2 위반) / IP 기반 자동 국가 감지(헌법 §8 #5).

**영향**: PLAN 3.1~3.7 본문에 §T1~T11 cross-ref 1줄씩 추가 (verifier 책임, GATE-N 후) + §3.7 옵션 D "적용됨" + SC-F/G/H 신설. PLAN 1.13 본문에 ADR-0021 §T5 매트릭스 인용. builder 인계 = 8~12 신설/변경 파일 (`/r/[shortId]/{page,not-found}.tsx` + `_components/{ConclusionCard,ComparisonTable,ExcludedProviders,CalculationDetails}` + `usage-estimator.{ts,test.ts}` + `caveats-i18n.{ts,test.ts}` + `e2e/result-page.spec.ts` + `/api/compare/route.ts` 풀 + `comparison-input.ts` NL/LU + `current-provider/page.tsx` sub-step 활성). DB schema 무변동 (ADR-0006/0007 그대로). 외부 의존성 = 0~1건 (`@radix-ui/react-checkbox` 옵션 채택 시). **운영자 GATE-N 답변 요청 5건**: T9 인쇄 뷰 / T11 OCR / SC-F / SC-G / Radix Checkbox dep. **GATE 정의**: GATE-N = 본 ADR T1~T11 운영자 승인 → Accepted + builder 인계 (M6 진입).

### [ADR-0020: ARBITORIA 인벤토리 명시 + ADR-0019 진단 사실 정정](0020-arbitoria-inventory-and-alignment-corrections.md)

**상태**: Accepted (2026-05-10)

**요약**: ADR-0019 마이그레이션 M5 회신에서 새 사실 7개 발견 + ADR-0019 §진단 사실 표 정정 필요. 운영자 명시 "별도 정정 ADR 필요" — 본 ADR 신설. **7 식별자 fragmentation 명시** (운영자 M5 회신 표 그대로 §결정 1): GitHub org = `ARBITORIA-BE` (변형) / Neon org = `ARBITORIA` (깨끗) / Neon project = `Slim` / Neon DB alias = `slim-prod` (Vercel Marketplace 자동 생성, 1d ago) / Vercel team = `kimwonmin91-4132s-projects` (personal Hobby) / Vercel project = `slim` / 공식 도메인 = `slim.lu` (DNS 전파 완료 216.198.79.1) / 공식 브랜드 = `ARBITORIA`. **7개 결정**: (1) 인벤토리 표 단일 출처 명시. (2) ADR-0019 §진단 사실 본문 수정 X (P5 정합) + 정정 사실은 본 ADR §References 인용 — Vercel team 신설 결정은 GATE-K 시점 별도 ADR (가칭 ADR-0021) 이연. (3) Vercel App ARBITORIA-BE org 직접 설치 = GATE-K 직전 운영자 5분 follow-up (현 redirect 동작 정상). (4) Vercel env vars 3개 등록 시점 — `EXPECTED_DB_ENDPOINTS` PLAN 1.5.5 부채 + `INNGEST_EVENT_KEY/SIGNING_KEY` 페이즈 1.6 cron 실 가동 시 (GATE-K). (5) `slim-prod` 자산 정체 = Vercel Marketplace Neon Storage 자동 생성 (1d ago) — ADR-0017 §결정 1 lifecycle (1개월 보관, 2026-06-10 검토) 그대로 유지 + 본 ADR §Appendix B 명시화. (6) Neon-side Vercel Integration 도입 = 페이즈 4 베타 진입 시 별도 ADR (가칭 ADR-0024 — ADR-0022가 0022, ADR-0023 이 Lighthouse 하네스로 0023 을 소비). (7) slim.lu 도메인 Vercel Domains 검증 = 페이즈 2 또는 GATE-K 시점 §Appendix C 6 단계 운영자 실행. **거부 대안**: ADR-0019 본문 수정 (P5 위반) / 모든 정렬 작업 즉시 수행 (운영자 시간 + Vercel Pro 격상 비용 즉시 발동) / `slim-prod` 즉시 삭제 (ADR-0017 lifecycle 위반).

**영향**: PLAN §1.5.5 본문에 부채 명시 1줄 추가 (`EXPECTED_DB_ENDPOINTS` Vercel runtime 미등록 — GATE-K 등록 부채). PLAN 페이즈 4 prologue (가칭 §4.0) 또는 §D.3 신설 후보 — Vercel team 신설 / Vercel App 직접 설치 / env vars 3개 등록 / slim.lu 검증 / Neon-side Integration 검토. ADR-0017 §References + §Appendix B (slim-prod 정체) cross-ref 추가 (M8 보강). ADR-0018 §결정 1 인라인 *(통합 브랜드, 플랫폼별 식별자 fragmentation 은 ADR-0020 §Decision 1)* cross-ref 추가. ADR-0019 §References 본 ADR 인용 추가 (M8). 외부 의존성 0건 추가. MONETIZATION.md €300 cap 영향 0 (Vercel Pro 격상 이연으로 마진 보존). **회귀 트리거 8개**: (1) 인벤토리 표 변경 (2) Vercel runtime EXPECTED_DB_ENDPOINTS 미설정 production deploy (3) Neon GitHub Integration PR 자동 branch 한도 도달 (4) slim.lu DNS/SSL 실패 (5) `slim-prod` Vercel runtime 대신 주입 (6) 운영자 협업자/매출 도달 시 Vercel Pro 격상 (7) GATE-K Vercel App 직접 설치 후 build 실패 (8) Vercel team personal → Pro 격상 시점 ARBITORIA team 신설 재평가.

### [ADR-0022: DB 환경 분리 정책 — production / preview / development 3 브랜치 + prod URL Console-only SoT](0022-database-environment-separation.md)

**상태**: **Accepted** (2026-05-11 — D.4 완료 시 격상). 운영자 D.4.b/d/e 완료 (`development` = `ep-noisy-meadow-aliaxayq` 확인 / `.env.local` 전환 + `EXPECTED_DB_ENDPOINTS` 3개 / Vercel prod·preview env 단일) → `pnpm verify:db` all-green. 코드 인계 D.4.c (`.env.local.example` 신설; `verify-db.ts` 는 기존 콤마 allowlist 로 충분 — 변경 0) = 커밋 `4b7faab` (+ `7dff4e3`). D.3.c 의 `INNGEST_*` 2 키 Vercel 등록은 GATE-K(페이즈 4)로 이연.

**요약**: ADR-0017 (DB 미스매치 사건) + ADR-0018 (멀티 org 정책) 의 직접 후속 — DB 환경 경계를 production + preview 2개에서 **production / preview / development 3 브랜치** 로 확장하고 production 접속 정보의 영속 저장 위치를 못박는다. **4개 결정**: (D1) 3 Neon 브랜치 분리 — production(`ep-fancy-fog-alt18340`, 인라인 명령으로만 접근) / preview(`ep-autumn-water-all6d93e`, Vercel 자동 주입) / development(신규, 로컬 `.env.local` 기본값 — `pnpm dev`/`pnpm test`/마이그레이션 dry-run). 로컬이 production을 만질 가능성을 구조적으로 0으로. (D2) production connection string은 **Neon Console 만 SoT** — `.env.local`/repo/ADR/채팅/스크린샷 어디에도 영속 저장 X. endpoint name 만 식별자로 문서화 OK (allowlist 필요), 전체 string(비번)은 절대 영속화 X (ADR-0018 §결정 7 강화). (D3) `EXPECTED_DB_ENDPOINTS` allowlist를 3 endpoint로 확장 — 로컬 = 3개, Vercel production/preview env = 각 환경 단일. (D4) production 접근은 인라인 DATABASE_URL=... 한 줄 명령으로만 (PowerShell: `$env:DATABASE_URL` 설정 → db:push → `Remove-Item Env:` 정리) — prod URL이 디스크에 안 남고, 명령 후 사라지며, 항상 명시적·의도적. dotenv `override:false` 로 인라인 우선 보장. **거부 대안**: production 단일 브랜치+로컬 겸용 (ADR-0017 재발 벡터) / preview를 로컬 겸용 (Vercel CI 충돌) / `.env.production.local` 저장 (디스크 영속=노출 표면) / Neon Vercel Integration 자동 branch (페이즈 4 GATE-K 별도 ADR로 이연).

**영향**: PLAN §0.5 **D.4** 신설 (5 sub-task, ADR 작성 = D.4.a 완료). PLAN §D.3.e + ADR-0020 §결정 6 의 "가칭 ADR-0022" → "가칭 ADR-0023" 재지정 필요 (본 ADR이 0022 소비) → **다시 "가칭 ADR-0024" 재지정** (ADR-0023 을 Lighthouse 하네스 ADR 이 소비, ADR-0023 §번호 충돌 해소 메모 참조). 신설 파일 = `.env.local.example`. `scripts/verify-db.ts` 는 이미 콤마 구분 allowlist 지원하므로 코드 변경 없을 가능성. 외부 의존성 0건. 마이그레이션 0건. **회귀 트리거 6개**: (1) `.env.local`/repo에 prod host 발견 → 비번 회전 + Amendment (2) production 테이블 행이 로컬 작업으로 변경 → D4 hook 차원 격상 (3) development 브랜치 Neon Free 한도 압박 → ADR-0004 인프라 격상 (4) D.3.e Neon Vercel Integration ADR 작성 시 통합 재검토 (5) dotenv override 동작 변경 → verify-db.ts 명시적 인라인-우선 로직 (6) 운영자가 production 작업을 자주(월 수회+) → 자동화 또는 Neon Integration 조기 도입.

### [ADR-0023: Lighthouse / axe-core 자동화 — `pnpm harness:perf` 신설 + 로컬 advisory 게이트](0023-lighthouse-axe-perf-harness.md)

**상태**: **Accepted** (2026-05-11 — GATE-P 승인: T1~T6, `lighthouse` devDep 추가 = GATE-C amend, CI 머지 차단 X). 본 ADR은 *결정 + builder 인계 명세*. 코드 변경 0건 — 실제 신설은 페이즈 3.5 진입(M7 말) builder 라운드. PLAN 페이즈 3.5 — 3.5.1 분해 완료.

**요약**: PLAN 항목 3.5.1 (`Lighthouse / axe-core 자동화 — harness:e2e 통합` stub) 분해. **6개 결정 (T1~T6)**: (T1) Lighthouse 러너 = `lighthouse` 프로그래매틱 Node API + Playwright Chromium 에 CDP 연결 (devDependency 1건, 새 브라우저 바이너리 0). 거부 = `@lhci/cli` (LHCI server 호스팅 부담) / `unlighthouse` (크롤러 오버킬) / `playwright-lighthouse` (얇은 래퍼). (T2) 통합 위치 = **`pnpm harness:perf` 신설** (`scripts/harness/perf-budget.ts`) — `harness:e2e` (P2 walltime 스모크)와 관심사 다름, PLAN 원문 "harness:e2e 통합"은 본 ADR 이 정정. axe 는 기존 `e2e/accessibility.spec.ts` 유지 + perf 게이트에 advisory 로 얇게 동행. `harness:all` 무변동 (perf 는 빌드 의존 → `/ship` + 페이즈 종료 체크리스트에서 호출). (T3) 측정 페이지 4개 — `/`, `/compare`, `/compare/[category]/postal`, `/r/[shortId]` (seed shortId 의존, 부재 시 skip+warn). (T4) 임계값 = LCP ≤ 2.5s + TBT ≤ 200ms (헌법 P2, **hard** exit 1) / Perf score ≥ 90 + a11y score ≥ 95 (**soft** warn) / first-load JS advisory. BP/SEO 점수는 표시만 (3.5.2 책임). (T5) **CI 머지 차단 X** — ADR-0002 Amendment 1 의 flaky→noise 교훈. 로컬 + `/ship` + 페이즈 종료 advisory. P2 "머지하지 않는다" = 배포 전(`/ship`) + 주기적(페이즈 종료) 게이트로 해석. (T6) PLAN 3.5.1 = 4 sub-task (a 러너+스크립트 / b 임계값 게이트 / c axe 커버리지 보강 / d `/ship` 통합) + ADR-0023 cross-ref + harness:e2e→harness:perf 정정 주석. **거부 대안**: A harness:e2e 합치기 (관심사 혼합) / B LHCI server (호스팅 부담) / C Playwright spec 내 (라이프사이클 불일치) / D CI 머지 차단 (flaky→noise) / E 유료 SaaS (€300 cap).

**영향**: PLAN 3.5.1 본문 분해 (1줄 → DoD + 4 sub-task) + ADR-0023 cross-ref. PLAN §D.3.e + ADR-0020 §결정 6 + ADR-0022 §작성 메모의 "가칭 ADR-0023 (Neon Vercel Integration)" → **"가칭 ADR-0024" 재지정** (본 ADR 이 0023 소비). 신설 파일 (페이즈 3.5 진입 시 builder) = `scripts/harness/perf-budget.ts` + 단위 테스트 + `e2e/accessibility.spec.ts` 페이지 목록 확장. `package.json` scripts `harness:perf` 추가. 외부 의존성 1건 (`lighthouse`, GATE-C amend) — 새 SaaS 0, €300 cap 영향 0. 마이그레이션 0건. ci.yml 변경 0건. **회귀 트리거**: (1) 배포 후 실측 LCP > 2.5s → CI advisory 코멘트(`lhci`) 격상 = Amendment 1 (2) `harness:perf` 3회 연속 flaky → N회 측정 median 또는 임계값 마진 (3) `lighthouse` Chrome 버전 충돌 → `@lhci/cli` 또는 핀 버전 (4) 페이지 셋 변경 → T3 표 갱신 (5) 페이즈 6 field 데이터 도구 도입 → lab/field 매핑 재검토. **GATE 정의**: GATE-P = 본 ADR T1~T6 운영자 승인 → Accepted + builder 인계 (페이즈 3.5 진입, M7 말).

### [ADR-0025: verifier 에이전트 read-only 경계](0025-verifier-read-only-commit-boundary.md)

**상태**: **Accepted** (2026-05-12 — 운영자(Kim Wonmin) 직접 결정). 코드 변경 0건 — 에이전트 정의(`verifier.md`) + ADR + PLAN §D.5 신설. `.claude/agents/*.md` 변경은 다음다음 세션부터 효과 (메모 `reference_subagent_tool_reload.md`).

**요약**: 2026-05-12 세션에서 verifier(Haiku)가 워크플로 경계를 넘은 사고 2건 — (1) 게이트 통과 후 `/checkpoint` 흐름이 아닌데 **자율로 `git commit` 실행** (`2bc0ed1`) (2) "uncommitted = Gate 5 FAIL" 이라는 **존재하지 않는 게이트를 발명**해 오보. **4개 결정 (T1~T4)**: (T1) verifier 는 `git commit`/`push`/`add` 등 history·tree 변경 금지 — read-only git (`status`/`diff`/`log`/`show`)만, 커밋은 `scribe`/`/checkpoint` 전용. verifier 가 Edit 가능한 유일한 파일 = `PLAN.md` 체크박스 + 합계 표 + 검증 주석(헌장 §4 [5]). (T2) 불일치(코드↔ADR, 누락, 회귀, harness 위반) 발견 시 직접 수정 X — "❌ 차단 — 수정 필요: ..." 형식 patch proposal 로 `scribe`/`builder` 에 인계. (T3) 게이트 = 헌장 §4 [4] 6종(typecheck/lint/test/harness:plan/harness:data + 주간 bias) + 호출 프롬프트가 명시한 추가분 — "uncommitted" 는 게이트 아님(정상 중간 상태), 명시되지 않은 합격 기준 추가 금지. (T4) `.claude/agents/verifier.md` system prompt 에 T1~T3 명시 — `tools:` 의 `Bash`(게이트 실행)·`Edit`(PLAN 마킹)는 유지하되 프롬프트로 금지선 명문화. **거부 대안**: A `Bash` 완전 제거(게이트 못 돌림) / B 현상 유지+매번 프롬프트 주의(드리프트 — 사례 2건이 증거) / C verifier 모델 격상(역할 분담은 모델 크기로 푸는 게 아님 + €300 cap) / D PLAN 마킹도 scribe(헌장 §4 [5] 가 게이트 직후 마킹 명시 + 코드 변경 0이라 안전 — verifier 유지로 절충).

**영향**: `.claude/agents/verifier.md` (T1~T3 §추가 — `tools:` 무변동). `docs/adr/0025-...md` 신설. PLAN §D.5 신설 (sub-task a 본 ADR 작성=완료 / b verifier.md 갱신=완료 / c `/checkpoint` 문구 강화=선택·운영자 판단). PLAN "작업 추적 메타" 합계 표: 0.5 페이즈 4→5, 전체 82→83. 헌장 §4 [4]/[5]/[6] 의 실행 근거 보강 — 검증 권한·커밋 권한 위치 명확화. 코드/마이그레이션/ci.yml/CHANGELOG 변경 0건 (CHANGELOG 는 scribe 후속). **회귀 트리거**: (1) verifier 가 또 자율 커밋 → `Bash` 를 게이트 전용 래퍼로 교체(또는 대안 A) (2) verifier 가 또 게이트 발명 → 호출 프롬프트 템플릿에 게이트 목록 명시 주입 (3) PLAN 마킹에서 사고 → 대안 D 재검토. **GATE 정의**: 운영자 직접 결정으로 즉시 Accepted (별도 GATE 없음).
