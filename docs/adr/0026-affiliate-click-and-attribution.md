# ADR-0026: `affiliate_click` 테이블 + 어트리뷰션 모델 (동의 흐름 / 수수료 공개 / 순위 격리)

## Status

**Accepted** (2026-05-12 — 운영자 직접 결정, Kim Wonmin).
Legal review (internal 1차): 2026-05-13 **조건부 통과** — builder 인계 가능.
잔존 조건: (1) BE 회계 보존 기간 정확한 구분(invoices 10년 vs 장부 7년)은 외부 감사 확정 전까지 보수적으로 10년 적용 권장.
Legal review (internal 1차 후속 — 4.1.d 구현 검증): 2026-05-13 — §검토 2(필수 5항목) / §검토 5(VI.99 랭킹 공개) / §검토 6(다크패턴 0) 모두 **통과**. 잔존 조건 (2) "동의 인터스티셜 UI 구현(4.1.d) 필수 5항목" 해소. 남은 외부 감사 항목: ADR §Legal Review §외부 변호사 감사 필수 항목 1~7 (베타 직전/M16 트랙 유지).
외부 변호사 감사: 베타 직전/M16 (ADR-0004 §결정 3, ADR-0007 §Legal review pending과 동일 트랙) — 세부 항목은 §Legal Review (4.1.f 1차) 참조.

본 ADR 은 *결정 + builder/legal 인계 명세*다. **코드/마이그레이션 변경 0건** — 실제 신설
(`src/db/schema/affiliate_click.ts`, `drizzle/0005_*`)은 PLAN 4.1.b~e builder 라운드, GDPR
처리 등록부 항목은 4.1.f legal. **legal 에이전트 1차 검토(4.1.f) 조건부 통과(2026-05-13)** —
builder 인계 시작. 외부 변호사 감사는 베타 직전 / M16 평가 게이트 1회 (ADR-0004 §결정 3,
ADR-0007 §Legal review pending 와 동일 트랙).

## Context

- **PLAN §4.1** — "어트리뷰션 시스템 (`affiliate_click` 테이블)". 헌법 §5 표의 "Stripe + 자체
  어트리뷰션" 결정의 *데이터 모델 구체화*다. PLAN §4.1 분해(4.1.a~f)는 `ed118c4` 로 커밋됨.
- **무엇이 우리를 이 결정 앞에 세웠는가:**
  1. **헌법 P3 (투명성은 운영자의 짐)** — 제휴 수수료를 *단가까지* 비교 결과 페이지 하단 +
     `/legal/affiliate-disclosure` 에 공개하려면, *어떤 클릭이 어떤 공급사·요금제로 갔는지*
     서버사이드 기록 + 정산 단가가 필요하다.
  2. **헌법 §8 #1** — "사용자 데이터를 외부로 보내지 않는다 — 제휴사 리다이렉트는 명시적 동의
     후에만, GDPR Art. 6(1)(a)". 어트리뷰션은 *동의 → 리다이렉트* 흐름을 데이터 모델에서
     강제해야 한다.
  3. **헌법 §8 #3 (다크패턴 0) / #4 (광고-비교 영역 분리)** — 어트리뷰션 레이어가 비교 표에
     섞이면 안 된다. 비교 결과는 100% 알고리즘 결과.
  4. **헌법 P3 핵심** — **어트리뷰션이 비교 알고리즘 순위에 절대 영향 X**. `provider.affiliate_status`
     가 정렬 키에 들어가면 P3 위반 + `bias-audit` 가 잡아야 할 사고.
  5. **ADR-0021 결과 페이지** — "변경하기" CTA 가 현재 placeholder. 페이즈 4 에서 활성화되며,
     이 CTA 클릭이 `affiliate_click` 의 유일한 entry point다.
  6. **Stripe payout 정산** — 클릭 → 전환 → 정산 추적 필드(수수료 단가, 전환 상태, payout
     배치)가 필요하다 (실 payout *실행* 은 본 ADR 범위 밖 — 페이즈 4 후반 별도 ADR).
  7. **GDPR 보존 충돌** — `comparison_request` 90일 후 PII 일반화 / `lockedInputs` NULL화
     (ADR-0007 §T4)와, 정산 목적의 회계 기록 장기 보존(BE 거래 기록 보관 의무, Art. 6(1)(c))이
     충돌한다. `affiliate_click` 의 `result_id` FK 가 그 둘을 잇는 연결고리다.
- **외부 사실 (검증된 출처):**
  - **GDPR Art. 6(1)(a) Consent** — "for one or more specific purposes". 클릭 기록 = 명시
    동의가 합법근거. 출처: [GDPR Art. 6](https://gdpr-info.eu/art-6-gdpr/).
  - **GDPR Art. 6(1)(c) Legal obligation** — 회계/세무 기록 보관은 컨트롤러의 법적 의무.
    BE 사업자 거래 기록 보관 의무는 일반적으로 7년 (확정은 legal 검토 필요 — 본 ADR 잠정 권고).
    출처: [GDPR Art. 6](https://gdpr-info.eu/art-6-gdpr/).
  - **GDPR Recital 26 (익명 vs 가명)** — IP/fingerprint/세션 컬럼이 없으면 `affiliate_click`
    행 자체는 *진짜 익명*. `result_id` FK 로 `comparison_request` PII 와 *간접* 연결되는 것이
    유일한 가명화 벡터 → 90일 후 FK SET NULL 로 끊는다. 출처:
    [GDPR Recital 26](https://gdpr-info.eu/recitals/no-26/).
- **비-목표 (본 ADR 범위 밖):** 실 Stripe payout *실행*(페이즈 4 후반 — 실 전환 발생 시 별도
  ADR), 베타 모집, A/B 테스트, 어트리뷰션 분석 대시보드, 제휴 네트워크(Impact/PartnerStack 등)
  연동(도입 시 ADR Amendment — `affiliate_click` 에 network 식별 컬럼 추가).

## Decision

T1~T8 8개 결정.

### T1 — `affiliate_click` 테이블 신설 (직전 architect 세션 스케치 본문화)

새 테이블 `affiliate_click`. 컬럼 셋은 아래 **§스키마 표** 참조. 핵심:

- **FK (ON DELETE 정책):**
  - `result_id → comparison_result(id) ON DELETE SET NULL` — 영구 링크가 깨지지 않게
    (ADR-0007 §T8 정신: 결과는 self-contained, 부모 삭제돼도 클릭 원장 보존).
  - `result_item_id → comparison_result_item(id) ON DELETE SET NULL` (선택, NULL 허용) —
    *어느 rank 행* 의 "변경하기" 가 눌렸는지. NULL = rank 미상 또는 결과 페이지 외 경로.
  - `provider_id → provider(id) ON DELETE RESTRICT` — 정산 추적 대상. 공급사 삭제 차단
    (ADR-0001 §후속작업 "4.1 `affiliate_click.provider_id` FK" 와 일관, RESTRICT 강화).
  - `tariff_snapshot_id → tariff_snapshot(id) ON DELETE RESTRICT` — 클릭 시점에 본 *정확한
    가격 스냅샷* = 단가 정산 근거. RESTRICT (ADR-0006 §append-only + ADR-0007 §T6 RESTRICT
    패턴 일관).
- **익명성 (ADR-0007 §T1/§T5 계승):** `click_token text UNIQUE NOT NULL` — nanoid (ADR-0007
  §T7 의 nanoid 패턴 재사용, URL-safe 64-char alphabet). **IP / User-Agent / device
  fingerprint / session 식별자 컬럼 0건**. 헌법 §8 #1 + #5 를 *스키마 레이어*에서 강제.
- **동의 (헌법 §8 #1):** `consent_given_at timestamptz NOT NULL` — 동의 인터스티셜에서 사용자가
  "이동" 을 누른 시각. **동의 없으면 행 자체가 생성되지 않는다** (NOT NULL 이 그것을 강제).
- **정직 기록 (P3):** `ref_param text NOT NULL` — 리다이렉트 URL 에 붙인 값(예: `slim`,
  `slim-r-<shortId>`). *무엇을 공급사에게 보냈는지* 정직하게 기록. 사용자 식별 정보는 절대 포함
  안 함 (T2 참조 — 단순 캠페인 식별자만).
- **정산 (Stripe payout):** `commission_amount_cents bigint` (ADR-0005 §T2 / ADR-0006 BIGINT
  cents 정수 산술 패턴 — 라운딩 0), `commission_currency text NOT NULL DEFAULT 'EUR'`,
  `conversion_status` Postgres enum `affiliate_conversion_status` (`pending` / `converted` /
  `rejected` / `expired`) `NOT NULL DEFAULT 'pending'`, `converted_at timestamptz` (NULL =
  미전환), `payout_batch_id text` (NULL = 미정산; 실 Stripe payout ADR 에서 의미 확정).
- **P1 (정보 우선):** `commission_source text` + `commission_fetched_at timestamptz` — 어트리뷰션
  단가도 *출처를 가진다*. 어디서 가져온 수수료율인지(제휴 계약 PDF / 어드민 입력 / 제휴 네트워크
  API). `harness:data` Rule 4 의 `source_url`/`fetched_at` 패턴을 정산 데이터에 확장 적용
  (T8 참조).
- **GDPR (T6):** `pii_anonymized_at timestamptz` — 90일 cron 이 `result_id`/`result_item_id`
  FK 를 NULL화한 시각. NULL = 아직 비교 입력과 연결 중. (`comparison_result.piiAnonymizedAt` /
  `comparison_request.piiAnonymizedAt` 와 동일 패턴.)
- 메타: `id uuid PK defaultRandom()`, `created_at timestamptz NOT NULL defaultNow()`.

### T2 — 어트리뷰션 흐름 (동의 인터스티셜 → 서버사이드 insert → 302)

```
결과 페이지 /r/[shortId] "변경하기" CTA 클릭 (ADR-0021)
   │
   ▼
동의 인터스티셜  (route handler 또는 /go/[...] — 구현 방식은 builder 자유, 4.1.c~e)
   │   표시 내용: 받는 회사명 (provider.name) + "전송 데이터: 없음 (단순 리다이렉트)" 명시
   │              + "방문 사실은 어트리뷰션을 위해 Slim 서버에 기록됩니다" (ADR-0007 §T3 모달 문구 정합)
   │
   ├─ [동의] → affiliate_click 서버사이드 INSERT (consent_given_at = now())
   │             → HTTP 302 redirect to provider.website?ref=<ref_param>  (ref_param 에 그 값 기록)
   │
   └─ [거부] → 외부 링크만 (provider.website, ?ref 없이 또는 닫기)  — affiliate_click 행 0건
```

- **쿠키 기반 추적 0** — `__attr` 류 추적 쿠키 미사용. (대안 (c) 거부 — GDPR 쿠키 동의 배너
  필요 + 다크패턴 위험 + 헌법 §8 #1.) 서버사이드 `affiliate_click` insert 만.
- **3rd-party 어트리뷰션 SaaS 0** — Impact / PartnerStack / Tune 등 미도입. (대안 (b) 거부 —
  헌법 §8 #1 사용자 데이터 외부 전송 + ADR-0004 €300 인프라 cap.) 자체 테이블만.
- PostHog / Sentry 외 추적기 0 (ADR-0007 §T5 일관 — 그것들도 cookieless + IP 익명화 모드,
  페이즈 6 운영 ADR 에서 별도 확정).

### T3 — 알고리즘 순위와 완전 격리 (헌법 P3 + §8 #4 — 단일 출처)

- 비교 엔진 `compare()` (ADR-0010)는 **절약액 DESC** 만 정렬 키로 본다. `provider.affiliate_status`
  는 **정렬 키에 들어가지 않으며**, `compare()` 코드 경로는 `affiliate_status` / `affiliate_click`
  을 *import 하지 않는다*.
- `affiliate_click` 은 *결과 페이지 클릭 시점* 에만 쓰인다 — 비교 계산이 끝나 영구 저장된
  *후* 의 별개 레이어. 헌법 §8 #4 (광고-비교 분리): 비교 표 = 100% 알고리즘 결과, 어트리뷰션 =
  클릭 시점 별도 레이어.
- **강제 (PLAN 4.1.e 단위 테스트):**
  1. `affiliate_status` 가 6값 중 무엇이든 — 동일 입력 → **동일 순위**.
  2. `compare()` (및 그 호출 그래프)가 `affiliate_status` / `affiliate_click` 모듈을 import
     하지 않음을 **정적 검증** (의존성 그래프 단언 또는 소스 grep 테스트).
- 이 테스트가 `/ship` §윤리 체크리스트의 "어트리뷰션 코드가 알고리즘 순위에 영향 없음 (단위
  테스트 확인)" 줄을 충족한다. **본 §T3 가 그 줄의 단일 출처** — 다른 ADR/문서는 여기를 참조.
- `bias-audit` (T5 정정 후)가 *런타임에* 같은 불변식을 주간 검증 — 어트리뷰션 공급사가 1위에
  오른 비율이 시장 점유율 + 5%p 초과 시 알림 (MONETIZATION.md §A 윤리 KPI).
- **구현 상태 (2026-05-13)**: PLAN 4.1.e `src/engine/compare.isolation.test.ts` 신설. 정적 검증(6토큰 0건) + behavioral 검증(3픽스처 동일 순위). 커밋 `16ee8da`. verifier 검증 통과.

### T4 — 수수료 공개 (헌법 P3 — 단가까지)

- `/legal/affiliate-disclosure` (PLAN 3.5.2 신설, 현재 stub) — 공급사별 수수료 단가 테이블을
  *데이터 소스에서 렌더* 한다 (정적 하드코딩 금지 — P1).
- **단가의 출처 (`commission_rate_*` 컬럼 vs 별도 `affiliate_agreement` 테이블 vs 정적
  데이터)는 builder 가 4.1.d 에서 결정** — 본 ADR 은 다음만 못박는다:
  - 공개 단가는 `affiliate_click.commission_amount_cents` 와 *정합* 해야 한다 (같은 계약의
    같은 수수료율을 두 곳이 다르게 표시하면 P3 위반).
  - 표시 대상은 `affiliate_status IN ('active_b2b_intra_eu', 'active_b2b_domestic_be')`
    공급사 (ADR-0001 §후속작업 "6.9 `/legal/affiliate-disclosure`" 와 일관). `pending` /
    `none` / `paused` / `terminated` 은 디스클로저 단가 비대상.
- `bias-audit` 하네스가 (또는 별도 정합 체크가) 디스클로저 데이터와 `affiliate_click` 정산
  필드의 정합을 검사 (T5/T8 — builder 가 4.1 라운드에서 확정).
- **정식 결정 (2026-05-13, architect)**: 단가 데이터 출처는 **옵션 C — 정적 TS const**
  (`src/data/affiliate-rates.ts`). PLAN 4.3.a 에서 **ADR-0027** 로 격상 + 본 §T4 의
  "builder 결정" 표현을 대체. 격상 트리거(계약 ≥ 6건 OR 분기 ≥ 2회 변경) 도달 시 옵션 B
  (별도 테이블) 로 amendment 검토. cf. PLAN 4.3.b (데이터) / 4.3.c (UI — 4.4 동시 충족).

**구현 (2026-05-13, 커밋 `0f1ea07`)**: `src/app/r/[shortId]/_components/AffiliateDisclosureLine.tsx` 가 결과 카드 하단 디스클로저(active 2값) + 비-active 4값 '수수료 없음' (PLAN 4.4 동시 충족) 을 enum 분기로 렌더. `getRateForProvider(providerId, affiliateStatus)` 호출 → active 2값일 때만 rate entry 반환 → `formatEuroCents(amountCents)` 형식. `comparison.ts` 의 getTopResultItem/getResultItems 에 `affiliate_status` select 추가. typecheck/lint/test 366 passed / harness:plan/harness:data 통과.

### T5 — `bias-audit.ts` 정정 (회귀 아님 — 데이터 정합 부채)

현 `scripts/harness/bias-audit.ts` 는 미래 스키마/enum 을 가정한 placeholder 쿼리를 들고 있다.
4.1 라운드에서 builder 가 함께 정정한다 (PLAN §4.1 본문 DoD #5 가 이미 명시):

- **(a) enum 값 오류** — 쿼리가 `p.affiliate_status = 'active'` 로 필터하는데, ADR-0001
  `affiliate_status` enum 6값은 `none` / `pending` / `active_b2b_intra_eu` /
  `active_b2b_domestic_be` / `paused` / `terminated` 이며 **`'active'` 는 없다**.
  → `p.affiliate_status IN ('active_b2b_intra_eu', 'active_b2b_domestic_be')` 로 정정
  (`MARKET_SHARE` 의 4사 합산 점유율 정의와도 정합 — "어필리에이트 = 계약 체결 공급사").
- **(b) 결과 스키마 오류** — 쿼리가 `comparison_result.results` JSONB 배열을
  `jsonb_array_elements` 로 풀고 `->> 'tariff_id'` / `->> 'rank'` 를 읽는데, 현 스키마(ADR-0007
  §T6)는 `comparison_result_item` 1:N **테이블** (`rank`, `tariff_snapshot_id` 컬럼)이며
  `comparison_result` 에는 `results` JSONB 컬럼이 *없다*. 또한 1위 추천은 부모
  `comparison_result.top_tariff_snapshot_id` 에 직접 있다.
  → `comparison_result_item WHERE rank = 1` join (또는 `comparison_result.top_tariff_snapshot_id`)
  으로 정정. `tariff_id` → `tariff_snapshot_id` → `tariff` → `provider` 조인 체인.
- **이것은 회귀가 아니다** — `bias-audit` 는 페이즈 4 데이터(실 비교 결과 + 어필리에이트
  활성 공급사)가 있어야 의미가 생기며, 그때까지 placeholder 였다. 4.1 에서 `affiliate_click`
  과 함께 스키마 정합으로 맞춘다. **builder 가 별도 sub-task 로 또는 4.1.b 와 묶어 정정** — 본
  ADR 은 *무엇을 정정할지* 명시만 한다 (실제 `bias-audit.ts` 수정은 builder, architect 아님).

### T6 — GDPR 보존 정책 (분리 보존 — legal 확정 대상)

- `affiliate_click` **자체** 는 진짜 익명 — IP / fingerprint / session 컬럼 0건 (T1). GDPR
  적용 경계 밖 (Recital 26).
- 단 `result_id` FK 로 `comparison_result` → `comparison_request` 의 PII (PC4 + 가구 형태 +
  사용량 — ADR-0007 §T2 quasi-identifier)와 *간접* 연결 가능 → 이 연결고리를 끊는다:
  - **90일 후** (ADR-0007 §T4 의 `comparison_request` PII 일반화 / `lockedInputs` NULL화와
    동일 시점): cron 이 `affiliate_click.result_id` 와 `result_item_id` 를 **SET NULL** 하고
    `pii_anonymized_at` 에 시각 기록. 그 시점부터 클릭 행은 *비교 입력과 단절된* 익명 정산
    레코드가 된다.
  - **정산 필드** (`commission_amount_cents`, `commission_currency`, `commission_source`,
    `commission_fetched_at`, `conversion_status`, `converted_at`, `payout_batch_id`,
    `provider_id`, `tariff_snapshot_id`)는 **회계 목적 (GDPR Art. 6(1)(c) 법적 의무 — BE
    거래 기록 보관 의무, 7년 가능성)으로 장기 보존**. 이미 IP/PII 가 없으므로 장기 보존이
    데이터 최소화를 위반하지 않는다 (*분리 보존* — 사용자 비교 입력과의 링크만 90일에 끊고,
    익명 회계 원장은 법정 기간 보존).
- 익명화 cron 은 **신규 job 을 만들지 않고** 기존 `comparison_request` 익명화 Inngest job
  (ADR-0008 §cron)에 `affiliate_click` 처리를 추가한다 (€300 cap — Inngest run 수 절약).
- **이 90일 / 7년 분리는 본 ADR 의 잠정 권고다 — legal 에이전트 (4.1.f) 가 확정해야 한다**
  (특히 BE 거래 기록 보관 의무 기간, "정산 필드만 장기 보존" 의 GDPR 적합성, 동의 철회 시
  처리). 외부 감사는 베타 직전.

### T7 — 합법 근거 (GDPR Art. 6)

| 처리 | 합법근거 | 강제 위치 |
|---|---|---|
| 클릭 사실 기록 (`affiliate_click` 행 생성) | **Art. 6(1)(a) 동의** — `consent_given_at`. 동의 없으면 행 미생성 (NOT NULL) | 동의 인터스티셜 (T2) + `consent_given_at NOT NULL` |
| 정산 필드 장기 보존 (회계 원장) | **Art. 6(1)(c) 법적 의무** — BE 거래 기록 보관 의무 | T6 분리 보존 (90일 후 FK SET NULL, 정산 필드 7년 가능성) |
| 제휴사로의 "전송" | **데이터 전송 없음** — URL 파라미터 `?ref=<ref_param>` 만 (사용자 식별 정보 0건). GDPR 처리 아님 | T1 (`ref_param` 에 캠페인 식별자만), T2 (인터스티셜 "전송 데이터: 없음" 명시) |

- 이는 ADR-0007 §T3 의 "어필리에이트 리다이렉트 = Art. 6(1)(a) 명시 동의" 결정의 데이터
  모델 구체화다 — ADR-0007 §T3 모달 문구("Slim에서 [공급사] 사이트로 이동합니다. 사용자
  데이터는 전송되지 않으나, 방문 사실은 어트리뷰션을 위해 기록됩니다")를 T2 인터스티셜이 그대로
  쓴다.
- legal 검토 (4.1.f) + ADR-0007 §"Legal review pending" 에 어트리뷰션 보존/동의 흐름이 cross-ref
  로 추가됨 (본 ADR §References + "또한" 참조).

### T8 — CI / 게이트

- **마이그레이션** — `affiliate_click` 의 `drizzle/0005_*` 는 ADR-0022 의 DB 환경 분리
  (production / preview / development 3 브랜치) 정책을 그대로 따른다. 어트리뷰션 데이터도
  환경별 격리 — preview/development 브랜치에는 시드 더미만, production 클릭 데이터는 절대 비
  production 환경으로 흐르지 않음.
- **순위-격리 단위 테스트 (T3)** 는 `pnpm test` 의 일부 — CI 머지 게이트 (헌법 §4 [4]).
- **`bias-audit`** 는 주간 cron (헌법 §4 [4] — CI 에선 결과 캐시만, 빌드 차단은 critical
  델타에서만). T5 정정 후 정상 동작.
- **`harness:data`** — `affiliate_click.commission_source` / `commission_fetched_at` 도 P1
  Rule 4 (또는 새 룰)로 검사하도록 확장 (builder — 4.1.b 와 묶음). 어트리뷰션 단가도 출처를
  가진다는 P1 을 게이트가 강제.
- `/ship` §윤리 체크리스트의 "어트리뷰션 코드가 알고리즘 순위에 영향 없음" 줄 → T3 테스트로
  충족 (위 T3).

## §스키마 (`affiliate_click` 테이블 — builder 4.1.b 인계 명세)

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | `uuid` | PK, `defaultRandom()` | |
| `click_token` | `text` | UNIQUE, NOT NULL | nanoid (ADR-0007 §T7 패턴, URL-safe 64-char). 외부 노출 가능한 클릭 식별자. **세션/IP/fingerprint 컬럼 부재 — 이것이 유일 식별자** |
| `result_id` | `uuid` | NULL, FK → `comparison_result(id)` **ON DELETE SET NULL** | 어느 비교 결과의 클릭인가. SET NULL = 영구 링크/GDPR 삭제와 비충돌 + T6 90일 익명화 시 NULL화 대상 |
| `result_item_id` | `uuid` | NULL, FK → `comparison_result_item(id)` **ON DELETE SET NULL** | 어느 rank 행의 "변경하기" 인가 (선택). T6 90일 익명화 시 NULL화 대상 |
| `provider_id` | `uuid` | NOT NULL, FK → `provider(id)` **ON DELETE RESTRICT** | 클릭이 향한 공급사. 정산 추적 — 삭제 차단 |
| `tariff_snapshot_id` | `uuid` | NOT NULL, FK → `tariff_snapshot(id)` **ON DELETE RESTRICT** | 클릭 시점에 사용자가 본 정확한 가격 스냅샷 = 단가 정산 근거. 삭제 차단 |
| `consent_given_at` | `timestamptz` | NOT NULL | 동의 인터스티셜에서 "이동" 누른 시각. **NOT NULL = 동의 없으면 행 미생성** (헌법 §8 #1 강제) |
| `ref_param` | `text` | NOT NULL | 리다이렉트 URL 에 붙인 캠페인 식별자 (예: `slim`, `slim-r-<shortId>`). **사용자 식별 정보 0건** — 무엇을 보냈는지 정직 기록 (P3) |
| `commission_amount_cents` | `bigint` (mode: number) | NULL | 정산 수수료 (cents). NULL = 미확정/미전환. BIGINT cents 정수 산술 (ADR-0005 §T2) |
| `commission_currency` | `text` | NOT NULL, DEFAULT `'EUR'` | 수수료 통화 |
| `commission_source` | `text` | NULL | 수수료율 출처 (제휴 계약 PDF / 어드민 / 제휴 네트워크 API). **P1 — 어트리뷰션 단가도 출처를 가진다** |
| `commission_fetched_at` | `timestamptz` | NULL | 수수료율 확인 시각. `harness:data` 검사 대상 (T8) |
| `conversion_status` | `affiliate_conversion_status` enum | NOT NULL, DEFAULT `'pending'` | `pending` / `converted` / `rejected` / `expired` |
| `converted_at` | `timestamptz` | NULL | 전환 확인 시각. NULL = 미전환 |
| `payout_batch_id` | `text` | NULL | Stripe payout 배치 식별자. NULL = 미정산. 의미는 실 payout ADR (페이즈 4 후반)에서 확정 |
| `pii_anonymized_at` | `timestamptz` | NULL | T6 cron 이 `result_id`/`result_item_id` 를 NULL화한 시각. NULL = 아직 비교 입력과 연결 중 |
| `created_at` | `timestamptz` | NOT NULL, `defaultNow()` | DB insert 시각 |

**부재 컬럼 (의도적 — 헌법 §8 #1 + #5, ADR-0007 §T5 계승):** `ip_address`, `user_agent`,
`device_fingerprint`, `session_id`, `referrer` — **없다**. 어떤 사용자 추적 식별자도 이 테이블에
들어오지 않는다.

**enum 신설:** `affiliate_conversion_status` Postgres enum `['pending', 'converted', 'rejected',
'expired']`. (마이그레이션 `drizzle/0005_*` 에 `CREATE TYPE affiliate_conversion_status` +
`CREATE TABLE affiliate_click`.)

**권장 인덱스 (builder 확정):** `click_token` UNIQUE, `(provider_id)` (정산 집계), `(result_id)`
(T6 cron + 결과별 역추적), `(conversion_status)` (정산 대시보드), `(pii_anonymized_at)` (T6 cron
의 `IS NULL` 필터 가속 — `comparison_result_pii_anonymized_idx` 패턴).

## Alternatives considered

### (a) Stripe Connect 로 어트리뷰션 처리 (재확인 — 거부 아님)

- Stripe Connect 는 *마켓플레이스 정산* 도구이지 *클릭 어트리뷰션* 도구가 아니다. 헌법 §5 표는
  이미 "Stripe(결제/추적 = payout 실행) + 자체 어트리뷰션(클릭 추적)" 으로 결정 — 둘은 **보완
  관계**: Stripe = payout *실행* 레이어 (페이즈 4 후반 별도 ADR), `affiliate_click` = 클릭 →
  전환 *원장*. 자체 테이블이 맞다 — 재확인.

### (b) 3rd-party 어트리뷰션 SaaS (Impact / PartnerStack / Tune 등) — 거부

- 장점: 클릭→전환 추적 + 제휴 네트워크 통합을 외주.
- 단점: **헌법 §8 #1** — 사용자 데이터(클릭, 리퍼러, 가능하면 IP)를 외부 SaaS 로 전송하게 됨.
  **ADR-0004 €300 인프라 cap** — 대부분 유료 + revenue-share. → **거부**. 자체 `affiliate_click`
  서버사이드 insert 만.

### (c) 쿠키 기반 클릭 추적 (`__attr` 쿠키) — 거부

- 장점: 클릭 후 이탈했다 돌아온 사용자의 전환을 쿠키로 연결 (어트리뷰션 윈도우).
- 단점: GDPR 쿠키 동의 배너 필요 + "X일 안에 돌아오면 추적" 은 다크패턴 경계 (헌법 §8 #3) +
  헌법 §8 #1. → **거부**. 서버사이드 `affiliate_click` insert 만, 쿠키 0. (전환 매칭은 공급사가
  `?ref=<ref_param>` 으로 보내는 postback / 정산 리포트에 의존 — 실 payout ADR 에서 확정.)

### (d) `comparison_result.results` JSONB 에 클릭 기록 append — 거부

- 장점: 테이블 0개 추가.
- 단점: (1) `comparison_result` 는 영구 링크의 *불변* 스냅샷이어야 한다 (ADR-0021 — 사용자가
  다시 봐도 같은 결과). 그 안에 클릭 시계열을 누적하면 불변성 깨짐. (2) JSONB 안에 시계열 누적은
  안티패턴 (인덱싱 불가, 동시 write 충돌). (3) `comparison_result` 에는 애초에 `results` JSONB
  컬럼이 없다 (ADR-0007 §T6 = `comparison_result_item` 1:N 테이블). → **거부**. 별도 테이블.

### (e) `result_id` FK 영구 보존 (90일 SET NULL 안 함) — 거부

- 장점: "이 클릭이 어느 비교에서 왔는지" 영구 추적 (정산 분쟁 시 유리할 수 있음).
- 단점: ADR-0007 §T4 의 90일 PII 일반화 정신 위배 + `comparison_request` PII 와의 간접 연결을
  법정 회계 기간(7년) 내내 유지 = 데이터 최소화 위반. → **거부** (T6 분리 보존 — 90일에 FK
  끊고, 익명 정산 원장만 장기 보존).

| Trade-off | 채택 | 거부된 주요 대안 |
|---|---|---|
| 정산 인프라 | Stripe (payout 실행) + 자체 `affiliate_click` (클릭 원장) | (a) Stripe Connect 단독 (어트리뷰션 도구 아님) |
| 클릭 추적 방식 | 서버사이드 `affiliate_click` insert (동의 후) | (b) 3rd-party SaaS (헌법 §8 #1 + €300 cap) / (c) 쿠키 (동의 배너 + 다크패턴) |
| 저장 위치 | 별도 `affiliate_click` 테이블 | (d) `comparison_result` JSONB append (불변성 깨짐 + 안티패턴) |
| `result_id` 보존 | 90일 후 SET NULL, 정산 필드만 장기 | (e) 영구 보존 (데이터 최소화 위반) |
| 식별자 | `click_token` nanoid, IP/fingerprint 0 | (해당 없음 — 헌법 §8 강제) |

## Consequences

### 얻는 것

- ✅ **헌법 P3** — 수수료 단가 공개(`/legal/affiliate-disclosure`)의 데이터 기반 마련 +
  `affiliate_click.commission_amount_cents` 와 정합 강제 (T4).
- ✅ **헌법 §8 #1** — 동의 후 리다이렉트, 데이터 전송 0건(URL `?ref` 만)이 데이터 모델
  (`consent_given_at NOT NULL`, IP/fingerprint 컬럼 부재)에서 강제됨 (T1/T2/T7).
- ✅ **순위-격리가 코드 차원 단언으로 강제됨** (T3 — `compare()` 미import 정적 검증). UI 규약
  ("광고 영역 분리")보다 강하다. `/ship` §윤리의 단일 출처.
- ✅ Stripe payout 정산 추적 필드 (전환 상태 / 단가 / payout 배치) — 실 payout ADR 이 그 위에
  올라간다.
- ✅ **의존성 / SaaS 0건 추가** — 자체 테이블 + 기존 nanoid (ADR-0007) + 기존 Inngest cron job
  확장(ADR-0008). ADR-0004 €300 cap 영향 0.

### 잃는 것 / 부채

- ⚠️ **GDPR 보존 90일 / 7년 분리는 legal 확정 전까지 잠정** — 4.1.f legal 1차가 §T6 을 통과해야
  builder 인계. 외부 감사가 보존 기간 이견 시 Amendment.
- ⚠️ **`bias-audit.ts` 정정 (T5)이 4.1 라운드 부채로 따라붙음** — enum(`active` → `active_b2b_*`)
  + 결과 스키마(JSONB → `comparison_result_item` join). builder 가 처리 (PLAN §4.1 DoD #5).
- ⚠️ **동의 인터스티셜이 "변경하기" 플로우에 클릭 1번 추가** — 단, 헌법 P2 (5분 / 5단계)의
  *비교* 플로우엔 영향 0 (전환 클릭은 비교 *완료 후* 의 별개 행위). 인터스티셜은 5단계 카운트
  밖.
- ⚠️ **쿠키 추적 0 → 어트리뷰션 윈도우는 공급사 postback/리포트에 의존** — 사용자가 클릭 후
  이탈했다 며칠 뒤 돌아와 가입하면, 우리 쪽 매칭은 공급사가 `?ref` 로 돌려주는 데이터에 달림.
  실 Stripe payout ADR 에서 이 한계의 영향 평가.
- ⚠️ **legal 1차 검토(4.1.f)가 builder 인계 전 게이트** — 워크플로우상 4.1.a(이 ADR) →
  4.1.f(legal 1차) → 4.1.b~e(builder)가 순서대로다 (4.1.f 가 b~e 뒤가 아니라 앞).

### 후속 작업 (다른 PLAN 항목 / ADR 과 연결)

- **PLAN 4.1.b** — `src/db/schema/affiliate_click.ts` + `drizzle/0005_*` 신설 (builder). 본 ADR
  §스키마 표가 인계 명세. `harness:data` 확장(commission_source/fetched_at)도 묶음.
- **PLAN 4.1.c~d** — 동의 인터스티셜 + `/legal/affiliate-disclosure` 단가 테이블 (builder).
  단가 출처 컬럼 위치 결정도 4.1.d.
- **PLAN 4.1.e** — 순위-격리 단위 테스트 (builder — T3).
- **PLAN 4.1.f** — GDPR 처리 등록부 항목 추가 + 본 ADR §T6/§T7 검토 (legal). 통과 시 Status
  주석 제거.
- **ADR-0007 §"Legal review pending"** — 본 ADR §어트리뷰션 흐름/보존 cross-ref 1줄 추가
  (ADR-0007 본문 다른 곳은 P5 정합상 미수정).
- **실 Stripe payout ADR (페이즈 4 후반 — 별도)** — 실 전환 발생 시 신설. `payout_batch_id` /
  `conversion_status` 전환 트리거 / 공급사 postback 매칭 정의.
- **ADR-0021** — "변경하기" CTA 활성화 (페이즈 4) = `affiliate_click` 의 entry point.
- **ADR-0008** — 익명화 Inngest job 에 `affiliate_click` 처리 추가 (T6).
- **ADR-0022** — 어트리뷰션 데이터 환경별 격리 (T8).
- **제휴 네트워크 도입 시 (미래)** — ADR Amendment: `affiliate_click` 에 network 식별 컬럼.

## Verification

1. **마이그레이션** — `drizzle/0005_*` 가 development 브랜치(ADR-0022)에 적용 + `pnpm db:push`
   green. SQL 에 `CREATE TYPE affiliate_conversion_status` (4값) + `CREATE TABLE affiliate_click`
   (FK 4개: provider RESTRICT, tariff_snapshot RESTRICT, comparison_result SET NULL,
   comparison_result_item SET NULL) 존재 확인.
2. **순위-격리 단위 테스트 (4.1.e)** green — (a) `affiliate_status` 6값 무관 동일 입력 →
   동일 순위, (b) `compare()` 가 `affiliate_status` / `affiliate_click` 미import 정적 검증.
3. **어트리뷰션 흐름** — `/r/[shortId]` "변경하기" → 동의 인터스티셜 → `affiliate_click` insert
   (`consent_given_at` 기록) → HTTP 302 to `provider.website?ref=<ref_param>`. 수동 + e2e.
4. **동의 거부 시 기록 0** — 인터스티셜에서 거부 → `affiliate_click` 행 0건, 외부 링크만.
5. **`pnpm harness:data`** — `affiliate_click.commission_source` / `commission_fetched_at` 검사
   포함 (확장 적용 후).
6. **`pnpm harness:bias`** — 정정된 enum(`active_b2b_*`) / `comparison_result_item` join 으로
   에러 없이 동작.
7. **legal 에이전트 (4.1.f)** — §스키마(데이터 모델) · §어트리뷰션 흐름(T2) · §GDPR 보존(T6) ·
   §합법근거(T7) 검토 통과 → Status "(legal review pending)" 주석 제거.
8. **`/legal/affiliate-disclosure`** — `active_b2b_*` 공급사별 단가 테이블 렌더 +
   `affiliate_click.commission_amount_cents` 와 정합 (정합 체크 green).

**회귀 트리거 (이 중 하나라도 발생 시 Amendment 또는 신규 ADR):**
- (a) 실 전환 발생 → Stripe payout *실행* ADR 신설.
- (b) legal 외부 감사가 보존 기간(90일/7년) 이견 → 본 ADR Amendment.
- (c) 어트리뷰션이 순위에 새는 PR 발견 → 순위-격리 단위 테스트(T3) 강화 + incident ADR.
- (d) 제휴 네트워크 도입 → 본 ADR Amendment (`affiliate_click` 에 network 식별 컬럼).

## Legal Review (4.1.f 1차 — 2026-05-13)

> 이 섹션은 PLAN 4.1.f legal 에이전트 1차 검토 결과입니다.
> **법률 자문이 아닙니다.** 외부 변호사 감사(베타 직전/M16)에서 확정됩니다.

### 검토 결과 요약

| # | 검토 항목 | 판정 | 사유 요약 |
|---|---|---|---|
| 1 | PII 최소화 / `click_token` 익명성 | 통과 | IP/fingerprint/세션 컬럼 0 (스키마 강제). `click_token`은 nanoid 무작위 — 단독으로 자연인 식별 불가. Recital 26 익명에 해당. `result_id` FK → 90일 SET NULL mitigation 충분 |
| 2 | T2 동의 흐름 — Art. 6(1)(a) 유효 동의 | 조건부 통과 | 구조는 적합. 단 4.1.d 구현 시 인터스티셜 필수 표시 항목 명세 준수 필요 (아래 §검토 2 상세) |
| 3 | T6 보존 — 90일 vs 장기 분리 | 조건부 통과 | 90일 FK SET NULL 구조는 GDPR Storage Limitation 적합. BE 회계 보존 기간은 invoices 10년 / 일반 장부 7년 — 외부 감사 확정 전까지 10년 보수 적용 권장 (아래 §검토 3 상세) |
| 4 | T7 합법근거 분리 | 통과 | 클릭=6(1)(a)/정산=6(1)(c) 분리 적합. "제휴사 전송 없음" 논리 견고 (아래 §검토 4 상세) |
| 5 | T4 수수료 공개 (헌법 P3) | 통과 (조건부) | P3 구조 적합. BE Code économique Art. VI.99 랭킹 기준 공개 의무 해당 — 4.1.d 구현 시 정렬 기준 명시 필요 |
| 6 | 다크패턴 종합 | 통과 (조건부) | ADR 설계상 다크패턴 0. 단 4.1.d UI 구현 시 버튼 동등 가시성 + 허위 긴급성 0 + pre-checked 0 필수 강제 |

**종합 판정:** 조건부 통과 — builder 인계(4.1.b~e) 가능. 잔존 조건은 아래 각 항목 상세 참조.

---

### §검토 1 — PII 최소화 / `click_token` 익명성

**판정: 통과**

- `affiliate_click` 스키마에 `ip_address` / `user_agent` / `device_fingerprint` / `session_id` / `referrer` 컬럼이 명시적으로 부재. T1 §"부재 컬럼 (의도적)" 명시 확인.
- `click_token` (nanoid, URL-safe, 64자 알파벳) — 단독으로 자연인 식별 불가. GDPR Recital 26 기준 "익명 식별자"로 분류 가능. 재식별 가능성: `click_token`만으로는 `comparison_request`의 PII(우편번호, 가구형태)에 접근 불가 — `result_id` FK 체인을 통해서만 간접 연결.
- `result_id` FK → 90일 후 SET NULL: ADR-0007 §T4 패턴과 일관. 이 시점부터 `affiliate_click` 행은 `comparison_request` PII와 완전 단절. Mitigation 충분.
- **잔존 위험:** `click_token`을 장기(7~10년) 보존하는 경우, 미래 기술 발전으로 재식별 가능성이 달라질 수 있음 (Recital 26 "reasonably likely"). 보수적 접근으로 정산 종료(7~10년) 후 `click_token` 삭제 정책 수립 권장 — 외부 감사 대상.

---

### §검토 2 — T2 동의 흐름 — Art. 6(1)(a) 유효 동의

**판정: 조건부 통과**

**구조 적합성:**
- "동의 인터스티셜 → insert → 302" 흐름은 GDPR Art. 6(1)(a) + Art. 7 요건에 부합하는 설계.
- `consent_given_at NOT NULL` 스키마 강제: 동의 없이 행 생성 불가 — 기술적 강제 장치 적절.
- 동의 거부 시 외부 링크만 (기록 0): "freely given"의 동등한 거부 가능성 보장.

**4.1.d 구현 시 필수 표시 항목 (EDPB Guidelines 05/2020 on consent):**

```
인터스티셜 필수 표시:
  1. 받는 회사명 (provider.name) — architect 이미 명시
  2. 처리 목적: "방문 사실이 Slim 서버에 어트리뷰션 목적으로 기록됩니다"
  3. 전송 데이터 정직 표현:
     - "Slim → 귀하의 브라우저 → [공급사명] 사이트로 리다이렉트됩니다"
     - "Slim이 공급사에 전송하는 귀하의 데이터: 없음 (단순 리다이렉트, ?ref=slim 캠페인 태그만 포함)"
     - "공급사가 자체적으로 귀하의 IP·브라우저 정보를 수집할 수 있습니다 — 이는 공급사의 개인정보처리방침에 따릅니다"
  4. 동의 철회 방법: "이 팝업을 닫거나 '취소'를 누르면 기록 없이 이동하거나 취소할 수 있습니다"
  5. "거부해도 비교 결과는 그대로 유지됩니다" — 명시 필수 (freely given 보장)
```

**항목 3 "전송 데이터" 표현 주의사항:** ADR-0026 T2의 "전송 데이터: 없음 (단순 리다이렉트)" 문구는 Slim 서버가 공급사로 데이터를 전송하지 않는다는 의미로 정확하나, 사용자가 공급사 사이트에 도착 시 공급사가 자체적으로 IP/UA를 수집하는 것은 우리 통제 밖임을 인터스티셜에서 솔직하게 언급해야 합니다. 이 표현을 생략하면 사용자를 오도할 수 있어 P3 위반이자 투명성 문제.

**"freely given" 요건:**
- Art. 7(4) — "서비스 이용을 동의에 조건부로 연결" 금지. 비교 결과 열람에 동의를 조건으로 붙이면 안 됨. ADR-0026 구조상 클릭 전까지는 동의 불필요 — 결과 열람 단계와 분리됨. 적합.
- 거부 버튼이 동의 버튼과 동등한 가시성을 가져야 함 (Visual Interference 다크패턴 방지 — §검토 6 참조).

**4.1.d 구현 후속 검토 (2026-05-13): 통과** — `src/app/go/[shortId]/[itemId]/page.tsx` 에서 필수 5항목 전부 확인. (1) 받는 회사명: `{providerName}` DD 표시. (2) 처리 목적: "방문 사실이 Slim 서버에 어트리뷰션 목적으로 기록됩니다." (3) 전송 데이터 3 sub-항목: 리다이렉트 흐름 / "전송하는 데이터: 없음 (단순 리다이렉트, ?ref 태그만)" / "공급사가 자체적으로 IP·브라우저 정보를 수집할 수 있습니다 — 공급사의 개인정보처리방침에 따릅니다." (4) 동의 철회: "기록 없이 취소됩니다." (5) freely given: "거부해도 비교 결과는 그대로 유지됩니다" 단독 줄 부각. `page.dark-pattern.test.ts` D섹션이 정규식으로 회귀 검증. 본 검토는 1차 후속 검토이며 베타 직전/M16 외부 감사를 대체하지 않음.

---

### §검토 3 — T6 보존 — 90일 vs 장기 분리 (GDPR Art. 5(1)(e))

**판정: 조건부 통과**

**90일 FK SET NULL 구조:**
- GDPR Art. 5(1)(e) Storage Limitation 원칙: "processed for no longer than is necessary for the purposes." 90일 후 `result_id`/`result_item_id` SET NULL로 비교 입력 PII와의 연결 고리 차단 — 적합.
- `pii_anonymized_at` 기록으로 처리 사실 증빙 — Art. 5(2) accountability 충족.

**BE 회계 보존 기간 사실 확인 결과:**

WebSearch + WebFetch 확인 결과 (출처: [Accountable.eu BE invoice retention](https://www.accountable.eu/en-be/blog/legal-retention-period-invoices-belgium/), [Belgium.be accounting obligations](https://www.belgium.be/en/accounting_obligations)):

- 일반 회계 장부(boekhouding/comptabilité): **7년**
- 인보이스 및 회계 근거 문서: **10년** (BE 원칙 — "documents serving as a basis for accounting")
- 부동산 관련: 15년 (해당 없음)

**정산 필드 분류 및 보존 기간 권고:**

| 필드 | 성격 | 권고 보존 기간 |
|---|---|---|
| `commission_amount_cents`, `commission_currency` | 수수료 금액 — 인보이스 근거 | 10년 (invoices/BE) |
| `commission_source`, `commission_fetched_at` | 단가 출처 증빙 | 10년 (회계 근거 문서) |
| `conversion_status`, `converted_at`, `payout_batch_id` | 정산 처리 기록 | 7~10년 (회계 장부) |
| `consent_given_at` | 동의 증빙 (Art. 7(1) accountability) | 처리 기간 내내 + 분쟁 대비 |
| `provider_id`, `tariff_snapshot_id` | 정산 대상 식별 | 동일 (정산 필드와 동반) |

**ADR-0026 T6의 "7년 가능성" 표현:** 실제 BE 법상 invoices는 10년이 일반 원칙. "7년" 단독 표기는 과소 보존 위험. builder/architect에게 T6 본문의 "7년 가능성" → "invoices 10년 / 일반 장부 7년, 외부 감사 확정 전 보수적으로 10년 적용" 으로 갱신 권고 (본문 수정은 architect 재호출 시 ADR Amendment로 처리 — 본 섹션은 legal review 의견으로 기록).

**`click_token` 보존:** 순수 익명 식별자이므로 GDPR Storage Limitation 직접 적용 밖. 그러나 보수적으로 정산 필드 보존 종료 시점(10년)과 일치시키거나 그 이후 삭제하는 정책 수립 권장 — 외부 감사 대상.

**동의 철회 시 처리:**
- 사용자가 동의를 철회하는 경우 Art. 7(3) — 기존 처리의 합법성에는 영향 없으나, 그 이후 새 insert 차단. `consent_given_at`이 특정 시각을 기록하므로 철회 시 그 이후 클릭에 대해 insert가 안 되도록 하는 것은 구현상 자연스러움 (동의 없으면 행 미생성 = `consent_given_at NOT NULL` 구조).
- 단, Art. 6(1)(a) 동의 기반 처리에서 사용자가 "이미 기록된 클릭을 삭제해 달라"고 요청하는 경우 — 정산 필드는 Art. 6(1)(c) 법적 의무로 전환되어 삭제 거부 가능하나 이 논리를 개인정보처리방침에 명시해야 함. 외부 감사 대상.

---

### §검토 4 — T7 합법근거 분리

**판정: 통과**

**클릭 기록 = Art. 6(1)(a):**
- `consent_given_at NOT NULL` 스키마 강제 + 동의 인터스티셜 흐름 = "freely given, specific, informed, unambiguous" 요건 충족 구조.
- 1처리 1근거 원칙: 클릭 기록은 (a) 동의 단독.

**정산 보존 = Art. 6(1)(c):**
- BE 회계/세무 기록 보관 의무(invoices 10년, 일반 7년)는 법적 의무(legal obligation)에 해당.
- `result_id` SET NULL 후 남는 정산 필드(금액, 공급사, 상태)는 사용자 PII와 단절된 익명 회계 원장 — (c) 근거로 장기 보존 적합.

**"제휴사 전송 = 데이터 전송 없음" 논리:**
- 302 redirect는 사용자가 자신의 브라우저를 통해 제휴사 사이트로 이동하는 것. Slim 서버 → 제휴사 서버로의 직접 데이터 전송 없음.
- `?ref=slim` 또는 `?ref=slim-r-<shortId>` 파라미터: 캠페인 식별자로, 사용자를 식별하는 PII 없음. `ref_param` 컬럼에 기록되는 내용이 그것.
- 따라서 Slim은 제휴사의 GDPR controller/processor가 아님. 논리 견고.
- 단, 인터스티셜에서 "공급사 사이트는 자체 개인정보처리방침을 가집니다" 명시 권장 (사용자 정보 제공 완결성 — §검토 2 참조).

---

### §검토 5 — T4 수수료 공개 (헌법 P3 + 소비자보호법)

**판정: 통과 (조건부)**

**헌법 P3 구조:**
- `/legal/affiliate-disclosure`에 공급사별 단가 공개 의무 명시. `commission_amount_cents`와 공개 단가 정합 요구 — 구조 적합.
- `commission_source` + `commission_fetched_at` (P1 — 단가 출처 보유): 적합.

**BE Code de droit économique Art. VI.99 (랭킹 기준 공개 의무):**
- 확인 결과 (출처: [Belgium Omnibus Directive - Two Birds](https://www.twobirds.com/en/trending-topics/omnibus-directive/omnibus-directive-countries/belgium), [Belgium.be](https://economie.fgov.be/en/legislation/book-vi-code-economic-law)): 2022-05-28 Omnibus Directive 시행으로 검색 기능을 제공하는 사업자는 랭킹 주요 파라미터 + 상대적 중요도를 소비자에게 명시해야 함.
- ADR-0026 T3 (순위-격리 + `compare()` 알고리즘 = 절약액 DESC 단독)이 이를 충족하는 구조. 단 **결과 페이지 또는 `/legal/affiliate-disclosure`에 "정렬 기준: 절약액 내림차순, 제휴 여부는 정렬에 영향 없음"을 사용자 가독 형태로 명시 필요** — 4.1.d 또는 별도 UI 작업에서 확인.
- "비제휴 공급사도 동등하게 표시"(PLAN 4.4) + "어트리뷰션이 순위에 영향 0" (ADR-0026 T3)이 VI.99 준수의 핵심 증거.

**EU UCPD (Unfair Commercial Practices Directive) 어필리에이트 디스클로저:**
- 확인 결과 (출처: [Tapfiliate affiliate compliance](https://tapfiliate.com/blog/affiliate-marketing-compliance-gp/), [EU Commission UCPD guidance](https://commission.europa.eu/law/law-topic/consumer-protection-law/unfair-commercial-practices-and-price-indication/unfair-commercial-practices-directive_en)): EU UCPD는 상업적 관계(commission 수수)를 소비자에게 명시 요구. 비교 사이트가 제휴 수수료를 받는 경우, 결과 페이지에서 이를 명시해야 함 (PLAN 4.3 — 카드별 "Slim은 변경 시 €X 수수료를 받습니다").
- ADR-0026 T4 + PLAN 4.3 구조가 이를 충족하는 방향. 구현 완료(4.1.d/4.3) 후 재확인 필요.

**4.1.d 구현 후속 검토 (2026-05-13): 통과** — `src/app/go/[shortId]/[itemId]/page.tsx` 푸터 line 203 "정렬 기준: 절약액 내림차순. 제휴 여부는 정렬에 영향 없음." 명시 확인. `page.dark-pattern.test.ts` E섹션이 정규식으로 회귀 검증. `text-xs text-muted` 스타일은 시각적으로 소형이나 소비자보호법상 "사용자 접근 가능 형태" 최소 요건 충족. 결과 페이지(`/r/[shortId]`)의 동일 문구 존재 여부는 PLAN 4.3/4.4 라운드에서 별도 확인. 본 검토는 1차 후속 검토이며 베타 직전/M16 외부 감사를 대체하지 않음.

---

### §검토 6 — 다크패턴 종합 (헌법 §8 #3, CMA Dark Pattern Taxonomy)

**판정: 통과 (조건부 — 4.1.d 구현 검증 필요)**

ADR-0026의 설계 차원 다크패턴 점검:

| 패턴 | ADR-0026 관련 조항 | 판정 |
|---|---|---|
| Confirmshaming | T2: 거부 시 "취소" 또는 닫기 — 수치심 유발 문구 금지 | 통과 (구현 시 문구 검증 필요) |
| Roach Motel | 동의 1단계, 거부도 1단계 (닫기) — 비대칭 없음 | 통과 |
| Forced Continuity | 해당 없음 (구독 없음, 클릭별 동의) | 통과 |
| Visual Interference | 동의/거부 버튼 동등 가시성 요구 (§검토 2) | 조건부 (4.1.d 구현 검증) |
| Fake Urgency | "X분 안에" 류 카피 금지 — ADR 명시 없지만 헌법 §8 #3 강제 | 조건부 (4.1.d 구현 검증) |
| Social Proof Lies | "방금 누가 가입함" 류 금지 — 해당 없음 | 통과 |
| Pre-checked | 동의 체크박스 pre-checked 금지 (PLAN 4.1.d 명시) | 조건부 (4.1.d 구현 검증) |

**4.1 전체 흐름 다크패턴 추가 확인사항:**
- PLAN 4.2: 제휴 공급사 "변경하기" 버튼 색만 다름 — 색 차이만으로 사용자가 상업적 의미를 인지할 수 있는지 보완 표시(예: 작은 배지 또는 툴팁 "수수료 있음") 검토 권장. 색만으로는 접근성 + 명확성 불충분 가능.
- 비제휴 공급사 표시(PLAN 4.4): 제휴/비제휴 공급사가 동등한 행 수와 디자인으로 표시되어야 함 — bias-audit(T5 정정 후)이 런타임 검증.

**4.1.d 구현 후속 검토 (2026-05-13): 통과** — `src/app/go/[shortId]/[itemId]/page.tsx` 에서 CMA Dark Pattern Taxonomy 6개 패턴 0건 확인. (1) Fake Urgency: `page.dark-pattern.test.ts` A섹션 10개 정규식 커버, 소스 직접 확인 0건. (2) Confirmshaming: 거부 카피 "동의 없이 외부 링크로 이동" — 중립적, B섹션 4패턴 0건. (3) Pre-checked: `<input>`/`<checkbox>` 구조 자체 없음, form POST 단일 버튼 구조로 pre-check 불발생, C섹션 검증. (4) Visual Interference: 동의(bg-primary)/거부(bg-fg/10) 모두 solid fill, 동일 rounded-full px-6 py-2.5 text-sm font-medium — EDPB freely given 동등 가시성 요건 충족. (5) Roach Motel: 동의 1단계/거부 1단계(a href 직접)/복귀 1단계 — 비대칭 없음. `page.dark-pattern.test.ts` F섹션이 cookies()/headers()/Set-Cookie 0건 추가 검증. 본 검토는 1차 후속 검토이며 베타 직전/M16 외부 감사를 대체하지 않음.

---

### builder 인계 가능 여부

**4.1.b~e 진행 가능.** 단 다음 조건 선행 또는 병행 필요:

1. **4.1.d 구현 시 §검토 2 인터스티셜 필수 표시 항목 준수** — 특히 "공급사 자체 수집" 언급 + "거부해도 결과 그대로" 명시 + 버튼 동등 가시성.
2. **4.1.d 구현 시 §검토 5 정렬 기준 공개 UI** — 결과 페이지 또는 disclosure 페이지에 "절약액 DESC, 제휴 미반영" 사용자 가독 표현.
3. **ADR-0026 T6 "7년 가능성" 표현** — 이 섹션 §검토 3 의견을 architect에게 전달하여 Amendment 또는 조건 명시 처리 권고 (본 legal review 섹션이 그 기록 역할).

---

### 외부 변호사 감사(베타 직전/M16) 필수 항목

1. **Art. 6(1)(b) "비교 서비스 = 계약" 유효성** (ADR-0007 T3) — EDPB Guidelines 2/2019
2. **`comparison_result` Recital 26 익명 판정** (ADR-0007 T9) — lockedInputs NULL 후 재식별 가능성
3. **동의 인터스티셜 유효성** — freely given·specific·informed·unambiguous 4요소, 특히 "freely given" (Art. 7(4) 서비스 조건부 동의 금지)
4. **BE 회계 보존 기간 확정** — invoices 10년 vs 일반 장부 7년 — 정산 필드 적용 기간 + `click_token` 보존 정책
5. **동의 철회 시 기존 클릭 삭제 요청 처리** — Art. 6(1)(c) 전환 논리 개인정보처리방침 명시
6. **Neon DPA 체결 완료 확인** — [Neon DPA](https://neon.com/dpa) 공식 서명 + Neon EU 리전(eu-central-1) 처리 확인
7. **Sentry/PostHog 국외 이전 적합성** — SCCs 또는 adequacy decision 확인

## References

- 헌법: [`CLAUDE.md`](../../CLAUDE.md) — P1 (정보 우선), P3 (투명성 = 운영자의 짐), P4 (타입
  안전), P5 (결정은 ADR로), §5 (기술 스택 — "Stripe + 자체 어트리뷰션"), §8 #1 (사용자 데이터
  외부 X), §8 #3 (다크패턴 0), §8 #4 (광고-비교 영역 분리), §8 #5 (추적 픽셀 X)
- 관련 ADR:
  - [ADR-0001](0001-provider-schema.md) — `provider` (FK 부모; `affiliate_status` enum 6값 —
    T5 정정 근거)
  - [ADR-0004](0004-monetization-solo-side-rebalance.md) — €300 인프라 cap, legal 외부 감사 1회
  - [ADR-0005](0005-tariff-schema-telecom.md) — BIGINT cents 정수 산술 패턴 (§T2)
  - [ADR-0006](0006-tariff-snapshot-schema.md) — `tariff_snapshot` (FK 부모; RESTRICT +
    append-only)
  - [ADR-0007](0007-comparison-request-result-schema.md) — `comparison_request` /
    `comparison_result` (FK 부모; 익명 식별자 §T1, IP 컬럼 0 §T5, 90일 PII 일반화 §T4, nanoid
    §T7, 어필리에이트 동의 모달 §T3 — 본 ADR 이 데이터 모델로 구체화 + 보존 패턴 계승)
  - [ADR-0008](0008-fetcher-interface-and-cron.md) — Inngest cron (익명화 job 에 `affiliate_click`
    추가)
  - [ADR-0010](0010-comparison-engine.md) — 비교 엔진 `compare()` (순위 격리 대상 — §T3)
  - [ADR-0021](0021-phase-3-results-page-design.md) — 결과 페이지 ("변경하기" CTA 활성 지점)
  - [ADR-0022](0022-database-environment-separation.md) — DB 환경 분리 (어트리뷰션 데이터 환경별
    격리 — §T8)
- 외부 GDPR 사실:
  - [GDPR Art. 6 — Lawfulness of processing](https://gdpr-info.eu/art-6-gdpr/) — (1)(a) 동의,
    (1)(c) 법적 의무
  - [GDPR Recital 26 — Anonymous / Pseudonymous](https://gdpr-info.eu/recitals/no-26/)
- PLAN: [`PLAN.md`](../../PLAN.md) §4.1 (어트리뷰션 분해 4.1.a~f), §4.2 (격리 — 본 ADR §T3 가
  단일 출처), `/ship` §윤리 체크리스트
- 수익화: [`MONETIZATION.md`](../../MONETIZATION.md) §A (어필리에이트 편향 ±5%p 윤리 KPI,
  transparency KPI)
- 하네스: [`scripts/harness/bias-audit.ts`](../../scripts/harness/bias-audit.ts) — §T5 정정 대상
- nanoid: [Async secure URL-friendly ID](https://github.com/ai/nanoid)
