# ADR-0005: `tariff` 테이블 스키마 (통신 BE)

## Status

Proposed (2026-05-09) — PLAN 항목 **1.2** 데이터 레이어 두 번째 테이블. verifier
가 typecheck/lint/test/migration-sql/harness:plan/harness:data 통과 확인 후
Accepted로 격상한다.

## Context

- PLAN 항목 **1.2**. 1.1 `provider`(ADR-0001)에 이어 두 번째 테이블. 후속 1.3
  `tariff_snapshot`, 1.7 fetcher 인터페이스, 1.11 비교 엔진, 1.12 12 케이스
  단위 테스트가 모두 본 테이블의 컬럼을 직접 의존한다.
- **카테고리 = 통신 BE**(모바일 + 인터넷, 추후 fixed-line + bundle 확장). 결정
  근거 [ADR-0003 §결정 1](0003-plan-realism-solo-side.md). 페이즈 1.8 fetcher
  3개 = Proximus / Orange BE / Telenet.
- **운영자 컨텍스트**(`docs/FOUNDER.md`): 솔로 사이드, 개발 3개월, 월 €300
  ALL-IN. **디버깅 용이성 + 단순함**이 *완벽한 일반화*보다 가중치가 크다.
- PLAN 1.2 원안 필드 목록(`unit_price`, `fixed_fee`, `valid_from/to`)은 페이즈
  1이 에너지였던 시점의 가정이다. 통신은 단위 가격(€/kWh) 개념이 없고 *월정액
  + 데이터 한도 + 약정 + 프로모* 가 공통 구조라서 본 ADR이 PLAN 1.2를
  통신용으로 재정의한다.

### 외부 사실 — 통신 BE 시장 사전 조사

WebFetch로 세 공급사 페이지를 직접 시도했으나 모두 HTTP 404 반환 (2026-05-09).
대신 WebSearch로 공급사 공식 도메인의 페이지 메타·요약을 확인했다. 요금제 *공통
구조*만 추출(P1: 구체적 가격은 1.3 스냅샷 책임).

| 출처 | 추출한 공통 구조 |
|---|---|
| [Proximus mobile subscriptions](https://www.proximus.be/en/mobile-subscription) (Essential / Smart / Unlimited 페이지 군) | 월정액(€/월), 데이터(GB 또는 unlimited), 음성(분 또는 unlimited), SMS, **EU 로밍 포함 여부**, 약정 없음(non-binding) 옵션 광고, **6 months promo discount** |
| [Orange Belgium GO portfolio](https://corporate.orange.be/en/news-medias/orange-belgium-launches-new-mobile-portfolio-go-introducing-first-mobile-family-offer) — Go Light / Go Plus / Go Intense | 월정액(€/월), 데이터(GB), [2026-01-18 €2~3 인상 + GB 추가](https://www.bruxellestoday.be/economie/orange-belgium-tarifs-2026.html) — *가격은 자주 변경되므로 시계열 분리 필요(1.3)* |
| [Telenet ONE / Internet](https://www2.telenet.be/residential/en/products/productoverzicht.html) ([Essential Internet](https://www2.telenet.be/residential/en/pages/essential-internet.html)) | 월정액(€/월), **다운/업 Mbps**(가정용 150 Mbps ~ 1 Gbps), **무제한 데이터**(피크 throttle), **활성화 무료** w/ ONE/ONEup, **Wi-Fi booster 무료 임대** + 추가 €2/월, 1~2년 약정 |

### 추출한 공통 구조 (모든 통신 카테고리)

- **월정액** (€/월) — 모든 요금제의 fixed unit, 비교 엔진의 제1 변수.
- **활성화 비용** (1회성, 0~€50)
- **약정** (0/12/24개월) + **조기 해지 위약금**
- **프로모** ("처음 X개월 €Y 할인" 형태가 베네룩스 표준)
- **모뎀/장비** — 인터넷 한정. Telenet은 Wi-Fi booster 무료 + 추가 €2

### 카테고리별 변동 속성

- **모바일**: `data_gb` (number | "unlimited"), `voice_minutes`,
  `sms_count`, `eu_roaming_included`, `throttle_after_gb_speed_kbps`
- **인터넷**: `download_mbps`, `upload_mbps`, `unlimited_data`,
  `fair_use_gb`, `wifi_booster_included`
- **번들(인터넷+TV)**: 위 인터넷 키 + `tv_channels`, `tv_4k_included`,
  `dvr_hours`, `mobile_lines_included`
- **유선**: `calls_be_included_minutes`, `international_zones`

## Decision

T1~T6 6개 결정.

### T1 — 단일 `tariff` 테이블 + JSONB `attributes` (옵션 A 채택)

핵심 비교 컬럼(가격/약정/프로모)은 컬럼으로 평탄화. 카테고리별 변동 속성은
`attributes JSONB NOT NULL DEFAULT '{}'`. Zod 스키마(`src/types/tariff-attributes.ts`,
1.7에서 신설)가 카테고리별 키 *런타임 검증*의 단일 출처.

**근거:**
- 솔로 + 개발 3개월. **단일 테이블이 가장 디버깅 쉽다** — `psql`에서 한
  테이블만 보면 됨.
- 페이즈 5에서 에너지/모기지 추가 시 새 카테고리별 attributes 키만 정의 →
  **마이그레이션 0건**. 운영 부담 최소.
- 핵심 비교 필드(가격, 약정, 프로모)는 컬럼이라 비교 엔진(1.11)이 SQL에서
  직접 정렬/필터 가능. JSONB 안에 가격을 넣으면 인덱싱·정렬 비용 발생.
- 운영자 본업 자산 [salair-plus.com](https://salair-plus.com) 같은 단일 도메인
  계산 도구의 운영 패턴과 일치 — *컬럼 + 부가 메타 1개*.

**거부된 대안 — 옵션 B (카테고리별 분리 테이블)**
- 장점: 타입 안전성 최대 (`mobile_tariff.data_gb int NOT NULL`).
- 단점: (a) 페이즈 5에서 카테고리 추가마다 새 테이블 + fetcher 분기 + 비교
  엔진 분기. (b) 카테고리 간 비교가 필요해질 때 (페이즈 5.6 "통신 절약했으니
  에너지도?") UNION 집계 복잡. (c) 솔로가 4개 테이블 마이그레이션 동시 관리는
  실수 위험.

**거부된 대안 — 옵션 C (단일 + 1:1 확장 테이블)**
- 장점: B의 타입 안전성 + A의 단일 마스터.
- 단점: 항상 JOIN. 운영자가 "왜 두 테이블?"을 매번 떠올려야 함 → 인지 부하.
  솔로 컨텍스트에서 가치보다 비용이 큼.

### T2 — 가격은 정수 cents (BIGINT, EUR 단위 €0.01)

`monthlyPriceCents`, `activationFeeCents`, `modemRentalCents`,
`earlyTerminationFeeCents`, `promoPriceCents` 모두 BIGINT.

**근거:**
- PLAN **1.12** DoD: "12케이스 모두 ±0.01€ 이내" — decimal(10,2) +
  부동소수 연산 누적 라운딩으로는 베타에서 회귀 위험.
- JS `Number`는 53-bit 정수 안전 → BIGINT cents에서 €90조까지 무손실. 모든
  통신 요금에 충분.
- Drizzle `bigint('col', { mode: 'number' })`로 TS는 `number` 타입 (Zod 검증
  쉬움). PostgreSQL 16에서 `BIGINT` 인덱싱 비용 = `INTEGER`와 사실상 동일.
- 표시 시점에만 `Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' })`
  로 변환 — 결과 카드(3.1) `<PriceWithSource>` 컴포넌트가 단일 변환 지점.

**거부된 대안 — `decimal(10,2)`**
- 장점: SQL 직관적 (`SELECT monthly_price`).
- 단점: PostgreSQL `numeric`은 정확하지만 JS 클라이언트는 `string` 반환 →
  매번 `parseFloat` → 부동소수 위험 재진입. `pg-numeric` 라이브러리 추가 의존성
  =월 €300 운영자에게 추가 학습 비용.

### T3 — 약정 = `commitmentMonths INT` (0=없음) + `earlyTerminationFeeCents BIGINT NULL`

**근거:**
- Proximus가 명시적으로 "non-binding subscriptions" 카테고리를 광고. 0은
  "약정없음"의 자연스러운 표현.
- 12·24가 일반적이지만 6·36도 향후 등장 가능 → enum보다 INT가 유연.
- 위약금은 약정 + 명시 시점에만 NOT NULL이 의미 있음 → NULL 허용.

**거부된 대안 — `commitment` enum (`none`/`12m`/`24m`)**
- 장점: 잘못된 값 차단.
- 단점: 6·36개월 등장 시 `ALTER TYPE ADD VALUE` 마이그레이션. 비교 엔진이
  enum→INT 변환 필요 (`switch` 문 추가). YAGNI.

### T4 — 프로모는 평탄화 (`promoPriceCents`, `promoMonths`, `promoDescription`)

**근거:**
- 베네룩스 통신 프로모의 99%가 "처음 X개월 €Y 할인" 단일 패턴 (Proximus 6
  months discount, Telenet 첫 3-6개월 활성화 무료 등).
- 비교 엔진(1.11)이 24개월 TCO 계산 시 한 행에서 모든 데이터 읽음 → JOIN 0회.
- 페이즈 4.5의 어트리뷰션(`affiliate_click`)은 `tariff_id` FK만 알면 충분.
  프로모 정산 분쟁은 `tariff_snapshot`(1.3)의 `raw_payload`에서 재구성 가능.

**거부된 대안 — 별도 `tariff_promotion` 테이블 (M-to-M)**
- 장점: 한 요금제에 다중 프로모 적용 (예: "신규고객 €10 + 가족결합 €5") 표현
  깔끔.
- 단점: (a) 베네룩스 통신에서 다중 프로모는 드묾(번들/장기약정 인센티브로 흡수).
  (b) 비교 엔진의 24개월 TCO 계산이 SUM/JOIN 추가 → 1.12 DoD ±0.01€ 검증 표면적
  증가. (c) **가장 큰 거부 사유**: 페이즈 4.5 어트리뷰션 데이터가 단일
  `tariff_id`로 단순화되는 것이 솔로 운영에 결정적 — 정산 시 한 줄로 추적 가능.

### T5 — `tariff` = 마스터 (`isActive` boolean + `lastSeenAt`). 시계열은 1.3 `tariff_snapshot` 단독

PLAN 1.2 원안의 `valid_from/valid_to`는 **제거**.

**근거:**
- 1.3 `tariff_snapshot`이 시계열의 단일 출처가 되도록 책임 분리. 그래야 1.5.2
  `harness:price` 일 1회 cron이 단일 테이블만 보면 됨.
- 비교 엔진(1.11)의 hot path = "현재 판매 중인 카테고리 X 요금제 모두" →
  `WHERE category = $1 AND is_active = true`. **B-tree 복합 인덱스**
  `(category, is_active)` 1개로 해결.
- `lastSeenAt`은 24h stale 라벨(P1: `<StaleLabel>` — `data-fidelity.ts` Rule 3
  호환) + status 페이지(6.6) + harness:price (1.5.2) 의 입력.
- 단종된 요금제는 `isActive=false`로 보존 — 영구 링크(3.6)가 깨지지 않음. 해당
  요금제로 변경한 사용자의 어트리뷰션도 유지.

**거부된 대안 — `validFrom/validTo timestamptz` 유지**
- 장점: SQL `WHERE now() BETWEEN valid_from AND valid_to` 한 줄.
- 단점: 통신은 *공급사가 명시적 종료일을 광고하지 않는다* — Telenet ONE이
  사라질 때는 페이지에서 그냥 사라짐. fetcher가 `validTo`를 추정해야 → 거짓
  데이터 위험. 마스터/스냅샷 분리가 사실에 더 충실.

### T6 — `tariff_category` enum = `mobile`, `internet_fixed`, `bundle_internet_tv`, `landline`

페이즈 1은 4값. 페이즈 5에서 `energy_electricity`, `energy_gas`, `mortgage`,
`insurance_auto`, `insurance_home` 등 추가 — *항상 ADR + `ALTER TYPE ADD
VALUE`*. enum 변경 정책은 ADR-0001과 동일.

**근거:**
- ADR-0001 §대안 C 동일: P4(타입 안전) + 베네룩스 외/카테고리 외 확장은
  ADR로 명시적 결정 사건이어야 한다.
- `internet_fixed` 명명: 페이즈 5에서 `internet_mobile_5g_home`(5G 가정용)이
  등장 가능 → `internet_*` 접두사로 그룹.
- `bundle_internet_tv` 명명: TV+모바일+인터넷 3종 번들도 가능하지만 베네룩스
  주류는 인터넷+TV. 모바일 추가는 `attributes.mobile_lines_included`.

**거부된 대안 — `category text` (enum 없음)**
- 장점: 카테고리 추가가 코드 변경만으로 끝남.
- 단점: 오타 위험, Drizzle TS 타입 손실, 비교 엔진의 `switch` exhaustive 체크
  불가. ADR-0001 §대안 C와 동일 사유로 거부.

## Consequences

### ✅ 얻는 것

- 1.3 `tariff_snapshot`이 *순수 시계열* 책임만 가지고 깨끗하게 시작 가능
  (`tariff_id` FK + `fetched_at` + `source_url` + `raw_payload jsonb`).
- 1.7 fetcher 인터페이스가 단순 — `FetchResult`를 한 카테고리 `tariff` 행 +
  `attributes` JSONB로 매핑하면 끝. fetcher 3개 모두 같은 출력 모양.
- 1.11 비교 엔진의 hot path 인덱스 1개(`tariff_category_active_idx`)로 해결.
- 1.12 ±0.01€ DoD가 정수 cents로 *수학적으로* 보장됨 — 부동소수 회귀 0건.
- 페이즈 5에서 카테고리 추가 = `ALTER TYPE ADD VALUE` + Zod attributes
  스키마 추가. *마이그레이션 1건, 신규 테이블 0건*.

### ⚠️ 잃는 것 / 부채

- `attributes` JSONB의 형식 안전은 **런타임 Zod 검증**에 의존. fetcher가
  잘못된 키로 쓰면 컴파일 타임에 못 잡음 → 1.7에서 fetcher 인터페이스가
  `attributes` 부분을 카테고리별 제네릭으로 받도록 설계 필요 (이 ADR의
  후속 작업).
- BIGINT cents는 `pgAdmin`/`drizzle-studio`에서 사람이 읽기 어려움 (€25.00
  → `2500`). 어드민 대시보드(4.5.1)에서 `<PriceCellFormatter>` 헬퍼
  컴포넌트 필요.
- 카테고리 추가 시 enum 마이그레이션은 *down 마이그레이션이 비싸다*
  (`ALTER TYPE DROP VALUE` 미지원). 추가 결정은 ADR로.

## 영향 (다른 PLAN 항목)

- **1.3 `tariff_snapshot`**: `tariff_id uuid REFERENCES tariff(id) ON DELETE
  CASCADE` 가정. 본 ADR이 마스터 책임을 가져갔으므로 1.3은 시계열만 담당
  — `fetched_at`, `source_url`, `raw_payload jsonb`, `confidence enum`,
  `monthly_price_cents_at_fetch` (스냅샷 시점 가격, 마스터 변경 시 보존).
  `harness:data` Rule 4가 정확히 이 컬럼들을 검증.
- **1.6 Inngest cron**: fetcher 실행 후 (a) `tariff` 마스터 upsert (provider_id
  + slug 키) (b) `tariff_snapshot` 추가 (c) `lastSeenAt` 갱신. 페이지에서 사라진
  요금제는 `isActive=false`로 마킹.
- **1.7 Fetcher 인터페이스**: `FetchResult` 타입이 본 스키마의 `NewTariff +
  attributes` 모양과 정확히 매칭되도록 설계. Zod 스키마는
  `src/types/tariff-attributes.ts` (신규).
- **1.10 `/data-sources` 페이지**: provider별 `tariff` 행 수 + `lastSeenAt`
  표시. P3 (제외된 공급사도 이름 공개)는 `provider.excluded_reason` +
  `tariff` 0행 조합으로 자연스럽게 표현됨.
- **1.11 비교 엔진**: 입력 = `(현재 tariff_id?, 사용량 프로파일, 후보 tariff[])`.
  24개월 TCO = `(monthlyPriceCents × 24) - (promoPriceCents 차감 × promoMonths)
  + activationFeeCents + (modemRentalCents × 24)`. 모두 정수 산술.
- **1.12 12 케이스 단위 테스트**: 정수 cents → 라운딩 사례 0개. `expect(result)
  .toBe(2500)` 같은 strict equality 사용 가능.
- **4.1 `affiliate_click`**: `tariff_id uuid REFERENCES tariff(id)` 추가 권장
  — 정산 시 어느 요금제로 변경했는지 추적.

## Alternatives considered (요약)

| Trade-off | 채택 | 거부된 주요 대안 |
|---|---|---|
| T1 | 단일 + JSONB attributes | 카테고리별 분리 테이블 (마이그레이션·JOIN 비용 큼) |
| T2 | BIGINT cents | decimal(10,2) (JS string 변환 → 부동소수 재진입) |
| T3 | INT 0=없음 | enum (6·36개월 추가 시 ALTER TYPE) |
| T4 | 평탄화 컬럼 | `tariff_promotion` M-to-M (어트리뷰션 단순화 손실) |
| T5 | 마스터 + isActive | `valid_from/valid_to` (공급사가 명시 안 함 → 거짓 데이터) |
| T6 | enum 4값 (확장 ADR) | `text` (P4 위반) |

## 검증 방법

### 1. typecheck / lint / test 0 에러

`pnpm typecheck && pnpm lint && pnpm test:run` — `tariff.ts` import + relations +
inferred types가 깨끗.

### 2. `pnpm harness:data` 통과

- `tariff_snapshot` 스키마는 본 ADR 시점 부재 → `schema-tariff-snapshot-missing`
  warn 유지 (1.3에서 해소). `harness:data`가 warn 레벨로 통과해야 함.
- 다른 룰(StaleLabel, fetcher FetchResult, UI PriceWithSource)은 본 ADR과 무관
  — 동일 상태 유지.

### 3. 마이그레이션 SQL 시각 검토

`pnpm db:generate` 실행 후 `drizzle/0001_*.sql` 의 `CREATE TYPE
tariff_category`, `CREATE TYPE currency`, `CREATE TABLE tariff`, FK 4개 인덱스
모두 존재 확인. 생성 후 verifier가 SQL 1회 시각 검토 (ADR-0001과 동일 절차).

### 4. 비교 엔진 회귀 (1.12에서 본격화)

본 ADR 기준 cents 기반 산술이 12 케이스 모두 ±0.01€ → 정확히 ±0 cent로
수렴해야 한다. 실패 시 본 ADR 재검토 (decimal로 회귀 또는 다른 분리).

## 다음 단계

1. **마이그레이션 생성** (사용자 실행):
   ```bash
   pnpm db:generate    # drizzle/0001_*.sql 생성
   pnpm db:push        # Neon에 적용 (확인 후)
   ```
   → 생성된 SQL은 verifier가 시각 검토. ADR-0001 패턴과 동일.

2. **PLAN 1.2 본문 갱신** — `unit_price/fixed_fee/valid_from/valid_to`
   에너지 가정을 통신 가정(`monthly_price_cents`, `commitment_months`,
   `is_active`, `attributes`)으로 갱신. 본 ADR 채택과 동시에 1줄 인라인 갱신.

3. **1.3 `tariff_snapshot` ADR-0006**(다음 작업) — 시계열 책임만 가져가도록
   본 ADR §영향에 명시한 컬럼 셋을 그대로 따름.

4. **1.7 fetcher 인터페이스** 작성 시 `src/types/tariff-attributes.ts` (Zod)
   신설 — 카테고리별 attributes 키 단일 출처.

## References

- 헌법: [`CLAUDE.md`](../../CLAUDE.md) — P1 (정보 우선), P4 (타입 안전), P5 (ADR)
- 운영자: [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, 디버깅 용이성 가중치
- 관련 ADR:
  - [ADR-0001](0001-provider-schema.md) — `provider` 마스터 (FK 부모)
  - [ADR-0003](0003-plan-realism-solo-side.md) §결정 1 — 카테고리 = 통신 BE
  - [ADR-0004](0004-monetization-solo-side-rebalance.md) — 어트리뷰션 단순화 가중치
- 외부 사실 (통신 BE 사전 조사 — WebSearch 2026-05-09):
  - [Proximus mobile subscriptions overview](https://www.proximus.be/en/mobile-subscription)
  - [Proximus Mobile Smart 70 GB plan](https://www.proximus.be/en/mobile-subscription/smart)
  - [Proximus Mobile Unlimited (1 Gbps, 300 GB → 512 Kbps)](https://www.proximus.be/en/mobile-subscription/unlimited)
  - [Proximus Mobile Essential 5 GB](https://www.proximus.be/en/mobile-subscription/essential)
  - [Orange Belgium GO portfolio launch](https://corporate.orange.be/en/news-medias/orange-belgium-launches-new-mobile-portfolio-go-introducing-first-mobile-family-offer)
  - [Orange Belgium 2026-01 가격 인상 보도](https://www.bruxellestoday.be/economie/orange-belgium-tarifs-2026.html)
  - [Telenet residential product overview](https://www2.telenet.be/residential/en/products/productoverzicht.html)
  - [Telenet Essential Internet](https://www2.telenet.be/residential/en/pages/essential-internet.html)
- Drizzle docs:
  - [pgEnum + relations](https://orm.drizzle.team/docs/sql-schema-declaration)
  - [bigint mode 'number'](https://orm.drizzle.team/docs/column-types/pg#bigint)
- PostgreSQL 16 — [JSONB 인덱싱](https://www.postgresql.org/docs/16/datatype-json.html), [`ALTER TYPE ADD VALUE`](https://www.postgresql.org/docs/16/sql-altertype.html)
