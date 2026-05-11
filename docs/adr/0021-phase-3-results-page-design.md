# ADR-0021: 페이즈 3 결과 페이지 설계 — 3층 구조 / caveats UI / `/api/compare` 풀 구현

## Status

**Accepted — T1~T8 + T9 옵션 D + T10 + T11 SC-H + SC-F + SC-G 채택 (2026-05-10)**.
운영자 GATE-N 검토 결과 ADR §결정 그대로 + 4 분기 모두 권장 채택. T4 Radix
Checkbox는 SC-F 채택(URL params + RSC, dep 0)으로 자동 대체 — builder 시점
native HTML `<input type="checkbox">` 사용. 후속:
- verifier 가 PLAN 3.1~3.7 + §1.13 본문에 §T1~T11 cross-ref + SC 표기 갱신
- 페이즈 3 진입 시점 (M6 시작) builder 가 §다음 단계 명세대로 8~12 신설/변경
- 외부 의존성 추가 = **0건** (SC-F + 자체 Badge 구현)

**격상 이력**:
- Proposed (2026-05-10) — T1~T11 11 결정 + SC-F/G/H 신설 + 옵션 D 채택
- Accepted (2026-05-10) — 운영자 GATE-N 통과, 4 분기 모두 권장 채택
- **Amendment 1 (2026-05-11)** — §T9 옵션 D **철회**: 인쇄 친화 뷰(`@media print`)
  를 페이즈 6 → **페이즈 3 환원** (별도 ADR-PRINT 미신설, Amendment 가 대체).
  단일 print stylesheet + Tailwind `print:` — 새 dep·새 라우트 0. 상세는 본문
  §T9 직후 `#### T9 Amendment 1` 섹션. (§T5/§T7 후속 Amendment 도 같은 날짜대 —
  결과 페이지 라운드 c/d 의 calculation-details/caveat-triggers 보강.)

본 ADR 은 **결정 + 인계 명세** 만 담는다. 코드 변경 0. 외부 의존성 추가 0
(SC-F URL params, T4 native checkbox). DB schema 무변동 (ADR-0006/0007 그대로).
OCR (T11 SC-H) 은 페이즈 3 결과 페이지 *직후* 별도 ADR-OCR 신설 트리거.

## Context

### 본 ADR 이 다루는 항목

- **PLAN 3.1** — 1층 결론 카드 (1위 추천 + 연간 절약액 + "변경하기" CTA)
- **PLAN 3.2** — 2층 비교 표 (상위 5개, 6 컬럼, 정렬+필터)
- **PLAN 3.3** — 3층 원본 링크 ("공식 요금제 페이지 보기" + "마지막 확인: X시간 전")
- **PLAN 3.4** — 제외된 공급사 섹션 (P3 정직성)
- **PLAN 3.5** — 계산 근거 펼치기 (가정/사용량/산식)
- **PLAN 3.6** — 공유 가능한 영구 링크 `/r/[shortId]` (스냅샷 영구 보관)
- **PLAN 3.7** — 인쇄 친화 뷰 (`@media print`) — 옵션 D 분기
- **PLAN 1.13** caveats UI 배치 — ADR-0011 §T3 예약 발동
- **페이즈 2 1차 부채 종결**:
  - `/api/compare` stub → 풀 구현 (DB insert + compare() 호출)
  - `/r/[shortId]` placeholder → 풀 결과 페이지
  - `current-provider` sub-step 요금제 선택 (ADR-0016 §T5) — disabled → 활성
  - bill OCR (ADR-0016 §T6 SC-A) — T11 분기에 따라 본 ADR 또는 별도 ADR
- **PLAN T3 SC-B 발동** — NL/LU 우편번호 추가 (ADR-0016 §T3 본문 "페이즈 3 진입
  직전 추가")

### 본 ADR 이 *결정하지 않는* 것

- **어트리뷰션 시스템** (PLAN 4.1) — 페이즈 4 전환 플로우 ADR. "변경하기" CTA
  의 *click 이벤트* 만 본 ADR §T1 결정 (실 어필리에이트 redirect 로직은 4.1).
- **베타 모집 카피** (PLAN 4.6) — 페이즈 4 ADR.
- **카테고리 확장** (PLAN 5.1) — M16 평가 게이트 후.
- **GDPR 도구 풀 구현** (PLAN 6.4) — 페이즈 6 ADR.
- **인쇄 뷰 풀 구현** — 옵션 D 채택 시 페이즈 6 이연 (본 ADR §T9).

### 본 ADR 이 직접 받는 의존성

- **헌법 §3 P1** (정보 우선) — 결과 페이지 모든 숫자에 source_url + fetched_at +
  confidence 첨부 (1.10 /data-sources 동형 정합).
- **헌법 §3 P2** (쉽고 빠르게) — Lighthouse 모바일 ≥ 90 (Perf/Acc/BP/SEO).
- **헌법 §3 P3** (투명성) — 제외 공급사 + 계산 근거 + 영구 링크 + caveats
  사용자 노출.
- **헌법 §8 #2** (가격 가공 X) — 비교 엔진 출력만 그대로 표시. 결과 페이지에
  서 추가 산술 0.
- **헌법 §8 #4** (광고 ↔ 비교 분리) — 결과 페이지에 광고 영역 0 (페이즈 6
  Slim Plus 진입 시 별도 ADR).
- **ADR-0006 §T7** — `tariff_snapshot` 의 `(tariff_id, fetched_at DESC)` 인덱스
  + DISTINCT ON 쿼리 패턴. /api/compare 후보 SELECT 의 hot path.
- **ADR-0007 §T6** — `comparison_result` (1) ↔ `comparison_result_item` (N).
  본 ADR §T2 의 결과 카드 + 비교 표 자연 매핑.
- **ADR-0007 §T7** — nanoid 12자 shortId. 페이즈 2 1차 stub 에서 이미 도입,
  페이즈 3 풀 구현에서 lookup 패턴 신설.
- **ADR-0007 §T9** — `lockedInputs` JSONB 봉인 + 90일 후 NULL. 결과 페이지가
  90일 후 *입력 부재* 상태에도 결과만 표시 가능해야 함 (P3 정직 노출).
- **ADR-0007 §T10** — 비교 엔진 호출 동기 + 5초 timeout. 본 ADR §T3 정합.
- **ADR-0010 §T6** — `deriveCaveats()` 순수 함수 8 규칙. 본 ADR §T5 의 caveats
  UI 배치 결정의 함수 차원 산물.
- **ADR-0010 §T5** — confidence floor `min(현재, 후보)`. 본 ADR §T2 비교 표
  "신뢰도" 컬럼 + §T7 계산 근거 노출.
- **ADR-0011 §T2** — `/data-sources` 표시 항목 6개. 본 ADR §T6 제외 공급사
  섹션의 형식 근거.
- **ADR-0011 §T3** — caveats UI 경계 *예약 결정* — 본 ADR §T5 발동.
- **ADR-0011 §T4** — 새 의존성 0 (GATE-C). 본 ADR §T11 차트 라이브러리 + OCR
  분기에 GATE-C amend 트리거.
- **ADR-0016 §T7** — preview → /r/[shortId] redirect. 본 ADR §T1 풀 페이지로
  격상.
- **ADR-0016 §T8** — sessionStorage 90일 자동 정리. 본 ADR §T2 결과 페이지 진입
  시점 sessionStorage 정리 결정.

### 본 ADR 이 여는 후속

- 페이즈 3 builder 인계 = 8~12 신설/변경 파일 (§다음 단계)
- 페이즈 4 어트리뷰션 ADR (PLAN 4.1) — 본 ADR §T1 "변경하기" CTA event 매핑
- 페이즈 6 인쇄 뷰 ADR (옵션 D 채택 시) — 본 ADR §T9
- 가칭 ADR-OCR (T11 별도 분기) — 본 ADR §T11

### 운영자 컨텍스트 (`docs/FOUNDER.md`)

- 솔로 사이드, 주 10-20 시간, 월 €300 ALL-IN cap
- 한국어 모국어 — 페이즈 4 베타 직전 i18n 일괄 도입 (ADR-0016 §T10 SC-E)
- 학습자 모드 — *왜 이 결정인지* 코드 코멘트로 설명
- M4~M5 페이즈 2 종료 → 본 ADR Proposed → M5 말 운영자 GATE-N → M6 진입
  시 builder 라운드 (페이즈 3 시작)

### 외부 사실 (검증된 출처 — 2026-05-10)

- **Lighthouse 4 카테고리 ≥ 90** — Performance / Accessibility / Best Practices
  / SEO. 본 ADR §검증 기준. 출처: [Lighthouse Scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring).
- **Next.js App Router `generateMetadata`** — 동적 OG/title 생성. /r/[shortId]
  영구 링크 SEO 표면. 출처: [Next.js — generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata).
- **Next.js App Router `notFound()`** — 잘못된 shortId 진입 시 404. 출처:
  [Next.js — notFound](https://nextjs.org/docs/app/api-reference/functions/not-found).
- **PostgreSQL DISTINCT ON** — `tariff_snapshot` 후보 SELECT (ADR-0006 §T7).
  출처: [PostgreSQL — DISTINCT ON](https://www.postgresql.org/docs/16/sql-select.html#SQL-DISTINCT).
- **NL 우편번호 PC4/PC6** — 1011 / 1011 AB 형식. 출처: [Universal Postal
  Union — Netherlands](https://www.upu.int/UPU/media/upu/files/postalSolutions/postalCodes/netherlandsEn.pdf).
- **LU 우편번호** — 4자리 숫자 1000~9999 (BE와 동일 형식, country 분기 필수).
  출처: [Universal Postal Union — Luxembourg](https://www.upu.int/UPU/media/upu/files/postalSolutions/postalCodes/luxembourgEn.pdf).

## Decision — T1~T11 11 결정

### T1 — 라우팅 = `/r/[shortId]` 풀 페이지 (페이즈 2 placeholder 격상)

페이즈 2 1차 placeholder 를 *풀 결과 페이지* 로 교체. URL 모양 변동 0
(영구 링크 호환).

**페이지 구성** (`src/app/r/[shortId]/page.tsx`, RSC + ISR `revalidate=3600`):
- 헤더 (sticky 아님): "당신을 위한 추천 [카테고리]" + 생성 시각 ("X시간 전")
- §T2 1층 결론 카드
- §T2 2층 비교 표
- §T6 제외 공급사 섹션
- §T7 계산 근거 펼치기 (`<details>`)
- 푸터: 영구 링크 복사 버튼 + GDPR Art. 6(1)(b) 인용 + /legal/affiliate-disclosure
  링크 (페이즈 4 진입 시 활성)

**진입 경로**:
- `/compare/[category]/preview` 자동 제출 후 redirect (ADR-0016 §T7 그대로)
- 직접 URL 진입 (영구 링크) — sessionStorage 0 가정, DB만 의존
- SNS/메일 공유 (페이즈 4 베타 모집 시점 활성)

**잘못된 shortId 처리**: `notFound()` (Next.js App Router) → `not-found.tsx`
한국어 안내 ("이 결과는 더 이상 존재하지 않습니다. 새로 비교를 시작하세요.")
+ `/compare` CTA.

**shortId 형식 검증 부록 (Sub-task 4, 2026-05-10)**: 라우트 진입 시 정규식
`/^[A-Za-z0-9_-]{12}$/` 강제 (ADR-0007 §T7 Amendment 1 정합 — nanoid default
URL-safe 64-char alphabet × 12자). 형식 미달 시 `notFound()` 즉시 호출. **DB
존재 여부 검증은 별도 작업** — Sub-task 5 (`/api/compare` 풀 + comparison_result
SELECT) 진입 시점에 추가.

**근거**:
- 페이즈 2 placeholder 와 URL 모양 동일 → 영구 링크 호환 (ADR-0007 §T7).
- RSC + ISR `revalidate=3600` = 같은 shortId 에 대한 첫 진입 후 1시간 캐시
  → 영구 링크 SNS 공유 부하 흡수 + Vercel ISR 무료 티어 정합.
- `notFound()` 표준 Next.js 패턴 + 학습자 모드 친화 (디버깅 시 명확).

**거부된 대안 — `/results/[id]` 신설**:
- 장점: REST 의미 명확.
- 단점: 페이즈 2 1차 `/r/[shortId]` 영구 링크 깨짐 → P1/P3 정직성 위반 (사용자
  공유한 링크 dead).
- 거부 사유: 영구 링크 호환성 절대 우선.

### T2 — 결과 페이지 3층 구조 (단일 페이지, RSC)

**1층 — 결론 카드** (PLAN 3.1):
- 1위 추천 (`comparison_result_item.rank=1` 행)
- 표시 항목:
  - 공급사 로고 (없으면 텍스트) + 요금제 이름
  - 월 비용 (정상 가격 + 프로모 시 첫 N개월 별도 표기)
  - **연간 절약액** (현 가입자 시 양수, 신규 가입자 시 "월 €X 비용" 동형 표기)
  - "변경하기" CTA — 페이즈 4 어트리뷰션 활성 전: `/compare/.../result-detail/[itemId]`
    placeholder (또는 disable 상태 + "베타 후 활성"). 페이즈 4 진입 시 활성.
- 디자인: shadcn/ui `<Card>` 큰 사이즈 (mobile 1열 + md 이상도 1열, 강조)

**2층 — 비교 표** (PLAN 3.2):
- 상위 5개 (`comparison_result_item` rank ≤ 5)
- 6 컬럼: 공급사 / 월 비용 / 절약액 / 약정 / 데이터 한도 (또는 다운로드 Mbps) /
  신뢰도 (high/medium/low 배지)
- **정렬 가능**: 클릭 헤더 → URL search param 갱신 (`?sort=monthly_asc` 등) →
  RSC 재렌더 (no client-side sort state). 학습자 모드 친화 + SEO 정합.
- **필터 가능**: "약정 없음만" / "무제한 데이터만" / "프로모 없는 가격만" 토글 —
  URL search param (`?commitment=none&data=unlimited&promo=exclude`)
- 모바일 (375px): 가로 스크롤 회피 → 카드 stack (각 행 = 카드, 6 컬럼은 row 내
  label-value 쌍)

**3층 — 원본 링크** (PLAN 3.3):
- 비교 표 각 행 우측 ("공식 요금제 페이지 보기" + 외부 링크 아이콘 + rel="nofollow noopener")
- "마지막 확인: X시간 전" — `tariff_snapshot.fetched_at` 인용 (P1 정합)

**SessionStorage 정리**: 결과 페이지 진입 시 `slim:compare:[category]:state` 삭제
(ADR-0016 §T8 비교 완료 = 처리 목적 종료).

**근거**:
- "결론 → 근거 → 원본" 헌법 P1 P3 직접 강제.
- 단일 페이지 + RSC = LCP 보호 (P2 2.5s) + SEO 친화.
- URL search param 정렬/필터 = 사용자 공유 가능 + back 버튼 자연 동작.

**거부된 대안 — 비교 표를 별도 라우트 `/r/[shortId]/compare`**:
- 장점: 결론 카드 LCP 절감.
- 단점: 영구 링크 모양 분기 → P3 단순성 위반. 사용자 공유 시 어느 URL 인지 모호.
- 거부 사유: 단일 영구 링크 = P3 정직 단일성.

### T3 — `/api/compare` 풀 구현 (페이즈 2 stub 종결)

**1. Zod 재검증** (페이즈 2 1차 그대로 유지) — 클라이언트 우회 방어.

**2. comparison_request insert** (ADR-0007 §T2 컬럼 그대로):
```sql
INSERT INTO comparison_request (id, category, postal_code, household_type,
  current_provider_id, input_attributes, created_at, pii_anonymized_at)
VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now(), NULL)
RETURNING id;
```

**3. tariff_snapshot 후보 SELECT** (ADR-0006 §T7 DISTINCT ON):
```sql
SELECT DISTINCT ON (ts.tariff_id) ts.*, t.*, p.*
FROM tariff_snapshot ts
JOIN tariff t ON t.id = ts.tariff_id
JOIN provider p ON p.id = t.provider_id
WHERE t.category = $1
  AND t.is_active = true
  AND p.country = 'BE'
  AND NOT ts.is_anomaly
  AND ts.confidence != 'low'
ORDER BY ts.tariff_id, ts.fetched_at DESC;
```
- 후보 0건 시 빈 결과 (compare() 자연 처리, ADR-0010 §T7 빈 candidates 케이스).
- 페이즈 5 NL/LU/카테고리 확장 시 `p.country` 필터 분기.

**4. 현재 요금제 SELECT** (currentTariffId 명시 시):
```sql
SELECT DISTINCT ON (ts.tariff_id) ts.*, t.*
FROM tariff_snapshot ts
JOIN tariff t ON t.id = ts.tariff_id
WHERE t.id = $1
ORDER BY ts.tariff_id, ts.fetched_at DESC;
```

**5. compare() 호출** (ADR-0010 §CompareInput):
```ts
const result = compare({
  category,
  currentTariff: currentTariffSnapshot, // null = 신규 가입자
  usageProfile: deriveUsageProfile(householdType, inputAttributes),
  candidates: candidateSnapshots,
});
```
- `deriveUsageProfile` 신설 (`src/engine/usage-estimator.ts`) — householdType +
  inputAttributes → ADR-0010 `UsageProfile` 매핑. 페이즈 2 1차 빈 객체 시 *기본
  프로파일* (single = 5GB / 100min, family = 20GB / 200min 등 — 본 ADR §T11
  보조 결정).

**6. comparison_result + comparison_result_item insert**:
```sql
-- result
INSERT INTO comparison_result (id, request_id, short_id, top_monthly_saving_cents,
  top_yearly_saving_cents, top_tariff_snapshot_id, locked_inputs, engine_version,
  created_at, pii_anonymized_at)
VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, now(), NULL)
RETURNING id;
-- items (1..N)
INSERT INTO comparison_result_item (result_id, rank, tariff_snapshot_id,
  monthly_saving_cents, yearly_saving_cents, caveats)
VALUES ...;
```

**7. shortId 반환** (페이즈 2 1차 stub 모양 유지) — 클라이언트는 redirect 만.

**5초 timeout** (ADR-0007 §T10): 전체 흐름 = `Promise.race([impl, timeout(5000)])`.
DB latency + compare() 동기 함수 = 보통 ms 단위 → 5초 마진 충분.

**근거**:
- ADR-0006/0007/0010 그대로 따라가면 풀 구현 = mechanical mapping.
- 단일 트랜잭션은 *불필요* (request insert → SELECT → result insert 간 일관성
  은 RDBMS 기본 ACID 로 충분; 부분 실패 시 result 없이 request 만 남음 = 분석
  가치).

**거부된 대안 — Inngest 비동기 처리**:
- 장점: 5초 timeout 회피 + 큐 처리.
- 단점: 사용자 UX 즉시 결과 vs 폴링 부담. ADR-0007 §T10 동기 5초 정합 위반.
- 거부 사유: 사용자 즉시 응답 우선 + Inngest free 티어 부담.

### T4 — 비교 표 정렬/필터 (PLAN 3.2)

**구현**: URL search params + RSC (no client-side state).

**정렬 기본**: `?sort=monthly_saving_desc` (절약액 큰 순). 다른 옵션:
- `monthly_price_asc` (월 비용 적은 순)
- `commitment_none_first` (약정 없음 먼저)

**필터** (multi-select 가능):
- `?commitment=none` (약정 없음만)
- `?data=unlimited` (mobile 무제한 데이터만)
- `?promo=exclude` (프로모 가격 무시 — 정상 가격으로 비교)

**클라이언트 인터랙션**: shadcn `<Select>` + `<Checkbox>` (Radix Checkbox dep
추가 GATE-C amend) → URL push (`router.push(?...)`)→ RSC 재렌더.

**근거**:
- URL params = SEO + 공유 가능 + back 버튼 자연.
- RSC 재렌더 = client state 동기화 부담 0.
- 학습자 모드 친화 — 디버깅 시 URL 만 보면 정렬/필터 상태 파악.

**거부된 대안 — Zustand/Jotai client-side state**:
- 장점: 빠른 인터랙션 (no roundtrip).
- 단점: 새 dep + URL 공유 시 정렬/필터 상태 누락 → P3 단순성 위반.
- 거부 사유: URL 단일 출처 + dep 0.

### T5 — caveats UI 배치 (PLAN 1.13 + ADR-0011 §T3 발동)

**위치 매트릭스** (8 caveats × 3 노출 위치):

| caveat ID | 결론 카드 (T2 1층) | 비교 표 (T2 2층) | 계산 근거 (T7) |
|---|---|---|---|
| `commitment_24m` | 텍스트 1줄 (강조) | 컬럼 "약정" 값 | 펼치기 안 |
| `commitment_12m` | 텍스트 1줄 | 컬럼 "약정" 값 | 펼치기 안 |
| `activation_fee` | 텍스트 1줄 | 컬럼 "월 비용" 보조 | 펼치기 안 |
| `promo_under_12m` | 텍스트 1줄 (강조) | 컬럼 "월 비용" 보조 | 펼치기 안 |
| `mobile_data_exceeded` | 0 (UX 단순) | 컬럼 "데이터 한도" 표시 | 펼치기 안 |
| `eu_roaming_excluded` | 0 | 컬럼 "데이터 한도" 보조 | 펼치기 안 |
| `bandwidth_below_4k` | 0 | 컬럼 "다운로드 Mbps" 보조 | 펼치기 안 |
| `confidence_low_or_medium` | "신뢰도" 배지 | 컬럼 "신뢰도" 배지 | 펼치기 안 |

**디자인**:
- 결론 카드 caveats: shadcn `<Badge>` (Radix dep 추가 GATE-C) 또는 텍스트 1줄.
  Badge 색상은 *neutral* (다크 패턴 회피 — 빨강/노랑 강조 X).
- 비교 표 caveats: 각 컬럼 보조 텍스트 (작은 글씨 + muted 색상).
- 계산 근거 펼치기: 모든 8 caveats 의 *왜* 트리거됐는지 (예: "24개월 약정이라
  ADR-0010 §T6 caveat #1 트리거") 표기.

**다국어 (페이즈 4 베타 직전 SC-E 발동)**: 본 ADR 페이즈 3 시점은 한국어 단일.

**Amendment 1 (2026-05-10) — caveats-i18n 모듈 미신설 결정**:
ADR-0010 §T6 본문이 "nl-BE 단일 문자열" 명시했으나, 실제 `src/engine/caveats.ts`
구현은 페이즈 1 시점부터 *한국어 직접 출력* (예: "약정 24개월 — 조기 해지 시
위약금 발생"). 따라서 한국어 매핑을 위한 별도 i18n 모듈(원안 `caveats-i18n.ts`)
은 *현 시점 의미 0* — 미신설로 결정. 사유:
- caveats.ts 가 이미 한국어 출력 → 매핑 함수 = identity, 코드 0줄 가치
- 단일 로케일 단계에서 분리는 *불필요한 추상화* (헌법: 가치 없는 추상화 회피)
- ADR-0010 §T6 본문의 "nl-BE 단일" 표현은 페이즈 1 결정 시점의 의도였고, 실
  코드는 한국어로 작성됨 (운영자 한국어 우선 정합)

**향후 트리거 (페이즈 4 베타 직전 SC-E 발동)**:
- next-intl 도입 + 4 locale (한/nl/fr/en) 일괄 시점에 caveats.ts 출력을 *caveat
  ID + 데이터* 모양으로 리팩터 → 별도 i18n 함수 (가칭 `caveats-i18n.ts`) 가 ID →
  로케일별 문자열 매핑. 현 한국어 직접 출력은 그때 ko 메시지 번들로 흡수.
- 본 Amendment 의 회귀 트리거 = ADR-0016 §T10 SC-E 발동 (페이즈 4 i18n ADR).

**근거**:
- 헌법 P3 + ADR-0011 §T3 예약 발동.
- 결론 카드 = 강조, 비교 표 = 정보 밀도, 계산 근거 = 깊이 — 3층 구조 (T2)
  자연 정합.
- 다크 패턴 회피 (헌법 §8 #3) — caveats 색상 neutral.

**거부된 대안 — caveats 모달 노출**:
- 장점: 정보 밀도 ↓ (UX 단순).
- 단점: 클릭 1회 추가 (P2 5분 위반 위험) + 모달 a11y 부담 (focus trap 등) +
  Radix Dialog dep 추가.
- 거부 사유: 헌법 P3 정직 즉시 노출 우선 + dep 0.

### T6 — 제외 공급사 섹션 (PLAN 3.4)

**구성** (`src/app/r/[shortId]/page.tsx` 안 별도 섹션):
- 섹션 헤더: "비교에서 제외된 공급사"
- `provider.excluded_reason IS NOT NULL` 행을 SELECT → 이름 + 사유 직접 표시
- ADR-0011 §T2 항목 3 동형 — `/data-sources` 페이지의 제외 공급사 섹션과 *내용
  동일* (UI 만 다름)
- "왜 제외됐나요?" 펼치기 — 사유 텍스트 (예: "ENGIE 는 API 미제공으로 제외")

**Orange BE 특수 처리** (ADR-0009 §결정 1 정합):
- `excluded_reason = '페이즈 5 평가 후 추가 예정'` (마스터 데이터)
- 베타 시점 "Orange BE 비교 요청" CTA → /data-sources 페이지로 link (click
  event 측정은 페이즈 4 PostHog SC-D 발동 후)

**근거**:
- 헌법 §3 P3 직접 강제 — "비교에서 제외된 공급사도 이름을 밝힌다".
- /data-sources 와 같은 데이터 출처 → 코드 중복 회피 (`getExcludedProviders`
  helper 신설).

### T7 — 계산 근거 펼치기 (PLAN 3.5)

**구현**: HTML `<details>` + `<summary>` (a11y 표준, JS 0).

**노출 항목**:
- 사용한 가정 (예: "single → 5GB/월 + 100min 통화 추정 — `usage-estimator.ts`
  v2026-05-10")
- 사용량 수치 (`comparison_request.input_attributes` 또는 빈 객체 시 추정값)
- 적용 산식 (compare() `breakdown` 필드):
  - `monthlyAvg12Cents` (12개월 평균)
  - `monthlyAvg24Cents` (24개월 평균)
  - `activation_amortized_per_month_cents` (활성화비 12개월 amortize)
- engineVersion 명시 (`compare@2026-05-09` 등 — 결과 재현성)

**caveats 트리거 표기** (T5 매트릭스 - 계산 근거 컬럼):
```
- 약정 24개월 → caveat #1 (deriveCaveats() 트리거)
- 활성화비 €0 → caveat #3 미트리거
- ...
```

**근거**:
- 헌법 P1 정직성 — 모든 숫자 출처 명시.
- `<details>` = 페이즈 2 1차 stub 도구 0 + 학습자 모드 친화 (브라우저 native).
- 90일 후 `lockedInputs` NULL 케이스 처리 — "이 결과는 90일이 지나 입력 부재.
  결과는 그대로 보존됩니다" 정직 표기 (ADR-0007 §T9).

### T8 — 영구 링크 SEO (PLAN 3.6)

**Open Graph** (`generateMetadata` in `/r/[shortId]/page.tsx`):
- `og:title`: "{공급사} {요금제명} — 월 €{절약액} 절약 (Slim 비교 결과)"
- `og:description`: "{카테고리} 비교 결과. 베네룩스 통신/에너지 등 비교는 Slim."
- `og:image`: 페이즈 4 진입 시 동적 OG 이미지 ADR (가칭 ADR-OG). 페이즈 3 1차는
  static 디폴트 이미지.

**robots / sitemap**:
- `/r/[shortId]` 는 **`robots: { index: false, follow: true }`** (개별 결과는
  검색 엔진 인덱스 X — 사용자 PII 파생물). PLAN 3.5.2 sitemap.xml 정합 (개별
  shortId 미포함, 카테고리 랜딩만).
- `/compare`, `/data-sources` 는 인덱스 OK (PLAN 3.5.2 페이즈 3.5).

**`<link rel="canonical">`** = 항상 `https://slim.lu/r/{shortId}` (도메인은
ADR-0020 §결정 7).

**근거**:
- 영구 링크 = 외부 공유 핵심 채널 (페이즈 4 베타 카피 정합).
- noindex = PII 파생물 보호 (헌법 §8 #5 정합 — Recital 26 익명 분류이지만
  보수적).
- 동적 OG 이미지는 페이즈 4 ADR 로 분리 — 본 ADR 범위 외.

### T9 — 인쇄 친화 뷰 (PLAN 3.7) = 옵션 D 채택 → 페이즈 6 이연

**옵션 D 채택**: 인쇄 뷰 (`@media print`) 를 페이즈 6 으로 미룸. PLAN.md scope
cut 옵션 D 명시 적용.

**페이즈 3 1차에서는**: `/r/[shortId]` 가 *기본 브라우저 인쇄* 시 가독성 OK
정도만 보장 (CSS reset + 기본 색상 contrast). 별도 `@media print` 규칙 0.

**페이즈 6 진입 시 추가 ADR** (가칭 ADR-PRINT) — 시니어 사용자 + B2B 사용
사례 트리거.

**근거**:
- ADR-0003 §결정 6 옵션 D 정합.
- 베타 영향 0 (옵션 D 본문 인용).
- 솔로 시간 보존.

---

#### T9 Amendment 1 (2026-05-11) — 인쇄 친화 뷰 페이즈 3 환원 (옵션 D 거부)

> **상태**: 채택 (2026-05-11). 본 §T9 원문(옵션 D = 페이즈 6 이연)은 기록으로
> 보존하되, 이 Amendment 가 그 결정을 *대체* 한다. P5 — ADR 은 append-only.

**트리거**: 본 ADR §회귀 트리거 #2 — "GATE-N 에서 운영자 T9 옵션 D 거부 →
본 ADR §T9 Amendment + builder 인계 갱신". 운영자(Kim Wonmin) 가 2026-05-11
GATE-N 사후 검토에서 옵션 D 를 거부, 인쇄 뷰를 페이즈 3 으로 당기기로 결정.

**비대칭 진단 (왜 옵션 D 였고 왜 지금 뒤집나)**:
- *원안(옵션 D) 의 전제* — 인쇄 뷰는 "시니어/B2B 사용 사례" 트리거, 베타 영향
  0, 솔로 시간 sink → 페이즈 6 까지 미뤄도 손해 없음.
- *전제가 무너진 지점* — 페이즈 3 builder 라운드 a~d 가 결과 페이지를 *이미
  풀 구현* 했다 (`ResultConclusionCard` / `ComparisonTable` / `CalculationDetails`
  / `ExcludedProvidersSection` / `ComparisonControls` 전부 존재). 인쇄 뷰는
  "새 UI" 가 아니라 *기존 컴포넌트 트리에 print stylesheet 한 겹* 이다 —
  Tailwind 4 의 `print:` variant 가 이미 내장이라 새 dep·새 라우트 0. 즉
  "큰 작업" 이라는 옵션 D 의 비용 추정이 페이즈 3 풀 구현 *이후* 시점에선
  과대평가다. 지금 하면 = 컨텍스트가 살아있는 상태에서 1 라운드. 페이즈 6
  까지 미루면 = 컴포넌트 구조 재학습 비용 + 그 사이 누적된 변경과 충돌 위험.
- *추가 동인* — "결론 → 근거 → 원본" (P1) 의 종이 사본은 베타 사용자 PDF 보관
  사용 사례에 자연스럽다. 인쇄물에 source/fetched_at·어필리에이트 디스클로저가
  안 보이면 P1/P3 위반인데, 기본 브라우저 인쇄(§T9 원문) 는 nav/footer/disabled
  CTA 까지 다 찍혀 그 품질을 보장 못 한다 → 옵션 D 유지 = P1/P3 리스크를
  페이즈 6 까지 안고 감.

**결정 — 인쇄 뷰 범위·접근**:
- **PLAN 3.7 을 페이즈 3 으로 환원** (체크박스 [ ] 유지, "페이즈 6 이연" 표기
  제거, 페이즈 3 builder 후속 라운드로 전환). 별도 ADR-PRINT 신설 *안 함* —
  본 Amendment 가 그 자리를 차지.
- **접근 = 단일 `@media print` 블록 (`src/app/globals.css`) + 컴포넌트 단위
  Tailwind `print:hidden` / `print:block`**. 새 라우트·새 컴포넌트·새 dep 0.
  - chrome 숨김: nav, footer 장식, sticky 헤더 장식, "새로 비교/홈" CTA 두 개,
    `ComparisonControls`(정렬/필터 `<a>`), disabled "변경하기" CTA.
  - `CalculationDetails` 의 `<details>` 는 인쇄 시 *펼친 상태* — `details[open]`
    강제 또는 print-only 펼친 사본. (builder 가 a11y·중복 최소인 쪽 선택.)
  - 외부 링크: 종이엔 클릭 불가 → `a[href^="http"]::after { content: " (" attr(href) ")" }`
    (단 인쇄 chrome 으로 숨긴 `<a>` 는 제외 — 정렬/필터 링크 URL 노이즈 회피).
  - page-break: 비교 표 행·결론 카드·`<details>` 블록에 `break-inside: avoid`.
  - 색상: 배경색 인쇄 안 됨 가정 → 신뢰도 배지·강조 영역은 *테두리/굵기/텍스트*
    로도 구분 가능해야 함 (배경색에만 의존 금지). `print-color-adjust` 강제 안 함.
  - **P1 강제 — source_url + "마지막 확인: X시간 전" (fetched_at) + engineVersion
    은 인쇄에서도 항상 보임.** 절대 `print:hidden` 대상 아님.
  - **P3 강제 — `/legal/affiliate-disclosure` 링크(인쇄 시 그 URL 텍스트) +
    제외 공급사 섹션은 인쇄에서도 항상 보임.** 푸터를 통째로 숨기지 말고
    푸터 안의 *디스클로저 줄만* 남긴다.
  - **P2 — print stylesheet 는 화면 렌더 경로(LCP)에 0 영향** (`@media print`
    안에만 규칙, 화면 CSS 무변동). harness:perf 회귀 없음 확인.

**거부 대안**:
- *대안 A — 별도 ADR-PRINT 신설*: 단점 = §회귀 트리거 #2 가 이미 "§T9
  Amendment" 경로 명시 → ADR 인플레이션. ADR-0002 "Amendment 1" 선례. **거부.**
- *대안 B — 별도 `/r/[shortId]/print` 라우트 + 전용 RSC*: 단점 = 영구 링크
  단일성(§T1/§T2) 위반 + 컴포넌트 2벌 유지 부채 + ISR 캐시 키 분기. **거부 —
  `@media print` 로 충분, 단일 URL 유지.**
- *대안 C — print-CSS 라이브러리(paged.js 등) 도입*: 단점 = 새 dep(GATE-C) +
  번들 부담 + 1장짜리 결과 페이지에 과잉. **거부.**
- *대안 D (= §T9 원문, 옵션 D) — 페이즈 6 이연 유지*: 위 비대칭 진단으로 거부됨.

**결과**:
- ✅ 인쇄/PDF 사본이 "결론 → 근거 → 원본 + source/fetched_at + 디스클로저" 를
  종이에서도 보장 → P1/P3 의 종이 표면 확보.
- ✅ 페이즈 3 컨텍스트 살아있는 동안 처리 → 페이즈 6 재학습 비용 회피. 새 dep·새 라우트·DB 변동 0.
- ✅ 페이즈 6 의 별도 ADR-PRINT 항목 소멸 → 페이즈 6 scope 1 항목 감소.
- ⚠️ 페이즈 3 builder 후속 라운드 1회 추가 (소규모: print CSS + `print:` 클래스 + e2e print 스냅샷).
- ⚠️ print 회귀 테스트 표면 신설 (`page.emulateMedia({ media: 'print' })`) — 유지 부채 소폭 증가.

**회귀 트리거 (이 Amendment 의)**:
- A. 베타 사용자 인쇄 사본에서 source/fetched_at 또는 어필리에이트 디스클로저
  누락 발견 → 즉시 hotfix + 본 Amendment §결정 P1/P3 강제 항목 재점검.
- B. print stylesheet 추가 후 harness:perf(LCP) 회귀 → P2 위반 → `@media print`
  격리 누수 점검.
- C. paged 인쇄 레이아웃 사용자 요구 강함 → 대안 C(라이브러리 도입) 재평가 + 별도 ADR.
- D. 페이즈 4 i18n(SC-E) 도입 시 `a[href]::after` URL 노출 + 다국어 라벨 충돌
  점검 → 본 Amendment + ADR-0016 §T10 정합.

**PLAN 매핑**:
- **3.7** — "옵션 D / 페이즈 6 이연" 표기 제거 → "Amendment 1 (2026-05-11) — 페이즈 3 환원" + DoD + sub-task `3.7.a`~`3.7.c`.
- 페이즈 3 prologue 주석(옵션 D 언급) → "3.7 도 페이즈 3 (Amendment 1)".
- 작업 추적 메타 표 페이즈 3 행 — 합계 7 유지, 주석 "3.7 페이즈 6 이연 옵션 D" → "3.7 Amendment 1 페이즈 3 환원".
- Scope cut 옵션 표 — "옵션 D: 적용됨" → "옵션 D: **철회됨 (ADR-0021 §T9 Amendment 1, 2026-05-11)** — 3.7 페이즈 3 환원".

### T10 — NL/LU 우편번호 추가 (ADR-0016 §T3 SC-B 발동)

**페이즈 3 진입 직전 (M5 말 또는 M6 초)** `src/types/comparison-input.ts` 의
`postalCodeSchema` 갱신:

```ts
const postalCodeSchema = z.discriminatedUnion('country', [
  z.object({
    country: z.literal('BE'),
    postalCode: z.string().regex(/^[1-9][0-9]{3}$/, '벨기에 우편번호는 1000~9999 4자리'),
  }),
  z.object({
    country: z.literal('NL'),
    // PC4 ("1234") 또는 PC6 ("1234 AB") 둘 다 허용 (UPU NL)
    postalCode: z.string().regex(/^[1-9][0-9]{3}( ?[A-Z]{2})?$/, '네덜란드 우편번호는 1234 또는 1234 AB'),
  }),
  z.object({
    country: z.literal('LU'),
    postalCode: z.string().regex(/^[1-9][0-9]{3}$/, '룩셈부르크 우편번호는 1000~9999 4자리'),
  }),
]);
```

**`/compare/[category]/postal/page.tsx` UI**:
- 국가 선택 `<Select>` 기본 BE (사용자 IP 기반 자동 선택은 헌법 §8 #5 거부 —
  명시 선택 only)
- 국가 선택 시 placeholder 동적 변경 ("예: 1000" / "예: 1011 AB")

**제약**: NL/LU 공급사 fetcher (PLAN 5.1) 부재 시 비교 후보 0 → 결과 페이지에
"네덜란드/룩셈부르크 공급사는 페이즈 5에서 추가 예정. 현재는 비교 후보가 없어
결과를 표시할 수 없습니다." 정직 안내 (ADR-0011 §T2 항목 5 동형).

**근거**:
- ADR-0016 §T3 SC-B 발동 시점 명시 ("페이즈 3 진입 직전").
- discriminatedUnion = Zod 표준 + 학습자 모드 친화.
- 비교 후보 0 시 정직 안내 = P3 정합.

### T11 — OCR 도입 분기 = 별도 ADR-OCR 채택

**옵션 A (권장) — 별도 ADR-OCR 신설**:
- OCR 도입 = tesseract.js (~2MB) + 청구서 5종 수집 + 정확도 튜닝 = 큰 작업
- 본 ADR 결정 묶음에 흡수하면 *결정 폭주*
- 페이즈 3 결과 페이지 *직후* 도입 시점에 별도 ADR (가칭 ADR-OCR)

**옵션 B — 본 ADR §T11 에 OCR 결정 인라인**:
- 장점: 페이즈 3 진입 시 즉시 builder 인계.
- 단점: 본 ADR 분량 ↑↑ + tesseract.js dep + 청구서 수집 절차 = 별도 게이트
  필요.

**본 ADR 권장 = 옵션 A (별도 ADR-OCR)**.

**OCR 미도입 동안 동작**:
- `/compare/[category]/bill` 페이지: 페이즈 2 1차 "청구서 없이 진행" 단일 버튼
  유지 + "청구서 OCR 알림 받기" 이메일 옵션 (페이즈 4 베타 사인업 통합)
- `usage-estimator.ts` 의 *기본 프로파일* (T3 §5 보조) 가 사용량 fallback

**근거**:
- 결정 분리 = 본 ADR scope 보호.
- 페이즈 4 베타 (M8~M10) 일정 무영향.

**거부된 대안 (옵션 C) — OCR 페이즈 5 까지 미룸 (ADR-0003 §결정 6 원안)**:
- 장점: 시간 비용 0.
- 단점: 페이즈 4 베타 사용자 청구서 OCR 가치 측정 데이터 부재 → 페이즈 5 OCR
  도입 의사결정 약함.
- 거부 사유: ADR-0016 §T6 본문 "페이즈 3 결과 페이지 직후 도입" 약속 정합.

## SCOPE CUT 옵션

본 ADR 이 *명시* 하는 SCOPE CUT 4개:

| 옵션 | 결정 | 적용 시점 |
|---|---|---|
| **옵션 D 적용** | 3.7 인쇄 뷰 → 페이즈 6 이연 (T9) | 페이즈 3 1차 = 기본 브라우저 인쇄만 |
| **SC-F (신설)** | 3.2 비교 표 정렬/필터 → URL params 만 (Zustand/Jotai dep 0) | 페이즈 3 1차 (T4) |
| **SC-G (신설)** | 3.6 영구 링크 동적 OG 이미지 → 페이즈 4 진입 시 별도 ADR (가칭 ADR-OG) | 페이즈 3 1차 = static OG (T8) |
| **SC-H (신설)** | OCR 도입 → 별도 ADR-OCR (T11 옵션 A) | 페이즈 3 결과 페이지 *직후* 별도 ADR |

**SC-F/G/H 채택 권장**: 본 ADR §결정 표기 정합. 운영자 GATE-N 답변 필요.

## PLAN 본문 갱신 가이드 (verifier 후속, 본 ADR Accepted 후)

**§3.1**: 본문에 "ADR-0021 §T2 — 1층 결론 카드 (1위 추천 + 연간 절약액 +
변경하기 CTA placeholder, 페이즈 4 어트리뷰션 활성)" 인용.

**§3.2**: 본문에 "ADR-0021 §T2 + §T4 — 비교 표 6 컬럼 + URL params 정렬/필터
(SC-F 적용)" 인용. SC-F 표기.

**§3.3**: 본문에 "ADR-0021 §T2 — 비교 표 각 행 우측 외부 링크 + fetched_at
인용" 인용.

**§3.4**: 본문에 "ADR-0021 §T6 — provider.excluded_reason 직접 표시 +
/data-sources 동형, Orange BE 페이즈 5 안내" 인용.

**§3.5**: 본문에 "ADR-0021 §T7 — `<details>` 펼치기 + 사용량 추정/산식/
engineVersion + caveats 트리거 표기" 인용.

**§3.6**: 본문에 "ADR-0021 §T1 + §T8 — `/r/[shortId]` 풀 페이지 격상 + RSC
ISR 1h + noindex + canonical (SC-G: 동적 OG는 페이즈 4)" 인용. SC-G 표기.

**§3.7**: 본문에 "**옵션 D 적용 (ADR-0021 §T9, 2026-05-10)** — 페이즈 6 이연,
1차는 기본 브라우저 인쇄 가독성만" 인용. **체크박스 [ ] 유지** (페이즈 6 진입
시 [x]).

**페이즈 3 합계**: 7 → **6/7** (3.1~3.6 [x] 마킹 가능 시점은 페이즈 3 builder
종료 후 — 현재는 [ ] 유지). 옵션 D 적용으로 3.7 차단 X (페이즈 6 정상 진입).

**작업 추적 메타 표 갱신**: 페이즈 3 합계 7 (변동 X). "최종 업데이트
2026-05-10".

**Scope cut 옵션 표 갱신**:
- 옵션 D → "**적용됨 (ADR-0021 §T9, 2026-05-10)**" 표기
- 옵션 SC-F / SC-G / SC-H 신설 행 추가

**§1.13 본문 갱신**: caveats UI 배치 결정 = ADR-0021 §T5 8×3 매트릭스. 페이즈 3
builder 종료 후 사용자 노출 [x] 마킹 가능.

## Rejected alternatives — 거부된 대안 (T 별 1개)

| Trade-off | 채택 | 거부된 주요 대안 |
|---|---|---|
| T1 | `/r/[shortId]` 풀 격상 (URL 모양 동일) | `/results/[id]` 신설 (영구 링크 깨짐) |
| T2 | 단일 페이지 3층 + URL params | 별도 라우트 비교 표 (P3 단순성 위반) |
| T3 | 동기 5초 timeout (ADR-0007 §T10) | Inngest 비동기 (UX 폴링 부담) |
| T4 | URL params 정렬/필터 (RSC 재렌더) | Zustand/Jotai client state (dep + 공유 깨짐) |
| T5 | 8×3 매트릭스 인라인 노출 | caveats 모달 (P2 위반 + a11y 부담) |
| T6 | excluded_reason 직접 표시 + /data-sources 동형 | 모달 / 별도 페이지 (P3 정직 즉시 노출 위반) |
| T7 | `<details>` native + caveats 트리거 표기 | JS 펼치기 + 차트 라이브러리 (dep + GATE-C) |
| T8 | noindex + canonical + static OG | 모든 shortId sitemap (PII 파생물 노출 위험) |
| T9 | 옵션 D 페이즈 6 이연 | 페이즈 3 1차 인쇄 뷰 (시간 sink, 베타 영향 0) |
| T10 | discriminatedUnion + 국가 선택 | IP 기반 자동 (헌법 §8 #5) |
| T11 | 별도 ADR-OCR (옵션 A) | 본 ADR 인라인 OCR (분량 폭주) |

## Consequences

### 얻는 것

- 페이즈 3 7 항목 + 1.13 caveats UI + `/api/compare` 풀 + NL/LU 우편번호
  *동시 결정* → builder 진입 시 추가 의사결정 0
- 영구 링크 (페이즈 2 1차 placeholder 와 호환) → 베타 외부 공유 채널 즉시 가용
- ADR-0006/0007/0010/0011/0016 와 *경계 분리* — OCR (T11) / 동적 OG (SC-G) /
  어트리뷰션 (페이즈 4) / 인쇄 뷰 (페이즈 6) 모두 별도 ADR 예약
- 외부 의존성 0~2건 (Radix Checkbox + Badge — T4/T5 SC-G 채택 시) — 월 €300
  cap 영향 0
- DB schema 무변동 (ADR-0006/0007 그대로) — 마이그레이션 0
- 페이즈 4 베타 (M8~M10) 일정 정합 — 본 ADR 통과 후 builder M6~M7 분량으로
  결과 페이지 완성 → M8 베타 진입 가능

### 잃는 것 / 부채

- **인쇄 뷰 부재** — 옵션 D. 시니어 사용자 인쇄 사용 사례 페이즈 6 까지 부재.
- **동적 OG 이미지 부재** — SC-G. 페이즈 4 진입 전 SNS 공유 시각 호소력 ↓.
- **차트/그래프 0** — 가격 시계열 차트 (PLAN 5.1 에너지 BE 차별화 포인트로
  언급) 는 페이즈 5 진입 시 별도 ADR.
- **OCR 부재** — SC-H 별도 ADR-OCR. 페이즈 3 결과 페이지 *직후* 도입 보장.
- **사용량 추정 매핑 정확도 미상** — T3 §5 deriveUsageProfile 의 기본 프로파일
  은 추정. 청구서 OCR (SC-H) + 베타 사용자 피드백 후 보정.
- **NL/LU 비교 후보 0** — 페이즈 5 까지 fetcher 부재. 결과 페이지에 정직 안내
  (T10).

### 후속 작업 (다른 PLAN / ADR 와 연결)

- **GATE-N 통과 직후 (verifier 책임)**:
  - PLAN §3.1~§3.7 본문에 ADR-0021 §T1~T11 cross-ref 추가 (각 1줄)
  - PLAN §3.7 옵션 D "적용됨" 표기, §3.2 SC-F 표기, §3.6 SC-G 표기, §2.5 OCR
    SC-H 신설 표기
  - PLAN Scope cut 옵션 표 갱신 (옵션 D + SC-F/G/H 신설)
  - PLAN §1.13 본문에 ADR-0021 §T5 매트릭스 인용
  - PLAN 작업 추적 메타 표 "최종 업데이트 2026-05-10"
  - INDEX.md ADR-0021 행 추가
  - 본 ADR Status 행 `Proposed` → `Accepted` 격상
- **GATE-N 통과 후 (builder 책임, 페이즈 3 진입 = M6)**:
  - 8~12 신설/변경 파일 (§다음 단계 §)
  - Radix Checkbox + Badge dep 추가 (옵션 SC-F/T5 채택 시) — GATE-C amend
  - Zod schema NL/LU 확장 (T10) — `src/types/comparison-input.ts`
  - `usage-estimator.ts` 신설 (T3 §5)
  - ~~`caveats-i18n.ts` 신설 (T5 한국어 매핑)~~ — **Amendment 1 (2026-05-10) 미신설** (caveats.ts 한국어 직접 출력)
- **페이즈 4 진입 시점 (architect 책임)**:
  - 어트리뷰션 ADR (PLAN 4.1) — "변경하기" CTA event 매핑
  - 동적 OG 이미지 ADR (가칭 ADR-OG) — SC-G 발동
  - PostHog feature flag + funnel ADR (ADR-0016 §T1 SC-D 발동)
  - i18n 일괄 도입 ADR (ADR-0016 §T10 SC-E 발동)
- **페이즈 3 결과 페이지 직후 (architect 책임)**:
  - **별도 ADR-OCR 신설** (T11 옵션 A) — tesseract.js 도입 + 청구서 5종 수집
    + 정확도 튜닝 + UI

### 외부 의존성 추가 — 0~2건 (GATE-N 분기)

- **SC-F 채택 시 (URL params 정렬/필터)**: dep 0 (RSC + Next.js 표준)
- **T5 caveats Badge 사용 시**: 0 (Tailwind 직접 + shadcn Badge 패턴 자체
  구현 — Radix dep 0)
- **T4 필터 Checkbox 사용 시**: `@radix-ui/react-checkbox` (~10KB gzip) — GATE-C
  amend 운영자 명시 승인 필요
- shadcn/ui / Tailwind / Lucide React = 페이즈 0 + 페이즈 2 dep 그대로 (변동 0)

### MONETIZATION.md 영향 — 변동 0

- 비용 cap €300/월 영향 0 (Radix Checkbox dep gzip 부담 ~10KB, Vercel Hobby
  bandwidth 영향 0.001% 미만)
- 베타 모집 카피 (Korean Society) 정합 — 결과 페이지 한국어 단일 (페이즈 4
  베타 직전 i18n 일괄)

## Validation

### 검증 1 — GATE-N (운영자 결정)

운영자 (Kim Wonmin) 가 본 ADR 검토 후 다음 항목 승인:
- T1 — `/r/[shortId]` 풀 격상 (URL 모양 동일)
- T2 — 단일 페이지 3층 구조
- T3 — `/api/compare` 풀 구현 (DB insert + compare() 호출)
- T4 — URL params 정렬/필터 (**SC-F**)
- T5 — caveats UI 8×3 매트릭스
- T6 — excluded_reason 직접 표시
- T7 — `<details>` 계산 근거 펼치기
- T8 — noindex + canonical + static OG (**SC-G**)
- T9 — **옵션 D** (인쇄 뷰 페이즈 6 이연)
- T10 — NL/LU discriminatedUnion 우편번호 (페이즈 3 진입 직전)
- T11 — **SC-H** (OCR 별도 ADR-OCR)

GATE-N 통과 = 본 ADR Status `Proposed` → `Accepted` 격상.

### 검증 2 — builder 종료 후 verifier 체크리스트

- `pnpm typecheck` 0 에러
- `pnpm lint` 0 에러
- `pnpm test` 0 실패 (`/api/compare/route.test.ts` + `usage-estimator.test.ts`
  + `caveats-i18n.test.ts` 신설)
- `pnpm dev` → http://localhost:3000/compare → 5단계 → /r/[shortId] 풀 결과
  페이지 도달 (3층 + caveats + 제외 공급사 + 계산 근거 펼치기 모두 노출)
- e2e/result-page.spec.ts 신설 — 정렬/필터 URL params 5+ 케이스
- e2e/accessibility.spec.ts 갱신 — /r/[shortId] 풀 결과 페이지 axe 0 violations
- `pnpm harness:plan` — PLAN 3.1~3.7 ADR-0021 cross-ref literal 매칭 통과
- Lighthouse 모바일 ≥ 90 (Perf/Acc/BP/SEO) — PLAN 3 검증 명세

### 검증 3 — 영구 링크 검증

- 결과 생성 후 `/r/{shortId}` URL 복사 → 새 시크릿 탭 진입 → 결과 동일 표시
- 90일 후 `lockedInputs` NULL 케이스 → 결과 페이지 "입력 부재 안내" + 결과만
  표시 (ADR-0007 §T9)
- 잘못된 shortId → notFound() 404
- view-source: noindex meta 확인

### 검증 4 — 사용량 추정 매핑 정확도 (T3 §5 deriveUsageProfile)

- 베타 사용자 청구서 5건 수집 (운영자 솔로) → `inputAttributes` 비교
- single 평균 사용량 ±20% 이내면 매핑 OK
- 미달 시 `usage-estimator.ts` Amendment 1 (값 보정)

## 회귀 트리거 (Trigger for revisit)

다음 중 하나 발견 시 ADR-0021 Amendment:

1. **Lighthouse 모바일 < 90** (Perf 또는 Acc 또는 BP 또는 SEO 중 하나) → P2
   위반 → 본 ADR §T2 / §T8 재평가
2. **GATE-N 에서 운영자 T9 옵션 D 거부** (인쇄 뷰 페이즈 3 1차 도입 결정) →
   본 ADR §T9 Amendment + builder 인계 갱신
3. **NL/LU 공급사 fetcher 추가 시점** (페이즈 5 5.1) → T10 *비교 후보 0 안내*
   제거 트리거
4. **OCR 별도 ADR (가칭 ADR-OCR) 진입** → T11 옵션 A 후속, 본 ADR §T11
   Amendment 또는 별도 ADR
5. **어트리뷰션 ADR (페이즈 4 4.1)** → T2 "변경하기" CTA placeholder → 활성
6. **차트 라이브러리 도입** (페이즈 5 에너지 BE 가격 시계열) → T7 계산 근거
   섹션 확장 트리거 + 별도 ADR
7. **/r/[shortId] 인덱스 정책 변경 요청** (베타 후 SEO 부족 발견) → T8
   Amendment + sitemap 정책 재평가
8. **사용량 추정 매핑 정확도 ≤ 60%** (검증 4) → T3 §5 deriveUsageProfile
   Amendment 1
9. **caveats 노출 위치 사용자 피드백 부정** (베타) → T5 매트릭스 Amendment
10. **5초 timeout 초과 발생 1건 이상** (DB latency or compare() 큰 candidates)
    → T3 비동기 분기 (Inngest) 재평가

## 다른 ADR 과의 관계

- **ADR-0006** §T7 DISTINCT ON 패턴 = 본 ADR §T3 후보 SELECT 의 형식 근거.
  ADR-0006 변동 0.
- **ADR-0007** §T6/§T7/§T9/§T10 직접 활용. 본 ADR §T1 영구 링크 + §T3 풀
  구현. ADR-0007 변동 0.
- **ADR-0010** §T6 deriveCaveats() = 본 ADR §T5 매트릭스의 함수 차원 산물.
  §T5 confidence floor = 본 ADR §T2 비교 표 신뢰도 컬럼 + §T7 계산 근거.
  ADR-0010 변동 0.
- **ADR-0011** §T2 = 본 ADR §T6 제외 공급사 섹션의 형식 근거 (둘이 같은 데이터
  출처). §T3 caveats UI 예약 발동 = 본 ADR §T5 매트릭스. §T4 GATE-C 의존성
  = 본 ADR §T4 Radix Checkbox amend 트리거. §T5 i18n SC-3 = 본 ADR §T5
  caveats-i18n.ts (한국어 단일 → 페이즈 4 일괄).
- **ADR-0016** §T7 preview redirect = 본 ADR §T1 풀 페이지 격상 호환. §T3
  SC-B = 본 ADR §T10 NL/LU 발동. §T6 SC-A = 본 ADR §T11 SC-H ADR-OCR. §T8
  sessionStorage = 본 ADR §T2 결과 페이지 진입 시 정리.
- **ADR-0020** §결정 7 slim.lu = 본 ADR §T8 canonical 도메인.
- **ADR-0009** §결정 1 Orange BE 페이즈 5 = 본 ADR §T6 제외 공급사 안내.

## 다음 단계 — builder 인계 명세 (GATE-N 통과 후, 페이즈 3 진입 시)

### 신설 파일 (8~12)

```
src/app/r/[shortId]/page.tsx                    # 풀 결과 페이지 (placeholder 교체, T1+T2)
src/app/r/[shortId]/not-found.tsx               # 잘못된 shortId 404 (T1)
src/app/r/[shortId]/_components/ConclusionCard.tsx        # 1층 결론 카드 (T2)
src/app/r/[shortId]/_components/ComparisonTable.tsx       # 2층 비교 표 (T2+T4)
src/app/r/[shortId]/_components/ExcludedProviders.tsx     # 제외 공급사 (T6)
src/app/r/[shortId]/_components/CalculationDetails.tsx    # 계산 근거 펼치기 (T7)
src/engine/usage-estimator.ts                   # householdType → UsageProfile (T3 §5)
src/engine/usage-estimator.test.ts              # 매핑 단위 테스트
# caveats-i18n.{ts,test.ts} — Amendment 1 (2026-05-10) 미신설.
# caveats.ts 가 이미 한국어 출력. 페이즈 4 i18n ADR 진입 시 재검토.
e2e/result-page.spec.ts                         # 정렬/필터 URL params + 영구 링크 회귀
```

### 변경 파일 (3~5)

```
src/app/api/compare/route.ts                    # stub → 풀 구현 (T3)
src/types/comparison-input.ts                   # NL/LU discriminatedUnion (T10)
src/types/comparison-input.test.ts              # NL/LU 케이스 추가
src/app/compare/[category]/postal/page.tsx      # 국가 선택 추가 (T10)
src/app/compare/[category]/current-provider/page.tsx  # sub-step 요금제 선택 활성 (페이즈 2 1차 disabled 해제)
e2e/accessibility.spec.ts                       # /r/[shortId] 풀 페이지 axe 0 violations
```

### 의존성: 페이즈 0 + 페이즈 2 dep (변동 0~2건)

- 옵션 SC-F 채택 시 (URL params 만): dep 0
- T4 필터 `<Checkbox>` 사용 시: `@radix-ui/react-checkbox` 추가 (GATE-C amend)
- T5 caveats Badge: 자체 구현 (dep 0) 권장

### 운영자 GATE-N 답변 요청

**1. T9 인쇄 뷰**: 옵션 D (페이즈 6 이연, 권장) vs 페이즈 3 1차 도입

**2. T11 OCR**: SC-H 별도 ADR-OCR (옵션 A, 권장) vs 본 ADR 인라인 (옵션 B)

**3. SC-F (URL params 정렬/필터)**: 채택 (dep 0) vs Zustand/Jotai 도입

**4. SC-G (static OG)**: 채택 (페이즈 4 동적 OG) vs 페이즈 3 1차 동적 OG

**5. T4 Radix Checkbox dep**: 추가 vs 자체 native checkbox

위 5 항목 + T1~T8/T10 본 ADR §결정 모두 승인 시 GATE-N 통과 → builder 인계
(페이즈 3 진입 시점 = M6).

## References

### 헌법 + 운영자 컨텍스트

- [`CLAUDE.md`](../../CLAUDE.md) — §3 P1 P2 P3 P4 P5, §8 #2/#3/#4/#5
- [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, 한국어, 학습자 모드, 월 €300

### 관련 ADR

- [ADR-0006](0006-tariff-snapshot-schema.md) — §T7 DISTINCT ON 후보 SELECT
- [ADR-0007](0007-comparison-request-result-schema.md) — §T6/§T7/§T9/§T10 결과
  스키마 + 영구 링크 + 봉인 + 5초 timeout
- [ADR-0009](0009-scope-cut-fetcher-2-providers.md) — §결정 1 Orange BE 제외
- [ADR-0010](0010-comparison-engine.md) — §T5 confidence floor, §T6 deriveCaveats(),
  §T7 케이스 6 신규 가입자
- [ADR-0011](0011-data-sources-page-and-caveats-boundary.md) — §T2 표시 항목,
  §T3 caveats UI 예약 발동, §T4 GATE-C, §T5 i18n SC-3
- [ADR-0016](0016-phase-2-input-flow-design.md) — §T3 SC-B (NL/LU), §T6 SC-A
  (OCR), §T7 preview redirect, §T8 sessionStorage 정리, §T10 SC-E (i18n)
- [ADR-0020](0020-arbitoria-inventory-and-alignment-corrections.md) — §결정 7
  slim.lu canonical

### 외부 사실 (검증된 출처 — 2026-05-10)

- [Lighthouse Performance Scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)
  — 검증 명세
- [Next.js — generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
  — T8 OG/canonical
- [Next.js — notFound](https://nextjs.org/docs/app/api-reference/functions/not-found)
  — T1 잘못된 shortId 404
- [PostgreSQL — DISTINCT ON](https://www.postgresql.org/docs/16/sql-select.html#SQL-DISTINCT)
  — T3 후보 SELECT
- [Universal Postal Union — Netherlands](https://www.upu.int/UPU/media/upu/files/postalSolutions/postalCodes/netherlandsEn.pdf)
  — T10 PC4/PC6
- [Universal Postal Union — Luxembourg](https://www.upu.int/UPU/media/upu/files/postalSolutions/postalCodes/luxembourgEn.pdf)
  — T10 4자리

### 운영자 GATE 정의

- **GATE-N** = 본 ADR T1~T11 운영자 승인 (특히 T9 인쇄 뷰 + T11 OCR 분기) →
  Accepted + builder 인계 명세 (페이즈 3 진입 시점 = M6 시작)
- **GATE-K** = 페이즈 4 베타 진입 게이트 (ADR-0020 §결정 7)
- **GATE-L** = M16 평가 게이트 (ADR-0003 §결정 2)
