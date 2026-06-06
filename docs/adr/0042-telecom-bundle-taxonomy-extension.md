# ADR-0042: 통신 카테고리 enum 확장 — mobile+internet 듀얼 추가 + bundle 의미 재정의 (옵션 B + JSONB 후방 호환 레인)

## Status

**Accepted (2026-06-07, 운영자 Pieter)** — Q1.B (옵션 B 3→5 + D2 JSONB 후방
호환 레인) + Q2.A (fetcher 별 PR 분리) + Q3.A (ADR Accepted 직후 마이그레이션)
모두 architect 추천 그대로 잠금. builder 인계 진입 게이트 열림. ADR-0005 §T6
**Amendment 2** 동반 채택.

격상 이력:
- Proposed (2026-06-07) — 운영자 신호 "모바일 + 인터넷 상품도 있어"
  (2026-06-06 slim.lu hero 5블록 자가 진단) 발화. ADR-0005 §T6 Amendment 1
  3값(`mobile`/`internet_fixed`/`bundle_internet_tv`) 시장 정합 진단.
- Accepted (2026-06-07) — 운영자 Q1.B + Q2.A + Q3.A 잠금. PLAN 4.14 진입
  게이트 열림. 합계 93→94 / 페이즈 4: 9→10.

## Context

### 1. 운영자 신호 (잠금된 사실)

운영자 Pieter (코드 작성자 본인) 가 slim.lu 홈 페이지 5블록 hero 예시 가격
카드를 보고 신호 발화 (2026-06-06):

> "모바일 + 인터넷 상품도 있어"

현 카테고리 enum 3값 (`src/types/comparison-input.ts:21-25`,
`src/db/schema/tariff.ts:42-51`):

```ts
export const TARIFF_CATEGORIES = [
  'mobile',
  'internet_fixed',
  'bundle_internet_tv',
] as const;
```

`bundle_internet_tv` 코멘트 = "인터넷+TV 묶음. Telenet ONE, Proximus Flex
등" — 본 ADR Context §2 외부 사실 정찰 결과 `Telenet ONE/ONEup` 은 실제
mobile+internet+TV+landline **quad/triple play** 이고 (TV-only bundle 아님),
mobile+internet 듀얼 번들은 별도 카테고리로 존재. 즉 현 enum 은 **이중 갭**:

- 갭 1: mobile+internet 듀얼 (TV 없음) = enum 부재
- 갭 2: `bundle_internet_tv` 라벨 ↔ 실 시장 매핑 모호 (TV-only vs triple)

### 2. 외부 사실 — 베네룩스 통신 BE 시장 정찰 (2026-06-07)

WebSearch + WebFetch 로 3 공급사 공식 사이트 + 보도/제3자 카탈로그 사이트
교차 확인. P1 정합 위해 *공식 출처* 우선 인용.

#### Proximus Flex+ (현행 모듈식 — Tuttimus 레거시 가격 인상 정리 중)

[Proximus Flex+ — Internet, TV, mobile and landline subscription](https://www.proximus.be/en/id_cr_all_flex_packs/personal/packs/cr-all-flex-packs.html)
페이지 직접 fetch (2026-06-07) — 인용:

| Pack name | 구성 |
|---|---|
| Internet Go 100 Mbps (Flex+) | 100 Mbps internet + 20 GB mobile + 80+ TV channels = **mobile+internet+TV triple** |
| Mega Fiber 500 Mbps (Flex+) | 500 Mbps fiber + 20 GB mobile + 80+ TV channels = **triple** |
| Giga Fiber 2 Gbps (Flex+) | 2 Gbps + 20 GB mobile + 80+ TV channels = **triple** |
| Ultra Fiber 10 Gbps (Flex+) | 8.5 Gbps + 20 GB mobile + 80+ TV channels = **triple** |
| Internet + Mobile (Flex+ dual) | "available as separate combinations" — **mobile+internet 듀얼** |
| Internet + TV (Flex+ dual) | "options for second residences" — **internet+TV 듀얼** |

추가 사실: [Proximus 2026-01 가격 인상 보도](https://itdaily.com/news/business/proximus-raises-prices-older-subscriptions/) — Tuttimus 등 레거시 번들은 €2~4/월
인상 + Flex+ 가격 동결 → Flex+ 가 사실상 주력. *Flex+ 가 "모듈식"이라
fetcher 가 카탈로그를 사전 정의 받기 어렵다* (사용자가 만드는 조합) — 본 ADR
§Open Question Q1 의 핵심 트레이드오프.

#### Telenet ONE / ONE up (DISCONTINUED 2026-05-15)

[Telenet 신규 가입 단종 보도 — 2026-04-28](https://itdaily.com/news/network/telenet-stel-je-eigen-bundel-samen/)
및 [test-achats.be 분석](https://www.test-achats.be/hightech/telecom/news/augmentation-des-tarifs-de-telenet)
교차 확인 — 인용:

- ONE/ONEup 은 mobile + internet + digital TV + fixed telephony **quad
  play** 단일 월정액.
- 2026-04-27 Telenet 공식 발표: **신규 가입 2026-05-15 차단**, 기존 고객
  grandfather + 다음 청구 주기 가격 조정.
- 신 모델 = **"build your own bundle"** 모듈식 (Telenet KLIK Mobile +
  Internet 200/500/2.5G + TV box + Landline 각각 선택).
- 따라서 운영자 진단 정확: 현 `bundle_internet_tv` 슬롯에 매핑된 ONE up =
  실제로 triple/quad play (mobile 포함, TV-only 아님).

[제3자 카탈로그 — abonnement-tv-internet.be Telenet ONE up](https://www.abonnement-tv-internet.be/operateurs-pack/telenet/one-up):
"Telenet ONE Up: Internet Fibre + Gsm Illimité + internet mobile illimité +
appels et sms illimités" = **mobile+internet 듀얼 (TV 없음)** — 이건 ONE up
의 **subvariant**. *제3자 카탈로그 vs 공식 페이지 사실 불일치* — fetcher 는
공식 페이지 SoT 우선, ADR-0013 신뢰도 보존.

#### Orange Belgium Love (Duo / Trio — 운영자 가설 완전 적중)

[Orange Belgium Love Duo 런칭 보도 — 2019-07-18](https://corporate.orange.be/en/news-medias/orange-belgium-launches-love-duo-mobile-and-fixed-internet-pack-intended-cord-cutters)
직접 fetch (2026-06-07) — 인용 (강조 추가):

> "Love Duo, a pack including **only a mobile subscription and ultrafast and
> unlimited fixed internet**."
>
> "An offer intended first and foremost for **'cord-cutters'**, those
> increasingly numerous consumers who watch little or no traditional
> television."
>
> "Thus, no question any longer of forcing consumers to take a pack that
> includes services they don't use or rarely use (**television or fixed
> telephony, notably**)."

가격 = €42~64/월 (mobile à la carte + ultrafast unlimited fixed internet).
런칭 2019-07-18, **현행 판매 중** (2026 promo 6/1~8/9 검증).

[Orange Belgium Love Trio (Mobile + Internet + TV)](https://www.tv-internet-abonnement.be/pack-operatoren/orange-belgie):
"Love Trio = internet + mobile telephony + television, with optional fiber".
예시 — Love Trio + Mobile Small = unlimited 150 Mbps + 70 TV channels +
Mobile small @ €81/월.

### 3. 베네룩스 통신 BE 시장 실 분포 — 잠금 매트릭스

| 번들 타입 | Proximus | Telenet | Orange BE | 현 enum 매핑 | 갭 |
|---|---|---|---|---|---|
| Mobile only | Proximus Mobilus (Essential/Smart/Unlimited) | KLIK Mobile (Basic/Unlimited) | Go Light/Plus/Intense/Eagle | ✅ `mobile` | 없음 |
| Internet only | Internet Go/Mega Fiber/Giga Fiber/Ultra Fiber (single) | Internet 200/500/2.5G | Home Internet | ✅ `internet_fixed` | 없음 |
| Mobile + Internet (TV 없음) | Flex+ "Internet + Mobile" 조합 | (KLIK 모듈식, ONE up dual subvariant 제3자 카탈로그만) | **Love Duo €42~64** | ❌ enum 부재 | **갭 1** |
| Mobile + Internet + TV (triple) | Flex+ Internet Go/Mega/Giga/Ultra (4 packs) | ONE up (DISCONTINUED 2026-05-15) | Love Trio + Mobile | ⚠️ `bundle_internet_tv` 매핑 의심 | **갭 2** |
| Internet + TV only (TV-only bundle, mobile 없음) | Flex+ Internet + TV (second residence) | (모듈식) | Love Trio (mobile 없는 variant) | ⚠️ `bundle_internet_tv` 의도 라벨 | 라벨 모호 |

### 4. tariff master 실 데이터 (2026-06-06 prod 실측 cross-ref)

운영자 Pieter Chrome MCP 실측 (2026-06-06, ADR-0041 V1~V4 검증 라운드):

- Proximus internet_fixed = 4 행 (Internet Giga/Go/Light/Mega Fiber)
- Proximus mobile = 5 행
- Telenet mobile = 2 행
- Orange BE internet_fixed = 3 행 (Home Internet Start/Zen/Giga)
- **bundle_internet_tv 행 = 0** (시드 데이터에 라벨 진입 0건 — 4.7 admin
  SCRAPING 14/14 [x] 시점 잠금)

즉 enum 값 `bundle_internet_tv` 는 **schema 에만 존재, 데이터 0건**. 운영자
신호 봉합 라운드 (4.13 [x]) 에서 hero 카드 예시로 "Telenet ONE up
€80/월"이 보였는데, 이건 *코드/시드 데이터 아니라 hero placeholder UI* —
실데이터 매핑 0건.

→ **enum 변경 마이그레이션 비용 ≈ 0** (행 삭제/재매핑 데이터 없음). 흔적
제거 (ADR-0005 §Amendment 1 D-1 패턴) 재사용 가능.

### 5. 운영자 제약 (잠금)

- 운영자 €300/월 cap + 솔로 사이드 (작업 사이즈 ≤ 2~3일)
- [ADR-0034 D2](0034-strategy-pivot-completion-first-seo-launch.md) — 통신
  BE 만 (다른 카테고리 진입 금지)
- 헌법 §3 P1 (정보 우선 — source/fetched_at)
- 헌법 §3 P3 (투명성 — 실 데이터 분류 정확)
- [ADR-0029 §T2](0029-beta-recruitment.md) 정직성 토큰 (DEPRECATED but 카피
  원칙 보존)
- [ADR-0011 §T2](0011-data-sources-page-and-caveats-boundary.md) (실 데이터
  부재 시 정직 안내)
- DB migration = 운영자 직접 실행 ([ADR-0039](0039-production-migration-application-procedure.md))
- typecheck/lint/test:run + harness:plan/data 모두 통과 후 PR

## Decision

### D1 — 옵션 B 채택 (enum 3 → 5, 듀얼 + 트리플 분리) — **architect 추천**

`tariff_category` enum 신값:

```ts
export const TARIFF_CATEGORIES = [
  'mobile',
  'internet_fixed',
  'bundle_mobile_internet',       // [신설] Love Duo, Flex+ dual, Telenet KLIK+Internet 등 — mobile+internet 듀얼 (TV 없음, cord-cutter)
  'bundle_internet_tv',           // [의미 명확화] Internet+TV 듀얼 (mobile 없음) — Proximus Flex+ Internet+TV (second residence), Orange Love Trio without mobile
  'bundle_mobile_internet_tv',    // [신설] Triple play — Proximus Flex+ Go/Mega/Giga/Ultra, Telenet ONE up (legacy), Orange Love Trio + Mobile
] as const;
```

5값 분류 = 베네룩스 통신 BE 시장 실 분포 (§Context 3 매트릭스) 와 1:1 매핑.

**근거 (architect):**

1. **시장 정합 완전 봉합** — 갭 1 + 갭 2 동시 해소. 사용자 인지 모델 정합
   (Orange Love Duo cord-cutter 명시적 분류, triple play 명시적 분류).
2. **데이터 마이그레이션 비용 ≈ 0** — `bundle_internet_tv` 실 데이터 0건
   (§Context 4 잠금). schema 흔적 변경만 (ADR-0005 §Amendment 1 D-1 패턴
   재사용 — 동일 enum 재생성 절차, 공유 컬럼 2개 `tariff.category` +
   `comparison_request.category` 동시 ALTER).
3. **다나와(KR)/Check24(DE) 벤치마크 패턴 정합** — 양 플랫폼 모두 "듀얼" /
   "트리플" 분류를 명시적 UI 카테고리로 제공 (베네룩스 비교 플랫폼은 모듈식
   build-your-own 모델로 가는 추세지만, *비교 입력 단계의 사용자 의도 분류*
   는 듀얼/트리플 이산 분류가 5분/5단계 UX 정합 — 헌법 P2).
4. **운영자 신호 직접 봉합** — "모바일 + 인터넷 상품도 있어" → 신규 enum
   `bundle_mobile_internet` 라벨이 그대로 hero 카드 텍스트.
5. **3값보다 5값이 헌법 P1 정합** — `bundle_internet_tv` 단일 슬롯이 triple
   play 를 흡수하면 fetcher 가 *공식 페이지의 실제 분류 정보를 잃음*
   (Orange Love Duo vs Love Trio 출처 정확도 손상). 5값 분류는 fetcher
   매핑이 공식 페이지 분류 그대로 보존.

**거부된 대안 — 옵션 A (enum 3 → 4, mobile+internet 듀얼만 추가):**

- 장점: 운영자 신호만 봉합, 가장 작은 변경 (~1.5일).
- 단점: `bundle_internet_tv` 라벨 의미 모호 잔존 (triple vs TV-only).
  fetcher 분류 시 ambiguity → 헌법 P1 손상 + P3 캡션 작성 어려움. 6개월
  내 옵션 B 재진입 trigger 위험 (운영자가 또 "TV+Mobile+Internet 도 있어"
  신호 발화 시 재작업). **상위 옵션이지만 5→3 갭 봉합 불완전.**

**거부된 대안 — 옵션 C (카테고리는 enum 3값 유지 + `tariff.included_services` JSONB):**

- 장점: 시장 모듈식 전환 (Telenet "build your own", Proximus Flex+
  customization, Orange Love configurator) 와 가장 정합. fetcher 가 공식
  페이지의 실제 included_services 그대로 추출.
- 단점: (a) 사용자 비교 입력 단계에서 "어떤 조합?" 자유 선택 UI 신설 필요
  → 5단계/5분 UX 골격(ADR-0016 §T1) 깨짐. (b) 비교 엔진(ADR-0010)이 *부분
  일치 후보* 매칭 로직 신설 (현재는 category exact match) → 1.12 12 케이스
  단위 테스트 회귀. (c) JSONB 필드는 인덱싱/필터 비용 증가, hot path 인덱스
  `(category, is_active)` (ADR-0005 §T5) 효과 손실. (d) 사이즈 ≈ 4~5일 =
  운영자 €300/월 cap + 솔로 사이드 정합 초과 (≥ 2~3일 한도). **D2 cross-ref**:
  옵션 C 의 핵심 아이디어(included_services JSONB)는 *후방 호환 레인*으로
  D2 에서 흡수 — `attributes.included_services` 권장 키로 fetcher 가 *옵션
  적* 으로 작성, 비교 엔진은 무시. 미래 모듈식 카탈로그 정합 트리거 발화 시
  옵션 C 정식 격상 ADR backfill.

**거부된 대안 — 옵션 D (카피만 정정):**

- 장점: enum/schema/fetcher 변경 0 (~0.5일).
- 단점: 운영자 신호 봉합 0 (mobile+internet 듀얼 카테고리 부재 잔존).
  헌법 P3 위반 잔존 (`bundle_internet_tv` 라벨 모호). **운영자 신호를
  카피로 봉합하는 패턴은 ADR-0029 §T2 정직성 토큰 위반 위험** (라벨이
  실 데이터 분류와 어긋난 채 카피만 정정 = 사용자에게 거짓 분류 노출).

### D2 — `attributes.included_services` 권장 키 신설 (옵션 C 후방 호환 레인)

ADR-0005 §T1 JSONB `attributes` 카테고리별 권장 키에 **모든 bundle\_\*
카테고리 공통** 으로 다음 키 신설 (강제 아님, fetcher 점진 추가):

```ts
attributes.included_services = {
  mobile: boolean,           // mobile subscription 포함 여부
  internet: boolean,         // fixed internet 포함 여부
  tv: boolean,               // digital TV 포함 여부
  landline: boolean,         // fixed telephony 포함 여부
}
```

**근거:**

- fetcher 가 공식 페이지의 분류를 *그대로 직렬화* 가능 (예: Orange Love Duo
  → `{mobile:true, internet:true, tv:false, landline:false}`). 카테고리
  enum 과 *중복* 정보지만 P1 (source/fetched_at) 정합 강화.
- 시장이 모듈식으로 더 전환되면 옵션 C 정식 격상 시 *데이터 손실 0* — 이미
  included_services 가 채워져 있어 비교 엔진 마이그레이션이 backfill 없이
  진행 가능.
- 비교 엔진(ADR-0010)은 **무시** — 현 단계 hot path 는 카테고리 exact match
  유지. 단위 테스트 회귀 0.
- `attributes.unlimited_data: boolean` 같은 기존 JSONB 권장 키와 동일 패턴 —
  런타임 Zod 검증 (ADR-0005 §T1, `src/types/tariff-attributes.ts`) 만 추가.

### D3 — i18n 라벨 (5 locale × 2 신규 카테고리 = 10 entries)

신규 i18n 키 (ADR-0033 §T2 5 locale 그대로):

```jsonc
// messages/{ko,nl,fr,en}.json — compare.* 네임스페이스 (legal.* 아님)
{
  "compare.category.bundle_mobile_internet.label": "모바일 + 인터넷",        // ko (예시)
  "compare.category.bundle_mobile_internet.description": "TV 없이 모바일과 가정용 인터넷만 묶은 상품 (Orange Love Duo 등)",
  "compare.category.bundle_mobile_internet_tv.label": "모바일 + 인터넷 + TV",
  "compare.category.bundle_mobile_internet_tv.description": "통신 3종 풀 번들 (Proximus Flex+ Go/Mega 등)",
  "compare.category.bundle_internet_tv.label": "인터넷 + TV",                // [재정의 — 라벨 명확화]
  "compare.category.bundle_internet_tv.description": "모바일 없이 인터넷과 TV만 묶은 상품 (이중 거주지 등)"
}
```

DeepL Free 자동 (nl/fr/en) → 운영자 + legal 1차 검수 (`compare.*` 일반
i18n 트랙 — ADR-0033 §T4 legal 검수 게이트 비대상). 누적 분량 ≈ 600 chars
× 5 locale = 3,000 chars / Free 500K = 0.6% (영향 0). builder 가 ko 1차 +
DeepL hybrid (ADR-0040 패턴 일관).

### D4 — Hero CategoryGrid + /compare 페이지 카드 갯수 (3 → 5)

[ADR-0041 D5](0041-home-hero-redesign.md) + Amendment 1 D7
(`src/components/Hero/CategoryGrid.tsx` + `src/app/[locale]/compare/page.tsx`)
의 카드 그리드:

- 현 `md:grid-cols-3` (3 카테고리) → `md:grid-cols-3 lg:grid-cols-5` (5 카테고리)
- 모바일 360×640 fold = 카드 2x2 (4 카드 우선) + 5번째 카드 fold 밖
  (ADR-0041 §모바일 우선 정합)
- 카드당 실 예시 가격 1개 (ADR-0041 Amd 1 D7.4 정합) — bundle\_\* 카테고리
  3개는 데이터 0건 상태로 진입하므로 **ADR-0011 §T2 정직 표시**
  ("실 데이터 수집 중 — 페이즈 5 이후 격상"). ADR-0029 §T2 정직성 토큰 보존.

**대안 — 4 카드 (`bundle_internet_tv` 제외, 의미 모호 카테고리 hero 숨김):**

- 장점: 모바일 fold 정합.
- 단점: 사용자 검색 깔때기 차단 (Orange Love Duo 검색 사용자가 `compare`
  카테고리 슬롯 없으면 이탈). **거부.**

### D5 — fetcher 매핑 갱신 (3 fetcher, 점진)

ADR-0034 Amendment 1 D4 = 3 fetcher (Proximus / Telenet / Orange BE).
신규 enum 매핑 우선순위:

| 우선순위 | fetcher | 신규 카테고리 매핑 | 정찰 작업 |
|---|---|---|---|
| P1 (가장 시장 영향) | **Orange BE** | `bundle_mobile_internet` (Love Duo €42~64) | `https://www.orange.be/nl/producten-en-diensten/internet-tv-mobiel` Mobile+Internet 페이지 정찰 (`reference_fetcher_recon_method` 재사용) |
| P2 | **Proximus** | `bundle_mobile_internet_tv` (Flex+ Internet Go/Mega/Giga/Ultra 4 packs) + `bundle_mobile_internet` (Flex+ dual) | `https://www.proximus.be/en/id_cr_all_flex_packs/personal/packs/cr-all-flex-packs.html` Flex+ 페이지 정찰 |
| P3 (선택) | **Telenet** | (ONE/ONE up DISCONTINUED 2026-05-15 → 신규 가입 차단) → bundle 카테고리 시드 0건 유지 + 정직 안내 | grandfather 가격은 시드 부적합 (사용자 가입 불가) |

**중요:**

- Telenet bundle 시드 = 0건 유지 (DISCONTINUED 사실 fetcher 가 표시).
  `provider.excluded_reason` 패턴 (ADR-0011) 동형 — "Telenet ONE/ONE up
  2026-05-15 신규 가입 차단, 모듈식 build-your-own 모델 전환 중" 캡션.
- Orange BE Love Duo 정찰 = ADR-0034 Amendment 1 D4 (Voo 흡수) cross-ref +
  PLAN 1.5.8 fetcher 갱신 (별 트랙).
- 본 ADR 우선순위는 **schema/enum 갱신 후 fetcher 갱신은 별 PR 트랙** —
  4.14 본 PR 의 DoD 는 schema/enum/UI/i18n + bundle\_\* 0 데이터 정직 표시
  까지. fetcher 매핑은 4.14 머지 후 별 PR (예: PLAN 1.5.8 Amendment 또는
  신규 1.5.10).

### D6 — DB schema migration 절차 (ADR-0039 정합)

ADR-0005 §Amendment 1 enum 값 제거 정책 재사용 + ADR-0039 production
마이그레이션 절차:

1. `src/db/schema/tariff.ts` `pgEnum` 배열 갱신 (3값 → 5값).
2. `src/db/schema/comparison_request.ts` 동일 enum 재사용 (변경 0 — enum
   값 자동 흡수).
3. `pnpm db:generate` → `drizzle/0008_*.sql` 자동 생성.
4. **verifier 시각 검토 필수** (ADR-0005 §Amendment 1 패턴): 생성 SQL 이
   (a) 새 enum type 5값 생성 (b) `tariff.category` + `comparison_request.category`
   2 컬럼 동시 ALTER (c) old type DROP 순서 정확.
5. **운영자 직접 실행** (ADR-0039 §D1 인라인 `db:push` 패턴): development
   → preview → production 순.
6. `pnpm verify-db` 정합 검증 (현 8 테이블, ADR-0039 §D2 확장 정합).

**ALTER TYPE ADD VALUE 우선 시도:**

- PostgreSQL 16 은 `ALTER TYPE ... ADD VALUE` 지원 (label DROP 만 미지원).
- 본 ADR 은 **DROP 없는 ADD 만** (3값 → 5값, 기존 3값 그대로 유지) →
  마이그레이션 단순. `ALTER TYPE ADD VALUE` 2회 (`bundle_mobile_internet`,
  `bundle_mobile_internet_tv`) 만으로 가능.
- Drizzle 의 `pgEnum` 배열 변경 시 생성 SQL 패턴은 ADR-0005 §Amendment 1
  관찰 (재생성 패턴) — verifier 가 ADD VALUE 패턴인지 재생성 패턴인지
  시각 확인 후 운영자 보고. ADD 만이면 더 안전.

## Consequences

### 확실하게 얻는 것 (Pros)

- ✅ 운영자 신호 봉합 (mobile+internet 듀얼 카테고리 신설) — 헌법 P3 정합.
- ✅ `bundle_internet_tv` 의미 명확화 + triple play 별도 슬롯 — 사용자
  인지 모델 정합 (다나와/Check24 벤치마크).
- ✅ fetcher 가 공식 페이지 분류 그대로 매핑 가능 → P1 source 정합 강화.
- ✅ `included_services` JSONB 후방 호환 레인으로 미래 모듈식 카탈로그
  격상 시 데이터 손실 0 (옵션 C 정식 격상 트리거 보존).
- ✅ 마이그레이션 비용 최소 — `bundle_internet_tv` 실 데이터 0건 (§Context
  4 잠금), `ALTER TYPE ADD VALUE` 2회 만으로 가능.

### 잃는 것 / 부채 (Cons)

- ⚠️ UI 카드 5개로 증가 → 모바일 fold 정합 압박 (ADR-0041 §모바일 우선
  재검토 필요). D4 대응 = `md:grid-cols-3 lg:grid-cols-5` + 5번째 fold
  밖 허용.
- ⚠️ bundle\_\* 카테고리 3개 모두 실 데이터 0건 진입 → 사용자에게 "비교
  후보 없음" 정직 표시 (ADR-0011 §T2 패턴). fetcher 매핑 별 PR 트랙
  머지 전까지 caveats UI 노출 부담.
- ⚠️ Telenet bundle 카테고리 영구 0건 가능성 (DISCONTINUED) → `/data-sources`
  페이지 캡션 부담 (ADR-0011 동형). 운영 부채 0 (자동 표시).
- ⚠️ i18n 10 entries × 5 locale (= 50 string entries) 신설 → DeepL Free
  3,000 chars / Free 500K = 0.6% (영향 0, 누적 메모리 정합).

### Trade-offs 요약

| 옵션 | 시장 정합 | 사이즈 | 인지 부하 | 회귀 위험 | 추천 |
|---|---|---|---|---|---|
| A (3→4) | 부분 봉합 | ~1.5일 | 낮음 | 6개월 재진입 위험 | ❌ |
| **B (3→5) + JSONB 레인** | **완전 봉합** | **~2.5일** | **중간 (5 카드)** | **낮음 (ADD VALUE 만)** | **✅** |
| C (3값 + JSONB 자유) | 미래 정합 최고 | ~4~5일 | 높음 (UX 자유 선택) | 높음 (비교 엔진 회귀) | ❌ |
| D (카피만) | 0 | ~0.5일 | 0 (라벨 모호 잔존) | ADR-0029 §T2 위반 위험 | ❌ |

## Open Questions (운영자 결정 필요)

### Q1 — 옵션 선택 잠금 (A/B/C/D)

architect 추천 = **옵션 B + D2 JSONB 후방 호환 레인** (D1 본문).

운영자 응답 형식:
- Q1.A — 옵션 A (3→4 듀얼만 추가, triple 라벨 모호 잔존)
- **Q1.B — 옵션 B (3→5 듀얼 + 트리플 명확화) + D2 JSONB 레인** (architect 추천)
- Q1.C — 옵션 C (3값 + JSONB 자유 — UX 큰 변경)
- Q1.D — 옵션 D (카피만, ADR 없이 보류)

### Q2 — fetcher 매핑 PR 트랙 분리 잠금

본 ADR D5 = "schema/enum/UI/i18n + 0 데이터 정직 표시" 가 4.14 PR. fetcher
매핑은 별 PR (PLAN 1.5.8 Amendment 또는 신규 1.5.10).

운영자 응답 형식:
- **Q2.A — 별 PR 분리** (architect 추천, 4.14 사이즈 ≤ 2.5일 정합)
- Q2.B — 4.14 안에 fetcher 매핑까지 (사이즈 ≈ 4~5일, 운영자 cap 초과 위험)

### Q3 — 마이그레이션 시점

운영자 응답 형식:
- **Q3.A — ADR Accepted 직후, 다음 라운드 (architect 추천)**
- Q3.B — PR 머지 후 운영자 다음 사이클
- Q3.C — 4.14 fetcher 매핑 트랙 머지 후 일괄

## 영향 (다른 PLAN/ADR 항목)

- **PLAN 4.14** (본 ADR 동반 신설): schema/enum/UI/i18n + 0 데이터 정직
  표시. 합계 93 → 94, 페이즈 4: 13 → 14.
- **PLAN 1.5.8** (Orange BE fetcher): Love Duo + Love Trio + Mobile 매핑
  추가 — 별 PR Amendment 트랙.
- **ADR-0005** §T6 **Amendment 2** (본 ADR 동반): enum 3 → 5. 본 ADR 의
  D1/D6 정합. ADR-0005 §Amendment 1 enum 값 제거 정책 → 본 Amendment 2 는
  **ADD only** (제거 0) 라 절차 단순화.
- **ADR-0041** D5 (Hero CategoryGrid): `md:grid-cols-3 lg:grid-cols-5`
  갱신. ADR-0041 Amd 1 D7.1 (`/compare` `md:grid-cols-3`) 동시 갱신 →
  ADR-0041 **Amendment 5** 동반 (별 PR 또는 4.14 흡수).
- **ADR-0011** §T2 (정직 안내): bundle\_\* 0 데이터 카테고리 caveats 활성.
  ADR-0029 §T2 정직성 토큰 (DEPRECATED but 카피 보존) 정합.
- **ADR-0016** §T1 (5단계 5분 골격): 본 ADR 카테고리 5개 = 카테고리 선택
  단계 (헌법 P2 5단계 골격 유지, 5단계 → 4단계 = ADR-0041 Amd 2 D9 정합).
- **ADR-0034** D2 (통신 BE 만): 본 ADR 5 카테고리 모두 통신 BE 내. 외
  카테고리 진입 0 → ADR-0034 D2 정합.
- **ADR-0039** D1 (production 마이그레이션 절차): 본 ADR D6 = 운영자
  인라인 `db:push` 절차 정합.
- **`src/types/tariff-attributes.ts`**: `included_services` Zod 키 신설
  (옵션 D2). `mobile|internet|tv|landline: boolean` 4 필드 nullable.
- **`/data-sources` 페이지** (PLAN 1.10): bundle\_\* 0 데이터 카테고리
  자동 "비교 후보 0건" 표시 (ADR-0011 §T2 동형, 특수 분기 0).
- **PLAN 5.5** (재사용 가능 컴포넌트, 통신 깊이 한정): CategoryGrid 5
  카드로 격상.

## 검증 방법

### V1 — typecheck / lint / test:run 0 에러

- `pnpm typecheck` — `TARIFF_CATEGORIES` 5값 + `tariff_category` enum +
  exhaustive switch (usage-estimator + caveat-triggers + ComparisonTable +
  CalculationDetails + page.tsx 26 파일 분기 — Grep `bundle_internet_tv`
  결과 영향 표면 확정).
- `pnpm lint` — 0 에러.
- `pnpm test:run` — 5값 enum 단위 테스트 (`comparison-input.test.ts`
  +2 케이스 / `tariff-attributes.test.ts` included_services Zod 검증 +).

### V2 — harness:plan / harness:data 통과

- `harness:plan` — 4.14 신규 항목 등재 + 합계 93 → 94 + 페이즈 4 13 → 14
  정합.
- `harness:data` — bundle\_\* 0 데이터 카테고리 caveat 등록 ("실 데이터
  수집 중" — ADR-0011 §T2 패턴).

### V3 — 마이그레이션 SQL 시각 검토

verifier 시각 검토 (운영자 별 트랙) — `drizzle/0008_*.sql` 이 (a) `ALTER
TYPE tariff_category ADD VALUE 'bundle_mobile_internet'` (b) `ALTER TYPE
... ADD VALUE 'bundle_mobile_internet_tv'` 2회 만으로 끝나는지 (재생성
패턴 아닌지). 재생성 패턴이면 `tariff.category` + `comparison_request.category`
동시 ALTER + old type DROP 순서 + idempotent.

### V4 — 운영자 자가 검증 (slim.lu prod)

- hero 카드 5개 (mobile / internet_fixed / bundle_mobile_internet /
  bundle_internet_tv / bundle_mobile_internet_tv) 렌더, 라벨 i18n 정합.
- bundle\_\* 3 카테고리 클릭 → `/compare/{category}` 진입 → "현재 비교
  후보 0건 — 페이즈 5 이후 격상" 정직 표시 (ADR-0011 §T2 패턴).
- 운영자 신호 봉합: "모바일 + 인터넷 상품도 있어" → ✅ 봉합 (hero 카드
  `bundle_mobile_internet` 슬롯 존재).

### V5 — fetcher 별 PR 트랙 (D5)

- Orange BE Love Duo 정찰 → `bundle_mobile_internet` 실 데이터 ≥ 1행 (4.14
  PR 머지 후 별 PR).
- Proximus Flex+ Internet Go/Mega/Giga/Ultra 정찰 → `bundle_mobile_internet_tv`
  실 데이터 ≥ 4행.
- 위 PR 머지 후 운영자 자가 검증: hero 카드 예시 가격이 placeholder →
  실데이터로 격상 (ADR-0029 §T2 정직성 토큰 해제, ADR-0041 V5 conversion
  신호 cross-ref).

## 다음 단계

1. **운영자 Q1~Q3 잠금** (architect 추천 디폴트 = Q1.B + Q2.A + Q3.A).
2. **ADR Accepted 격상** (운영자 직접 결정).
3. **ADR-0005 §Amendment 2 동반 작성** (scribe — 본 ADR D1/D6 정합).
4. **PLAN 4.14 [~] 진행 마킹 + 합계 갱신** (architect 본 라운드 — 본 PR).
5. **builder 호출 — 4.14.a~e 구현** (별 라운드).
6. **fetcher 매핑 별 PR 트랙** (PLAN 1.5.8 Amendment 또는 1.5.10 신설).

## References

- 헌법: [`CLAUDE.md`](../../CLAUDE.md) — P1 (정보 우선), P2 (쉽고 빠르게,
  5단계/5분), P3 (투명성), P4 (타입 안전), §8 #4 (광고-비교 분리)
- 운영자: [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, €300/월 cap
- 관련 ADR:
  - [ADR-0005](0005-tariff-schema-telecom.md) — `tariff` 스키마 (본 ADR
    Amendment 2 동반 신설)
  - [ADR-0011](0011-data-sources-page-and-caveats-boundary.md) §T2 — 정직
    안내 패턴 (bundle\_\* 0 데이터 카테고리)
  - [ADR-0013](0013-fetcher-real-scraping-risk-assessment.md) — fetcher
    공식 페이지 SoT 우선 정책
  - [ADR-0016](0016-phase-2-input-flow-design.md) §T1 — 5단계 5분 골격
  - [ADR-0029](0029-beta-recruitment.md) §T2 (DEPRECATED) — 정직성 토큰
  - [ADR-0033](0033-i18n-next-intl-introduction.md) §T2 — 5 locale 콘텐츠
  - [ADR-0034](0034-strategy-pivot-completion-first-seo-launch.md) D2 —
    통신 BE 만 + Amendment 1 D4 — 3 fetcher
  - [ADR-0039](0039-production-migration-application-procedure.md) D1 —
    인라인 `db:push` 절차
  - [ADR-0040](0040-legal-namespace-deepl-hybrid-and-interstitial-boundary.md)
    §T3 — DeepL + 수동 hybrid (compare.* 일반 트랙)
  - [ADR-0041](0041-home-hero-redesign.md) D5 — Hero CategoryGrid (5 카드
    재설계 Amendment 5 동반)
- 외부 사실 — 베네룩스 통신 BE 시장 (2026-06-07 WebSearch + WebFetch):
  - [Proximus Flex+ — Internet, TV, mobile and landline](https://www.proximus.be/en/id_cr_all_flex_packs/personal/packs/cr-all-flex-packs.html) —
    Internet Go/Mega Fiber/Giga Fiber/Ultra Fiber 4 packs (mobile+internet+TV
    triple), Internet+Mobile dual, Internet+TV dual 각각 존재
  - [Proximus Tuttimus 가격 인상 보도 2026-01](https://itdaily.com/news/business/proximus-raises-prices-older-subscriptions/) —
    레거시 정리, Flex+ 가 주력
  - [Telenet 신규 가입 ONE/ONE up 단종 2026-04-28](https://itdaily.com/news/network/telenet-stel-je-eigen-bundel-samen/) +
    [test-achats.be 분석](https://www.test-achats.be/hightech/telecom/news/augmentation-des-tarifs-de-telenet) —
    2026-05-15 신규 가입 차단, "build your own bundle" 모듈식 전환
  - [Telenet 모듈식 신상품 보도 broadbandtvnews 2026-04-28](https://www.broadbandtvnews.com/2026/04/28/telenet-launches-more-personalised-telecom-and-entertainment-offer/) —
    1 Gbps internet + unlimited mobile data while traveling
  - [Orange Belgium Love Duo 런칭 — 2019-07-18](https://corporate.orange.be/en/news-medias/orange-belgium-launches-love-duo-mobile-and-fixed-internet-pack-intended-cord-cutters) —
    mobile+internet 듀얼, cord-cutter 명시, €42~64/월
  - [Orange Belgium Internet+TV+Mobiel 카탈로그 NL](https://www.orange.be/nl/producten-en-diensten/internet-tv-mobiel) —
    Love Duo / Love Trio 모두 제공, 현행
  - [Orange Belgium Love Trio + Mobile 가격 — tv-internet-abonnement.be](https://www.tv-internet-abonnement.be/pack-operatoren/orange-belgie) —
    Love Trio Mobile Small €81/월 (제3자 카탈로그)
  - [Telenet ONE up subvariant — abonnement-tv-internet.be](https://www.abonnement-tv-internet.be/operateurs-pack/telenet/one-up) —
    제3자 카탈로그 (공식 페이지 SoT 우선)
- PostgreSQL: [ALTER TYPE ADD VALUE](https://www.postgresql.org/docs/16/sql-altertype.html)
- 운영 부채 메모리: `project_provider_seed_required.md`,
  `project_fetcher_prod_ip.md`, `reference_fetcher_recon_method.md`
