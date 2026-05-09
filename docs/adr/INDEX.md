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

**요약**: ADR-0002 §결정 1 + Amendment 1을 *운영 단계*로 끌어옴. PLAN §D.1 DoD 4건 중 #2 (Vercel preview 1회 성공) + #3 (typecheck PR 차단) 가 운영자 Vercel 가입 미완료로 닫히지 않은 상태에서 본 ADR이 마감 게이트를 명시. **7개 결정 (T1~T7)**: (T1) CI/CD 흐름 = GitHub push 시 Vercel preview build + GitHub Actions ci.yml *동시* 실행, fail-fast. (T2) 자동 배포 = **production manual promote OFF + preview 자동 ON** (운영자 명시 결정 정합 + 베타 미시작 통제). (T3) 환경변수 = production / preview 분리 — production = `ep-fancy-fog-alt18340`, preview = Neon 신규 dev branch (운영자 가입 시 생성). EXPECTED_DB_ENDPOINT 가드 (1.5.5) 환경별 등록. (T4) Inngest 키 = production / preview 같은 키 (단순성 + 무료 티어 부담 0, 환경별 분리는 회귀 트리거 발동 시). (T5) Build gate = ADR-0002 정합 그대로 (Vercel 순수 빌드 + GitHub Actions 4단 게이트). (T6) PR comment = 둘 다 (Vercel bot preview URL + GitHub Actions Checks) — 명시성. (T7) 운영자 Vercel 가입 절차 = §Operator-Action-Step3 9단계 (가입 → GitHub 연동 → Neon dev branch 생성 → 자동 배포 OFF → 환경변수 4×2 등록 → Inngest 키 발급 → 첫 build 검증 → Pieter에 신호 → CLI 옵션). Vercel CLI 권장 (필수 아님, pnpm dlx). **거부 대안**: 직렬 CI/CD (fail-late) / production 자동 ON (베타 미시작 통제 손실) / 같은 endpoint (데이터 오염) / 환경별 Inngest 키 (솔로 부담) / Vercel buildCommand에 게이트 (ADR-0002 §대안 D 동형 거부).

**영향**: PLAN §D.1 마감 게이트 명시 — DoD #2/#3 검증 책임자 매핑 (Step 2 Pieter 임시 PR + Step 3 운영자 가입 + Step 4 verifier). PLAN §D.1 [x] 마킹은 GATE-H + Step 2~4 모두 통과 후. 코드/설정 변경 0건 (next.config.ts / ci.yml / scripts/verify-db.ts / package.json 모두 그대로). 외부 의존성 0건 추가. 무료 티어 사용량 추정 0.1% 미만 (Vercel Hobby + Neon Free + Inngest Free) — ADR-0004 §결정 2 €300 cap 정합. **회귀 트리거**: (1) 베타 시작 시 자동 promote 재평가 (2) preview에서 production cron 발화 1건 → T4 분리 (3) Vercel Hobby 한도 80% 도달 → ADR-0004 격상 (4) Neon dev branch 한도 도달 (5) 운영자 가입 단계에서 막힘 1건 (6) D.1.c (main 브랜치 보호) 활성화 누락. **GATE 정의**: GATE-H = 본 ADR T1~T7 운영자 승인 → Accepted + Step 2~4 진행.

