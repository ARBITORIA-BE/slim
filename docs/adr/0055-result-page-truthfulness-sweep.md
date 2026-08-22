# ADR-0055: 결과 페이지 정직성 스윕 — caveat 다국어화 + 사용량 적합성 정렬

## 상태

**Accepted** (2026-08-22, 운영자 "지금까지 문제 모두 해결" 지시 — 아래 D2 는 architect 판단으로 결정하고 근거를 명시).

> 발화: 운영자가 프로덕션 결과 페이지 스크린샷을 제시하고 문제를 찾으라고 요구. 코드 대조 결과 P0 2건 + P1 2건 + P2 3건이 확인됐다.

## 맥락 (Context)

### 실측 (2026-08-22, prod `/r/UuTk_tcN-fWT`)

| 페이지 | 한글 노출 |
|---|---|
| `/en/r/…` | **13건** |
| `/nl/r/…` | **13건 (동일)** |
| `/fr/r/…` | **13건 (동일)** |
| `/en/data-sources` | 3건 |
| `/en` (홈) | 0 |

**로케일 스위처가 이 영역에서는 아무 일도 하지 않았다.** 세 로케일이 글자 하나까지 같은 한국어를 렌더했다.

### 원인 — 생성기 둘, 성질 둘

| 생성기 | 산출 | 저장 여부 |
|---|---|---|
| `src/app/[locale]/r/[shortId]/_lib/caveat-triggers.ts` | 진단 표 ("주의사항 발동 / 미발동") | 렌더 시 계산 |
| `src/engine/caveats.ts` | Important Notes 10종 | **DB `comparison_result_item.caveats`(text[]) 에 문장으로 저장** |

두 번째가 문제의 핵심이었다. 코드를 고쳐도 **이미 발급된 영구 링크는 계속 한국어**를 뿜는다.

노출된 문구 중에는 `추정값 — 실 데이터 페이즈 5 이후` 처럼 **내부 로드맵 용어**, `주의사항 발동 — 한도 초과 비용 미표시` 처럼 **개발자 디버깅 어휘**가 그대로 있었다.

### 왜 게이트가 못 잡았나

`harness:i18n` 스캔 범위가 `src/app/[locale]/**/*.tsx` + `src/components/**/*.tsx` + `comparison-input.ts` 였다 (ADR-0036 §D2 가 "누출 실증 파일군만" 으로 좁힌 결정). **사용자 노출 문장을 실제로 만드는 `src/engine/**` 과 `src/app/**/_lib/**` 이 처음부터 사각지대**였다.

### 번역은 이미 있었다

`messages/{ko,nl,fr,en}.json` 의 `caveats.*` 키 10종이 **4 로케일 모두 존재**했다. 이전 라운드가 번역만 만들어 두고 **소비자를 연결하지 않았다.** 즉 이번 작업의 대부분은 번역이 아니라 **배선**이다.

### P0-2 — 추천이 사용자 조건과 반대였다

같은 스크린샷에서:

- 월 **10GB** 사용자에게 **5GB** 요금제가 1위 + **"You can save €2 per month"**
- **15GB** 요금제(€21)는 **"-€3.01/mo"** 로 열위 표기
- 그리고 caveat 이 자백: *"한도 초과 비용은 표시되지 않습니다"*

`compare()` 의 정렬 기준은 `monthlySavingCents` **단일** 이었고, `usageProfile.data_gb_used` 는 **caveat 생성에만** 쓰였다 — 필터에도, 점수에도, 페널티에도 없었다. **총비용의 핵심 변수를 모른다고 밝히면서 결론은 단정한 상태.**

## 결정 (Decision)

### D1. caveat = 코드 + 파라미터, 번역은 렌더에서

`deriveCaveats()` 가 문장 대신 **직렬화된 코드**를 낸다.

```
{"k":"promoEnds","p":{"months":6,"price":"€16.99"}}
```

- **반환 타입은 `string[]` 유지** → `comparison_result_item.caveats`(text[]) 스키마 변경 0, 마이그레이션 0, API 계약 변경 0.
- 코드 이름 = `messages.caveats.*` 키 (1:1). 중간 매핑 테이블을 두지 않아 키 어긋남이 테스트에서 즉시 드러난다.
- 렌더는 `_lib/caveat-text.ts` 의 `formatCaveats()` 하나로 통일 — ResultConclusionCard 와 CalculationDetails 가 같은 함수를 쓴다 (문구 불일치 0).

**레거시 행 처리 = 렌더 시 역매핑 (백필 불필요).**
`parseLegacyCaveat()` 이 4.28 이전 한국어 문장을 코드로 되돌린다. 템플릿이 9종뿐이고 파라미터(개월·금액·GB·Mbps)가 문장에 전부 남아 있어 무손실이다. **이미 발급된 영구 링크가 DB 를 건드리지 않고 즉시 다국어로 복구된다.**

대안으로 검토한 것:
- *백필 마이그레이션* — 같은 역매핑을 DB 에 쓰는 것뿐. 렌더 경로가 이미 해결하므로 **선택 사항**으로 남긴다 (운영자가 원하면 나중에).
- *레거시 숨김* — 주의사항이 사라진 결과가 더 위험. 거부.
- *렌더 시 재계산* — 영구 링크 불변성(그때의 결론 보존)이 깨진다. 거부.

역매핑 실패 시에는 **원문을 그대로 노출**하고 `unresolved` 로 센다 — 억지 추측으로 뜻이 바뀐 caveat 을 만드는 것보다 낫다 (P1).

### D2. 사용량을 감당하는 후보가 먼저 (정렬 변경, 제외 아님)

`compare()` 의 1차 정렬 키를 **적합성 → 절약액** 순으로 바꾼다.

```
fitsUsage(모바일 데이터 한도) → monthlySavingCents desc → tariffSnapshotId
```

- **후보를 제외하지 않는다.** 비교 대상을 임의로 지우는 것은 P3(제외한 것도 이름을 밝힌다) 위반이고, "5GB 로 충분하다" 는 판단은 사용자 권리다. **순서만 바꾸고 전부 보여준다** — caveat 이 이유를 설명한다.
- **초과요금을 추정하지 않는다.** 단가를 수집하지 않으므로 "얼마나 더 비싼가" 는 출처 없는 숫자가 된다 (P1). 우리가 아는 사실(`감당한다 / 못한다`)로만 순서를 가른다.
- **모르면 불리하게 쓰지 않는다.** 한도 미상 · 사용량 미상 · unlimited 는 적합으로 본다.
- **4K 속도 부족은 순서를 바꾸지 않는다.** 요금제를 쓸 수 없는 것이 아니라 화질이 떨어지는 문제라 성격이 다르다 — caveat 으로만 알린다.
- 사용자가 정렬 탭을 **명시적으로** 고르면 그 정렬이 이 순서를 덮는다 (`compare-view`).

그리고 감당하지 못하는 요금제가 그래도 1위가 된 경우(= 감당하는 후보가 하나도 없는 경우) 결론 카드가 **절약액을 단정하지 않는다** — `savingsOverageNote` 로 "실제 절약액은 이보다 적을 수 있다" 를 덧붙인다.

### D3. 표시 라벨 정직화

| 문제 | 조치 |
|---|---|
| 표의 대표 가격이 라벨 없는 **12개월 평균** (프로모 요금제라면 어느 달에도 청구되지 않는 금액) | `monthlyAvgLabel` 표기 추가 |
| `commitmentNone: "None"` 이 단독 줄 — 무엇이 None 인지 불명 | "No contract" / "약정 없음" 등으로 교체, `commitmentMonths` 도 "…-month contract" 로 |
| 신선도 중복 — 리본("N시간 전 갱신 · 출처")과 행 내부("Last checked: N시간 전")가 같은 말 | 행 내부는 `sr-only` 로 (정보 손실 0, 시각적 소음 제거) |
| CTA "Change" 단독 — 무엇을 바꾸는지 불명 | "Switch to this plan" / "이 요금제로 변경" 등으로 (원 의도 "변경하기" 보존) |
| nl/fr `caveats.commitment` 번역이 깨져 있었음 (`{months} Contractduur van [aantal] maanden`) | 플레이스홀더 정합 문장으로 교체 |

`ReliabilityDots` 는 이미 `aria-label`("Reliability n/5 — confidence")을 갖고 있어 접근성 문제가 아니었다 — 시각적 범례 부재는 디자인 판단으로 남긴다.

### D4. 정렬 컨트롤 단일화

`SortTabs`(ADR-0050 §D3)와 레거시 `ComparisonControls` 가 **둘 다 정렬 UI 를 렌더**하고 있었고 어휘도 달랐다 ("Cheapest" vs "Sorted by lowest monthly cost", "Most saved" vs "Largest savings"). 같은 개념을 두 이름으로 부르면 사용자는 다른 기능이라고 읽는다. `ComparisonControls` 는 **필터 전용**으로 남긴다 (코드 주석은 이미 그렇게 적혀 있었으나 실제 렌더는 달랐다).

### D5. `harness:i18n` 범위 확장 — 재발 차단

스캔 대상에 **`src/engine/**/*.ts`** 와 **`src/app/**/_lib/**/*.ts`** 를 추가한다 (그룹 4). 문자열만 고치고 범위를 그대로 두면 다음 라운드에 같은 일이 난다.

영구 허용 2건 (사용자 미노출):
- `src/engine/caveat-codes.ts` — 한국어가 **출력이 아니라 입력**이다 (레거시 문장 역매핑 패턴). 레거시 행이 소멸하면 함께 삭제.
- `src/engine/usage-estimator.ts` — exhaustive switch 의 개발자용 throw 메시지.

## 결과 (Consequences)

### ✅ 얻는 것

- en · nl · fr 결과 페이지에서 **한글 노출 0** (기존 영구 링크 포함).
- 사용량을 감당하지 못하는 요금제가 **1위로 추천되지 않는다** — 데이터 추가 수집 0으로.
- 사용자 노출 문자열 생산자가 **게이트 안**으로 들어왔다.

### ⚠️ 잃는 것 / 한계 (정직 표기)

- **초과요금 자체는 여전히 모른다.** 순서와 문구만 정직해졌을 뿐, "5GB 로 쓰면 얼마" 는 답하지 못한다. 공급사별 초과요금 단가 수집은 별 항목.
- **적합성 판정은 모바일 데이터 하나뿐.** 통화/SMS/속도 등 다른 축은 caveat 수준에 머문다.
- **레거시 역매핑은 템플릿 9종에 한정.** 그 이전 포맷이 있었다면 원문 노출된다 (`unresolved` 로 집계되지만 알림은 없다).
- `caveats` 컬럼에 JSON 문자열을 담는 것은 **정규 스키마가 아니다.** 스키마 변경 0 을 얻는 대신 컬럼 의미가 "문장" 에서 "직렬화 값" 으로 바뀌었다 — 컬럼 주석과 본 ADR 이 유일한 계약서다.

## 검증 방법 (Verification)

1. `caveat-codes` 왕복 + 레거시 역매핑 9종 + 방어 3건.
2. `caveat-text` — **실제 messages 파일 4 로케일**을 읽어 키 누락 0 / 플레이스홀더 잔존 0 / ko 외 로케일 한글 0.
3. `compare.fit` — 프로덕션 시나리오(10GB 사용자 · 5GB vs 15GB) 재현 + 제외 0 + 미상 처리 + unlimited + internet 비대상.
4. `caveat-triggers` — 전 행에 한글 0 (회귀 가드).
5. `harness:i18n` GREEN with engine(6) + app _lib(4) 포함.

## 관련 ADR

- [ADR-0010](0010-comparison-engine.md) §T6 — caveat 매트릭스 (본 ADR 이 출력 형식을 바꿈)
- [ADR-0036](0036-i18n-completion-zod-harness-locale-switcher.md) §D1/§D2 — 엔진 locale-free + 키 전략 (본 ADR 이 같은 패턴을 caveat 에 적용, §D2 스캔 범위는 확장)
- [ADR-0021](0021-phase-3-results-page-design.md) §T5 — 계산 근거 펼치기 (트리거 표 i18n)
- [ADR-0050](0050-ui-v2-comparison-redesign.md) §D3 — SortTabs (정렬 단일화의 기준)
- [ADR-0005](0005-tariff-schema-telecom.md) §T2 — cents 정수 + 표시 정책
