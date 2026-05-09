# ADR-0010: 비교 엔진 (compare) — 절약액 계산 + caveats + 6 테스트 케이스

## Status

Proposed (2026-05-09) — PLAN 항목 **1.11** + **1.12** 동시 결정. **scope cut
옵션 B (12 → 6 케이스)** 동시 채택. verifier가
typecheck/lint/test/harness:plan/harness:data 통과 확인 후 Accepted로 격상한다.

## Context

- PLAN 항목 **1.11** (절약액 계산 로직 — `src/engine/compare.ts`) + **1.12**
  (단위 테스트 N 케이스). 1.11이 *함수 정의*라면 1.12는 *그 정의의 일부* —
  테스트가 없으면 함수가 정의되지 않은 것과 같다. 두 항목을 한 ADR에서 결정.
- 본 ADR이 **확정하는 의존성**:
  - **ADR-0005** §T2 (정수 cents) — 모든 산술이 cents
  - **ADR-0006** §T2 (평탄화 5컬럼) + §T5 (anomaly/low 자동 제외) +
    §T7 (DISTINCT ON 최신 스냅샷) — 비교 엔진 입력
  - **ADR-0007** §T6 (`comparison_result_item.caveats text[]`) +
    §T9 (`lockedInputs` JSONB) + `engineVersion text NOT NULL` —
    비교 엔진 출력 모양
  - **ADR-0008** §T1 (`TariffSnapshotInput`) — fetcher 입력과 매핑
  - **ADR-0009** — 2 fetcher × N tariff = ~7~10 후보 (Proximus 4 + Telenet 4)
- 본 ADR이 **여는 후속**:
  - **1.13** caveats 메커니즘은 본 ADR의 `deriveCaveats()` 순수 함수로 *생성*은
    완료. *사용자 노출* (결과 카드 / 비교 표) 은 페이즈 3.5에서 결정.
  - **1.10** `/data-sources` 페이지의 "이 카테고리는 N개 공급사만 비교됩니다"
    문구는 본 ADR의 `compare()` 결과 통계 (입력 candidates 수)를 메타로 사용.
- **운영자 컨텍스트** (`docs/FOUNDER.md`): 솔로 사이드, 개발 3개월, 학습자 모드.
  *왜 이런 산식인지* 코드 코멘트로 설명 — 6개월 후 운영자 본인이 디버깅 시
  ADR을 안 읽고도 함수 자체에서 의도를 읽을 수 있어야 함.
- **헌법 §8 #2**: "공급사가 보낸 가격을 가공하지 않는다 — 그대로 표시한다.
  절약액 계산만 한다." → 본 ADR의 *유일한 산술 책임*은 절약액 + 24개월 TCO
  파생값. 가격 자체는 변형하지 않는다.

### 외부 사실 (검증된 출처)

- **GDPR 합법근거 영향 없음** — 비교 엔진은 *순수 함수*. `lockedInputs` 봉인은
  ADR-0007 §T9에서 결정됨 (90일 후 NULL).
- **베네룩스 통신 프로모 패턴**: ADR-0005 §T4 — "처음 X개월 €Y 할인" 단일
  패턴이 99%. 본 ADR T3에서 이 사실 활용.
- **베네룩스 통신 약정 표준** (ADR-0005 §외부 사실):
  - Proximus: 0개월(non-binding) + 12/24개월
  - Telenet: 12개월 표준 (인터넷), 24개월 (번들)
  - 즉 24개월 amortize는 *시장 기본 약정 길이*에 정합 (T4 거부 대안 B)
- **Inngest free tier 영향 0** — 비교 엔진은 동기 + 5초 timeout (ADR-0007 §T10).

## Decision

T1~T7 7개 결정.

### T1 — 비교 단위 = 카테고리 동일 후보만 (옵션 A 채택)

`compare(input)` 의 candidates는 *동일 카테고리* tariff snapshot만. 카테고리
혼합 비교는 거부.

```ts
// 의사코드
const filtered = candidates.filter((c) => c.category === input.category);
```

**근거:**
- **헌법 P1 (정보 우선)**: 모바일 €15 vs 인터넷 €35는 "절약 €20"이 아니다 —
  서로 다른 *수요*. 카테고리 혼합 비교는 사용자에게 거짓 정보.
- **PLAN 2.1** 카테고리 선택이 5단계 입력의 *첫* 단계. 사용자가 명시적으로
  카테고리를 선택했으므로 비교 단위도 동일해야 일관.
- 페이즈 5.6 "교차 추천" (통신 절약했으니 에너지도?) 는 *비교*가 아니라 *추천*
  의 영역. 별도 함수 (`recommendNextCategory()`)로 페이즈 5에서 결정.
- 카테고리가 다른 candidates가 들어오면 *조용히 무시*하는 게 아니라 — 본 ADR은
  filter 후 메타로 카운트하여 caveat에 노출 ("3개 후보 중 2개가 다른 카테고리
  로 제외됨"). P3 투명성.

**거부된 대안 — 옵션 B (혼합 + caveat)**
- 장점: 후보가 부족할 때 비교 가능.
- 단점: 정보 무결성 손실. caveat을 사용자가 안 읽으면 거짓 절약액으로 클릭.
  P1 위반 위험 > 후보 부족 가치.

**거부된 대안 — 옵션 C (사용자가 카테고리 선택 → 그 카테고리만)**
- 사실상 옵션 A와 같음 — PLAN 2.1이 그 선택의 위치. 본 ADR은 옵션 A를 채택하되
  "selectionUI는 PLAN 2.1 책임" 으로 분리.

### T2 — 사용량 프로파일 = 추천성 매핑만, 가격 가공 X (옵션 단순 채택)

사용량 프로파일은 *추천성 점수* 또는 *caveat 트리거* 로만 사용. **요금제의
월정액에 사용량 기반 추가 비용을 더하지 않는다.**

**산식:**
- mobile: `data_gb_used > attributes.data_gb` (한도 초과) → caveat:
  "월 {used}GB 사용 → 본 요금제 {limit}GB 초과. 한도 초과 비용은 표시되지
  않습니다." monthlySaving 에는 영향 0.
- internet_fixed: `download_mbps_needed > attributes.download_mbps` → caveat:
  "본 요금제 {speed}Mbps. 4K 스트리밍 / {needed}Mbps 권장 시 부족할 수 있음."
- 모든 카테고리: `unlimited`로 표기된 attributes는 사용량 무관 caveat 0건.

**근거:**
- **헌법 §8 #2** — "공급사가 보낸 가격을 가공하지 않는다." 한도 초과 비용은
  공급사마다 산식이 다르고 (data top-up, throttle, blocked) 우리가 추정하면
  거짓 정보. 사용자에게 "초과는 직접 확인" caveat이 정직.
- **PLAN 2.5** 청구서 OCR은 페이즈 5로 cut (옵션 C). 페이즈 1~4 베타에서는
  정확한 사용량 데이터가 없으므로 *추정 비용을 더하면 거짓 정밀도*.
- **솔로 운영 디버깅**: 사용량 → 비용 매핑이 fetcher마다 다르면 1.5.6 실
  스크래핑 전환 시 *모든 매핑 재검증* 필요. 추천성으로 두면 사용자가 직접
  판단.

**거부된 대안 — 한도 초과 비용 추정 산식**
- 장점: 절약액 정밀도 ↑.
- 단점: 공급사 페이지에 명시되지 않은 "데이터 top-up €5/GB" 같은 변동값을
  추정하면 P1 위반. 페이즈 5 OCR 도입 후 실 청구서 데이터로 재논의.

### T3 — 프로모 가격 처리 = 첫해 + 24개월 둘 다 breakdown에 넣음 (옵션 C 채택)

한 비교 결과에 *두 시나리오*의 절약액을 동시에 보존.

**산식 (cents 정수, 모든 산술):**
```ts
// 12개월 평균 (첫 해)
const promoMonths = candidate.promoMonths ?? 0;
const promoCents = candidate.promoPriceCents ?? candidate.monthlyPriceCents;
const months12 = 12;
const total12Cents =
  promoCents * Math.min(promoMonths, months12) +
  candidate.monthlyPriceCents * Math.max(0, months12 - promoMonths) +
  candidate.activationFeeCents +                    // 1회성 — 첫 해 흡수
  (candidate.modemRentalCents ?? 0) * months12;
const monthlyAvg12Cents = Math.round(total12Cents / months12);

// 24개월 평균 (시장 표준 약정 — ADR-0005 외부 사실 Telenet 24개월 번들)
const months24 = 24;
const total24Cents =
  promoCents * Math.min(promoMonths, months24) +
  candidate.monthlyPriceCents * Math.max(0, months24 - promoMonths) +
  candidate.activationFeeCents +                    // 1회성 — 24개월 amortize
  (candidate.modemRentalCents ?? 0) * months24;
const monthlyAvg24Cents = Math.round(total24Cents / months24);
```

**저장 위치:**
- `monthlySavingCents` = `current.monthlyPriceCents - monthlyAvg12Cents` (1차
  표시 — 사용자가 첫 해 영향을 가장 직접 체감)
- `breakdown.monthlySaving12Cents` / `breakdown.monthlySaving24Cents` 둘 다
  ComparisonItem에 저장 → PLAN 3.5 "계산 근거 펼치기"에서 둘 다 노출 가능
- `yearlySavingCents` = `monthlySaving12Cents * 12` (소수 자리 0)

**근거:**
- **PLAN 3.5 "계산 근거 펼치기"** 가 두 시나리오를 모두 보여줘야 사용자가
  *프로모 함정* 인지 *진짜 저렴* 인지 자가 판단. P3 투명성 (운영자가 자기
  부담을 진다).
- 단일 시나리오 (12개월만 또는 24개월만) 는 한 쪽이 거짓이 됨:
  - 12개월만 = 24개월 약정 사용자에게 "첫 해 €X 절약" 만 보고 약정 후 후회
  - 24개월만 = 비약정(0개월) 후보의 첫 해 메리트가 평균에 묻힘
- 프로모 길이 (예: 6개월 €15 + 정상 €25) 가 12개월 안에 끝나는 것이 베네룩스
  표준 (ADR-0005 §T4) → 12개월 평균이 *프로모를 정확히 한 번* 반영하는 자연
  단위.
- **솔로 디버깅**: 두 시나리오 모두 breakdown에 있으면 6개월 후 운영자가
  "왜 이게 1위지?" 디버깅 시 둘 다 즉시 확인.

**거부된 대안 — 옵션 A (첫 12개월만)**
- 장점: 단순.
- 단점: 24개월 약정 candidate의 *진짜 비용*을 가림. 베네룩스 약정 24개월이
  TV 번들 표준이므로 정보 무결성 손실.

**거부된 대안 — 옵션 B (24개월 평균만)**
- 장점: 약정 시장 정합.
- 단점: 0개월 비약정 candidate의 첫 해 매력이 묻힘. 사용자가 12개월 후 변경
  계획이면 24개월 평균은 *과대평가*.

### T4 — 활성화 비용 + 모뎀 = 12개월 amortize에 흡수 (옵션 A 채택), 약정 위약금 = caveat

**산식 (T3 §총비용 계산식 안에 이미 포함):**
- 활성화 비용은 *1회성* — 12개월 평균 시 ÷12, 24개월 평균 시 ÷24 (자동 amortize)
- 모뎀 임대는 *월별* — × 12, × 24 (지속 비용)
- 약정 위약금 (`earlyTerminationFeeCents`) 은 산식에 더하지 않음 → caveat 으로만

**근거:**
- 활성화 비용 12개월 amortize 가 결과 카드(PLAN 3.1) 첫 표시 단위와 정합 —
  사용자가 보는 "월 €X 절약" 은 *첫 해 평균*.
- 24개월 amortize는 T3의 24개월 시나리오가 자동으로 처리.
- **약정 위약금 caveat 처리**: 사용자가 *현재* 약정 중인지를 우리가 모름
  (`comparison_request.input_attributes` 에 약정 여부 입력 없음 — PLAN 2.4
  현재 공급사는 선택적). 위약금을 산식에 넣으면 미약정 사용자에게 거짓 비용,
  약정 사용자에게 거짓 절약. 두 거짓을 피하는 유일한 길 = caveat.
- **헌법 §8 #2** 동일 — 위약금은 사용자 *상황* 의존. 가공 X.

**거부된 대안 — 옵션 B (24개월 amortize 단일)**
- 장점: 약정 시장 정합.
- 단점: 첫 해 표시값과 ÷24 amortize 단위 불일치. 결과 카드 (3.1) "월 €X 절약"
  의 단위가 모호.

**거부된 대안 — 옵션 C (별도 `switching_cost` 컬럼)**
- 장점: 위약금 + 활성화를 명시.
- 단점: ADR-0007 `comparison_result_item` 스키마 변경 → 본 ADR의 출력 책임을
  넘어서 마이그레이션 필요. YAGNI — caveat[]이 동등한 표현 가능.

### T5 — Confidence 전파 = `min(현재, 후보)` 보수적 (옵션 A 채택)

**산식:**
```ts
function combineConfidence(
  current: Confidence | null,
  candidate: Confidence,
): Confidence {
  // null = 신규 가입자 (currentTariff 없음) → candidate 신뢰도가 결정
  if (!current) return candidate;
  // min: high > medium > low
  const order = { high: 2, medium: 1, low: 0 } as const;
  return order[current] <= order[candidate] ? current : candidate;
}
```

**입력 단계 강제:**
- ADR-0006 §T5: `confidence='low'` OR `is_anomaly=true` 인 후보는 비교 엔진에
  *입력 단계에서 제외*. compare()의 첫 step에서 filter.
- 사용자 노출: "X개 후보 중 N개는 데이터 신뢰도 부족으로 제외됨" caveat.

**근거:**
- 보수적 floor — 한 입력의 신뢰도가 medium이면 결과도 medium 이상이 될 수 없음.
- 옵션 B (가격 차이 크기 + 입력 결합) 는 *공식이 모호*. 가격 차이가 크면
  high가 더 신뢰 가능한가? 솔로 운영자가 6개월 후 공식을 못 떠올림. YAGNI.
- 옵션 C (anomaly 1건이라도 있으면 결과 자체 제외) 는 *너무 보수적* — 후보 1
  개만 anomaly여도 비교 결과가 빈 페이지가 됨. ADR-0006 §T5는 *그 후보만*
  제외하는 의도였음.

**거부된 대안 — 옵션 B (가격 차이 + 신뢰도 결합)**
- 장점: 큰 절약일수록 높은 신뢰도 요구 — 직관적.
- 단점: 공식 모호. 신뢰도와 절약액을 결합하면 결과 페이지 표시가 두 의미 혼동.

**거부된 대안 — 옵션 C (anomaly 1건이라도 있으면 결과 제외)**
- 장점: 가장 안전.
- 단점: 후보가 5개인데 1개가 anomaly라고 비교 자체가 빈 결과면 사용자 가치 0.

### T6 — caveats 자동 생성 = `deriveCaveats(snapshot, profile, current?)` 순수 함수

본 ADR에서 deriveCaveats() 함수를 신설. compare() 내부에서 매 candidate에
대해 호출. 각 caveat은 i18n key 가 아닌 *nl-BE 단일 문자열* (페이즈 1~4 시점).
페이즈 2 i18n 도입 시 키화 — ADR Amendment.

**자동 caveat 생성 규칙 (페이즈 1, T6):**

| 조건 | caveat 텍스트 (nl-BE 우선) |
|---|---|
| `commitmentMonths >= 24` | "24개월 약정 — 조기 해지 시 위약금 발생" |
| `commitmentMonths >= 12 && commitmentMonths < 24` | "{N}개월 약정 — 조기 해지 시 위약금 발생" (N = commitmentMonths) |
| `activationFeeCents > 0` | "활성화 비용 €{X} 별도 (1회성)" (X = activationFeeCents/100) |
| `promoMonths != null && promoPriceCents != null && promoMonths < 12` | "프로모 가격은 첫 {M}개월만 — 이후 €{normal}/월" (M = promoMonths, normal = monthlyPriceCents/100) |
| `current != null && current.confidence !== 'high'` | "현재 요금제 데이터 신뢰도: {level}" (level = high/medium) |
| `candidate.confidence === 'medium'` | "비교 데이터 신뢰도: medium ({reason})" (reason = confidenceReason) |
| `category === 'mobile' && profile.data_gb_used > attributes.data_gb` (number 일 때) | "월 {used}GB 사용 → 본 요금제 {limit}GB 초과. 한도 초과 비용은 표시되지 않습니다." |
| `category === 'mobile' && !attributes.eu_roaming_included` | "EU 로밍 미포함" |
| `category === 'internet_fixed' && profile.streaming_4k && attributes.download_mbps < 100` | "4K 스트리밍에 권장 100 Mbps 미만 (본 요금제 {speed} Mbps)" |

**규칙 0 (필수 — 데이터 정직성):**
- candidate가 stub fetcher인 경우 (`rawPayload.stub === true`) — 별도 처리 X.
  T5의 confidence='low' 자동 제외가 이미 기능. (ADR-0009 페이즈 1 시점 모든
  fetcher가 stub → 베타 시점에 1.5.6 실 스크래핑 전환 필수.)

**근거:**
- caveat 텍스트가 *코드에 직접 박혀 있는* 것이 솔로 디버깅 용이. i18n 키화는
  페이즈 2 시점 기능 도입 시 일괄 변환 (자동화 가능).
- 모든 caveat 함수가 *순수* — 입력 동일하면 출력 동일 → 테스트 가능 (1.12
  케이스 검증의 일부).
- 1.13 PLAN 항목은 본 ADR로 *함수 차원 완료*. 사용자 노출 (결과 카드에 어떻게
  배치) 은 페이즈 3.5 결정.

**거부된 대안 — caveat 텍스트를 i18n 키로 페이즈 1부터**
- 장점: 페이즈 2 진입 시 자동.
- 단점: 페이즈 1에 i18n 인프라 (next-intl) 미도입. 빈 키 file → 솔로 디버깅
  부담. 페이즈 2 도입 시 일괄 변환 (하드코딩 → 키) 가 더 자연.

### T7 — 6 케이스 (옵션 B scope cut 적용)

**6 케이스 명세** (각 케이스는 1.12 단위 테스트의 1 expect 블록 + 운영자 가이드):

| # | 케이스 이름 (nl-BE / KR) | 입력 (currentTariff / profile / candidates) | 기대 동작 | 검증 |
|---|---|---|---|---|
| 1 | 평균 커플 모바일 (€25 → €15) | currentTariff: Proximus Smart 70 (€25) / profile: { data_gb_used: 30, voice_minutes_used: 100 } / candidates: [Proximus Essential €15, Telenet GO 10 €20] | rank 1 = Proximus Essential / monthlySaving12 = 1000 cents (€10/월) / yearly = 12000 cents | Smart 70은 currentTariff와 동일 슬러그 → candidates에서 자동 제외 (자기 비교 X) |
| 2 | 저사용 1인 모바일 (€15 → €15, 절약 0) | currentTariff: Proximus Essential (€15) / profile: { data_gb_used: 2 } / candidates: [Telenet GO 10 €20] | rank 1 = Essential 자체 / monthlySaving12 = 0 cents | "현재 요금제가 가장 저렴" caveat |
| 3 | 고사용 family 모바일 한도 초과 caveat | currentTariff: Telenet GO 10 (€20, 10GB) / profile: { data_gb_used: 50 } / candidates: [Proximus Smart 70 €25 (70GB), Proximus Unlimited €35] | rank 1 = Smart 70 / monthlySaving12 = -500 cents (실제론 €5 더 비쌈) / candidate Telenet GO 10에 caveat: "월 50GB 사용 → 10GB 초과" | 한도 초과 정보가 candidate가 아닌 currentTariff에 표시 (역방향 — 사용자 현재 상황 인식) |
| 4 | VDSL → 케이블 인터넷 전환 (€35 → €49 — 음의 절약) | currentTariff: Proximus Internet Essential (€35, 150 Mbps) / profile: { download_mbps_needed: 400, streaming_4k: true } / candidates: [Telenet ONE Internet €59 (400 Mbps, 12개월 약정 + 활성화 0 + 첫 3개월 €49)] | rank 1 = ONE Internet / monthlySaving12 < 0 (음의 절약) / yearlySaving12 ≈ -2400 cents (€24 더 비쌈) / caveats: ["12개월 약정", "프로모는 첫 3개월만 — 이후 €59/월"] | 음의 절약을 그대로 표시 — P3 투명성 (사용자가 속도 선택을 결정) |
| 5 | 약정 vs 비약정 비교 — 같은 €49도 다름 | currentTariff: null (신규) / profile: { download_mbps_needed: 100 } / candidates: [Telenet Essential Internet €49 (12개월 약정), Telenet ONE Internet €59 → €49 첫 3개월 (12개월 약정)] | rank 1 = Essential €49 (프로모 없음 = 첫 해 평균이 더 낮음) / monthlySaving12 (Essential) = 4900 cents (currentTariff null 이라 절약 = candidate.monthlyAvg12 음수 변환) — 실제 산식: currentTariff null 시 absolute monthlyCents 표기 / caveats: ["12개월 약정"] | currentTariff null 시 monthlySavingCents = -monthlyAvg12Cents (signed) — 신규 가입자 절약은 의미 없음, monthly cost 자체가 1차 표시 |
| 6 | 신규 가입자 (currentTariff null) 엣지 | currentTariff: null / profile: { household_type: 'single', data_gb_used: 5 } / candidates: [Proximus Essential €15, Telenet GO 10 €20] | rank 1 = Essential / monthlySavingCents = -1500 cents / caveat: "신규 가입자 — 현재 요금제가 없으므로 절약액 대신 월 비용 표시" | rank 결정은 monthlyAvg12Cents 오름차순 (signed saving 내림차순과 같음) |

**각 케이스의 expected 절약액 ±0.01€ 검증:**
- 모든 산술이 정수 cents → ±0 cent로 수렴. ±0.01€ DoD는 *수학적으로* 보장됨.
- 테스트 assertion: `expect(item.monthlySavingCents).toBe(EXPECTED_CENTS)` — strict equality.

**12 케이스 확장 조건:**
- 페이즈 1.5.6 실 스크래핑 전환 후 + 페이즈 4.6 베타 청구서 6개 추가 수집 시
  → ADR-0010 Amendment 1로 6 → 12 확장. 추가 6 케이스 후보:
  - (7) 모뎀 임대 €5/월 인터넷 (현재 €35 무료 vs 후보 €30 + €5)
  - (8) 24개월 번들 (Telenet ONE up €80) — 활성화 amortize 24개월 vs 12개월 차이 검증
  - (9) Family 3+ 모바일 + 라인 결합 — bundle_internet_tv mobile_lines_included
  - (10) 프로모 6개월 + 비프로모 — 12 vs 24 시나리오 차이 ≥ €X 검증
  - (11) 다중 anomaly candidate — 입력 N개 중 anomaly N-2개 → 결과 2개만
  - (12) 카테고리 혼합 입력 (T1) — caveat 1건: "X개 후보가 다른 카테고리로 제외됨"

**거부된 대안 — 6 케이스 미축소 (12 케이스 유지)**
- 장점: 처음부터 풀 커버리지.
- 단점: 솔로 사이드 + 청구서 수집이 가장 타이트한 작업 (ADR-0009 §결정 2 마진
  흡수 대상). 6 케이스는 *기능 정확성* + *엣지 케이스 (null currentTariff,
  음의 절약, 한도 초과)* 모두 커버. 베타 청구서 데이터로 12 케이스 확장이 더
  정직.

### Engine version 정책

**현재 버전:** `compare@2026-05-09` (하드코딩 — `src/engine/compare.ts` 상수)

**버전 변경 트리거:**
- T3 산식 변경 (12개월 → 24개월 1차 표시 변경 등)
- T4 amortize 정책 변경
- T5 confidence 결합 공식 변경
- T6 caveat 규칙 추가/제거 (텍스트 미세 수정은 제외)

**변경 시 절차:**
1. ADR-0010 Amendment 작성 (변경 사유 + 기존 결과 호환성)
2. `ENGINE_VERSION` 상수 갱신 → 새 결과는 새 버전 라벨
3. 과거 결과 (영구 링크) 는 그 시점 버전으로 보존 → P1 정보 무결성

## Consequences

### 얻는 것

- 1.11 + 1.12 + 1.13 (함수 차원) 세 항목이 *동시에 결정* → 비교 엔진 입출력
  모양이 명확.
- 모든 산술이 정수 cents → ±0.01€ DoD 수학적 보장 (ADR-0005 §T2 직접 효과).
- caveats 자동 생성이 *순수 함수* → 1.12 6 케이스 + 페이즈 3.5 사용자 노출
  구현 시 모두 같은 함수 호출. 진실 단일 출처.
- 6 케이스로 *기능 정확성 + 엣지 케이스* 커버, 1주 마진 확보 (ADR-0009 §결정 2
  마진과 합산 → 1.5.6 실 스크래핑 또는 페이즈 1.5 부채 흡수 가능).
- engineVersion 정책으로 영구 링크 (3.6) 의 *재현성* 보장.

### 잃는 것 / 부채

- **사용량 → 비용 매핑 부재** (T2): 한도 초과 비용을 추정 안 함 → 실 청구서
  대비 절약액 정밀도 손실. 페이즈 2.5 OCR (옵션 C로 페이즈 5 이연) 시 재논의.
- **caveat 텍스트 i18n 미적용** (T6): nl-BE 단일 문자열만. 페이즈 2 next-intl
  도입 시 일괄 변환 필요 (자동화 가능).
- **6 케이스 → 12 케이스 확장 부채**: M3 시점 베타 청구서 6개 수집 시 Amendment 1.
- **음의 절약 처리** (T7 케이스 4/5): 현재 함수는 음수도 그대로 반환. UI
  (페이즈 3.1) 에서 *어떻게 표시할지* 는 페이즈 3.5 결정. "비교 결과 절약액
  €0 미만 = '더 비쌈'" 라벨 전환 권장 (별도 ADR 또는 PLAN 3.5 본문에서 결정).
- **카테고리 혼합 입력 거부 caveat 부재 (현재 6 케이스)**: 케이스 12에 명시 후
  Amendment 1에서 추가.

### 후속 작업 (다른 PLAN 항목과 연결)

- **1.12** 6 케이스 단위 테스트 — 본 ADR §T7 매트릭스가 그대로 테스트 명세.
  추가 단위 테스트 3건 (빈 candidates / 모두 confidence=low / null currentTariff)
  은 본 ADR §T5/T6에서 정의됨.
- **1.13** caveats 메커니즘 — 본 ADR §T6 deriveCaveats() 함수로 *생성* 완료.
  *사용자 노출* (결과 카드/비교 표 어디에 배치) 은 페이즈 3.5 결정.
- **1.10** `/data-sources` 페이지 — `compare()` 입력 통계 ("이 카테고리 N개
  공급사 비교 가능") 는 별도 함수 `getComparisonStats(category)` 가 필요. 본
  ADR 외 — 1.10 진입 시 결정.
- **3.1** 결론 카드 — `topMonthlySavingCents` + `topYearlySavingCents` 직접 표시.
  음수 케이스 라벨 전환 (3.5 결정).
- **3.5** 계산 근거 펼치기 — `breakdown.monthlySaving12Cents` /
  `breakdown.monthlySaving24Cents` / 모든 caveat 노출.
- **3.6** 영구 링크 — `engineVersion` 보존 (ADR-0007 컬럼 이미 결정).
- **4.1** 어트리뷰션 — `comparison_result_item.id` → `affiliate_click.result_item_id`
  FK (별도 ADR). 본 ADR과 직교.

## Alternatives considered (요약)

| Trade-off | 채택 | 거부된 주요 대안 |
|---|---|---|
| T1 | 카테고리 동일 후보만 | 혼합 + caveat (P1 위반 위험) |
| T2 | 추천성 매핑만, 한도 초과는 caveat | 초과 비용 추정 산식 (헌법 §8 #2 위반) |
| T3 | 12개월 + 24개월 둘 다 breakdown | 12개월만 (24개월 약정 사용자 거짓) / 24개월만 (비약정 매력 묻힘) |
| T4 | 12개월 amortize + 위약금 caveat | 24개월 amortize (단위 불일치) / `switching_cost` 컬럼 (스키마 변경) |
| T5 | min(현재, 후보) 보수적 | 가격 차이 + 신뢰도 결합 (공식 모호) / anomaly 1건이면 결과 제외 (너무 보수적) |
| T6 | nl-BE 단일 문자열 + 순수 함수 | i18n 키 페이즈 1부터 (인프라 부재) |
| T7 | 6 케이스 (옵션 B) | 12 케이스 (청구서 수집 솔로 병목) |

## 검증 방법

### 1. typecheck / lint / test 0 에러

`pnpm typecheck && pnpm lint && pnpm test:run` — `src/engine/compare.ts` +
`src/engine/compare.test.ts` strict 통과 (noUncheckedIndexedAccess /
exactOptionalPropertyTypes).

### 2. `pnpm test` — 6 케이스 + 추가 단위 테스트 3건 통과

본 ADR §T7 매트릭스 기준 6 케이스 + (a) 빈 candidates → 빈 ranked (b) 모두
confidence='low' → 빈 ranked + caveat 1건 (c) null currentTariff (케이스 6
재사용 가능). 모든 expect는 *strict equality* (정수 cents).

### 3. `pnpm harness:plan` 통과

PLAN 1.11 / 1.12 본문에 백틱으로 `src/engine/compare.ts` + `src/engine/compare.test.ts`
명시. verify-plan harness 의 fileRe (literal 매칭) 통과.

### 4. `pnpm harness:data` 통과 유지

본 ADR이 추가하는 파일은 `src/engine/**` — harness:data Rule 1
(`src/fetchers/**`) 영향 없음. UI 컴포넌트 (Rule 2) 도 변경 없음. 회귀 0.

### 5. 1.13 사용자 노출 (페이즈 3.5) 시 회귀 (이 ADR이 옳은지)

페이즈 3.5 결과 카드에서 caveats 가 *적절한 빈도* (평균 1~3건/candidate) 로
노출되는지. 빈도 0건 = T6 규칙이 너무 좁음. 빈도 5건+ = 정보 과부하.
M16 평가 게이트에서 사용자 피드백 (베타 100명) 으로 검증.

## 다음 단계

1. **builder 인계** (1.11 코드):
   - `src/engine/compare.ts` 신설 (순수 함수 `compare(input): CompareResult`)
   - `src/engine/compare.test.ts` 신설 (6 케이스 + 추가 3건)
   - `src/engine/types.ts` 신설 또는 inline (CompareInput, CompareResult,
     ComparisonItem, UsageProfile, TariffSnapshotLike)
   - `src/engine/caveats.ts` 신설 또는 inline (`deriveCaveats()` 순수 함수)

2. **PLAN 1.11 + 1.12 갱신** — 본 ADR 채택 시 [x] 마킹 + 옵션 B "적용됨
   (ADR-0010, 2026-05-09)". 1.13은 [ ] 유지 (페이즈 3.5 노출 의존).

3. **engineVersion 상수**: `src/engine/compare.ts` 에 `export const ENGINE_VERSION
   = 'compare@2026-05-09'`. ADR-0007 §T6 `comparison_result.engineVersion`
   컬럼이 이 값을 기록.

4. **Amendment 1 트리거**: M3 시점 베타 청구서 6개 추가 수집 시 6 → 12 케이스
   확장. T7 §"12 케이스 확장 조건" 의 추가 6 케이스 명세를 본 ADR Amendment
   에 추가.

## References

- 헌법: [`CLAUDE.md`](../../CLAUDE.md) — P1 (정보 우선), P3 (투명성), P4
  (타입 안전), P5 (ADR), §8 #2 (가격 가공 X)
- 운영자: [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, 학습자 모드 (왜
  코멘트), 청구서 수집 솔로 병목
- 관련 ADR:
  - [ADR-0005](0005-tariff-schema-telecom.md) §T2 (cents 정수) §T4 (프로모
    평탄화) — 입력 가격 모양
  - [ADR-0006](0006-tariff-snapshot-schema.md) §T2 (평탄화 5컬럼) §T5
    (anomaly/low 자동 제외) §T7 (DISTINCT ON 최신) — 입력 시계열 정책
  - [ADR-0007](0007-comparison-request-result-schema.md) §T6 (`caveats text[]`)
    §T9 (`lockedInputs`) — 출력 모양
  - [ADR-0008](0008-fetcher-interface-and-cron.md) §T1 (`TariffSnapshotInput`)
    — 입력 매핑
  - [ADR-0009](0009-scope-cut-fetcher-2-providers.md) — 2 fetcher × N tariff
    실제 후보 수
- 외부 사실:
  - 베네룩스 통신 프로모 패턴 (ADR-0005 §외부 사실 인용)
  - 베네룩스 약정 표준 12/24개월 (ADR-0005 §외부 사실 인용)
- Harness:
  - [`scripts/harness/verify-plan.ts`](../../scripts/harness/verify-plan.ts)
    Rule 1 — fileRe literal 매칭 (백틱 src 경로)
  - [`scripts/harness/data-fidelity.ts`](../../scripts/harness/data-fidelity.ts)
    Rule 1/2/4 — 본 ADR 영향 없음
