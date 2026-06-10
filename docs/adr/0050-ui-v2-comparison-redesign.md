# ADR-0050: UI v2 — 결과 표 / 홈 카테고리 그리드 재설계 (인지과학 + Check24/Danawa/Wirecutter 벤치마크)

## 상태

**Accepted** (2026-06-10, 운영자 — architect 권고 묶음 잠금).

운영자 잠금 결과:
- **Q1 = B** (P1~P3, 5d) — 즉시 회복 + P3 알고리즘 투명성 정합. P4/P5는 베타 트래픽 신호 누적 후 별 ADR.
- **Q2 = A** (DB 테이블 `curated_pick`) — 별 **ADR-0051** 트리거 (P4 진입 시점, 본 ADR 잠금 시점에는 신설 대기).
- **Q3 = (다)** — **페이즈 4.19~4.23** 추가 + 페이즈 4 헤더 "UI v2 sweep (Amendment)" 마킹. PLAN 갱신은 P1 verifier 통과 후 plan-tracker.

builder 진입 게이트 열림 — **P1** CategoryGrid.tsx 2+3 분리 + 베타 배지 + i18n 6×5 locale (1d).

(이력) Proposed 2026-06-10, architect — 운영자 자가 진단 신호 "현 결과 표 + 카테고리 그리드 UX 깨짐" + 2 mockup 동반 트리거.

---

## 맥락 (Context)

### C1. 운영자 자가 진단 신호 + 두 mockup

운영자(코드 작성자 본인)가 2026-06-10 slim.lu 두 화면을 보고 UX 문제 식별:

**(1) 결과 표** — `src/app/[locale]/r/[shortId]/_components/ComparisonTable.tsx` (ADR-0021 §T2 2층, 7컬럼: `#` / CARRIER+PLAN / MONTHLY COST / AGREEMENT / SAVING / RELIABILITY / ORIGINAL)
- 좁은 폭에서 모든 헤더·셀이 줄바꿈으로 깨짐.
- 디스클로저 ("Slim does not receive any commission…") 9줄이 carrier 셀에 세로 누적 → 행 높이 셀마다 달라 *비교 정렬 시각 신호 파괴*.
- Saving `"+€5/mo"` 텍스트 — pre-attentive 채널(색·크기·위치) 미사용.
- Reliability `"High"` 토큰 — 비교 가능성 0 (정량 점수 없음).
- `"1시간 전"` 한국어 + `"Last checked"` 영어 혼재 (i18n 미완 — ADR-0033 §T5 S2 누락 추정).

**(2) 홈 카테고리 그리드** — `src/components/Hero/CategoryGrid.tsx` (ADR-0041 D1 §블록 2 + ADR-0042 §D4 5 카드)
- 5개 카드 (Mobile / Internet / Mob+Net / Net+TV / Triple) 한 줄에 욱여넣음 → 폭 좁아져 본문 `"Mobile and hom…"` 자르기.
- 베타 안내문이 있는 카드만 키 큼 → 콘텐츠 양 비대칭 → Gestalt similarity / alignment 깨짐.
- 가운데 카드(`bundle_mobile_internet`) 임의 하이라이트 (`hover:border-accent-dark`가 의도 외 발현 가능성, 정찰 미완).
- `"Telenet ONE up (인터넷+TV 번들)"` 영어 페이지에 한국어 잔존 (ADR-0042 §D3 i18n 10 entries 누락 추정).
- `"e.g."` 라인이 카드마다 있다/없다 불일치 (`showExamples` prop + DB 조회 부재 시 graceful degradation 분기 — `CategoryGrid.tsx:120~128`).

> **사실 정정 (architect)**: 사용자가 "비교 결과 페이지"로 칭한 화면 = 실제 파일은 `/r/[shortId]/_components/ComparisonTable.tsx` (ADR-0021 §T2 2층 비교 표). `preview/page.tsx`는 입력 확인 후 `/api/compare` POST → `/r/[shortId]` 리디렉트 역할 뿐 (표 0). 본 ADR 의 결과 표 결정 = `/r/[shortId]` 전체 (ResultConclusionCard + ComparisonTable + ExcludedProvidersSection + CalculationDetails) 대상.

### C2. 벤치마크 결론 (세 시장)

운영자 메모리 `project_benchmarks.md` 정합 — 세 시장의 강점 흡수 패턴:

- **Check24 (DE)** — 카테고리 그리드 + 위저드 + 정렬 탭 + "왜 이 순서?" 펼침 + 외부 인증 배지 (TÜV / Stiftung Warentest).
- **Danawa (KR)** — 비교 슬롯 (최대 3) + 가격 시계열 + 표/카드 모드 분리.
- **미국 (Wirecutter / NerdWallet / Policygenius)** — 강한 큐레이션 ("Our pick / Runner-up / Budget pick" 3장) + 카드 형식 + 에디토리얼 라벨.

### C3. 인지과학 7원칙 (현 v1 위반 매트릭스)

| # | 원칙 | 출처 | v1 위반 | v2 회복 경로 |
|---|---|---|---|---|
| 1 | Pre-attentive processing | Treisman & Gelade 1980; Healey 1996 | `+€5/mo` 텍스트만 | 절약 막대 (정규화 색·길이) |
| 2 | Cowan 4±1 working memory | Cowan 2001 | 7컬럼 표 | 청크 4 (플랜 / 요금 / 절약 / CTA) |
| 3 | Hick's Law | Hick 1952 | 카테고리 5장 한 줄 | 2+3 분리 (단품/번들) |
| 4 | Gestalt proximity / similarity | Wertheimer 1923 | 베타 안내 카드만 키 비대칭 | `grid-rows-1fr` + `line-clamp-2` |
| 5 | F-pattern 시선 | Nielsen 2006 | 좌→우→아래 흐름 무시 | 좌측 강조 + 정렬 탭 상단 |
| 6 | Cognitive load (extraneous) | Sweller 1988 | 9줄 디스클로저 셀 누적 | ⓘ 펼침 (외화) |
| 7 | Visual rhythm / alignment | Tufte 1990 | 행 높이 들쭉 | 고정 행 + 카드 모드 |

### C4. 현 시스템 정찰 (잠금된 사실)

`src/components/Hero/CategoryGrid.tsx`:
- 5 카테고리 enum `TARIFF_CATEGORIES` (ADR-0042 §D1, line 19).
- `grid-cols-1 md:grid-cols-3 lg:grid-cols-5` (line 171) — 데스크탑 5열 strict.
- `CardDescription`에 `line-clamp-2 min-h-[2.5em]` 적용 (line 191) — *부분 적용*. 하지만 `Card` 전체에 `flex h-full flex-col justify-between` 만 (line 184), `grid-rows-1fr` 부재 → 인접 카드 간 높이 동기화 X.
- `PriceExample` graceful degradation (line 78~111) — DB 조회 실패 시 `pendingLabel` 표시. 카드별 `showExamples` 일관성은 prop 단일 → 카드 간 비대칭은 데이터 가용성에 기인.

`src/app/[locale]/r/[shortId]/_components/ComparisonTable.tsx`:
- Desktop native `<table>` (line 5) + 모바일 카드 stack 패턴 의도됨.
- `'result.table'` i18n 네임스페이스 (line 17) — `formatRelativeTime` (`stale.ts`) 호출 시 locale 정합 점검 필요 (v1 한/영 혼재 원인 후보).
- 색상 neutral 잠금 (line 12) — pre-attentive 채널 *의도적 미사용*. 본 ADR §결정 D6 = 다크패턴 회피 vs pre-attentive 회복 trade-off 잠금.

### C5. 운영 제약

- 운영자 €300/월 cap + 솔로 사이드 (ADR-0004 §결정 2).
- 5 locale (ko/en/nl-BE/nl-NL/fr-BE/fr-LU) i18n 정합 — 한국어 본문, 영어/네덜란드어/프랑스어 키만 (운영자 명시).
- ADR-0034 D2 = **통신 BE 만 깊게**.
- ADR-0046 페이즈 4 종료 정합 (4.5.3 시간 트랙 [~] 유지 — 베타 + 6개월 후 회고).
- ADR-0048 페이즈 6 일괄 격상 직후 — 신규 UI 작업은 *코드 신설* 트랙 (페이즈 6 footnote 격상 X).
- 헌법 §3 P1 (정보 우선 source/fetched_at), §3 P2 (5분 5단계 + LCP 2.5s), §3 P3 (투명성 알고리즘 노출), §8 #2 (가격 가공 X), §8 #3 (다크패턴 0).

---

## 결정 (Decision)

### D1. 홈 카테고리 그리드 — 2+3 분리 + 고정 높이 + 베타 외화

- `grid-cols-1 md:grid-cols-3 lg:grid-cols-5` (현재) → **2행 분리**:
  - 1행 단품 2장 `lg:grid-cols-2` (`mobile`, `internet_fixed`).
  - 2행 번들 3장 `lg:grid-cols-3` (`bundle_mobile_internet`, `bundle_internet_tv`, `bundle_mobile_internet_tv`).
  - 행 간 헤더 라벨 `t('home.categories.singles')` / `t('home.categories.bundles')` — Gestalt proximity (원칙 4).
- 카드 고정 높이 잠금: `Card` 컨테이너에 `min-h-[180px]` (compact) / `min-h-[220px]` (full) + `CardDescription`에 기존 `line-clamp-2` 유지.
- 베타 안내 → 카드 우상단 `<Badge variant="beta">` 외화 (별 컴포넌트, 신규). 본문 텍스트에서 제거 → 콘텐츠 양 대칭 회복 (원칙 4, 7).
- 가운데 카드 임의 하이라이트 제거 — `hover:` 만 유지, 정찰 단계 = `showExamples` prop 활성/비활성 카드 시각 분기 0건 잠금.

### D2. 결과 표 — 7컬럼 표 → 수평 펼침 카드 리스트

- Desktop `<table>` (ComparisonTable.tsx line 5 의도) → **수평 카드 리스트** (`<ul role="list">` + `<li>` 카드) 전환.
- 청크 4 잠금 (원칙 2 Cowan):
  - **C1 플랜** (CARRIER + PLAN 이름 + 약정 개월).
  - **C2 요금** (`€XX/mo` 큰 typography + 약정 footnote).
  - **C3 절약** — 정규화 막대 + `+€X/mo` (pre-attentive 색·길이 발현, 원칙 1).
  - **C4 CTA** ("Change" 버튼 + 신뢰도 5점 도트 micro-visual).
- 디스클로저 9줄 → `<details><summary>ⓘ</summary>` 펼침 (원칙 6 extraneous load 외화). 펼침 닫힌 상태 행 높이 균일 잠금.
- Reliability `"High"` 토큰 → 5점 도트 시각 + 정량 점수 tooltip (`reliability_score`, ADR-0006 정합 — 신규 컬럼 없음 / 기존 `confidence` enum 5단 매핑).
- i18n 한/영 혼재 봉합: `formatRelativeTime` (`/r/[shortId]/_lib/stale.ts`) 호출 시 `useLocale()` 또는 `getLocale()` 정합 점검 — ADR-0033 §T5 S2 (컴포넌트 t() 소비) 누락 1건 추정, 본 ADR P3 sweep 동반.

### D3. 정렬 탭 + "why this order?" 펼침 (P3 알고리즘 투명성)

- 정렬 탭 (Cheapest / Most saved / Best value / Most reliable) 4개 — URL params + RSC 재렌더 (ADR-0021 §SC-F 정합, dep 0).
- **"why this order?"** 펼침 — 각 정렬 알고리즘 1~2 문장 설명 + ADR-0010 §T5 confidence floor 노출. 헌법 P3 "투명성 운영자의 짐" 정합.

### D4. 신선도 띠 + 제외 공급사 명시 (P1 + P3)

- 결과 카드 상단 얇은 띠 (`<div className="bg-bg-warm text-xs">`) — `"Price refreshed 23 min ago · source: proximus.be"` (`fetched_at` + `source_url`, ADR-0006 정합).
- 제외 공급사 = `ExcludedProvidersSection.tsx` (이미 존재, ADR-0021 §T6) 본 ADR D4 강조 보존 — `"ENGIE는 API 미제공으로 제외"` 패턴 정합 (헌법 P3 신조).

### D5. 다나와 슬롯 (최대 3) + 큐레이션 3장 (Wirecutter)

- **다나와 슬롯**: 결과 카드 리스트 우상단 `[+ Compare]` 토글 → 최대 3개 슬롯 선택 → 표 모드 진입 (선택된 3개만 7컬럼 표 — 결정 단계 진입 시에만).
- **Pieter's picks 3장**: 결과 카드 리스트 상단 큐레이션 영역 (`"Our pick / Runner-up / Budget pick"` 3장 패턴). 외부 인증 부재(베네룩스 TÜV 동급 없음) 대안 = 운영자 직접 큐레이션 + `"why these?"` 펼침으로 *큐레이션 편향 위험* 봉합 (헌법 P3 + ADR-0026 bias-audit 정합).

### D6. 다크패턴 회피 vs pre-attentive 회복 trade-off 잠금

- 현 ComparisonTable.tsx line 10~12 "절약액 강조 색상 X" 주석 = **본 ADR D2가 일부 완화**.
- 잠금 규칙:
  - 절약 막대 = pre-attentive 발현 허용 (정규화 길이 + 단일 색상 `text-accent-dark`).
  - 1위 카드 임의 하이라이트 / "추천" 라벨 / "X명이 보고 있어요" / 색상 다중화 = **전면 금지 잠금**.
  - 헌법 §8 #3 정합 + ADR-0026 §T4 bias-audit 통과 트리거 (월요일 06:00 UTC, ADR-0048 §D6 6.7 cross-ref).

### D7. 모바일 우선 + LCP 예산 정합

- 360×640 fold 1 카드 완전 노출 + 정렬 탭 일부 노출.
- Lighthouse LCP ≤ 2.5s 잠금 (ADR-0023 §T4 정합) — Pieter's picks 큐레이션 영역은 ISR (3600s, ADR-0041 D7.4 동형).
- 새 의존성 0 (절약 막대 = Tailwind only / 정렬 탭 = URL params + RSC).

---

## 미결 (운영자 잠금 대기)

### Q1. 산출물 범위

builder 진입 게이트 사이즈 분해:
- **P1** 홈 그리드 (2+3 분리 + 베타 배지) — **1일** (CategoryGrid.tsx + Badge 신설 + i18n entries 6 × 5 locale).
- **P2** 결과 카드 리스트 (7컬럼 → 청크 4 카드) — **3일** (ComparisonTable.tsx 전환 + 디스클로저 펼침 + 절약 막대).
- **P3** 정렬 탭 + 신선도 띠 + i18n 봉합 — **1일** (URL params + RSC + stale.ts locale 정합).
- **P4** Pieter's picks 큐레이션 인프라 — **2일** (Q2 콘텐츠 모델 잠금 후).
- **P5** 다나와 슬롯 (최대 3) + 표 모드 진입 — **5일** (sessionStorage 슬롯 + 표 모드 토글 + 비교 슬롯 컴포넌트 신설).

운영자 옵션:
- (A) P1+P2 만 (4일, 최소 회복 — UX 즉시 효과 ≥ 70% 추정).
- (B) P1~P3 (5일, 즉시 효과 + P3 알고리즘 투명성 정합).
- (C) P1~P5 (12일, 다나와/Wirecutter 풀 흡수, 베타 진입 게이트는 §C5 ADR-0034 D2 영향 0).

architect 권고 = **(B) P1~P3** (즉시 회복 + P3 정합 잠금, P4/P5는 베타 트래픽 신호 누적 후 별 ADR — Pieter's picks 콘텐츠 모델 결정도 데이터 신호 후가 적정).

### Q2. Pieter's picks 큐레이션 콘텐츠 모델

대안:
- **A. DB 테이블** (`curated_pick` — provider_id / tariff_id / pick_type / rationale_md / fetched_at) — 운영자 admin UI 편집 가능, 시계열 추적. 단점 = 신설 테이블 + admin UI 작업 +2일.
- **B. JSON 파일** (`src/data/curated-picks.json`) — Git 커밋 기반 편집 이력. 단점 = 운영자 코드 편집 의존 (CLAUDE.md `feedback_learning_mode` 정합도 낮음).
- **C. MDX** (`src/content/picks/{category}.mdx`) — 운영자 자체 카피 + 마크업 자유도. 단점 = MDX 의존 신규 (ADR-0034 D2 외 dep 증가 위험).

architect 권고 = **A. DB 테이블** 신설 → 별도 **ADR-0051** 트리거 (Q1 (B) 잠금 후 P4 진입 시점). 이유 = ADR-0027 affiliate-rate static const 옵션 C 정합 패턴 (정적 → 트리거 시 DB 마이그레이션) + bias-audit 시계열 추적 정합.

### Q3. PLAN 갱신 위치

- (가) **페이즈 6 항목 6.11~6.15 추가** — 6.10 외부 GDPR 감사와 동일 페이즈 = 운영 인프라 트랙. 단점 = 페이즈 6 ADR-0048 §D6 광의 해석 "Claude 트랙 머지 완료" 잠금 직후 신규 항목 추가 = 헌법 P3 정직성 텐션.
- (나) **페이즈 7 (UX v2) 신설** — 현재 페이즈 7 = "(예약) M24+ 시드/풀타임 평가" (PLAN line 2392~2399). 신설 시 페이즈 7 의미 충돌 → 페이즈 7.5 또는 페이즈 8 신설로 분리 가능.
- (다) **페이즈 4.6 후속 sweep** — 페이즈 4 (어트리뷰션 + 완성) 라운드 컨텍스트에 4.19~4.23 (UI v2 P1~P5) 추가. ADR-0046 페이즈 4 종료 직후 + ADR-0045 §D2 동형 패턴.

architect 권고 = **(다) 페이즈 4.19~4.23 추가** + 페이즈 4 헤더 "UI v2 sweep (Amendment)" 마킹. 이유 = (a) UI v2 = 4.13 hero (ADR-0041) + 4.14 enum (ADR-0042) + 4.16 ZIP 제거 (ADR-0043)의 직접 후속 sweep — 페이즈 의미 정합. (b) 페이즈 6 footnote 격상 직후 페이즈 6에 신설 코드 항목 추가 = ADR-0048 §V1 P3 정직성 텐션 회피. (c) 페이즈 7 (M24+ 시드) 자리홀더 보존.

---

## 대안 (Alternatives)

### Alt 1. 현 7컬럼 표 유지 + 디스클로저만 펼침 외화 (점진 봉합)

- 변경 0건에 가까움 (디스클로저 `<details>` 한 줄).
- 단점 = pre-attentive 미회복 / 7컬럼 폭 깨짐 / Cowan 4±1 위반 잔존. *원칙 6만 부분 회복*.
- 거부 사유 = 운영자 자가 진단 신호 "UX 깨짐" 봉합 부족 + 4.9 organic SEO 런치 conversion 위험 봉합 부족 (ADR-0041 §C2 동형 trigger).

### Alt 2. 표 + 카드 모드 토글 (Danawa 풀 흡수)

- 사용자 선택 토글 (`?mode=table|card` URL param + sessionStorage 잠금).
- 단점 = 토글 비용 (cognitive load — 원칙 6 위반 신설) + 비교 슬롯 3개 잠금 패턴 정합 텐션. 운영자 단일 제품 SoT 정직 = "결정 단계만 표" 정합 거부 위험.
- 거부 사유 = 사이즈 +1일 / 토글 UX 비용. **단** Q1 (C) P5 다나와 슬롯 잠금 = 표 모드 진입 = 결정 단계만 (자동 활성, 토글 0) → Alt 2 부분 흡수 잠금.

### Alt 3. Pieter's picks 0 + 알고리즘 정렬만 (Wirecutter 모델 거부)

- 큐레이션 편향 위험 0 (헌법 §8 #3 + #4 정합 강).
- 단점 = 외부 인증 부재(베네룩스 TÜV 동급 없음) + 정렬 알고리즘 단독 = "왜 이 순서?" 펼침 단일 의존. **사용자 의사결정 부담 (paradox of choice, Schwartz 2004) 잔존**.
- 거부 사유 = §C2 미국 (Wirecutter / NerdWallet / Policygenius) 모델 핵심 가치 누락. 운영자 직접 큐레이션 + bias-audit 시계열 추적 = 헌법 P3 정합 회복 경로 잠금.

---

## 결과 (Consequences)

### ✅ 회복

- **원칙 1** Pre-attentive: 절약 막대 색·길이 발현 → 인지 시간 ≤ 200ms (Healey 1996).
- **원칙 2** Cowan 4±1: 7컬럼 → 4 청크 → 작업 기억 부담 ↓ 43% 추정.
- **원칙 3** Hick's Law: 5 카테고리 → 2+3 분리 → 의사결정 시간 log₂(N) 분기 ↓.
- **원칙 4** Gestalt: `min-h` + `line-clamp-2` + 베타 배지 외화 → 카드 동기화 회복.
- **원칙 5** F-pattern: 정렬 탭 상단 + Pieter's picks 좌측 우선 → 시선 흐름 정합.
- **원칙 6** Cognitive load: 디스클로저 9줄 → ⓘ 펼침 → extraneous load ↓.
- **원칙 7** Visual rhythm: 행 균일 + 카드 모드 분리 → "비교 가능" 시각 신호 회복.
- 헌법 P3 알고리즘 투명성: "why this order?" + "why these picks?" 펼침.
- ADR-0034 D2 정합 (통신 BE 만 깊게 — 본 ADR 범위 보존).

### ⚠️ 잃는 것 / 부채

- **큐레이션 편향 위험** — Pieter's picks 3장 (Wirecutter 모델) → bias-audit 시계열 추적 필요 (ADR-0026 §T4 정합). 회피 = §검증 V4 정량 측정 잠금.
- **표 모드 ↔ 카드 모드 전환 비용** — Q1 (C) P5 다나와 슬롯 잠금 시. 운영자 결정 단계만 표 진입 = 토글 비용 0 잠금.
- **i18n entries 신증** — P1 카테고리 헤더 6 × 5 locale + P2 정렬 탭 8 × 5 locale + P3 알고리즘 설명 12 × 5 locale ≈ 130 entries 추가. DeepL Free 무료 cap (500k/월) 정합 — 영향 < 1%.
- **LCP 위험** — Pieter's picks 큐레이션 영역 ISR 3600s 잠금 → 초기 렌더 비용 추가. ADR-0023 §T4 LCP ≤ 2.5s 잠금 회귀 측정 필요 (§검증 V1).
- **ComparisonTable.tsx 라인 80%+ 재작성** — 기존 test (24 passed/4 skipped, PLAN 3.7) 회귀 위험. 사이즈 +0.5일 (P2 잠금 후 test:run 재작성).

### 운영자 트랙 잔여 (P3 정직성 잠금)

- **Pieter's picks 콘텐츠 작성** = 운영자 직접 트랙 (별 PR, P4 인프라 머지 후).
- **bias-audit 시계열 추적 활성** = ADR-0048 §D6 6.7 cron 등록 후 (운영자 트랙 잔여 = Inngest cron 등록).
- **표 모드 ↔ 카드 모드 회귀 테스트** = e2e 신규 (P5 진입 시).

---

## 검증 방법 (Verification)

### V1. Lighthouse 정합

- LCP ≤ 2.5s (Pieter's picks ISR 3600s 영향 측정) — ADR-0023 §T4 임계값.
- Lighthouse Performance ≥ 90 (Mobile + Desktop) — 회귀 0 잠금.
- 도구: `pnpm harness:perf` (자체 인프라, ADR-0023).

### V2. 4±1 청크 audit

- ComparisonTable 행 1개당 시각 청크 카운트 ≤ 4 (자동화: DOM `data-chunk` attribute 카운트 스크립트).
- 도구: 신규 `pnpm harness:cognitive-chunks` (선택, P2 진입 시 결정).

### V3. i18n 정합

- `pnpm harness:i18n` (ADR-0036 §D2) 누출 0 잠금.
- 한/영 혼재 sweep — `formatRelativeTime` (stale.ts) locale 정합 회귀 테스트 (Vitest 신규 +5 추정).

### V4. 큐레이션 편향 정량 측정

- ADR-0026 §검증 확장 — `pnpm harness:bias` (월요일 06:00 UTC, ADR-0048 §D6 6.7 정합).
- Pieter's picks 3장 어필리에이트 클릭률 vs 알고리즘 정렬 1~3위 클릭률 비교 — 30일 누적 시 ±20% 초과 시 architect 재호출 트리거.
- 도구: `scripts/harness/bias-audit.ts` 확장 (P4 머지 시 동반).

### V5. 헛데이터 비교 (가짜 데이터 정합)

- 3 fetcher 결과(Proximus / Telenet / Orange BE) 정확히 표시 — 가공 0 (헌법 §8 #2).
- 정렬 4종 알고리즘 단위 테스트 — Cheapest = `monthlyPriceCents ASC` / Most saved = `savings DESC` / Best value = `(savings / monthlyPriceCents) DESC` / Most reliable = `confidence DESC`.
- 도구: Vitest (`ComparisonTable.sort.test.tsx` 신규).

---

## 빌드 분할 (Build Phases)

본 ADR §결정 D1~D7 → builder 진입 게이트 5단:

| # | 트랙 | 사이즈 | 의존 | 결정 cross-ref |
|---|---|---|---|---|
| **P1** | 홈 그리드 (2+3 분리 + 베타 배지) | 1d | (없음) | D1 |
| **P2** | 결과 카드 리스트 (7컬럼 → 청크 4) | 3d | (없음) | D2, D6 |
| **P3** | 정렬 탭 + 신선도 띠 + i18n 봉합 | 1d | P2 | D3, D4 |
| **P4** | Pieter's picks 큐레이션 인프라 | 2d | Q2 잠금 (ADR-0051) | D5 |
| **P5** | 다나와 슬롯 (max 3) + 표 모드 진입 | 5d | P3 | D5, Alt 2 |

운영자 Q1 선택 옵션 = (A) P1+P2 / **(B) P1~P3 architect 권고** / (C) P1~P5.

---

## 관련 ADR Cross-ref

- [ADR-0010](0010-comparison-engine.md) §T5 confidence floor — 본 ADR D2 신뢰도 5점 도트 매핑 정합.
- [ADR-0011](0011-data-sources-page-and-caveats-boundary.md) §T2 0 데이터 정직 토큰 — 본 ADR D4 신선도 띠 정합.
- [ADR-0016](0016-phase-2-input-flow-design.md) §T1 5단계 골격 — 본 ADR §C5 P2 5분 5단계 잠금 정합.
- [ADR-0021](0021-phase-3-results-page-design.md) §T2 2층 비교 표 + §SC-F URL params — 본 ADR D2/D3 정합 (T2 7컬럼 = 본 ADR이 청크 4로 재정의).
- [ADR-0023](0023-lighthouse-axe-perf-harness.md) §T4 LCP ≤ 2.5s — 본 ADR §V1 정합.
- [ADR-0026](0026-affiliate-click-and-attribution.md) §T4 bias-audit — 본 ADR §V4 Pieter's picks 정량 측정 정합.
- [ADR-0027](0027-affiliate-rate-data-source.md) 옵션 C 정적 const → 트리거 시 DB — Q2 ADR-0051 콘텐츠 모델 정합 패턴.
- [ADR-0033](0033-i18n-next-intl-introduction.md) §T5 S2 컴포넌트 t() 소비 — 본 ADR D2 i18n 한/영 혼재 봉합 정합.
- [ADR-0034](0034-strategy-pivot-completion-first-seo-launch.md) §D2 통신 BE 만 — 본 ADR §C5 범위 잠금 정합.
- [ADR-0036](0036-i18n-completion-zod-harness-locale-switcher.md) §D2 harness:i18n — 본 ADR §V3 정합.
- [ADR-0041](0041-home-hero-redesign.md) D1 5블록 + D7.4 ISR 3600s — 본 ADR D1 홈 그리드 후속 sweep + D7 Pieter's picks ISR 정합.
- [ADR-0042](0042-telecom-bundle-taxonomy-extension.md) §D4 5 카드 — 본 ADR D1 2+3 분리 후속 sweep.
- [ADR-0043](0043-telecom-flow-zip-removal-data-model-preservation.md) ZIP 제거 — 본 ADR §C1 통신 흐름 정합.
- [ADR-0046](0046-phase-4-closure.md) 페이즈 4 종료 — 본 ADR Q3 (다) 4.19~4.23 sweep 잠금 정합.
- [ADR-0048](0048-phase-6-bulk-promotion-option-c.md) §D6 광의 해석 + §V1 P3 정직성 — 본 ADR Q3 (가) 거부 사유 정합.

---

## 다음 단계 (Next Steps)

1. **운영자 잠금 게이트** — §미결 Q1 (범위) + Q2 (콘텐츠 모델) + Q3 (PLAN 위치) 잠금.
2. Q1 (B) 잠금 시 → P1 builder 진입 게이트 열림 (사이즈 5일, CategoryGrid.tsx + ComparisonTable.tsx + 정렬 탭 + i18n 봉합).
3. Q2 잠금 (DB / JSON / MDX) → ADR-0051 trigger (P4 진입 게이트).
4. Q3 잠금 (페이즈 4.19~4.23 / 페이즈 6 6.11~6.15 / 페이즈 7) → PLAN 갱신 (verifier 통과 후 plan-tracker).
5. mockup 추가 검증 필요 vs P1 즉시 builder 진입 — 운영자 판단 (architect 권고 = mockup 1장 추가 = 결과 카드 청크 4 시각 정합 잠금 후 P1 진입).
