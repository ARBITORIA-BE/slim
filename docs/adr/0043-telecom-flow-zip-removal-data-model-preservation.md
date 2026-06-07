# ADR-0043: 통신 비교 흐름 — ZIP code 단계 제거 + 데이터 모델 보존 + carrier availability caveats

## Status

**Accepted (2026-06-07, 운영자 Pieter)** — 옵션 D 잠금: ZIP 단계 제거 + 데이터
모델 (`postalCountry`/`postalCode`) 보존 + carrier availability caveats 신설 +
미래 카테고리 reverse 트리거 명시.

- Architect (Pieter, 2026-06-07): ADR 신설 옵션 Y 채택. ADR-0016 §T1 Amendment 4
  동반 (4단계 → 3단계 골격 변경).
- 동반 산출물:
  - `docs/adr/0016-phase-2-input-flow-design.md` §Amendment 4 (4→3단계 골격)
  - PLAN.md §4.16 sub-task 분해
  - i18n `compare.postal.*` 키 4 × 5 locale = 20 entries 삭제 (별 cleanup PR 가능)
- 페이지: `[ADR-0011](0011-data-sources-page-and-caveats-boundary.md) §T2` 정직 표시 패턴 재사용

### 이력

- Proposed (2026-06-07) — D1~D6 6 결정 + Open Questions Q1~Q4
- Accepted (2026-06-07) — 운영자 옵션 D 잠금 + architect 디폴트 Q1~Q4 채택

---

## Context

### 본 ADR 이 다루는 항목

1. **현 4단계 통신 비교 흐름 (ADR-0016 §T1 Amendment 3)**: `postal → current-provider
   → household → preview` 4단계. 첫 단계 = 우편번호 입력 (ADR-0016 §T3, BE 1차
   SC-B 적용). NL/LU 는 페이즈 5 진입 직전 추가 예정 (ADR-0021 §T10).
2. **운영자 자가 진단 (2026-06-07, slim.lu/en prod 1/4 ZIP 단계)**: "여기 zip
   code 는 가격 변동 비교요인에 영향을 안줘 [...] 살고 있는 곳을 비교하는건
   의미가 없는거같아 [...] 데이터에 대한 정보는 저장하고 지금 인터넷 전화 서비스
   비교에서는 빼는게 좋을것같아."
3. **시장 사실 (architect 정찰, ADR-0034 D2 통신 BE 만 정합)**:
   - BE 통신 carrier 가격 = 전국 동일 (Proximus Mobilus €15 = ZIP 1000 / ZIP 9000
     동일). 지역 차이 = carrier *가용성* (availability):
     - Telenet: Flanders + Brussels (Wallonia 미커버, Liberty Global 역사적 한계)
     - Voo: Wallonia 중심 (2025-10-01 Orange BE 흡수 — [ADR-0034 Amendment 1
       D4](0034-strategy-pivot-completion-first-seo-launch.md))
     - Proximus / Orange BE: 전국 (Wallonia/Flanders/Brussels)
   - NL: KPN/Ziggo/T-Mobile NL/Vodafone NL 전국 동일 가격 (지역 무관)
   - LU: POST/Tango/Orange LU/Eltrona 전국 동일 가격 (지역 무관)
4. **결론**: 통신 카테고리에서 ZIP 입력 가치 = 0 (가격 변동 영향 0). 가치 영역 =
   **carrier availability filtering** (Wallonia 거주자 → Telenet 미노출 결과
   안내). 운영자 진단 정확.

### 본 ADR 이 직접 받는 의존성

- **ADR-0016 §T1 / §T3 / §T6** — 입력 흐름 골격 (5단계 → 4단계 → 3단계 진화).
  본 ADR = §T1 Amendment 4 트리거 (4→3).
- **ADR-0011 §T2** — 정직 표시 패턴 (`/data-sources` 6 항목 + 사용자 노출 메시지).
  본 ADR §D3 carrier availability caveats 가 본 패턴 재사용.
- **ADR-0029 §T2** — 정직성 토큰 (DEPRECATED but 카피 원칙 보존). 본 ADR §D3
  caveats 텍스트 톤 정합.
- **ADR-0034 D2 + Amendment 1 D4** — 통신 BE만, 3 공급사 (Voo 흡수). 본 ADR §D3
  carrier availability 매트릭스 = 본 결정의 직접 결과.
- **ADR-0007 §T2** — `comparison_request.postal_code` 컬럼. 본 ADR §D2 보존 결정.
- **ADR-0033 §T1** — i18n 5 locale. 본 ADR §D6 cleanup PR 트리거.

### 본 ADR 이 여는 후속

- **미래 카테고리 진입 시 reverse 트리거** (§D4): 에너지 BE (지역별 그리드
  운영자 차이 — Fluvius vs RESA vs Sibelga) / 모기지 (지역별 등록세 + 시장가
  차이) / 보험 (자동차 보험료 지역 위험도 차이) 진입 시 본 ADR §D2 보존된 데이터
  모델 재활성. 별 ADR (ADR-NNNN-zip-reintroduction) 트리거.
- **NL/LU 통신 확장 시점** (페이즈 5 진입 직전, ADR-0021 §T10): NL/LU 도 통신
  가격 지역 무관 → 본 ADR §D1 ZIP 제거 결정 유지 (NL/LU `country` 입력은 별
  단계로 분리 검토 — 본 ADR 범위 밖, 페이즈 5 진입 시 재검토).

### 운영자 컨텍스트 (`docs/FOUNDER.md`)

- 솔로 사이드 / 개발 3개월 / 월 €300 운영 cap / TVA `BE1037548919`
- 4.9 organic SEO 런치 완료 (2026-06-05) — 사용자 진입 깔때기 정정 시급
- 4.13 Hero 재설계 [x] (ADR-0041, 2026-06-06) + 4.14 enum 5값 잠금 (ADR-0042,
  2026-06-07) + 4.15 locale 5→3 (PR #41 OPEN) — 본 ADR 진입 게이트 = 4.13/4.14
  잠금 보존.

### 외부 사실 (검증된 출처 — 2026-06-07)

- **Proximus Mobilus 가격**:
  [Proximus Mobilus tariffs (NL)](https://www.proximus.be/nl/id_cr_subbrand_mobilus/personal/prijzen-en-voorwaarden/mobilus.html)
  — €15/월 (Light) ~ €60/월 (Premium). 가격 표 = 단일 전국 가격, ZIP 분기 0.
- **Telenet coverage**:
  [Telenet about us page](https://www.telenet.be/en/about-telenet/our-network)
  — "Our network covers Flanders and Brussels." Wallonia 미커버.
- **Voo (구) → Orange BE 흡수**:
  [Orange Belgium / VOO merger completion 2025-10-01](https://corporate.orange.be/en/news-medias/voo-orange-belgium-finalize-merger)
  — ADR-0034 Amendment 1 잠금. 본 ADR 정합 (3 공급사 매트릭스).
- **KPN NL 가격**:
  [KPN Internet abonnement](https://www.kpn.com/internet/internet-abonnement.htm)
  — 전국 동일 가격. ZIP 입력은 *coverage 체크* 용 (가격 분기 X).
- **POST Luxembourg 가격**:
  [POST Telecom packs](https://www.post.lu/en/particuliers/packs)
  — 전국 동일. LU 지역 분기 0.

---

## Decision — D1~D6 6 결정

### D1 — ZIP code 단계 제거 (통신 카테고리 전용)

**무엇**: `/compare/[category]/postal` 라우트 = 통신 흐름에서 제거.

- `src/app/[locale]/compare/[category]/postal/page.tsx` 삭제
- `src/app/[locale]/compare/[category]/postal/layout.tsx` 삭제
- `/compare/[category]` 진입 시 redirect 대상 = `postal` → **`current-provider`**
  (ADR-0016 §T1 Amendment 4 동반)

**왜**: 운영자 진단 + architect 정찰 (Context §3) — 통신 가격 ZIP 무관 (3국 모두).
ZIP 입력은 *5분 5단계 예산* (헌법 §3 P2) 의 무가치 소비.

**거부된 대안**:

- 옵션 A: ZIP 단계 유지 + skip 버튼 — 다크패턴 시그널 (무가치 단계에 skip 부여).
  운영자 명시 거부.
- 옵션 B: ZIP 단계 = 카테고리 분기 (통신만 제거, 에너지 진입 시 부활) — 분기
  복잡도 ↑ + 사용자 코드 인지 부하 ↑. §D4 reverse 트리거로 흡수.
- 옵션 C: ZIP 단계 → `country` 선택 단계로 대체 — NL/LU 페이즈 5 진입 시 검토
  (본 ADR 범위 밖).

### D2 — 데이터 모델 보존 (`postalCountry` / `postalCode` 필드 + DB 컬럼 + Zod schema)

**무엇**: 운영자 명시 — "데이터에 대한 정보는 저장." 다음 표면 *모두 보존*:

- **DB**: `comparison_request.postal_code` 컬럼 (ADR-0007 §T2) — nullable 유지
  (현재 schema 정합 — postal 입력 부재 시 NULL).
- **Zod**: `src/types/comparison-input.ts` §32-87
  - `POSTAL_COUNTRIES` / `postalCountrySchema` / `PostalCountry` — 보존
  - `postalCodeSchema` (discriminatedUnion BE/NL/LU) — 보존
  - `comparisonInputSchema` §133-141 — `postal` 필드 = **optional 격상**
    (`postal: postalCodeSchema.optional()`) — 통신 흐름은 미제출, 미래 카테고리는
    제출.
- **sessionStorage**: `sessionStateSchema.data.postalCountry` / `postalCode` —
  이미 `.optional()` (§169-170 잠금). 변경 0.
- **stepSchemas**: §145-149 `postal: postalCodeSchema` 키 = **제거** (단계
  대응이라 카테고리별 흐름과 분리). `StepName` 타입 자동 축소 (`postal` 제거).

**왜**: 운영자 명시 + §D4 reverse 트리거 (미래 카테고리 진입 시 즉시 재신설 가능).
데이터 모델 단일 출처 원칙 (`comparison-input.ts` 헤더 코멘트) 보존.

**거부된 대안**:

- 옵션 A: 데이터 모델 동시 제거 — 미래 카테고리 진입 시 재구축 부담. 운영자 명시 거부.
- 옵션 B: DB 컬럼만 보존 + Zod/sessionStorage 제거 — 부분 보존은 정합성 깨짐. 거부.

### D3 — carrier availability caveats 신설 (ADR-0011 §T2 패턴 재사용)

**무엇**: 결과 페이지 (`/r/{shortId}`) 에 carrier availability 안내 섹션 신설.

**위치**: 별 섹션 `<CarrierAvailabilityNotice />` (RSC) 신설. `ExcludedProvidersSection`
*통합 거부* (옵션 B 거부) — `ExcludedProvidersSection` = "비교에서 제외된 공급사"
(영구 미커버 — API 미제공 등) 의미라, "carrier 미커버 = 지역 가능성" 과 의미 다름.
별 섹션이 정합.

**섹션 텍스트 (5 locale, ko 1차)**:

```
ko (1차):
"참고: Telenet 은 플랑드르 (Flanders) 와 브뤼셀 지역에서만 서비스됩니다.
왈로니아 (Wallonia) 거주 시 2 공급사 (Proximus, Orange BE) 가 비교 후보가 됩니다.
출처: Telenet 공식 네트워크 페이지 (확인 2026-06-07)."

en (DeepL):
"Note: Telenet is available in Flanders and Brussels only. Wallonia users have
2 carriers (Proximus, Orange BE). Source: Telenet official network page
(verified 2026-06-07)."

nl/fr: DeepL Free hybrid + 운영자 검수 (ADR-0040 §T3 hybrid 동형, `compare.*`
일반 트랙 — legal 검수 게이트 비대상).
```

**카테고리 분기**: **카테고리 무관** (architect 디폴트 Q3 잠금). mobile / internet
/ bundle\_\* 5 카테고리 모두 동일 caveats 노출. 사유: Telenet 매트릭스 = 카테고리
무관 (Telenet 의 *어떤* 통신 상품도 Wallonia 미서비스).

**i18n 키**: `compare.carrierAvailability.{notice,sourceLabel,verifiedAt}` × 5
locale = 15 string entries (DeepL Free 누적 < 0.1%). headline / footer / source
3 키 × 5 = 15 entries.

**source / fetched_at**: 헌법 §3 P1 정합 — Telenet 공식 페이지 인용 + `verifiedAt`
타임스탬프 (수동 갱신, 페이지 표시).

**거부된 대안**:

- 옵션 A: `ExcludedProvidersSection` 통합 — 의미 충돌 (위 설명). 거부.
- 옵션 B: 카테고리별 분기 — Telenet 매트릭스 단일 → 분기 부질없음. 거부.
- 옵션 C: 결과 페이지 외 (`/data-sources`) 만 노출 — 결과 페이지 사용자 = 직접
  영향 받는 청중. 결과 페이지 우선 + `/data-sources` 자동 흡수 (§T2 패턴).

### D4 — 미래 카테고리 reverse 트리거 (BC compatibility)

**무엇**: 다음 카테고리 진입 시 ZIP 단계 *재신설* 가능 — 데이터 모델 보존 (§D2)
덕분. 재신설 트리거 = 별 ADR (ADR-NNNN-zip-reintroduction).

**카테고리별 ZIP 가치 매트릭스** (architect 정찰):

| 카테고리 | ZIP 가치 | 사유 | 재신설 시점 |
|---|---|---|---|
| 통신 BE/NL/LU | **0** | 전국 동일 가격 | 본 ADR — 제거 |
| 에너지 BE | **HIGH** | 지역 그리드 운영자 (Fluvius/RESA/Sibelga) 차이 | 페이즈 5 별 ADR (보류, ADR-0034 D2) |
| 모기지 BE | **MID** | 지역 등록세 + 시장가 차이 | 페이즈 5+ 별 ADR (보류) |
| 보험 BE | **MID** | 자동차 보험료 지역 위험도 차이 | 페이즈 5+ 별 ADR (보류) |

**왜**: 운영자 명시 — "앞으로 다른 무언가 비교를 추가할때 zip 코드가 필요할수
있으니." 본 트리거 명시로 §D2 보존 의도 봉합.

### D5 — ADR-0016 §T1 Amendment 4 동반 (4→3단계)

**무엇**: ADR-0016 §T1 (URL 구조) + §T6 (단계 6 / step indicator) 갱신.

- 라우팅 구조:
  ```
  /compare/[category]                         # = /compare/[category]/current-provider redirect
  /compare/[category]/current-provider        # 단계 1 (구 단계 2)
  /compare/[category]/household               # 단계 2 (구 단계 3)
  /compare/[category]/preview                 # 단계 3 (구 단계 4)
  ```
- step indicator: `1/4 단계 · 약 4분` → **`1/3 단계 · 약 3분`** (P2 5분 예산
  마진 ↑)
- progress bar: `n/4` → `n/3`
- e2e `e2e/compare-flow.spec.ts` `step='postal'` assertion 제거 → `current-provider`
  진입 assertion 추가
- sessionStateSchema `step` enum (line 165): `['postal', 'household', 'current-provider',
  'preview']` → `['current-provider', 'household', 'preview']`

**왜**: ADR-0016 §T1 = 라우팅 단일 출처. 본 결정과 동기 — Amendment 4 추가
(ADR-0041 Amendment 2 동형 패턴).

### D6 — i18n `compare.postal.*` 키 cleanup (별 PR 또는 4.16 흡수)

**무엇**: i18n 키 cleanup 영역:

- 삭제: `compare.postal.*` 네임스페이스 — 4 키 × 5 locale = 20 string entries
  (`headline` / `placeholder` / `cta` / `validation.postal.{be,nl,lu}`)
- 보존: `validation.postal.{be,nl,lu}` — Zod schema (`comparison-input.ts` §62-83)
  잠금 키. **보존 필수** (§D2 schema 보존 → validation message 보존 필수). harness:i18n
  스캔 정합 유지 (key 정의 보존, UI 소비 0 = 정상).
- 신규: `compare.carrierAvailability.{notice,sourceLabel,verifiedAt}` 3 키 × 5
  locale = 15 entries (§D3)

**옵션**: 본 4.16 흡수 (디폴트) — 단일 PR 정합성 ↑. 별 cleanup PR 분리 = 옵션
(운영자 시간 여유 시).

**DeepL 누적**: `compare.carrierAvailability.*` 3 키 × ko 1차 ≈ 250 chars × 3
locale (nl/fr/en) ≈ 750 chars / Free 500K = 0.15% (영향 0).

---

## 대안 (전체 — D1 옵션 비교)

본 ADR § D1 = 옵션 D 잠금. 운영자 결정 잠금:

- **옵션 A — ZIP 유지 + skip 버튼** ❌: 다크패턴 시그널, 무가치 단계.
- **옵션 B — 카테고리별 ZIP 분기** ❌: 사용자/코드 인지 부하 ↑. §D4 reverse 트리거로 흡수.
- **옵션 C — ZIP 제거 + 데이터 모델 동시 제거** ❌: 미래 카테고리 재구축 부담.
- **옵션 D — ZIP 제거 + 데이터 모델 보존 + carrier availability caveats** ✅ (잠금).

---

## 결과

### ✅ 얻는 것

- 사용자 흐름 4→3단계 (P2 5분 예산 마진 +1단계 = ≈ 75% 시간 단축 추정)
- 헌법 §3 P3 (투명성) 강화 — carrier availability caveats 정직 표시 (Wallonia
  거주자 = Telenet 미노출 사유 명시)
- 헌법 §3 P1 (정보 우선) 정합 — 무가치 입력 제거, 가치 영역 (availability) 강조
- 데이터 모델 단일 출처 보존 — 미래 카테고리 진입 비용 ↓ (별 ADR 트리거만으로 재신설)
- 솔로 사이드 € 300/월 cap 정합 — 사이즈 ≤ 2일

### ⚠️ 잃는 것 / 부채

- ZIP 데이터 = 통신 흐름에서 NULL 만 누적 (분석 가치 0 일정 기간). 미래 카테고리
  진입 시 ZIP NULL row vs 비-NULL row 정합성 검토 부담 (별 ADR 트리거 시 흡수).
- i18n `validation.postal.*` 키 = 사용 0 상태로 정의만 보존 → harness:i18n 정합
  유지 위해 코드 보존 코멘트 필수.
- ADR-0016 §T3 = `DEPRECATED but preserved` 의미 모호 → §Amendment 4 본문에서
  명시.

---

## 검증 방법

| # | 검증 항목 | 방법 |
|---|---|---|
| V1 | 4단계 → 3단계 골격 정합 | e2e `compare-flow.spec.ts` 3-step flow 통과 + Vercel 배포 URL Pieter Chrome MCP 실측 5 locale |
| V2 | 데이터 모델 보존 | `pnpm typecheck` 0 + `comparisonInputSchema` `postal` optional 격상 + `sessionStateSchema` step enum 3값 정합 |
| V3 | carrier availability caveats 노출 | 결과 페이지 `/r/{shortId}` 5 locale 실측 — `<CarrierAvailabilityNotice />` 렌더 + 텍스트 한글 0 in nl/fr/en + source/verifiedAt 명시 (헌법 §3 P1) |
| V4 | i18n harness 통과 | `pnpm harness:i18n` GREEN 5 locale + `compare.carrierAvailability.*` 15 entries 정의 + `compare.postal.*` 20 entries 삭제 + `validation.postal.*` 보존 (Zod 잠금) |
| V5 | 운영자 신호 봉합 | 운영자 자가 V1 통과 — slim.lu/en `/compare/{category}` 진입 → ZIP 단계 0 + current-provider 직진 + 결과 페이지 Telenet Wallonia caveats 노출 |

V5 = observational (게이트 아님, 운영자 자가 검증).

---

## Open Questions (운영자 결정 영역 — 본 ADR Accepted 시점에 잠금)

본 ADR Accepted 시점에 운영자 디폴트 (architect 추천) 채택:

- **Q1 (운영자 잠금 옵션 Y)**: ADR 신설 (옵션 Y) vs ADR-0016 Amendment 4 단독
  (옵션 X). architect 추천 = Y (운영자 신호 + 시장 정합 + 사용자 흐름 변경이 큰
  결정이라 별 ADR 정합).
- **Q2 (architect 디폴트 별 섹션)**: 결과 페이지 caveats 위치 — `ExcludedProvidersSection`
  통합 vs **별 섹션 `<CarrierAvailabilityNotice />`**. 디폴트 = 별 섹션 (의미 충돌
  회피).
- **Q3 (architect 디폴트 카테고리 무관)**: caveats 카테고리 분기 — 분기 vs **무관**.
  디폴트 = 무관 (Telenet 매트릭스 단일).
- **Q4 (architect 디폴트 영향 0)**: postal 데이터 부재 시 결과 페이지 영향 —
  DB 컬럼 nullable 확인. 정찰 결과 = `comparison_request.postal_code` 이미 nullable
  (ADR-0007 §T2). 영향 = **0** (`comparisonInputSchema.postal.optional()` 격상
  으로 흡수).

---

## Cross-ref

- [ADR-0016 §T1 / §T3 / §T6](0016-phase-2-input-flow-design.md) — 입력 흐름 골격
  (Amendment 4 동반)
- [ADR-0011 §T2](0011-data-sources-page-and-caveats-boundary.md) — 정직 표시 패턴
  (carrier availability caveats 재사용)
- [ADR-0029 §T2](0029-honesty-tokens.md) — 정직성 토큰 (caveats 텍스트 톤)
- [ADR-0034 D2 + Amendment 1 D4](0034-strategy-pivot-completion-first-seo-launch.md)
  — 통신 BE만 + 3 공급사
- [ADR-0007 §T2](0007-comparison-request-data-model.md) — `comparison_request.postal_code`
  컬럼 (보존)
- [ADR-0033 §T1](0033-i18n-namespace-and-locale-routing.md) — i18n 5 locale
- [ADR-0040 §T3](0040-legal-namespace-deepl-hybrid-and-interstitial-boundary.md)
  — DeepL hybrid (`compare.*` 일반 트랙)
- [ADR-0042 §D1](0042-telecom-bundle-taxonomy-extension.md) — enum 5값 (carrier
  availability 카테고리 무관 정합)

---

## 산출물 인계 (builder)

- 삭제: `src/app/[locale]/compare/[category]/postal/{page,layout}.tsx` 2 파일
- 수정: `src/app/[locale]/compare/[category]/page.tsx` redirect `postal` → `current-provider`
- 수정: `src/types/comparison-input.ts`
  - `stepSchemas` line 145-149: `postal` 키 제거 (`StepName` 자동 축소)
  - `comparisonInputSchema` line 133-141: `postal: postalCodeSchema.optional()` 격상
  - `sessionStateSchema.step` line 165: enum 3값 (`['current-provider', 'household', 'preview']`)
  - `POSTAL_COUNTRIES` / `postalCountrySchema` / `postalCodeSchema` 보존 (§D2)
- 신규: `src/app/[locale]/r/[shortId]/_components/CarrierAvailabilityNotice.tsx` RSC
- 신규: `src/app/[locale]/r/[shortId]/_components/CarrierAvailabilityNotice.test.tsx` 단위 테스트
- i18n: `messages/{ko,nl,fr,en}.json` (4.15 locale 5→3 PR #41 머지 시점 동기) —
  `compare.postal.*` 4 키 삭제 + `compare.carrierAvailability.*` 3 키 신설 +
  `validation.postal.*` 보존 (코멘트 추가)
- e2e: `e2e/compare-flow.spec.ts` 3-step flow 단언 갱신
- progress bar / step indicator UI: `1/4` → `1/3` 자동 갱신 (배지 토큰 단일 출처
  — ADR-0041 D7.6 cross-ref)

---

**ADR-0043 End.**
