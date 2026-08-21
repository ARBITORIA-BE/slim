# ADR-0054: fetcher 산출 급감 알림 — "조용한 데이터 유실" 감지

## 상태

**Accepted** (2026-08-21, 운영자 승인 — Q1/Q2/Q3 architect 추천안 그대로 잠금).

- Q1 알림 채널 = **Sentry + Inngest logger** (신규 의존성 0)
- Q2 임계 = **0건(선언 카테고리) + 직전 대비 −30%**
- Q3 비교 기준 = **`tariff_snapshot` 집계** (신규 테이블 0)

> 발화 근거: [ADR-0053 §D6.1](0053-telecom-provider-ecosystem-expansion.md) "fetcher 별 연속 실패 알림이 없다는 것이 부채로 확인됐다".

## 맥락 (Context)

### 트리거 — 한 라운드에서 조용한 유실 3건

PLAN 4.26.a (2026-08-19~20) 검증 중 **공급사 페이지 개편으로 인한 데이터 유실 3건**이 한꺼번에 드러났다.

| 사고 | 예외/에러 | 사용자에게 보인 것 | 발견 경로 |
|---|---|---|---|
| Orange `internet_fixed` 전멸 | 없음 (파싱 0 → `ok:false`) | **더 이상 팔지 않는 상품**(Start/Zen/Giga)이 6월 가격 그대로 노출 | 사람이 우연히 |
| Proximus `internet_fixed` 4 → 1 | 없음 | 4개 중 가장 약한 요금제 1개만 비교 대상 | 사람이 우연히 |
| Telenet `mobile` 결합가 혼입 | 없음 | (직전에 봉합) 요금제가 절반 가격으로 노출될 뻔 | 사람이 우연히 |

**공통점**: HTTP 200, 예외 0, 타입 에러 0. **숫자만 조용히 줄어든다.**

### 왜 기존 감시가 못 잡았나

1. **`ok:false` 가 아무에게도 안 간다.** cron 은 `logger.error` 만 찍는다. `src/inngest/functions.ts` 주석은 *"logger로 Sentry까지 전이 (4.5.2 정식화 예정)"* 라고 적혀 있었으나 **실제 연결은 없다** (Inngest logger ↔ Sentry 미연결, 2026-08-21 확인). Orange 가 매일 실패하는데 몇 주간 아무도 몰랐던 직접 원인.
2. **부분 유실은 성공으로 집계된다.** 4개 중 1개만 나와도 `ok:true` 다. 단종 처리(ADR-0005 §T5)는 오히려 "안 보인 요금제"를 조용히 비활성화하므로, 파서 고장과 정상 단종이 **DB 관점에서 구별되지 않는다.**
3. **`/data-sources` 신선도 표기는 사후적이다.** "3 days ago" 를 사람이 보러 가야 안다. 솔로 운영자가 매일 볼 수 없다.

### 감시가 없는 채로 커버리지를 넓히면

4.26.a 가 커버리지를 4 → 10칸으로 넓혔고 4.26.b 는 공급사 자체를 늘린다. **썩을 수 있는 표면이 넓어지는데 감지 수단은 여전히 "사람의 우연"** 이다. 헌법 P1(정보 우선)은 "출처 있는 숫자"를 요구하는데, 출처가 죽은 줄 모르는 상태는 그 요구를 형식적으로만 만족한다.

## 결정 (Decision)

### D1. 감지 위치 = cron 후처리, persist 는 건드리지 않는다

`src/inngest/functions.ts` 의 fetcher 루프에 **Step C(yield-check)** 를 추가한다. `persistFetchResult` 는 DB 쓰기 책임만 유지한다 (seed 스크립트도 같은 함수를 쓰므로 알림 로직이 끼면 안 된다).

순서가 중요하다:

```
Step A: fetch  →  previous-yield 조회  →  Step B: persist  →  Step C: yield-check
                  ^^^^^^^^^^^^^^^^^^
                  persist *이전* 에 읽는다 — 나중에 읽으면 방금 쓴 이번 실행이 "직전"이 된다
```

### D2. 판정 조건 3종

| kind | 조건 | 잡는 사고 |
|---|---|---|
| `fetch_failed` | `outcome.ok === false` | Orange internet 전멸 |
| `zero_yield` | fetcher 가 `metadata.categories` 로 **선언한** 카테고리인데 이번 산출 **0건** | Orange internet 전멸(부분) / 신규 fetcher 초기 고장 |
| `sharp_drop` | 직전 대비 **−30% 이상** 감소 (직전 건수 ≥ 3) | Proximus internet 4 → 1 |

- `retiredCategories`([ADR-0008 Amd 1](0008-fetcher-interface-and-cron.md))로 커버 중단을 선언한 카테고리는 `zero_yield` 대상에서 제외 — 의도된 0건이다.
- 0건이면 `zero_yield` 만 낸다 (`sharp_drop` 이중 알림 억제).

### D3. 채널 = Sentry `level='error'` + Inngest logger, fingerprint 고정

**세 조건 모두 `error` 레벨이다.** architect 초안은 `sharp_drop` 을 warning 으로 뒀으나, [운영 룰 1](../runbook/sentry-alert-rules.md)이 **`level:error` 이상만 이메일**로 보낸다 (warning 은 노이즈 회피 목적으로 제외). warning 으로 두면 *아무도 보지 않는 로그가 하나 더 생길 뿐* 이고, 그것이 바로 본 ADR 이 없애려는 상태다. 승인된 2단계 의미는 레벨이 아니라 `kind` 태그로 보존한다.

알림 피로는 **fingerprint 고정**으로 막는다:

```
fingerprint = ['fetcher-yield', kind, providerSlug, category]
```

같은 고장이 매일 반복돼도 Sentry issue 는 하나로 묶이고, [운영 룰 2(신규 issue 첫 발생)](../runbook/sentry-alert-rules.md)가 **1회만** 이메일을 보낸다. 침묵도 없고 매일 오는 알림도 없다.

### D4. 비교 기준 = `tariff_snapshot` 집계, 신규 테이블 0

한 fetcher 실행은 **하나의 `fetched_at` 값**을 모든 행에 공유한다(`FetchResult.fetchedAt`). 따라서:

1. `prevFetchedAt` = 이번 `fetchedAt` **미만**의 최대 `fetched_at` (해당 provider)
2. 그 시각의 행을 `tariff.category` 로 group by count

스키마 마이그레이션 0, 신규 테이블 0. 조회 실패 시 **빈 객체를 반환**해 비교를 건너뛴다 — 감시가 수집을 깨뜨리면 본말전도다.

### D5. 임계값의 근거

- **−30%**: 실측 사고는 −75%(4→1). 정상 변동(5개 중 1개 단종)은 −20% 라 30% 아래에 머문다. 두 분포 사이의 골짜기.
- **직전 ≥ 3 일 때만 비율 판정**: 1 → 0, 2 → 1 같은 소표본은 비율이 −50~100% 로 튄다. 진짜 0건은 `zero_yield` 가 이미 잡으므로 손실 없음.

## 결과 (Consequences)

### ✅ 얻는 것

- 조용한 유실이 **다음 cron 실행(최대 24h) 안에** 이메일로 발화한다. 지금까지의 발견 경로("사람이 우연히")를 대체.
- `ok:false` 가 처음으로 알림 경로를 갖는다 — 4.5.2 주석이 가정만 하고 구현하지 않았던 연결.
- 판정이 **순수 함수**(`evaluateYield`)라 사고 3건을 회귀 테스트로 박아둘 수 있다.

### ⚠️ 잃는 것 / 한계 (정직 표기)

- **`SENTRY_DSN` 미등록이면 이메일은 안 간다.** `sentry.server.config.ts` 는 DSN 부재 시 `enabled:false` no-op 이다. 그 경우 본 항목의 산출은 **Inngest 로그 기록뿐**이며, 이는 "사람이 보러 가야 안다" 상태와 동일하다. DSN 등록은 [운영자 트랙](../runbook/sentry-alert-rules.md)이고 본 ADR 이 그것을 대신할 수 없다.
- **건수가 유지되는 오염은 못 잡는다.** Telenet 결합가 혼입(가격만 절반, 건수 동일)이 정확히 이 사각지대다. 가격 이상치 감시(전일 대비 ±N% 가격 변동)는 **별 항목**이다. 이 한계는 테스트로 명시해 두었다 (`yield-alert.test.ts` — "한계 명시").
- **공급사의 진짜 대규모 단종은 오탐이 된다.** 예: 공급사가 요금제 라인업을 절반으로 줄이면 `sharp_drop` 이 뜬다. 그러나 그런 사건은 실제로 사람이 봐야 하므로 오탐 비용이 낮다.
- **최대 24h 지연.** cron 이 일 1회이므로 감지도 일 1회다. 더 빠른 감지는 fetch 빈도를 올려야 하고, 그건 공급사 부하·차단 위험과 맞바꾸는 별 결정이다.

### 잠긴 트레이드오프 (재논의 ❌)

- 알림 채널을 이메일/슬랙으로 직접 붙이지 않는다 — Sentry 가 이미 그 역할을 하고, 솔로 운영에서 채널을 늘리면 알림 피로만 커진다.
- 신규 테이블로 실행 이력을 따로 쌓지 않는다 — `tariff_snapshot` 이 이미 append-only 시계열이다.

## 검증 방법 (Verification)

1. `evaluateYield` 회귀 테스트 — 실제 사고 3건 재현 + 오탐 억제 6건 + 한계 명시 1건.
2. `reportYieldFindings` — level/fingerprint/Sentry 예외 격리 4건.
3. 프로덕션: 다음 cron 실행 후 Inngest 로그에 `yield-check-*` step 이 보이고, 정상 상태에서는 finding 0 인 것을 확인.

## 관련 ADR

- [ADR-0008](0008-fetcher-interface-and-cron.md) — fetcher 인터페이스 + cron (Amendment 1 `retiredCategories`)
- [ADR-0005](0005-tariff-schema-telecom.md) §T5 — 단종 처리 (본 감시가 보완하는 대상)
- [ADR-0006](0006-tariff-snapshot-schema.md) — `tariff_snapshot` 시계열 (D4 비교 기준)
- [ADR-0037](0037-public-legal-pages-and-cookie-consent.md) §6.1 — Sentry 도입 + 프라이버시 가드
- [ADR-0053](0053-telecom-provider-ecosystem-expansion.md) §D6.1 — 본 ADR 을 발화시킨 사고 3건
- 운영 문서: [`docs/runbook/sentry-alert-rules.md`](../runbook/sentry-alert-rules.md) — 룰 1/2 가 본 알림의 전달 경로
