# ADR-0011: `/data-sources` 투명성 페이지 + caveats 함수/UI 경계

## Status

**Accepted (2026-05-09)** — GATE-A 운영자 승인 완료. 추가 디자인 결정:
"비교 사용 횟수: 0" 단독 표시 대신 **"0회 — 런칭 초기 (2026년 5월~)"**
부가 텍스트로 *버려진 사이트* 인상 회피 (§결정 2 항목 5 갱신). 카운터 자연
증가 시 부가 텍스트는 페이즈 3 결정으로 진화 ("최근 30일 N회" 등 후보).

## Context

### 본 ADR이 다루는 두 항목

- **PLAN 1.10** — `/data-sources` 투명성 페이지. P3 (투명성은 운영자의 짐)을
  사용자 노출 차원에서 처음 강제하는 라우트. 헌법 §3 P3: *"비교에서 제외된
  공급사도 이름을 밝힌다"* 의 단일 출처.
- **PLAN 1.13** — caveats 메커니즘. ADR-0010 §T6 `deriveCaveats()` 순수 함수가
  이미 `src/engine/caveats.ts` 에 구현됨 (8 규칙). *함수 차원* 은 1.11 ADR-0010
  산출물이 흡수.

### 본 ADR이 해결하는 모호함

1. **1.13의 완료 정의가 PLAN 본문상 모호**:
   PLAN 1.13 본문은 *"함수 차원 완료 + 사용자 노출은 페이즈 3.5 결정"* 으로
   이미 분기되어 있으나, [x] 마킹 가능 여부의 형식 근거가 없다 → 본 ADR §결정 1
   이 그 근거를 *명시 기록*.
2. **1.10에 무엇을 표시하는가의 폭이 결정되지 않음**:
   PLAN 1.10 본문은 "공급사 + 마지막 수집 시각 + 수집 방법 + 제외 공급사 섹션"
   까지만 명시. 어필리에이트 가능 여부 노출, 비교 사용 횟수, caveats 미리보기는
   *운영자 의도*에 따라 추가 결정 필요 → 본 ADR §결정 2 가 6개 항목으로 못
   박는다.
3. **caveats UI를 어디에 배치할지의 결정 시점**:
   결과 페이지 (3.1 결론 카드 / 3.2 비교 표 / 3.5 계산 근거 펼치기) 어디에
   둘지는 페이즈 3 진입 시점의 베타 사용자 피드백에 따라 결정. 본 ADR §결정 3
   이 *경계*를 명시 — 페이즈 1 = 함수 + 미리보기, 페이즈 3 = 결과 노출.

### 본 ADR이 직접 받는 의존성

- **헌법 §3 P3** — 투명성 운영자의 짐 (페이지 디자인 정책)
- **헌법 §8 #3** — 다크 패턴 금지 (1.10에 "X명이 보고 있어요" 류 0)
- **ADR-0001** — `provider.affiliateStatus` enum 6값 + `excluded_reason` text
  (1.10 표시 컬럼)
- **ADR-0008** §T5 — `FetcherMetadata` 모양 + `src/fetchers/index.ts` registry
  (1.10 데이터 출처)
- **ADR-0009** §결정 4 — `/data-sources` 제외 공급사 섹션에 Orange BE +
  "페이즈 5에서 평가 후 추가 예정" CTA 명시 (베타 신호 측정)
- **ADR-0010** §T6 — `deriveCaveats()` 순수 함수 (1.10 미리보기 + 1.13 함수
  차원)

### 본 ADR이 여는 후속

- **PLAN 1.13** [x] 마킹 (verifier 책임, GATE-A 후)
- **PLAN 1.10** 구현 (builder 책임, GATE-A 후)
- **페이즈 3.1/3.2/3.5** caveats UI 배치 ADR (페이즈 3 진입 시 신설 — 본 ADR이
  아닌 별도 ADR)

### 운영자 컨텍스트 (`docs/FOUNDER.md`)

- 솔로 사이드, 주 10-20시간, 월 €300 ALL-IN
- 개발 3개월 (학습자 모드) — 정보 밀도 우선 디자인이 디버깅 용이
- TVA 대기 중, 베타 모집 미시작 → 페이즈 1 i18n은 한국어 단일 (운영자 모국어)
  로 시작, 페이즈 2 진입 시 nl-BE/fr-BE/en 일괄 도입

## Decision

T1~T6 6개 결정.

### T1 — PLAN 1.13은 *함수 차원* 완료로 [x] 마킹 가능

PLAN 1.13의 완료 정의를 다음으로 *분리* 한다:

| 차원 | 위치 | 페이즈 |
|---|---|---|
| 함수 (caveats 자동 생성) | `src/engine/caveats.ts` `deriveCaveats()` | **페이즈 1 — 완료 (ADR-0010 §T6)** |
| UI (사용자 노출) | 결과 페이지 3.1/3.2/3.5 어딘가 | **페이즈 3 — 별도 ADR** |

**근거:**
- ADR-0010 §T6 가 이미 8 규칙 매트릭스 + `deriveCaveats(input): string[]` 순수
  함수로 *생성 책임*을 닫음. 단위 테스트 1.12에 6 케이스 caveats 검증 포함.
- *사용자 노출 위치* 는 베타 사용자 피드백 (M11) + 결과 페이지 전체 정보 위계
  (3.1 결론 → 3.2 표 → 3.5 펼치기) 와 함께 결정해야 하므로 페이즈 3 진입 시점
  까지 미루는 것이 정직.
- 1.13을 [ ] 유지 시 페이즈 1 종료 게이트 (`pnpm harness:plan` 79 항목 중 페이즈
  1 13 항목 모두 [x]) 가 페이즈 3까지 막힘 → 페이즈 1.5 운영 부채 정리 + 페이즈
  2 입력 플로우 진입 차단. 함수와 UI 분리 명시가 더 정직.
- 운영자가 본 ADR 한 곳에서 "왜 1.13이 [x] 인가" 를 6개월 후에도 추적 가능 (P5).

**[x] 마킹 시 verifier 작업:**
- `PLAN.md` §1.13 본문에 "함수 차원 완료" 한 줄 + ADR-0011 §T1 인용
- `작업 추적 메타` 표 페이즈 1 완료 카운트 11 → 12 (1.13만 +1)

### T2 — `/data-sources` 표시 항목 6개 (운영자 명시)

페이지 본문에 다음 6개를 표시. **추가/제거는 GATE-B (별도 운영자 결정 + 본
ADR Amendment)**.

#### 항목 1 — 공급사 정체성 + 국가 + 슬러그

표시: `provider.name` + `provider.country` (BE/NL/LU 배지) + `provider.slug`
(URL 라우트 호환).

근거:
- ADR-0001 §1 컬럼: `name`, `country` enum, `slug` UNIQUE
- 사용자가 *어떤 공급사를 비교 대상에 포함했는지* 한 줄로 식별

#### 항목 2 — 마지막 fetch 시각 (`fetched_at`)

표시: 공급사별 가장 최신 `tariff_snapshot.fetched_at` 의 *최댓값* (DISTINCT
ON `(tariff_id, fetched_at DESC)` 후 `max(fetched_at)` per provider).

근거:
- ADR-0006 §T7 인덱스 `(tariff_id, fetched_at DESC)` 가 이 쿼리의 hot path
- 헌법 §3 P3: *"23시간 전 기준"* 류 표시의 단일 출처
- `<StaleLabel>` 컴포넌트 재사용 (페이즈 0.3 토큰 + 페이즈 3.3 입력)

#### 항목 3 — fetch 방법 (`api`/`scraping`/`stub`)

표시: `FetcherMetadata.method` (ADR-0008 §T5 — registry).

| 값 | 표시 라벨 | 페이즈 1 케이스 |
|---|---|---|
| `api` | 공식 API | (현재 0) |
| `scraping` | 셀렉터 스크래핑 | 1.5.6 후 Proximus + Telenet |
| `manual` | 수동 입력 | (운영자 입력 케이스, 현재 0) |
| `stub` | 스텁 (개발 중) | **현재 페이즈 1 — Proximus + Telenet** |

**`stub` 라벨 추가 결정** (ADR-0008 `FetcherMetadata.method` 의 enum 확장):
- 페이즈 1.8이 ADR-0009 옵션 A로 스텁 fetcher 채택. 사용자에게 *현재 데이터가
  스텁임* 을 정직하게 노출.
- `confidence='low'` + `stub` 라벨 동시 표시 → P1 정직성 유지.
- 1.5.6 실 스크래핑 전환 시 `stub` → `scraping` 으로 단일 라벨 변경.
- **Builder 작업**: `src/fetchers/types.ts` `FetcherMetadata.method` 의 union에
  `'stub'` 추가 (ADR-0008 §T5 변경 — Amendment 1 트리거). *본 ADR 이 그 변경의
  형식 근거*.

#### 항목 4 — 어필리에이트 가능 여부 + 순위 무영향 텍스트

표시:
- `provider.affiliateStatus` enum 6값을 사용자 친화 라벨로 매핑:
  - `none` → "어필리에이트 없음"
  - `pending` → "협상 중"
  - `active_b2b_intra_eu` / `active_b2b_domestic_be` → "어필리에이트 활성"
  - `paused` → "일시 중단"
  - `terminated` → "종료"
- **별도 강조 텍스트** (모든 행 하단 또는 페이지 헤더 한 번):
  > "어필리에이트 여부는 결과 순위에 영향을 주지 않습니다 — 알고리즘은 절약액
  > 순입니다. 자세한 내용은 [`/legal/affiliate-disclosure`](/legal/affiliate-disclosure)."

근거:
- 헌법 §3 P3: 단가까지 공개 (`/legal/affiliate-disclosure` 는 페이즈 6.9에서
  정식)
- MONETIZATION.md §A 윤리 가드레일 #1: *"순위 무영향: 알고리즘 = 절약액 DESC.
  제휴/비제휴는 정렬에 들어가지 않는다."*
- 다크 패턴 금지 (헌법 §8 #3): "어필리에이트 활성" 라벨을 *눈에 띄게* 만들지
  않음. 단순 텍스트 + 동일 색상.

#### 항목 5 — 비교 사용 횟수 (`getComparisonStats`)

표시: 공급사별 `comparison_result_item` 등장 횟수 (해당 공급사의 tariff
snapshot이 결과에 포함된 건수).

**페이즈 1 시점 정책 (SC-1 옵션 — Scope Cut 1, GATE-A 운영자 승인 갱신)**:
- 페이즈 1 진입 시 `comparison_result` 행이 0건 → 모든 카운트 0 표시
- 표시 형식: **"0회 — 런칭 초기 (2026년 5월~)"** (운영자 명시 — *버려진 사이트*
  인상 회피 + 정직성 유지). 카운터 1+ 도달 시 부가 텍스트 제거 또는
  "최근 30일 N회" 같은 형태로 진화 — 페이즈 3에서 결정.
- 페이지 헤더에 *"비교 데이터는 베타 (페이즈 4) 시작 후 누적됩니다."* 단일 문구
- 헬퍼 함수 `getComparisonStats(category)` 신설 — 페이즈 4 진입 시 자동 갱신
- `comparison_result_item.tariff_snapshot_id` (ADR-0007 §T6) → `tariff_snapshot.tariff_id`
  → `tariff.provider_id` 의 3단 join

근거:
- 페이즈 1 시점 0 카운트 노출이 *거짓 정보가 아닌 정직한 0* — P1 정합
- 페이즈 4 베타 시작 시 자동으로 카운트 증가 → 운영자 추가 작업 0
- helper 함수 분리는 페이즈 6.1 어드민 대시보드 (4.5.1 v0)와 *동일 데이터
  소스* 재사용 가능

**거부된 대안 — 페이즈 4까지 항목 5 노출 X**:
- 장점: 페이즈 1 코드 -1 helper.
- 단점: 1.10 페이지 *형식*이 페이즈 4에서 변경됨 → 베타 직전 UI 회귀 위험.
- 거부 사유: 정직한 0 노출이 회귀 위험보다 안전.

#### 항목 6 — 최근 1.13 caveats 샘플 (미리보기)

표시: 카테고리별 (mobile / internet_fixed / bundle_internet_tv / landline) 의
*예시 caveats* 5건 미만.

생성 방법:
- 페이즈 1 시점 = `deriveCaveats()` 를 *고정 입력*으로 호출하여 *대표 caveats
  텍스트* 를 미리보기로 노출
- 고정 입력 = 베타 모집 카피 ("≥ 75% 점유 2개 공급사 깊이") 정합 시나리오
  - mobile: 평균 커플 (1.12 케이스 1) → "12개월 약정", "활성화 비용 €X 별도"
  - internet_fixed: VDSL→케이블 (1.12 케이스 4) → "24개월 약정", "프로모 첫
    3개월"
- 페이즈 4 진입 시 = 실제 결과의 *최빈 caveats* 5건 자동 산출 (별도 결정,
  본 ADR 영향 X)

**파일 결정** (builder 자유도):
- 옵션 A: `src/engine/caveats-preview.ts` 신설 — 고정 입력 + 호출 결과 export
- 옵션 B: `src/app/data-sources/page.tsx` 인라인 — 1.10 페이지가 단일 진입점

builder 가 옵션 A/B 중 디버깅 용이성 기준 선택. **본 ADR은 강제 X**.

근거:
- 1.13 함수가 *추상*이 아니라 *실 텍스트* 임을 사용자에게 미리 노출
- "결과에 어떤 주의사항이 붙는지" 가 데이터 출처 페이지에 보이는 일관성
- 페이즈 3 결과 페이지 진입 시 caveats UI 배치 결정의 *시각적 입력*

### T3 — 페이즈 3 caveats UI 배치는 본 ADR 외부 결정

결과 페이지 (3.1 결론 카드 / 3.2 비교 표 / 3.5 계산 근거 펼치기) 어디에 caveats
를 노출할지는 **페이즈 3 진입 시점에 별도 ADR**.

페이즈 1과 페이즈 3 사이의 *경계*:

| 차원 | 페이즈 | 본 ADR 책임 |
|---|---|---|
| 함수 생성 (`deriveCaveats`) | 페이즈 1 (ADR-0010 §T6) | ✅ 인용 |
| 미리보기 (1.10 §결정 2 항목 6) | 페이즈 1 (본 ADR §T2) | ✅ 결정 |
| 결과 페이지 노출 | 페이즈 3 | ❌ 외부 ADR |

**근거:**
- 페이즈 3 진입 시 베타 사용자 피드백 (M11 = 페이즈 4 베타 종료 시점) 반영 가능
- 결과 페이지 정보 위계 (결론 → 근거 → 원본) 와 함께 결정해야 일관
- 본 ADR이 페이즈 3까지 결정을 *예약* 하면 *결정 부채 누적* — 의도적 분리

### T4 — 디자인 정책 = 정보 밀도 우선

페이지 디자인은 다음 원칙을 따른다:

1. **정보 밀도 우선** (디자인보다 데이터 가독성)
2. **shadcn/ui `<Table>` + `<Card>` 최소 스타일** (페이즈 0.3 토큰 재사용)
3. **접근성 강제**:
   - 키보드만으로 모든 행/링크 탐색 가능
   - axe-core 0 violations (페이즈 3.5.1 자동화 전이지만 본 페이지는 *수동
     검증* — builder DoD에 포함)
   - 색상 대비 WCAG AA 충족 (페이즈 0.3 토큰이 이미 충족)
4. **다크 패턴 0건** (헌법 §8 #3):
   - "X명이 보고 있어요" / "오늘만 할인" 류 0
   - "어필리에이트 활성" 라벨 시각적 강조 X (단순 텍스트)
5. **새 의존성 추가 X** (GATE-C):
   - Recharts / Chart.js / date-fns / dayjs 등 거부
   - 시간 표시는 `Intl.DateTimeFormat` 직접 사용 (`<StaleLabel>` 단일 진입점)
   - 페이즈 6 어드민 대시보드 진입 시 차트 라이브러리 도입 검토 (별도 ADR)

**근거:**
- 운영자 솔로 디버깅: 의존성 추가 = 학습 곡선 + 보안 패치 부담 (월 €300 cap)
- 헌법 §3 P3: *데이터로 보여준다, 디자인으로 말하지 않는다*
- shadcn/ui 는 페이즈 0.3에서 이미 채택 — 신규 추가 0

### T5 — i18n 정책 = 페이즈 1 한국어 단일 (SC-3)

페이지 텍스트는 페이즈 1 시점 **한국어 단일** (운영자 모국어).

| 페이즈 | i18n 정책 | 근거 |
|---|---|---|
| **페이즈 1 (본 ADR)** | 한국어 단일 (인라인 또는 `messages/ko.json`) | next-intl 미도입, 운영자 디버깅 우선 |
| **페이즈 2** | nl-BE / fr-BE / en 일괄 도입 | PLAN 2 진입 시 별도 결정 |
| **페이즈 4 베타** | 베타 모집 채널 (Korean Society BE/NL/LU) 고려 한국어 + nl-BE | PLAN 4.6 베타 카피 정합 |

**근거:**
- ADR-0010 §T6 caveats 텍스트도 페이즈 1 한국어 단일 (deriveCaveats 본문 nl-BE
  텍스트가 *주석 인용*에는 있으나 실제 출력은 한국어 — 코드 확인 결과 한국어로
  구현됨)
- 페이즈 2 진입 시 일괄 변환 (자동화 가능) — 빈 키 file 만 만들면 솔로 디버깅
  부담만 추가
- 운영자 자가 베타 (개인 테스트) 단계는 한국어가 가장 빠른 검증

**거부된 대안 — 페이즈 1부터 nl-BE/fr-BE 추가**:
- 장점: 베타 진입 시 i18n 회귀 위험 0.
- 단점: 인프라 부재 (next-intl 미도입) + 운영자 솔로 사이드 시간 압박. 텍스트
  3개 언어 × 검증 = 시간 비용 큼.
- 거부 사유: 페이즈 2 일괄 도입이 *효율 + 일관성* 모두 우선.

### T6 — 라우트 + 파일 구조

페이지 라우트 + 파일 책임:

```
src/app/data-sources/page.tsx       # App Router (RSC), 본 페이지 단일 진입점
src/engine/comparison-stats.ts      # getComparisonStats(category) helper (신설)
src/engine/caveats-preview.ts       # caveats 미리보기 (옵션, builder 자유도)
                                    # 또는 page.tsx 인라인 (옵션 B)
```

**렌더링 정책 = RSC (React Server Component)**:
- DB 쿼리 (`tariff_snapshot.fetched_at` 최댓값, `comparison_result_item` 카운트)
  를 클라이언트로 보내지 않음
- ISR (`revalidate: 3600` 1시간) — fetcher cron이 일 1회 06:00 UTC (ADR-0008
  §T6) 이므로 1시간 ISR이 충분
- 정적 빌드 시점 = 운영 환경에서는 빌드 후 ISR 캐시 무효화

**파일 신설 시 의존성**:
- `src/engine/comparison-stats.ts` — `comparison_result_item` ↔ `tariff_snapshot`
  ↔ `tariff` ↔ `provider` 4테이블 join (Drizzle, 페이즈 1 시점 0 row 안전 처리)
- `src/engine/caveats-preview.ts` — `deriveCaveats()` 호출 + 고정 입력 (옵션 A
  채택 시)

**근거:**
- App Router RSC = SSR + 캐시 양립 (페이즈 0.2 채택 결정)
- helper `src/engine/` 위치 = 페이즈 6.1 어드민 대시보드 데이터 소스 재사용
- 새 의존성 0건 (GATE-C 통과)

## Alternatives considered

### 거부된 대안 1 — PLAN 1.13을 [ ] 유지 (페이즈 3까지 미마킹)

- **장점**: 페이즈 3에서 caveats UI까지 일괄 마감 → 1.13의 "사용자 노출" 의미가
  명확.
- **단점**:
  - 페이즈 1 종료 게이트 (`pnpm harness:plan` 페이즈 1 13 [x]) 가 페이즈 3까지
    차단 → 페이즈 1.5 / 페이즈 2 진입 *형식적으로* 막힘
  - 함수 차원의 *실제 완료* 와 PLAN 본문의 *형식 미완료* 가 어긋남 → P5 결정
    추적성 손실
- **거부 사유**: 함수와 UI 의 분리 명시가 *정직* + 진행 가능성 둘 다 충족.

### 거부된 대안 2 — 1.10에 affiliate_status 비공개

- **장점**: 어필리에이트 협상 중인 공급사의 *경쟁 정보 노출* 우려 해소.
- **단점**: 헌법 §3 P3 정면 위반 — *"투명성은 운영자의 짐"* 의 핵심.
- **거부 사유**: 헌법은 협상 우려보다 우선. `affiliate_status='pending'` 의
  *"협상 중"* 라벨이 충분히 비-적대적.

### 거부된 대안 3 — 차트 라이브러리 추가 (Recharts 등)

- **장점**: 마지막 fetch 시각 분포 / 비교 사용 횟수 추이를 *시각화*.
- **단점**:
  - 새 의존성 + 솔로 학습 곡선 + 월 €300 cap 압박
  - 1.10 페이지의 *정보 밀도* 정책에 미관 위주 차트가 부합하지 않음
- **거부 사유**: GATE-C (새 의존성 추가 금지) 통과. 페이즈 6 어드민 대시보드
  진입 시 차트 도입 별도 결정.

### 거부된 대안 4 — 페이즈 1부터 nl-BE/fr-BE 추가

- **장점**: 베타 (페이즈 4) 진입 시 i18n 회귀 위험 0.
- **단점**:
  - next-intl 인프라 부재 → 페이즈 2 진입과 동시에 추가하는 것이 효율
  - 운영자 솔로 사이드 시간 압박 (주 10-20시간) — 3개 언어 × 텍스트 검증 = 시간
    sink
- **거부 사유**: SC-3 (페이즈 1 한국어 단일) 채택. 페이즈 2 일괄 도입.

## Consequences

### ✅ 얻는 것

- PLAN 1.13 [x] 마킹 가능 → 페이즈 1 종료 게이트 진행 가능 (1.10 빼고 12/13
  완료, 1.10 builder 후 13/13)
- 1.10 표시 항목 6개 명시 → builder 가 *추가 의사결정 없이* 구현 가능
- caveats 함수/UI 경계 명시 → 페이즈 3 진입 시 별도 ADR 작성 시 본 ADR §T3
  인용으로 시작점 확보
- 새 의존성 0건 (GATE-C 통과) — 월 €300 cap 영향 0
- `FetcherMetadata.method` `'stub'` 추가 = ADR-0008 Amendment 1 트리거 (별도
  Amendment 작성 없이 본 ADR §T2 항목 3 인용으로 형식 충족)

### ⚠️ 잃는 것 / 부채

- **1.10 페이지의 비교 사용 횟수가 페이즈 1 시점 0** — 페이지의 *정보 가치*가
  베타 시작 (페이즈 4) 까지 부분 결손. 단, 정직한 0 + 헤더 단일 문구로 완화.
- **caveats 미리보기 고정 입력** = 실 결과의 통계가 아님 (페이즈 1 시점). 페이즈
  4 진입 후 동적 산출로 교체 필요 (별도 작업, 본 ADR 외부).
- **`/data-sources` 와 `/legal/affiliate-disclosure` 의 책임 분리** = 페이즈 6.9
  까지 후자 미존재. 페이즈 1 시점 §T2 항목 4 의 링크는 *향후 페이지* 를 가리킴
  (404 일시적 — builder 가 placeholder 텍스트로 우회).
- **페이즈 3 caveats UI 결정 부채** — 본 ADR이 명시적으로 페이즈 3로 미룸. 페이즈
  3 진입 시점에 별도 ADR 신설 필요.

### 후속 작업 (다른 PLAN 항목과 연결)

- **GATE-A 통과 직후 (verifier 책임)**:
  - PLAN 1.13 본문에 "함수 차원 완료 (ADR-0011 §T1)" 한 줄 추가
  - PLAN 1.13 [x] 마킹
  - PLAN 작업 추적 메타 표 페이즈 1 완료 카운트 11 → 12
  - 본 ADR Status 행을 `Accepted` 로 격상
  - INDEX.md 의 ADR-0011 행 Status 갱신
- **GATE-A 통과 후 (builder 책임)**:
  - `src/app/data-sources/page.tsx` 신설
  - `src/engine/comparison-stats.ts` 신설
  - `src/engine/caveats-preview.ts` 신설 (옵션 A) 또는 page.tsx 인라인 (옵션 B)
  - `src/fetchers/types.ts` `FetcherMetadata.method` 의 union에 `'stub'` 추가
    (ADR-0008 Amendment 1 트리거)
  - 단위 테스트: `src/engine/comparison-stats.test.ts` (0 row 안전 처리)
  - 페이지 수동 axe-core 검증 (페이즈 3.5.1 자동화 전)
- **페이즈 3 진입 시점 (architect 책임)**:
  - caveats UI 배치 ADR 신설 (본 ADR §T3 인용)
- **페이즈 4 베타 시작 후**:
  - `getComparisonStats(category)` 가 자동으로 0 → 양수로 전환
  - caveats 미리보기 고정 입력 → 실 결과 최빈 caveats 동적 산출 검토 (별도 작업)
- **페이즈 6.9 진입 시**:
  - `/legal/affiliate-disclosure` 정식 페이지 → §T2 항목 4 링크가 작동
- **ADR-0008 Amendment 1**:
  - `FetcherMetadata.method` enum에 `'stub'` 추가 = 본 ADR §T2 항목 3 채택
    시점에 ADR-0008 본문 §T5 갱신

## 검증 방법

### 검증 1 — GATE-A (운영자 결정)

본 ADR 초안을 운영자(Kim Wonmin)가 검토하여 다음 6개 결정 모두 승인:
- T1 — 1.13 함수 차원 [x] 마킹
- T2 — 표시 항목 6개 (`stub` 라벨 추가 포함)
- T3 — 페이즈 3 caveats UI 외부 결정
- T4 — 디자인 정책 (정보 밀도 + 새 의존성 0)
- T5 — 페이즈 1 한국어 단일
- T6 — RSC + ISR 1h + helper 위치

GATE-A 통과 = 본 ADR Status `Proposed` → `Accepted` 격상.

### 검증 2 — GATE-B (1.10 표시 항목 변경)

§T2 6개 항목 외 추가/제거 시 본 ADR Amendment 작성 + 운영자 재승인. 페이즈 4
베타 종료 (M11) 시점에 *실 사용자 피드백* 으로 표시 항목 재평가 권장.

### 검증 3 — GATE-C (새 의존성 추가)

builder 가 `package.json` 에 새 의존성 추가 시 본 ADR §T4 #5 위반 → PR 차단.
예외: 운영자 직접 승인 + 본 ADR Amendment.

### 검증 4 — builder 종료 후 verifier 체크리스트

- `pnpm typecheck` 0 에러
- `pnpm lint` 0 에러
- `pnpm test` 0 실패 (`comparison-stats.test.ts` 포함)
- `pnpm dev` → http://localhost:3000/data-sources 에서 6개 항목 모두 렌더링 확인
- axe-core (수동) 0 violations
- `pnpm harness:plan` 페이즈 1 13 항목 [x] (1.10 + 1.13 모두)

### 검증 5 — 페이지 콘텐츠 정합성

- §T2 항목 1~6 모두 페이지에 존재
- 항목 4 의 "순위 무영향" 텍스트가 페이지 헤더 또는 푸터에 *눈에 띄는* 위치 (단,
  다크 패턴 0)
- ADR-0009 §결정 4 — 제외 공급사 섹션에 "Orange BE — 페이즈 5에서 평가 후 추가
  예정" + CTA 노출
- `provider.excludedReason IS NOT NULL` 인 모든 행이 표시됨 (헌법 §3 P3)

## 영향

### PLAN.md 갱신 (본 ADR 통과 후, verifier 책임)

- **§1.10**: 본문 변경 없음 (이미 표시 항목 명시). DoD 갱신 — "ADR-0011 §T2
  6개 항목 모두 렌더링 + 수동 axe-core 통과" 추가.
- **§1.13**: 본문에 "함수 차원 완료 (ADR-0011 §T1) — UI 노출은 페이즈 3 진입 시
  별도 ADR" 한 줄 추가. [x] 마킹.
- **§작업 추적 메타 표**: 페이즈 1 완료 카운트 11 → 12 (1.13 추가).

### 다른 ADR과의 관계

- **ADR-0001**: §1 컬럼 직접 사용 (`affiliateStatus`, `excludedReason`,
  `country`, `name`, `slug`). 본 ADR 영향 0.
- **ADR-0007**: §T6 `comparison_result_item.tariffSnapshotId` 직접 사용 (§T2
  항목 5 `getComparisonStats`). 본 ADR 영향 0.
- **ADR-0008**: §T5 `FetcherMetadata` 직접 사용 + `'stub'` 추가 = Amendment 1
  트리거. 본 ADR §T2 항목 3 이 그 변경의 형식 근거.
- **ADR-0009**: §결정 4 `/data-sources` 제외 섹션 정합 — 본 ADR §검증 5 이 강제.
- **ADR-0010**: §T6 `deriveCaveats()` 직접 사용 (§T2 항목 6 미리보기 + §T1 함수
  차원 인용). 본 ADR 영향 0.

### MONETIZATION.md 영향 — 가정 변동 없음

- §A 어필리에이트 단가 가정 / §A 윤리 가드레일 #1 (순위 무영향) 변동 없음.
- 본 ADR §T2 항목 4 가 `affiliate_status` 노출 정책을 *명시* — MONETIZATION.md
  §A "결과 카드 하단 단가까지 명시" 정신과 정합 (페이지 책임 분담: 1.10 = 노출
  여부, /legal/affiliate-disclosure = 단가).

### 외부 의존성 추가 — 0건

GATE-C 통과. 새 라이브러리 / 외부 SaaS 연동 없음.

## References

- 헌법: [`CLAUDE.md`](../../CLAUDE.md) — §3 P3 (투명성 운영자의 짐), §8 #3
  (다크 패턴 금지)
- 운영자: [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, 한국어 모국어
- 관련 ADR:
  - [ADR-0001](0001-provider-schema.md) §1, §2 — `affiliate_status` enum 6값,
    `excluded_reason` 텍스트
  - [ADR-0007](0007-comparison-request-result-schema.md) §T6 —
    `comparison_result_item.tariffSnapshotId`
  - [ADR-0008](0008-fetcher-interface-and-cron.md) §T5 — `FetcherMetadata`
    + registry. **Amendment 1 트리거** (§T2 항목 3 `'stub'` 추가)
  - [ADR-0009](0009-scope-cut-fetcher-2-providers.md) §결정 4 — `/data-sources`
    Orange BE CTA
  - [ADR-0010](0010-comparison-engine.md) §T6 — `deriveCaveats()` 8 규칙
- PLAN: [`PLAN.md`](../../PLAN.md) — §1.10, §1.13, §3 (페이즈 3 결과 페이지)
- MONETIZATION: [`MONETIZATION.md`](../../MONETIZATION.md) — §0, §A 윤리
  가드레일, §3 윤리 KPI
- 운영자 GATE 정의 (본 ADR 작성 컨텍스트):
  - GATE-A = 본 ADR 초안 운영자 승인 → Accepted
  - GATE-B = §T2 표시 항목 변경 운영자 재승인 → Amendment
  - GATE-C = 새 의존성 추가 운영자 승인 → Amendment
