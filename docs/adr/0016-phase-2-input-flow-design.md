# ADR-0016: 페이즈 2 입력 플로우 설계 — 5단계 5분 / shadcn / 모바일 우선

## Status

**Accepted — T1~T8 + T9 옵션 A (RHF) + T10 SC-E (한국어 단일) 채택 (2026-05-10)**.
운영자 GATE-J 검토 결과 ADR §결정 그대로 + 두 분기 모두 권장(옵션 A / SC-E)
채택. 후속:
- verifier 가 PLAN 2.1~2.9 본문에 §T1~T10 cross-ref + SC 표기 갱신
- builder 가 §다음 단계 명세대로 10~12 신설 파일 진입
- RHF + `@hookform/resolvers` 2 dep 추가 (운영자 명시 승인 — GATE-C amend)

**Amendment 1 (2026-05-16)** — (a) §T1/§T2 카테고리 4→3 (`landline` 제거,
D-1) (b) §T10 SC-E 발동 + 시점 앞당김 (시나리오 γ) (c) ADR-0029 cross-ref
(d) e2e/PLAN 단언 갱신. 본 문서 끝 §Amendment 1 참조.

**Amendment 2 (2026-05-17, [ADR-0034](0034-strategy-pivot-completion-first-seo-launch.md) D1)**
— **§T10 SC-E 운영 모델 변경** (ko 단일 베타 → EN/FR/NL 공개 + ko basic-auth
게이트). 변경 전: "페이즈 4 까지 한국어 단일, nl/fr/en 은 4.9 런치 게이트
backfill". 변경 후: **공개 = EN/FR/NL (ADR-0033 §T2 `locales` 그대로) /
ko = 운영자 전용 hidden, 구현 = `src/middleware.ts` basic-auth + env 1개
(기존 `/admin` 가드 패턴 동형) / nl·fr·en 콘텐츠 backfill 이 4.9 런치
게이트 → 완성 동시로 당겨짐**. **§T1~§T9 (라우팅/입력 플로우 UI) 는 무관 —
보존 (회귀 0)**. SC-E 는 폐기 아닌 *재정의* (운영 모델만). 본 문서 끝
§Amendment 2 참조 (해당 절 없으면 본 Status 블록이 단일 출처).

**Amendment 4 (2026-06-07, [ADR-0043](0043-telecom-flow-zip-removal-data-model-preservation.md))**
— **§T1/§T3/§T6 4단계 → 3단계 골격 변경 (`/postal` 페이지 제거 + 데이터 모델
보존 + carrier availability caveats)**. 운영자 자가 진단 ("zip code 는 가격
변동 비교요인에 영향을 안줘") + architect 시장 정찰 (BE/NL/LU 통신 가격 지역
무관). 새 URL 구조 = `current-provider → household → preview` 3단계.
`postalCountry`/`postalCode` Zod schema + DB 컬럼 + sessionStateSchema 모두
보존 (미래 카테고리 진입 시 reverse 트리거 — ADR-0043 §D4). carrier availability
caveats (`<CarrierAvailabilityNotice />` 별 섹션) = 결과 페이지 `/r/{shortId}`
신설, ADR-0011 §T2 패턴 재사용. **본 Amendment 후 §T1~§T9 전반 일부 영향**: §T1
URL 구조 4→3 / §T3 결정 = *DEPRECATED but data model preserved* / §T6 step
indicator `1/4` → `1/3`. 본 문서 끝 §Amendment 4 참조.

**Amendment 3 (2026-06-06, [ADR-0041](0041-home-hero-redesign.md) Amendment 2)**
— **§T1/§T6 5단계 → 4단계 골격 변경 (`/bill` 페이지 제거)**. 운영자 PR #34
머지 직후 Pieter Chrome MCP 실측 신호: "[bill 페이지] 이거 어디에 업로드
해달라는거야?" — 헌법 §3 P3 (투명성) 위반 진단: heading "Would you like to
upload your bill..." 카피가 *빈 약속* (OCR 미구현 + 페이지 본문 = Skip 버튼
1개 + 업로드 영역 0). SC-A 결정 "OCR 을 페이즈 3 결과 페이지 직후로 미룸"
은 *결과 페이지 직후도 미구현* (2026-06-06 기준). 빈 페이지 = 사용자 4/5
이탈 위험 + P3 위반 진행 중. **결정**: `/compare/[category]/bill` 라우트
삭제 + 단계 골격 5→4 (postal → current-provider → household → preview).
`compare.bill.*` i18n 키 4종 × 5 locale = 20 entries 삭제. OCR 미래 활성화
시 별 ADR (ADR-OCR 가칭) + 본 페이지 재추가. **본 Amendment 후 §T1~§T9
전반 일부 영향**: §T1 URL 구조 5→4 / §T6 SC-A "없이 진행" 단일 버튼 결정
= *deprecated* (페이지 자체 부재). 본 문서 끝 §Amendment 3 참조.

**격상 이력**:
- Proposed (2026-05-10) — T1~T10 10 결정 + SC-A/B/C/D + 신규 SC-E
- Accepted (2026-05-10) — 운영자 GATE-J 통과, T9 옵션 A + T10 SC-E
- Amendment 1 (2026-05-16) — landline 제거 + SC-E 발동/앞당김 (운영자
  D-1·D-2, ADR-0033 신설)
- Amendment 2 (2026-05-17) — §T10 SC-E 운영 모델 = EN/FR/NL 공개 + ko
  basic-auth 게이트 (ADR-0034 D1, §T1~§T9 보존)
- Amendment 3 (2026-06-06) — §T1/§T6 5단계 → 4단계 골격 (`/bill` 제거,
  ADR-0041 Amendment 2 동반, 운영자 P3 위반 신호)
- Amendment 4 (2026-06-07) — §T1/§T3/§T6 4단계 → 3단계 골격 (`/postal` 제거 +
  데이터 모델 보존 + carrier availability caveats, ADR-0043 동반, 운영자 자가
  진단 + 시장 정찰 사실)

본 ADR 은 **결정 + 인계 명세** 만 담는다. 옵션 A 채택의 직접 후속 = RHF +
resolvers 2 dep 추가 (next-intl / shadcn/ui 등 페이즈 0 dep는 변동 0). shadcn
컴포넌트 7종 (Card/Input/Label/RadioGroup/Select/Form/Progress) install 방식
(CLI vs 직접 작성)은 builder 자유도 — 본 ADR §결정 외.

## Context

### 본 ADR 이 다루는 항목

- **PLAN 2.1** — 카테고리 선택 화면 (랜딩 또는 별도 진입)
- **PLAN 2.2** — 단계 1: 우편번호 (BE/NL/LU 자동 인식)
- **PLAN 2.3** — 단계 2: 가구 형태 (혼자/커플/3+) → 사용량 추정 fallback
- **PLAN 2.4** — 단계 3: 현재 공급사/요금제 (선택적)
- **PLAN 2.5** — 단계 4: 청구서 업로드 (OCR — SC-A 후보)
- **PLAN 2.6** — 단계 5: 결과 미리보기 → 페이즈 3 진입
- **PLAN 2.7** — 진행 표시 + 백 가능 + sessionStorage 자동 저장
- **PLAN 2.8** — 모바일 우선 디자인 (375px 기준)
- **PLAN 2.9** — 접근성 (axe-core 0 violations) + Playwright E2E

### 본 ADR 이 직접 받는 의존성

- **헌법 §3 P2** (쉽고 빠르게) — 5분/5단계 / LCP 2.5s / FID 100ms
- **헌법 §3 P3** (투명성 운영자의 짐) — 베네룩스 외 우편번호 / 청구서 OCR 없음
  / NL/LU 미지원을 *정직하게 노출*
- **헌법 §8 #3** (다크 패턴 금지) — "X명이 보고 있어요" / "오늘만 할인" 류 0
- **헌법 §8 #5** (GDPR 우회 추적 X) — sessionStorage 만, localStorage 0 / 추적
  픽셀 0
- **ADR-0007** — `comparison_request.{category, postalCode, householdType,
  currentProviderId, inputAttributes}` 컬럼 모양 + GDPR Art. 6(1)(b) Contract
  performance (T3) — 입력 화면 *원본* 보존 위치
- **ADR-0010** — `compare(input)` 동기 5초 timeout (T10) — 2.6 결과 미리보기의
  엔진 호출 인터페이스
- **ADR-0011** §T4 GATE-C (새 의존성 0) + §T5 i18n 페이즈 1 한국어 단일 →
  페이즈 2 진입 시점 결정
- **ADR-0020** §결정 7 + §Appendix C — slim.lu 도메인 검증 시점 = 페이즈 2 또는
  페이즈 4 베타 직전 (본 ADR §T11 결정 외 — 운영자 별도 작업)

### 본 ADR 이 여는 후속

- 페이즈 2 builder 인계 = 10~12 신설 파일 (§다음 단계)
- 페이즈 3 결과 페이지 ADR (3.1~3.7) — 본 ADR §T7 결과 미리보기와 *경계* 분리
- 페이즈 3 caveats UI 배치 ADR (ADR-0011 §T3 예약) — 본 ADR §T7 미리보기와
  *경계* 분리
- next-intl 인프라 도입 ADR (SC-E 거부 시) — 본 ADR §T10 분기에 따라 GATE-J
  통과 시점 신설

### 운영자 컨텍스트 ([`docs/FOUNDER.md`](../FOUNDER.md))

- 솔로 사이드, 주 10-20 시간, 월 €300 ALL-IN cap
- 한국어 모국어 — 페이즈 1 전 텍스트 한국어 단일 (ADR-0011 §T5)
- 사업자등록 ✅ / TVA 대기 ⏳ / 베타 미시작 (페이즈 4 진입 시점 = M8~M10)
- 학습자 모드 — *왜 이 결정인지* 코드 코멘트로 설명 (FOUNDER §5)

### 운영자 사전 명시 5 결정 (GATE-J 진입 시점)

본 ADR §결정에 *그대로 박아둠* — 운영자가 GATE-J 에서 수정/거부 가능:

1. **입력 순서**: 카테고리 선택 → 우편번호 → 가구 형태 → 현재 공급사/요금제 →
   청구서 (선택)
2. **5단계 5분 목표 + 이탈률 30% 미만** (PostHog 측정 — SC-D 분기로 구조만 1차)
3. **디자인 시스템**: shadcn/ui 그대로 (자체 디자인 시스템은 페이즈 4 이후 고려)
4. **모바일 우선** (375px 기준 → md 768 → lg 1024)
5. **진행 표시 + 백 가능 + sessionStorage 자동 저장**

본 ADR §T1~T10 은 위 5 결정을 *기술적 명세* 로 풀어놓은 형태. 본 ADR §결정 표기와
운영자 5 결정이 충돌하면 본 ADR 가 *오류* (운영자 결정이 헌장).

### 외부 사실 (검증된 출처 — 2026-05-10)

- **shadcn/ui Form pattern** — RHF (`react-hook-form`) + zod + `<Form>` /
  `<FormField>` / `<FormItem>` 패턴. 출처: [shadcn/ui — Form](https://ui.shadcn.com/docs/components/form)
  . 본 ADR §T3 우편번호 / §T4 가구 형태 / §T5 현재 공급사 / §T7 결과 미리보기
  모두 이 패턴 채택. **단 — RHF 의존 추가 여부는 GATE-J 분기** (본 ADR §T9
  결정).
- **next-intl 라우팅 패턴** — `app/[locale]/...` 또는 단일 locale 정적 파일.
  출처: [next-intl — App Router](https://next-intl.dev/docs/routing). 본 ADR
  §T10 SC-E 분기 결정.
- **axe-core 자동화** — `@axe-core/playwright` 또는 `axe-core` 단독. 출처:
  [Deque — axe-core](https://github.com/dequelabs/axe-core). PLAN 2.9 DoD.
- **PostHog feature flag + funnel** — `posthog-js` + `posthog.capture()` 단계별
  + `Funnel` 분석. 출처: [PostHog — Funnels](https://posthog.com/docs/product-analytics/funnels)
  . 본 ADR §T2 5단계 5분 / 이탈률 30% 측정 구조 (SC-D 분기).
- **BE 우편번호 형식** — 4자리 숫자, 1000~9999. 출처: [Universal Postal Union —
  Belgium](https://www.upu.int/UPU/media/upu/files/postalSolutions/postalCodes/belgiumEn.pdf).
  본 ADR §T3 Zod 검증 산식.
- **Tailwind 4 breakpoints** — 기본 모바일 (no prefix), `md:` 768px, `lg:`
  1024px. 출처: [Tailwind v4 — Responsive](https://tailwindcss.com/docs/responsive-design).
  본 ADR §T9 모바일 우선 정합.

## Decision — T1~T10 10 결정

### T1 — 입력 라우팅 = 옵션 A `/compare/[category]/[step]` (REST 스타일 + deep-link)

App Router URL 구조:

```
/compare                                    # 카테고리 선택 (T2)
/compare/[category]                         # = /compare/[category]/postal redirect
/compare/[category]/postal                  # 단계 1: 우편번호 (T3)
/compare/[category]/household               # 단계 2: 가구 형태 (T4)
/compare/[category]/current-provider        # 단계 3: 현재 공급사 (T5)
/compare/[category]/bill                    # 단계 4: 청구서 — SC-A "없이 진행" (T6)
/compare/[category]/preview                 # 단계 5: 결과 미리보기 (T7)
```

> **→ Amendment 3 (2026-06-06) 참조**: `/compare/[category]/bill` *제거*
> → 5단계 → 4단계. 새 URL 구조 = postal → current-provider → household
> → preview (단계 1~4). T6 SC-A 결정 deprecated (페이지 자체 부재). 헌법
> §3 P3 (투명성) 정합 — 빈 약속 봉합. ADR-0041 Amendment 2 동반 (홈
> hero/`/compare` 페이지 재설계 + bill 제거).

`[category]` = `mobile` / `internet_fixed` / `bundle_internet_tv` / `landline`
(ADR-0005 §T6 enum 4값). 잘못된 category → 404.

> **→ Amendment 1 (2026-05-16) 참조**: `landline` 제거 → 3값
> (ADR-0005 §Amendment 1, D-1). `[category]` enum = `mobile` /
> `internet_fixed` / `bundle_internet_tv`. URL 구조 보존 (locale prefix
> 는 ADR-0033 §T1 별도).

**근거 (학습자 모드 + Next.js App Router 친화):**
- App Router 의 *파일 시스템 = 라우트* 패턴이 가장 단순 → 운영자 6개월 후
  디버깅 시 폴더 구조만 보면 단계 흐름 파악 가능.
- Deep-link 가능 → 사용자가 *단계 4* 에서 새 탭으로 공유하거나 브라우저
  뒤로가기 / 새로고침에도 단계 보존 (T8 sessionStorage 와 결합).
- PostHog funnel 측정 (SC-D 채택 시) 시 *URL 자체가 단계 식별자* — 추가 props
  설정 0.

**거부된 대안 — 옵션 B (단일 페이지 + step state in sessionStorage)**:
- 장점: 라우트 1개 — 라우팅 단순.
- 단점: (a) 단계별 deep-link 불가 → 사용자 새 탭 / 새로고침 시 항상 단계 1로
  복귀 (P2 위반). (b) 브라우저 뒤로가기가 *카테고리 선택 이전* 으로 빠짐 —
  T8 백 가능 결정 위반. (c) PostHog funnel URL 식별 불가 → step props 수동
  설정 부담.
- 거부 사유: 학습자 모드 + deep-link 가치 > 라우팅 단순성.

**거부된 대안 — 옵션 C (단계별 별도 라우트, `/compare/mobile/postal` 같이
*카테고리 + 단계 모두* 평탄화)**:
- 장점: URL 명시적.
- 단점: 4 카테고리 × 5 단계 = 20 라우트 정적 정의 필요 (또는 dynamic). 옵션 A
  의 `[category]/[step]` 동형 구조와 *기능 동등* 하지만 폴더 깊이 ↑.
- 거부 사유: 옵션 A 와 기능 동등 + 폴더 구조 단순.

### T2 — 카테고리 선택 화면 (2.1) = `/compare` 별도 페이지 + 4 카드

**진입 경로**:
- 랜딩 (`/`) 의 메인 CTA "비교 시작" → `/compare` 이동 (랜딩 자체는 본 ADR 외
  결정 — 페이즈 2 진입 시점 builder 가 *최소* 랜딩 placeholder 작성)
- 페이즈 1 시점 `/data-sources` 에서도 "비교 시작" CTA → `/compare` 이동 (헤더
  네비게이션 — 본 ADR 결정 외, 페이즈 2 builder 자유도)

> **→ Amendment 1 (2026-05-16) 참조**: "4 카드" → **3 카드** (유선 전화
> 카드 제거 — D-1). 동등 시각 무게 원칙 유지 (3 카드 모두 동일 무게,
> "추천" 라벨/색상 강조 0). PLAN §2.1 검증 설명 텍스트 "4 카드 동등
> 무게" → "3 카드 동등 무게" (e2e `compare-flow.spec.ts` 는 모바일 카드
> 클릭만 단언 — spec 코드 변경 0, 카드 *개수* 단언이 없음. 단 page.tsx
> 의 `TARIFF_CATEGORIES` ↔ `CATEGORIES` 정합 자가 점검은 양쪽 동시
> landline 제거로 통과 — ADR-0005 §Amendment 1 builder 노트).

**페이지 구성** (`/compare` = `src/app/compare/page.tsx`, RSC):
- 헤더: "어떤 요금제를 비교하시겠어요?" (한국어 단일 — T10)
- 4 카테고리 카드 (모바일 / 인터넷 / 인터넷+TV 번들 / 유선 전화) — shadcn/ui
  `<Card>` + `<CardHeader>` + `<CardContent>`
- 카드별 표시:
  - icon (Lucide React `Smartphone` / `Wifi` / `Tv` / `Phone` — 페이즈 0
    shadcn/ui dep 에 이미 포함, 추가 의존성 0)
  - 짧은 한 줄 설명 (예: 모바일 = "월 €15~€35, 한 회선당")
  - 평균 절약액 미리보기 — **페이즈 2 시점은 "베타 후 노출"** 부가 텍스트 (실
    데이터 0 → ADR-0011 §T2 항목 5 "0회 — 런칭 초기" 동형 정직 노출)
  - 클릭 → `/compare/[category]/postal` 이동
- 푸터: "이용 약관 동의" 체크박스 + `/legal/terms` 링크 (ADR-0007 §T3 GDPR
  Art. 6(1)(b) 계약 본질 명시 — 페이즈 6.9 정식 페이지 진입 전 placeholder)

**근거**:
- 별도 `/compare` 페이지 = 랜딩의 *비-비교* 컨텐츠 (브랜드 / 신뢰 / 베타 사인업
  / FAQ — 페이즈 4 진입 시 결정) 와 비교 입력 분리. 사용자 의도 명확.
- 4 카드 동일 시각 무게 — 다크 패턴 0 (헌법 §8 #3) — "추천" 라벨 / 색상 강조 0.
- "평균 절약액 미리보기" 0 데이터 노출은 ADR-0011 §T2 항목 5 와 동형 — *런칭
  초기* 부가 텍스트 + 페이즈 4 베타 후 자동 갱신.

**거부된 대안 — 랜딩 자체에 4 카드 inline (별도 `/compare` 없음)**:
- 장점: 클릭 1회 절약.
- 단점: 랜딩 = 브랜드 + 신뢰 + 베타 시작 시점 사인업 등 *비-비교 컨텐츠* 도
  싣는다. 비교 입력 카드와 혼합 시 LCP 부담 + 사용자 의도 분기 모호.
- 거부 사유: P2 LCP 2.5s 보호 + 비교 의도 명확성.

### T3 — 단계 1 우편번호 (2.2) = BE 1차 (SC-B 채택), Zod + 즉시 피드백

**Zod schema** (`src/types/comparison-input.ts` 신설):

```ts
// 요지 (실제 코드 X)
const postalCodeSchema = z.object({
  country: z.literal('BE'),  // 1차 BE 만, NL/LU 는 페이즈 3 진입 전 추가
  postalCode: z.string()
    .regex(/^[1-9][0-9]{3}$/, '벨기에 우편번호는 4자리 숫자입니다 (예: 1000)'),
});
```

**자동 인식 로직** (페이즈 2 1차):
- 사용자 입력 4자리 숫자 → BE 우편번호로 인식 (1000~9999 범위)
- BE 외 형식 입력 시 (예: NL PC6 "1234 AB") → 정직한 안내:
  "현재 벨기에(BE) 우편번호만 지원합니다. 네덜란드(NL) / 룩셈부르크(LU) 는
  페이즈 3 (M6) 진입 전 추가 예정입니다."
- 헌법 §3 P3 정합 — *왜 미지원인지* 명시.

**UI 컴포넌트** (`src/app/compare/[category]/postal/page.tsx`):
- shadcn/ui `<Input>` + `<Label>` + `<FormMessage>` (Zod 검증 결과 즉시 노출)
- *옵션* 자동 도시명 표시 (예: "1000 — Brussels") — 페이즈 2 1차에서는 *미구현*
  (SC-B 정합, BE 우편번호 → 도시명 매핑 데이터 부재). 페이즈 3 진입 시 추가
  검토.

**SC-B 채택 (운영자 명시)**:
- 페이즈 2 1차 = BE 만 (Proximus + Telenet 모두 BE 시장 — ADR-0009)
- NL/LU 추가 시점 = 페이즈 3 진입 직전 (M5 말 또는 M6 초)
- NL = PC4 ("1234") 또는 PC6 ("1234 AB") — 둘 다 허용
- LU = 4자리 숫자 (BE 와 형식 동일하지만 country 분기 필요)

**근거**:
- ADR-0009 §결정 4 — Proximus + Telenet 모두 BE → NL/LU 입력 시점에 *비교 후보
  0* 가 됨 → 페이즈 2 1차 NL/LU 추가는 *기능적 가치 0* (사용자에게 "벨기에만
  지원" 안내가 동등 정직).
- 페이즈 3 진입 시점에 NL/LU 공급사 fetcher 추가 (페이즈 5 항목, ADR-0009 5.0)
  와 동기화 필요 → 페이즈 2 1차에서 미리 NL/LU 입력만 받아두면 *비교 후보 0
  caveat* 노출 부담.

**거부된 대안 — 페이즈 2 1차부터 BE/NL/LU 3국 모두 허용**:
- 장점: 페이즈 3 진입 시 회귀 0.
- 단점: NL/LU 공급사 fetcher 부재 (페이즈 5) → 비교 결과 *영구 0* → 사용자
  신뢰 손상.
- 거부 사유: SC-B 정합 + 정직성 우선.

### T4 — 단계 2 가구 형태 (2.3) = enum 3값 + 라디오 카드

**Zod 통합** (ADR-0007 §T2 `householdType` enum 그대로 재사용):

```ts
const householdTypeSchema = z.enum(['single', 'couple', 'family_3_plus']);
```

**UI 컴포넌트** (`src/app/compare/[category]/household/page.tsx`):
- shadcn/ui `<RadioGroup>` + `<RadioGroupItem>` — 카드 형태 (Tailwind grid)
- 3 옵션:
  - `single` → 아이콘 (Lucide `User`) + "혼자" + 부가 설명 "1인 가구"
  - `couple` → 아이콘 (Lucide `Users`) + "커플" + 부가 설명 "2인 가구"
  - `family_3_plus` → 아이콘 (Lucide `UsersRound`) + "가족 (3인+)" + 부가 설명
    "3인 이상 가구"
- 모바일 (375px): 세로 스택 / `md:` 이상 가로 그리드 (3열)

**사용량 추정 매핑** (별도 helper 후보 — `src/engine/usage-estimator.ts`,
**본 ADR 결정 외** trivial):
- 페이즈 2 1차에서는 매핑 *없음* — `inputAttributes = {}` 빈 객체 저장 (DB
  default `{}` 정합)
- 페이즈 2 후반 또는 페이즈 3 진입 시 *간단 매핑* 추가 검토:
  - mobile + single → `{ data_gb_used: 5, voice_minutes_used: 100 }`
  - mobile + couple → 회선당 동일 (가구 형태는 *회선 수* 와 직교)
  - internet_fixed + family_3_plus → `{ download_mbps_needed: 200,
    streaming_4k: true }`
- 매핑 부재 시 비교 엔진 (ADR-0010 §T2) 의 추천성 caveat 도 약화 — 운영자가
  페이즈 3 진입 시점에 청구서 수집 결과로 매핑 정확도 평가.

**근거**:
- ADR-0007 §T2 enum 그대로 재사용 = 마이그레이션 0 + DB schema 무변동.
- 라디오 카드 = shadcn/ui 패턴 정합 + 모바일 친화 (탭 영역 大).
- 사용량 추정 매핑은 *데이터가 없으면 정직한 빈 객체* 가 SC-A (OCR 페이즈 3
  이연) 정합. 청구서 수집 후 매핑 정확도 평가가 자연.

**거부된 대안 — 가구 형태 + 사용량 직접 입력 동시**:
- 장점: 정확한 사용량 데이터 1차 확보.
- 단점: 5단계 → 6~7단계 확장 → P2 5분 위반. 사용자 *모르는 정보* 강요.
- 거부 사유: P2 + 정직성. SC-A 정합 (청구서 OCR 페이즈 3 이연 = 사용량은 페이즈
  3 진입 후 정확도 검토).

### T5 — 단계 3 현재 공급사 (2.4) = 선택적 (스킵 동등 노출)

**UI 컴포넌트** (`src/app/compare/[category]/current-provider/page.tsx`):
- 헤더: "현재 사용 중인 공급사를 선택하시겠어요?" (한국어 단일)
- shadcn/ui `<Select>` 또는 `<RadioGroup>` 컴포넌트 (provider 목록 — `provider`
  테이블 SELECT, ADR-0001 정합)
- *동등하게 노출되는 "스킵" 버튼*:
  - "모르겠어요 / 스킵" — shadcn/ui `<Button variant="outline">` (강조 X)
  - 클릭 시 `current_provider_id = NULL` (ADR-0007 §T2 정합)
- 공급사 선택 시 → 요금제 (`tariff` 테이블) 선택 화면 *2단 노출* (sub-step,
  URL 변경 X — 동일 page 안에서 conditional render)
  - "현재 요금제를 선택하시겠어요?" + `<Select>` 8 tariff (페이즈 1 시점 stub
    fetcher 8개)
  - "모르겠어요" 동등 버튼 — 클릭 시 `current_provider_id = providerId` 만,
    `currentTariffId` (ADR-0010 §CompareInput.currentTariff) NULL → 비교
    엔진이 *신규 가입자* 동형 처리 (ADR-0010 §T7 케이스 6)

**검증 (Zod)**:
- `current_provider_id`: `z.string().uuid().nullable()`
- `current_tariff_id`: `z.string().uuid().nullable()` — JSONB `inputAttributes`
  안에 보관 (DB 컬럼 미변동, ADR-0007 §T2 정합)

**근거**:
- ADR-0007 §T2 결정: PLAN 2.4 "선택적, 모르면 스킵" — 스킵 버튼 동등 노출이
  헌장 정합.
- 스킵 가시성 = 다크 패턴 회피 (헌법 §8 #3) — "스킵하면 정확도 떨어집니다" 류
  guilt-trip 0.
- 요금제 선택 sub-step = URL 변경 X → 단계 카운트 5 유지 (P2 5단계).

**거부된 대안 — 현재 공급사 필수 입력**:
- 장점: 비교 정확도 ↑.
- 단점: 신규 가입자 (ADR-0010 §T7 케이스 6) 배제 → 베타 모집 카피 (Korean
  Society BE/NL/LU — 신규 입국자 多) 와 충돌.
- 거부 사유: 사용자 가치 + ADR-0010 케이스 6 정합.

### T6 — 단계 4 청구서 (2.5) = SC-A 채택, "없이 진행" 단일 버튼

**SC-A 채택 (페이즈 2 1차 = 청구서 OCR 미구현)**:
- 본 페이즈에서 OCR 미구현 — `tesseract.js` 의존 0 (GATE-C 정합)
- "청구서 없이 진행" 단일 버튼 + 안내 텍스트:
  > "청구서 OCR 자동 입력은 페이즈 3 결과 페이지 직후 추가됩니다. 지금은 가구
  > 형태 기반 추정값으로 비교합니다."
- 헌법 §3 P3 정직성 — *왜 미구현* + *언제 구현* 명시
- DB 영향: `comparison_request.input_attributes` 에 빈 객체 또는 가구 형태
  추정값 (T4 매핑 부재 시 빈 객체)

**UI 컴포넌트** (`src/app/compare/[category]/bill/page.tsx`):
- 헤더: "청구서를 업로드해 정확한 사용량을 자동 입력하시겠어요?"
- 본문: "현재 베타 진행 중 — 청구서 OCR 은 다음 업데이트에서 추가됩니다." (배지
  형태)
- 단일 CTA: shadcn/ui `<Button variant="default">` "청구서 없이 진행" → 다음
  단계로
- *부가 옵션* "청구서 OCR 알림 받기" 이메일 입력 (페이즈 4 베타 사인업 통합) —
  본 ADR 결정 외, 페이즈 4 진입 시 builder 자유도

**페이즈 3 진입 시점 (OCR 도입)**:
- 페이즈 3 결과 페이지 *직후* 청구서 업로드 옵션 노출 검토 (별도 ADR — 가칭
  ADR-0017-bill-ocr-introduction)
- tesseract.js 의존 추가 = GATE-C Amendment 트리거 → 운영자 별도 승인
- 페이즈 3 진입 전 청구서 5종 수집 (운영자 솔로 작업) — PLAN 1.12 베타 청구서
  수집과 통합

**근거**:
- SC-A = 운영자 명시 옵션 — OCR 솔로 시간 sink (1-2개월 흡수, ADR-0003 §결정 6
  옵션 C). 페이즈 2 일정 단축 → SC-A 정합.
- "없이 진행" 단일 버튼 = 사용자 결정 부담 0. 베타 모집 카피 (페이즈 4) 정합.

**거부된 대안 — 페이즈 2 1차부터 tesseract.js 통합**:
- 장점: 페이즈 3 회귀 0.
- 단점: tesseract.js gzip ~2MB → LCP 영향 (P2 위반 위험). 청구서 5종 수집
  솔로 1-2개월. 베타 시작 일정 (M8~M10) 위협.
- 거부 사유: SC-A 운영자 명시 + 일정 + LCP 보호.

### T7 — 단계 5 결과 미리보기 (2.6) = 페이즈 3 와 분리, 결과 카드 1개 미리보기만

**구성** (`src/app/compare/[category]/preview/page.tsx`, RSC):
- 페이지 진입 = sessionStorage 의 입력 데이터 + Zod 검증 → 통과 시 서버 액션
  (`POST /api/compare`, ADR-0007 §T10 동기 5초 timeout) → `comparison_request`
  + `comparison_result` insert → `shortId` 반환
- 미리보기 카드 = *1위 추천만* (ADR-0010 §CompareResult.ranked[0]):
  - 공급사 이름 + 요금제 이름
  - 월 절약액 (또는 신규 가입자 시 월 비용)
  - 1~2건의 핵심 caveat (ADR-0010 §T6 매트릭스 — 약정 / 활성화 비용)
- CTA: "더 보기 — 5개 비교 + 계산 근거" → `/r/[shortId]` 이동 (페이즈 3 결과
  페이지)

**페이즈 3 미구현 시 (페이즈 2 1차 = 페이즈 3 미진입)**:
- `/r/[shortId]` 라우트 placeholder — 페이즈 2 1차 시점 builder 가 *최소
  placeholder* 작성 (shortId 표시 + "결과 페이지는 페이즈 3 (M6) 에서 진입"
  안내)
- ADR-0011 §T2 항목 5 *런칭 초기* 동형 정직 노출

**비교 엔진 호출 흐름** (ADR-0007 §T10 + ADR-0010):
1. 클라이언트 (preview/page.tsx) 가 sessionStorage 데이터 → 서버 액션
2. 서버 액션 (Next.js Server Action 또는 `app/api/compare/route.ts`) 가:
   a. Zod schema 검증 (재검증 — 클라이언트 우회 방어)
   b. `comparison_request` insert (id 생성)
   c. `compare(input)` 호출 (ADR-0010 §CompareInput) — 후보 SELECT 쿼리는
      서버 액션이 ADR-0006 §T7 DISTINCT ON 패턴으로
   d. `comparison_result` + `comparison_result_item[]` insert
   e. `shortId` 반환
3. 클라이언트가 `shortId` 받아 `/r/[shortId]` redirect

**근거**:
- 페이즈 2 = *입력 + 미리보기*, 페이즈 3 = *결과 페이지 풀버전* (3.1~3.7) 분리
  → 본 ADR 가 페이즈 3 의 결과 카드 / 비교 표 / 계산 근거 결정을 *예약* 하지
  않음 (ADR-0011 §T3 동형 경계 분리).
- 미리보기 1개 카드 = 5분 5단계 P2 정합 — 페이즈 3 진입 시 풀버전 노출.
- 영구 링크 (`/r/[shortId]`) = ADR-0007 §T7 nanoid 12자 그대로 — 페이즈 2 시점
  미리보기 카드도 같은 shortId 사용 → 페이즈 3 진입 시 회귀 0.

**거부된 대안 — 페이즈 2 미리보기에 5개 결과 카드 모두 노출 (페이즈 3 흡수)**:
- 장점: 페이즈 3 진입 부담 ↓.
- 단점: 페이즈 2 = 입력 / 페이즈 3 = 결과 분리가 깨짐. 페이즈 3 결정 (3.1~3.7)
  이 본 ADR 에 누적 → ADR 폭주.
- 거부 사유: 경계 분리 + ADR-0011 §T3 동형 패턴.

### T8 — 진행 표시 + sessionStorage (2.7) — 운영자 명시 결정 5 채택

**sessionStorage key 명세**:

```
slim:compare:[category]:state    # v1
```

(예: `slim:compare:mobile:state`)

값 (JSON 직렬화):

```json
{
  "version": 1,
  "category": "mobile",
  "step": "household",
  "data": {
    "postalCode": "1000",
    "householdType": "single",
    "currentProviderId": null,
    "inputAttributes": {}
  },
  "updatedAt": "2026-05-10T12:34:56Z"
}
```

**진행 표시 (UI)**:
- shadcn/ui `<Progress>` (헤더 또는 sticky top) — 5 단계 시각화 (1/5, 2/5, ...)
- 단계 라벨 (한국어 단일 — T10): "카테고리 선택 / 우편번호 / 가구 형태 / 현재
  공급사 / 청구서"
- 모바일 (375px): 컴팩트 (숫자 + 작은 막대) / `md:` 이상 풀 라벨

**백 가능**:
- 브라우저 뒤로가기 (Next.js App Router native — T1 라우팅 정합)
- UI 백 버튼 (shadcn/ui `<Button variant="ghost">` — "이전") — `router.back()`
  호출
- 단계 1 (`/compare/[category]/postal`) 에서 백 → `/compare` 카테고리 선택으로

**자동 저장**:
- 매 입력 즉시 저장 (RHF `onChange` 또는 `useEffect` 의존 — T9 결정에 따라)
- `beforeunload` 이벤트 = *불필요* (즉시 저장이면 충분, 추가 hook 0)
- 페이지 닫힘 시 = 브라우저가 sessionStorage 자동 정리 (브라우저 동작) →
  운영자 추가 코드 0

**localStorage 사용 X**:
- 헌법 §3 P3 + §8 #5 정합 — 영구 저장은 *명시 동의* 필요 (페이즈 6 회원가입)
- sessionStorage = *탭 닫힘 시 자동 정리* → GDPR 합법근거 (b) Contract
  performance (ADR-0007 §T3) 의 *처리 목적* 종료 시점과 정합

**근거**:
- 운영자 명시 결정 5 채택.
- sessionStorage 만 사용 → GDPR 영향 0 + 추가 의존성 0.
- 매 입력 즉시 저장 = beforeunload race condition 회피.

**거부된 대안 — localStorage + 30일 TTL**:
- 장점: 사용자 다음 방문 시 입력 복원 → 5분 단축.
- 단점: 헌법 §8 #5 위반 위험 (브라우저 fingerprint 동형). GDPR 합법근거 변경
  (Art. 6(1)(a) Consent 모달 추가) → P2 5분 위반.
- 거부 사유: 헌장 정합 + 운영자 명시 결정 5.

### T9 — 모바일 우선 + 폼 라이브러리 결정

**Tailwind breakpoint** (운영자 명시 결정 4):
- 기본 (no prefix) = 375px (iPhone SE 기준)
- `md:` = 768px (태블릿)
- `lg:` = 1024px (데스크톱)
- `xl:` 사용 X (페이즈 2 1차)

**shadcn/ui 컴포넌트** (운영자 명시 결정 3 — shadcn/ui 그대로):
- `<Card>` / `<CardHeader>` / `<CardContent>` — 카테고리 카드 (T2)
- `<Input>` / `<Label>` / `<FormMessage>` — 우편번호 (T3)
- `<RadioGroup>` / `<RadioGroupItem>` — 가구 형태 (T4)
- `<Select>` / `<SelectTrigger>` / `<SelectContent>` — 현재 공급사 (T5)
- `<Button>` 다양한 variant — 모든 단계 CTA
- `<Progress>` — 진행 표시 (T8)
- `<Form>` / `<FormField>` / `<FormItem>` — Zod 검증 통합 (T9 RHF 분기)

**RHF (`react-hook-form`) 의존 추가 여부 — GATE-J 분기**:

| 옵션 | 결정 | 근거 |
|---|---|---|
| **옵션 A (RHF 추가)** — shadcn/ui Form 패턴 그대로 | RHF + `@hookform/resolvers` 2 dep 추가 | 표준 패턴, 학습자 모드 친화, 검증 보일러플레이트 ↓ |
| **옵션 B (RHF 미추가)** — `useState` + Zod `safeParse` 직접 | dep 0 | GATE-C 정합, 폼 5개 단순 (단계당 1~2 필드), 보일러플레이트 수용 |

**본 ADR 권장 = 옵션 A (RHF 추가)**.

**근거 (옵션 A)**:
- shadcn/ui Form 패턴 = RHF + Zod 가 *공식 권장* (출처: shadcn/ui 공식 문서)
- 5 단계 × 평균 2 필드 = 10+ 필드 검증 — `useState` + Zod 직접 시 보일러플레이트
  ↑↑ → 학습자 모드 디버깅 부담
- RHF + `@hookform/resolvers` = 둘 다 ~10KB gzip, dep zero-deps, 보안 패치
  부담 0.1 (월 €300 cap 영향 0)
- GATE-C (새 의존성 0) = ADR-0011 §T4 가 `/data-sources` 페이지 한정 정책 →
  페이즈 2 진입 시점에 운영자 명시 승인 (GATE-J) 으로 *2 dep 동시 승인* 가능

**옵션 B 거부 사유**:
- 보일러플레이트 ↑↑ — `useState`로 5 단계 × 평균 2 필드 = 10+ 상태 변수 + 매
  단계 `safeParse` 호출 + 에러 표시 conditional render
- 학습자 모드 부적합 — 운영자 6개월 후 디버깅 시 폼 패턴이 *비표준* → Stack
  Overflow 검색 결과 적용 어려움
- 옵션 A 의 dep 부담 (~20KB gzip) > 보일러플레이트 부담의 학습 비용

**GATE-J 운영자 답변 요청**: 옵션 A (RHF 추가) vs 옵션 B (dep 0) 중 선택. 본
ADR 권장 = A.

### T10 — i18n 정책 = SC-E 신설 (페이즈 2 한국어 단일) 권장

> **→ Amendment 1 (2026-05-16) 참조**: SC-E **발동 + 시점 앞당김**
> (폐기 아님 — §회귀 트리거 7번 발동). "페이즈 4 베타 직전 일괄 도입"
> → **시나리오 γ**: next-intl 인프라 배선 + `messages/ko.json` 키화 =
> 4.6 베타 진입 전 / nl·fr·en 콘텐츠 backfill + ko 제거 + hreflang 활성
> = 4.9 런치 게이트. 베타 = ko 단일 콘텐츠 (ADR-0029 한국어 단일 잠금
> 100% 보존). 4 locale + 라우팅 명세 = [ADR-0033](0033-i18n-next-intl-introduction.md)
> §T1·§T2 신설.

**옵션** (ADR-0011 §T5 가 페이즈 2 진입 시점 결정 미룸):

| 옵션 | 결정 | 근거 |
|---|---|---|
| **옵션 A (페이즈 2 한국어 단일 — SC-E 신설)** | next-intl 도입 X (또는 한국어 메시지 파일 1개) | 운영자 학습 + 시간 부담 ↓, 베타 모집 카피 한국어 (Korean Society BE/NL/LU) 정합 |
| **옵션 B (nl-BE 우선 + 페이즈 3 fr-BE/en 추가)** | next-intl 도입 + 한국어 + nl-BE 2개 locale | 베네룩스 시장 진입 신호, 베타 BE 사용자 직접 노출 가능 |
| **옵션 C (nl-BE + fr-BE + en 동시 도입)** | next-intl 도입 + 4 locale (한/nl/fr/en) | i18n 인프라 한 번에, 페이즈 4 베타 진입 시 회귀 0 |

**본 ADR 권장 = 옵션 A (SC-E 신설)**.

**근거 (옵션 A)**:
- 운영자 솔로 사이드 + 주 10-20시간 — 4 locale × 텍스트 검증 = 시간 sink
  (ADR-0011 §T5 거부 대안 4 동형)
- 페이즈 4 베타 모집 = Korean Society BE/NL/LU (FOUNDER §3 미상, MONETIZATION
  §A 베타 카피) → 한국어 우선 정합
- next-intl 인프라 도입은 *페이즈 4 베타 직전* (M8~M10) 또는 *페이즈 5 멀티
  카테고리* 진입 시점에 일괄 도입 — 빈 키 file 만 만들면 솔로 디버깅 부담
  최소화 (자동화 가능)
- ADR-0011 §T5 가 "페이즈 2 진입 시점에 결정" 으로 미룬 결정을 본 ADR 가 SC-E
  로 *명시 cut* — 페이즈 2 1차 한국어 단일 + 페이즈 4 베타 직전 일괄 도입

**옵션 B 거부 사유**:
- next-intl 인프라 도입 (i18n routing `app/[locale]/...` 또는 단일 locale 파일)
  + 한/nl 2 텍스트 검증 = 솔로 시간 ↑ → 페이즈 2 일정 (M4~M5) 위협
- 베타 모집 카피 (Korean Society) 가 한국어 → nl-BE 추가 가치 < 시간 비용

**옵션 C 거부 사유**:
- 4 locale 동시 = 솔로 시간 sink 최대화 → 페이즈 2 일정 1.5배 (M4~M6.5) 위협
- 페이즈 4 베타 (M8~M10) 까지 일정 마진 잠식 → 베타 미시작 위험
- "한 번에" 도입의 *효율* 가치는 운영자 시간 부담 > 효율

**GATE-J 운영자 답변 요청**: SC-E (옵션 A 한국어 단일) 채택 여부. 본 ADR 권장
= SC-E 채택.

### T11 (참고) — 슬림 도메인 + Vercel Domains 검증

ADR-0020 §결정 7 + §Appendix C 가 slim.lu 도메인 검증 시점을 *페이즈 2 또는
페이즈 4 베타 직전* 으로 미룸. 본 ADR §T11 결정 = **페이즈 2 진입과 *직교***
(운영자 별도 작업, ~15분 + SSL 발급 1h).

**권장 시점**: 페이즈 2 진입 *직후* (M4 초) — 베타 모집 카피 / brand-aware copy
도입 시점 정합. 운영자 ADR-0020 §Appendix C 6 단계 실행 → `https://slim.lu`
검증.

본 ADR 외 결정 — ADR-0020 인용으로 형식 충족.

## SCOPE CUT 옵션

본 ADR 이 *명시* 하는 SCOPE CUT 5개:

| 옵션 | 결정 | 적용 시점 |
|---|---|---|
| **SC-A** | 2.5 청구서 OCR → 페이즈 3 결과 페이지 직후 처리 | 페이즈 2 1차 = "없이 진행" 단일 버튼 (T6) |
| **SC-B** | 2.2 BE/NL/LU 우편번호 자동 인식 → 1차 BE 만 | 페이즈 2 1차 = BE 만, NL/LU 페이즈 3 진입 직전 추가 (T3) |
| **SC-C** | 2.9 Playwright E2E → 1차 axe-core 만 | 페이즈 2 1차 = axe-core, Playwright 페이즈 4 deploy 직전 (T9 + 페이즈 2.9 본문 갱신) |
| **SC-D** | PostHog 측정 (이탈률 30%) → 페이즈 4 이후 | 페이즈 2 1차 = "측정 가능한 구조" 만 (T1 URL 자체가 단계 식별자) |
| **SC-E (신설)** | i18n 한국어 단일 → 페이즈 4 베타 직전 일괄 도입 | 페이즈 2 1차 = 한국어 단일 (T10) |

**SC-A/B/C/D 채택 권장**: 운영자 명시 옵션 — 본 ADR §결정 표기 정합.
**SC-E 채택 권장**: 본 ADR §T10 권장 = 옵션 A. 운영자 GATE-J 결정 필요.

## PLAN 본문 갱신 가이드 (verifier 후속, 본 ADR Accepted 후)

**§2.1**: 본문에 "ADR-0016 §T2 — `/compare` 4 카드 + 카테고리 선택 진입" 인용
한 줄.

**§2.2**: 본문에 "ADR-0016 §T3 — BE 1차 (SC-B 적용), NL/LU 페이즈 3 진입 직전
추가" 인용. SC-B 표기.

**§2.3**: 본문에 "ADR-0016 §T4 — `householdType` enum 3값 라디오 카드, 사용량
추정 매핑은 페이즈 2 후반 또는 페이즈 3 진입 시 결정" 인용.

**§2.4**: 본문에 "ADR-0016 §T5 — 선택적, 스킵 동등 노출, sub-step 요금제 선택"
인용.

**§2.5**: 본문에 "ADR-0016 §T6 — SC-A 적용, 페이즈 2 1차 = '없이 진행' 단일
버튼, OCR 페이즈 3 결과 페이지 직후 추가" 인용. SC-A 표기. 체크박스 [ ] 유지.

**§2.6**: 본문에 "ADR-0016 §T7 — 결과 카드 1개 미리보기 + `/r/[shortId]` 이동,
페이즈 3 결과 페이지 풀버전과 분리" 인용.

**§2.7**: 본문에 "ADR-0016 §T8 — sessionStorage `slim:compare:[category]:state`
v1 + 진행 표시 + 백 가능 + 매 입력 즉시 저장" 인용.

**§2.8**: 본문에 "ADR-0016 §T9 — Tailwind 375/768/1024 + shadcn/ui (RHF 추가
GATE-J 분기)" 인용.

**§2.9**: 본문에 "ADR-0016 §T9 — axe-core 0 violations + SC-C (Playwright 페이즈
4 deploy 직전)" 인용. SC-C 표기.

**페이즈 2 합계**: 9 → **9 그대로** (체크박스 [ ] 모두 유지, scope cut 만 표기).

**작업 추적 메타 표 갱신**: 페이즈 2 합계 = 9 (변동 X). "최종 업데이트
2026-05-10".

**Scope cut 옵션 표 갱신**:
- 옵션 C → "**적용됨 (ADR-0016 §T6, 2026-05-10)**" 표기
- 옵션 SC-B / SC-D / SC-E 신설 행 추가 (옵션 D 인쇄 뷰와 충돌 X — 별도 SC 라벨)

## Rejected alternatives — 거부된 대안 (T 별 1개)

| Trade-off | 채택 | 거부된 주요 대안 |
|---|---|---|
| T1 | 옵션 A `/compare/[category]/[step]` (REST) | 옵션 B 단일 페이지 + step state (deep-link 불가) |
| T2 | `/compare` 별도 페이지 + 4 카드 | 랜딩 inline (LCP 부담 + 의도 분기 모호) |
| T3 | BE 1차 (SC-B) | 페이즈 2 1차 BE/NL/LU 3국 (비교 후보 0 → 신뢰 손상) |
| T4 | `householdType` enum 3값 라디오 카드 | 가구 형태 + 사용량 직접 입력 (P2 5분 위반) |
| T5 | 선택적 스킵 동등 노출 + sub-step | 현재 공급사 필수 (신규 가입자 배제) |
| T6 | SC-A "없이 진행" 단일 버튼 | tesseract.js 페이즈 2 1차 통합 (LCP + 일정 위협) |
| T7 | 결과 카드 1개 미리보기 + `/r/[shortId]` | 5개 결과 카드 모두 노출 (페이즈 3 흡수, 경계 깨짐) |
| T8 | sessionStorage 만 + 매 입력 즉시 저장 | localStorage 30일 TTL (헌법 §8 #5 위반) |
| T9 | RHF 추가 권장 (옵션 A) | RHF 미추가 옵션 B (보일러플레이트 ↑↑) |
| T10 | SC-E 한국어 단일 (옵션 A) | 옵션 B nl-BE 우선 (시간 sink) / 옵션 C 4 locale 동시 |

## Consequences

### 얻는 것

- 페이즈 2 9 항목 *동시 결정* → builder 진입 시 추가 의사결정 0
- 5단계 5분 P2 정합 + 운영자 명시 5 결정 모두 *기술적 명세* 로 확정
- SC-A/B/C/D + 신규 SC-E = 페이즈 2 일정 (M4~M5) 마진 보존 → 페이즈 4 베타
  (M8~M10) 일정 정합
- ADR-0007 / ADR-0010 / ADR-0011 와 *경계 분리* — 결과 페이지 (페이즈 3) /
  caveats UI (페이즈 3) / OCR (페이즈 3 결과 직후) 모두 별도 ADR 예약
- 외부 의존성 0~2 (RHF + resolvers, GATE-J 분기) — 월 €300 cap 영향 0
- DB schema 무변동 — 마이그레이션 0 (ADR-0007 그대로)

### 잃는 것 / 부채

- **페이즈 2 1차 NL/LU 미지원** — SC-B 적용. 페이즈 3 진입 직전 추가 부채.
- **OCR 미구현** — SC-A. 사용자 사용량 자동 입력 가치 0 → 가구 형태 추정값
  fallback. 페이즈 3 결과 직후 OCR 도입 시 회귀 검토 필요 (별도 ADR).
- **PostHog 측정 미구현** — SC-D. 이탈률 30% 측정 데이터 0 → 페이즈 4 이후
  통계 기반 이탈률 검증 부담.
- **Playwright E2E 미구현** — SC-C. 1차 axe-core 만 → 5분 5단계 *시간 측정*
  데이터 0 → 운영자 수동 검증 부담. 페이즈 4 deploy 직전 일괄 추가.
- **i18n 인프라 부재** — SC-E. 페이즈 4 베타 직전 일괄 도입 시 *모든 텍스트
  키화* 부담 (자동화 가능, ADR-0011 §T5 거부 대안 4 동형).
- **사용량 추정 매핑 부재** (T4) — `inputAttributes = {}` 빈 객체 → 비교 엔진
  (ADR-0010 §T2) 추천성 caveat 약화. 페이즈 3 진입 시 청구서 수집 결과로
  매핑 정확도 평가.
- **`/r/[shortId]` placeholder** (T7) — 페이즈 3 미진입 시 결과 페이지 풀버전
  부재. ADR-0011 §T2 항목 5 *런칭 초기* 동형 정직 노출.

### 후속 작업 (다른 PLAN / ADR 와 연결)

- **GATE-J 통과 직후 (verifier 책임)**:
  - PLAN §2.1~§2.9 본문에 ADR-0016 §T1~T10 cross-ref 추가 (각 1줄)
  - PLAN §2.5 SC-A 표기, §2.2 SC-B 표기, §2.9 SC-C 표기
  - PLAN Scope cut 옵션 표 갱신 (옵션 C "적용됨", SC-B/D/E 신설)
  - PLAN 작업 추적 메타 표 "최종 업데이트 2026-05-10"
  - INDEX.md ADR-0016 행 추가 (§INDEX.md 갱신 §)
  - 본 ADR Status 행 `Proposed` → `Accepted` 격상
- **GATE-J 통과 후 (builder 책임)**:
  - 10~12 신설 파일 (§다음 단계 §)
  - shadcn/ui 컴포넌트 install (이미 설치된 것 외 추가) — `<RadioGroup>` /
    `<Select>` / `<Form>` / `<Progress>`
  - RHF + resolvers dep 추가 (옵션 A 채택 시) 또는 미추가 (옵션 B)
  - axe-core 수동 검증 (페이즈 2.9 DoD)
- **페이즈 3 진입 시점 (architect 책임)**:
  - 결과 페이지 ADR (3.1~3.7) 신설
  - caveats UI 배치 ADR 신설 (ADR-0011 §T3 예약 발동)
  - 청구서 OCR 도입 ADR 신설 (가칭 ADR-OCR, T6 발동)
  - NL/LU 우편번호 추가 결정 (T3 SC-B 발동)
- **페이즈 4 진입 시점 (architect 책임)**:
  - i18n 일괄 도입 ADR (T10 SC-E 발동) — next-intl + 4 locale (한/nl/fr/en) 또는
    운영자 분기
  - PostHog feature flag + funnel 도입 (T2 SC-D 발동)
  - Playwright E2E 도입 (T9 SC-C 발동)

### 외부 의존성 추가 — 0~2건 (GATE-J 분기)

- **옵션 A 채택 시**: `react-hook-form` (~10KB gzip) + `@hookform/resolvers`
  (~5KB gzip) — GATE-J 운영자 승인 필요
- **옵션 B 채택 시**: 0 (GATE-C 정합)
- shadcn/ui / Tailwind / Lucide React = 페이즈 0 dep 그대로 (변동 0)

### MONETIZATION.md 영향 — 변동 0

- 비용 cap €300/월 영향 0 (RHF + resolvers gzip 부담 ~15KB, Vercel Hobby
  bandwidth 영향 0.01% 미만)
- 베타 모집 카피 (Korean Society BE/NL/LU) 정합 — SC-E 한국어 단일 유지

## Validation

### 검증 1 — GATE-J (운영자 결정)

운영자 (Kim Wonmin) 가 본 ADR 검토 후 다음 항목 승인:
- T1 — `/compare/[category]/[step]` REST 라우팅
- T2 — `/compare` 별도 페이지 + 4 카드
- T3 — SC-B 채택 (BE 1차)
- T4 — `householdType` enum 3값 라디오 카드
- T5 — 현재 공급사 선택적 + 스킵 동등
- T6 — SC-A 채택 ("없이 진행" 단일 버튼)
- T7 — 결과 카드 1개 미리보기
- T8 — sessionStorage 만 + 매 입력 즉시 저장
- **T9 — RHF 추가 (옵션 A) vs 미추가 (옵션 B)** [GATE-J 답변 필수]
- **T10 — SC-E 채택 (한국어 단일) 여부** [GATE-J 답변 필수]

GATE-J 통과 = 본 ADR Status `Proposed` → `Accepted` 격상.

### 검증 2 — builder 종료 후 verifier 체크리스트

- `pnpm typecheck` 0 에러
- `pnpm lint` 0 에러
- `pnpm test` 0 실패
- `pnpm dev` → http://localhost:3000/compare 진입 → 5단계 입력 → `/r/[shortId]`
  도달 (placeholder 또는 페이즈 3 결과)
- axe-core (수동) 0 violations — 페이즈 2.9 DoD
- 운영자 자가 5분 측정 (수동, SC-D 대체) — 5단계 완주 시간 < 5분
- `pnpm harness:plan` — PLAN 2.1~2.9 ADR-0016 cross-ref literal 매칭 통과

### 검증 3 — 모바일 우선 검증 (수동)

- 375px (iPhone SE) viewport — 모든 단계 가로 스크롤 0
- 768px (iPad) — `md:` breakpoint 적용 확인
- 1024px (Desktop) — `lg:` breakpoint 적용 확인
- 키보드만으로 5단계 완주 가능 (Tab 순서 + Enter 진행)

### 검증 4 — sessionStorage 정합성

- 각 단계 입력 → sessionStorage 즉시 저장 (DevTools Application 탭 확인)
- 페이지 새로고침 → 입력 데이터 복원
- 탭 닫기 → 새 탭 진입 시 sessionStorage 비어 있음 (브라우저 자동 정리)
- localStorage = 빈 (헌법 §8 #5 강제)

## 회귀 트리거 (Trigger for revisit)

다음 중 하나 발견 시 ADR-0016 Amendment:

1. **페이즈 2 1차 사용자 5분 측정 실패** (운영자 자가 측정 또는 베타 사용자
   초기 신호) → P2 위반 → 단계 수 / UI 단순화 재평가
2. **GATE-J 에서 운영자 T9/T10 옵션 B 채택** → 본 ADR §T9/§T10 옵션 B 명세로
   Amendment + builder 인계 갱신
3. **shadcn/ui 컴포넌트 호환성 이슈 1건 이상** (Tailwind 4 미지원 또는 RSC
   호환성) → 컴포넌트 별도 ADR
4. **NL/LU 공급사 추가 (페이즈 5 5.0)** → SC-B 발동 → §T3 NL/LU Zod schema +
   라우트 분기 결정
5. **OCR 도입 시점 (페이즈 3 결과 직후)** → SC-A 발동 → §T6 본문 갱신 또는 별도
   ADR
6. **PostHog feature flag + funnel 도입 (페이즈 4)** → SC-D 발동 → §T1/T2
   funnel props 본문 갱신
7. **i18n 일괄 도입 (페이즈 4 베타 직전)** → SC-E 발동 → §T10 4 locale 명세 +
   `app/[locale]/...` 라우팅 결정
8. **`comparison_request.input_attributes` 카테고리별 추정 매핑 정확도
   ≤ 60%** (페이즈 3 청구서 수집 후 검증) → §T4 사용량 추정 helper 신설 결정
9. **이탈률 ≥ 30%** (페이즈 4 PostHog 측정 후) → P2 위반 → 본 ADR Amendment +
   단계 / UI 재평가

## 다른 ADR 과의 관계

- **ADR-0007**: §T2 `comparison_request` 컬럼 모양 (category / postalCode /
  householdType / currentProviderId / inputAttributes) 직접 사용. 본 ADR §T3~T7
  이 그 컬럼을 채우는 *입력 화면 명세*. ADR-0007 변동 0.
- **ADR-0010**: §T7 케이스 6 (currentTariff null = 신규 가입자) 직접 활용 — 본
  ADR §T5 스킵 시 동일 처리. ADR-0010 §T10 동기 5초 timeout = 본 ADR §T7 결과
  미리보기 호출 인터페이스. ADR-0010 변동 0.
- **ADR-0011**: §T4 GATE-C (새 의존성 0) 정책 = 본 ADR §T9 GATE-J 분기로
  *부분 완화* — 페이즈 2 진입 시점 운영자 명시 승인 필요. §T5 i18n 페이즈 1
  한국어 단일 = 본 ADR §T10 SC-E 로 *연장* 결정 (페이즈 4 베타 직전 일괄 도입).
  §T3 caveats UI 배치 결정 = 본 ADR §T7 결과 미리보기와 *경계 분리*.
- **ADR-0009**: §결정 1 BE 시장 점유 ≥ 75% (Proximus + Telenet) = 본 ADR §T3
  SC-B 정합 (페이즈 2 1차 BE 만 = 비교 후보 100% 커버).
- **ADR-0020**: §결정 7 + §Appendix C slim.lu 도메인 검증 = 본 ADR §T11 직교
  결정. 페이즈 2 진입 직후 운영자 별도 작업.
- **ADR-0003**: §결정 6 옵션 C (OCR 페이즈 5 이연) = 본 ADR SC-A 와 *동형
  의도* (단 본 ADR 은 페이즈 3 결과 직후로 더 빠른 시점 채택). ADR-0003 §결정 6
  옵션 C 표기 변경 가능 (verifier 분기 결정).

## 다음 단계 — builder 인계 명세 (GATE-J 통과 후)

### 신설 파일 (10~12)

```
src/types/comparison-input.ts        # Zod schema (postal/household/current-provider) 단일 출처
src/app/compare/page.tsx              # 카테고리 선택 (T2)
src/app/compare/[category]/page.tsx   # = redirect to /postal (T1)
src/app/compare/[category]/postal/page.tsx              # 단계 1 (T3)
src/app/compare/[category]/household/page.tsx           # 단계 2 (T4)
src/app/compare/[category]/current-provider/page.tsx    # 단계 3 (T5)
src/app/compare/[category]/bill/page.tsx                # 단계 4 (T6, "없이 진행")
src/app/compare/[category]/preview/page.tsx             # 단계 5 (T7)
src/app/compare/[category]/_components/CompareLayout.tsx     # 진행 표시 + 백 버튼 (T8)
src/app/compare/[category]/_components/useCompareSession.ts  # sessionStorage 훅 (T8)
src/app/api/compare/route.ts          # POST /api/compare 서버 액션 (T7 비교 엔진 호출)
src/app/r/[shortId]/page.tsx          # placeholder (페이즈 3 진입 전, T7)
```

**옵션 A (RHF 추가) 시 추가**:
- `package.json` dep: `react-hook-form` + `@hookform/resolvers`

### 의존: 페이즈 0 dep (변동 0)
- Next.js 15 (App Router) / Tailwind 4 / shadcn/ui / Drizzle / Zod / Lucide React

### 테스트
- `src/types/comparison-input.test.ts` — Zod schema BE 우편번호 정합 (1000~9999
  pass, 0001~0999 fail 등)
- `src/app/api/compare/route.test.ts` — 동기 호출 + comparison_request +
  comparison_result insert 정합
- `src/app/compare/[category]/_components/useCompareSession.test.ts` —
  sessionStorage 훅 read/write + version migration

### 운영자 GATE-J 답변 요청

**1. T9 RHF 추가 vs 미추가**:
- 옵션 A (권장) — `react-hook-form` + `@hookform/resolvers` 2 dep 추가 (~15KB
  gzip), shadcn/ui Form 패턴 정합, 학습자 모드 친화
- 옵션 B — dep 0, `useState` + Zod `safeParse` 직접, 보일러플레이트 ↑↑

**2. T10 SC-E 한국어 단일 vs 페이즈 2 1차 nl-BE 추가**:
- SC-E (권장) — 페이즈 2 한국어 단일, 페이즈 4 베타 직전 일괄 i18n
- 옵션 B — nl-BE 우선 + 페이즈 3 fr-BE/en — next-intl 페이즈 2 진입 시 도입

위 2 항목 + T1~T8 본 ADR §결정 모두 승인 시 GATE-J 통과 → builder 인계.

## References

### 헌법 + 운영자 컨텍스트

- [`CLAUDE.md`](../../CLAUDE.md) — §3 P2 (5분/5단계 + LCP/FID), §3 P3 (투명성),
  §3 P4 (타입 안전), §3 P5 (ADR), §8 #3 (다크 패턴 금지), §8 #5 (추적 픽셀 X)
- [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, 한국어 모국어, 학습자 모드,
  주 10-20시간 / 월 €300

### 관련 ADR

- [ADR-0001](0001-provider-schema.md) — `provider` 테이블 (T5 현재 공급사
  SELECT 출처)
- [ADR-0003](0003-plan-realism-solo-side.md) — §결정 6 옵션 C OCR 페이즈 5
  이연 (본 ADR SC-A 와 동형 의도)
- [ADR-0005](0005-tariff-schema-telecom.md) — §T6 `tariff_category` enum 4값
  (T1 라우팅 [category] 정합)
- [ADR-0007](0007-comparison-request-result-schema.md) — §T2 입력 컬럼 + §T3
  GDPR Art. 6(1)(b) Contract performance + §T10 동기 5초 timeout
- [ADR-0009](0009-scope-cut-fetcher-2-providers.md) — §결정 1 BE 시장 점유
  ≥ 75% (T3 SC-B 정합)
- [ADR-0010](0010-comparison-engine.md) — §T7 케이스 6 신규 가입자 (T5 정합) +
  §CompareInput 모양 (T7 결과 미리보기 입력)
- [ADR-0011](0011-data-sources-page-and-caveats-boundary.md) — §T3 caveats UI
  경계 분리 (T7 동형 패턴) + §T4 GATE-C 의존성 정책 (T9 분기) + §T5 i18n 페이즈
  1 한국어 단일 (T10 SC-E 연장)
- [ADR-0020](0020-arbitoria-inventory-and-alignment-corrections.md) — §결정 7
  + §Appendix C slim.lu 도메인 (T11 직교)

### 외부 사실 (검증된 출처 — 2026-05-10)

- [shadcn/ui — Form](https://ui.shadcn.com/docs/components/form) — RHF + Zod +
  `<Form>` / `<FormField>` 패턴 (T9)
- [shadcn/ui — RadioGroup](https://ui.shadcn.com/docs/components/radio-group) —
  T4 라디오 카드
- [shadcn/ui — Select](https://ui.shadcn.com/docs/components/select) — T5 현재
  공급사
- [shadcn/ui — Progress](https://ui.shadcn.com/docs/components/progress) — T8
  진행 표시
- [next-intl — App Router routing](https://next-intl.dev/docs/routing) — T10
  SC-E 거부 시 `app/[locale]/...` 패턴
- [react-hook-form](https://react-hook-form.com/) — T9 옵션 A 권장 의존
- [@hookform/resolvers — zod](https://github.com/react-hook-form/resolvers) —
  T9 옵션 A 권장 의존
- [Deque axe-core](https://github.com/dequelabs/axe-core) — PLAN 2.9 + SC-C
- [Deque @axe-core/playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)
  — SC-C Playwright 페이즈 4 deploy 직전
- [PostHog — Funnels](https://posthog.com/docs/product-analytics/funnels) —
  SC-D 페이즈 4 이후
- [Tailwind v4 — Responsive Design](https://tailwindcss.com/docs/responsive-design)
  — T9 breakpoints
- [Universal Postal Union — Belgium postal codes](https://www.upu.int/UPU/media/upu/files/postalSolutions/postalCodes/belgiumEn.pdf)
  — T3 BE 4자리 1000~9999

### 운영자 GATE 정의

- **GATE-J** = 본 ADR T1~T10 운영자 승인 (특히 T9 RHF + T10 SC-E 분기) →
  Accepted + builder 인계
- GATE-K = 페이즈 4 베타 진입 게이트 (ADR-0020 §결정 7 slim.lu / §결정 4
  Vercel env vars / §결정 3 GitHub App 직접 설치 정합)
- GATE-L = M16 평가 게이트 (ADR-0003 §결정 2)

---

## Amendment 1 (2026-05-16) — landline 제거 (§T1/§T2) + SC-E 발동·시점 앞당김 (§T10)

### 상태

**Accepted (2026-05-16)** — 운영자 잠금 결정 **D-1 (landline 흔적 제거)**
+ **D-2 (시나리오 γ)** 승인. [ADR-0033](0033-i18n-next-intl-introduction.md)
통합 분석 산출물.

### (a) §T1 / §T2 — 카테고리 4 → 3 (`landline` 제거)

- §T1 `[category]` enum = `mobile` / `internet_fixed` /
  `bundle_internet_tv` (4→3, ADR-0005 §Amendment 1, D-1). URL 라우팅
  *구조* 보존 — `/compare/[category]/[step]` 그대로. (locale prefix 는
  ADR-0033 §T1 별도 트랙.)
- §T2 "4 카테고리 카드" → **3 카드** (유선 전화 카드 제거).
  **동등 시각 무게 원칙 유지** — 3 카드 모두 동일 무게, "추천" 라벨/
  색상 강조 0 (헌법 §8 #3 다크 패턴 0 — 원 §T2 근거 불변).

### (b) §T10 — SC-E 발동 + 시점 앞당김 (시나리오 γ)

- ADR-0016 §회귀 트리거 **7번** ("i18n 일괄 도입 (페이즈 4 베타 직전)
  → SC-E 발동 → §T10 4 locale 명세 + `app/[locale]/...` 라우팅 결정")
  **발동**.
- SC-E = **폐기 아님**. "페이즈 4 베타 직전 일괄 도입" → **시점 앞당김
  + 분리** (시나리오 γ):
  - **4.6 베타 진입 전**: next-intl 인프라 배선 (ADR-0033 §T1 라우팅
    마이그레이션 + middleware) + `messages/ko.json` 키화 (ADR-0033 §T5
    1~3 우선순위).
  - **베타 (4.6)**: ko 단일 콘텐츠 운영 (ADR-0029 한국어 단일 정합 —
    4.6 비-blocker, 콘텐츠 변경 0).
  - **4.9 런치 게이트**: nl/fr/en 콘텐츠 backfill + `messages/ko.json`
    제거 + hreflang/sitemap 활성 + `legal.*` legal 에이전트 검수.
- 4 locale 명세 (`nl-BE/nl-NL/fr-BE/fr-LU/en`) + `app/[locale]/...`
  라우팅 결정 = [ADR-0033](0033-i18n-next-intl-introduction.md)
  §T1·§T2 신설 (본 §T10 이 그 명세를 위임).

### (c) ADR-0029 cross-ref

시나리오 γ 는 ko 를 *next-intl locale 목록에 넣지 않고 베타 콘텐츠
언어로만* 운영한다 (ADR-0033 §T2). 따라서 [ADR-0029](0029-beta-recruitment.md)
Amendment 1/2 의 **한국어 단일 베타 모집 잠금 (r/BENL banned → 3채널
한국어)** 을 **100% 보존** — ADR-0029 Amendment 불요 (D-3, cross-ref만).

### (d) e2e / PLAN 단언 갱신 (builder 인계)

- **e2e `compare-flow.spec.ts`** — 현재 spec 은 *모바일 카드 클릭만*
  단언 (`getByRole('link', { name: '모바일 비교 시작' })`). 카드
  *개수* 단언 코드 **없음** → spec 코드 변경 0. 단 `/compare` 진입
  렌더가 landline 제거 후 `page.tsx:61-67` 자가 점검 throw 0 이어야
  통과 (양쪽 동시 제거 — ADR-0005 §Amendment 1 builder 노트).
- **PLAN §2.1 검증 설명 텍스트** — "4 카드 동등 무게" → "3 카드 동등
  무게" (PLAN.md L604 부근, ADR-0016 Amd 1 cross-ref). PLAN P-2 외과적
  Edit.
- 라우팅 마이그레이션 (ADR-0033 §T1) 채택 시 e2e URL 단언에 locale
  prefix 정합 = ADR-0033 §Migration builder 인계 (본 Amendment 외 —
  ADR-0033 트랙).

### 결과

- ✅ §T2 "4 카드" dead 카테고리 제거 → 3 카드 동등 무게 (다크 패턴 0
  원칙 불변).
- ✅ SC-E 발동 명문화 — 발동 트리거 7번 + 시점 앞당김 (회귀 표면적
  분산, 일정 리스크 ↓).
- ✅ ADR-0029 한국어 베타 잠금 보존 (γ — cross-ref, D-3).
- ⚠️ 라우팅 마이그레이션 (ADR-0033 §T1) = e2e URL 단언 갱신 부채
  (ADR-0033 트랙으로 흡수).

### 검증

- `pnpm test:e2e` — `compare-flow.spec.ts` 모바일 카드 클릭 통과
  (3 카드 렌더 + 자가 점검 throw 0).
- `pnpm harness:plan` — PLAN §2.1 "3 카드" + ADR-0016 Amd 1 cross-ref
  literal 매칭.
- ADR-0033 §Verification 게이트와 통합 (4.5.i / 4.5.j DoD).

## Amendment 2 (2026-05-17) — §T10 SC-E 운영 모델 = EN/FR/NL 공개 + ko basic-auth 게이트 ([ADR-0034](0034-strategy-pivot-completion-first-seo-launch.md) D1)

### 상태

**Accepted (2026-05-17)** — 운영자 잠금 ([ADR-0034](0034-strategy-pivot-completion-first-seo-launch.md)
D1). 본 절은 §Status Amendment 2 블록의 본문 확정판.

### (a) §T10 SC-E 운영 모델 변경 — §T1~§T9 보존

- 변경 전 (Amendment 1): "페이즈 4 까지 한국어 단일, nl/fr/en 은 4.9
  런치 게이트 backfill".
- 변경 후 (D1 잠금): **공개 = EN/FR/NL (ADR-0033 §T2 `locales` 그대로,
  변경 0) / ko = 운영자 전용 hidden, 구현 = `src/middleware.ts`
  basic-auth + env 1개 (기존 `/admin` 가드 동형) / nl·fr·en backfill 이
  4.9 런치 게이트 → 완성 동시로 당겨짐**.
- **§T1~§T9 (REST 라우팅 / 5단계 입력 플로우 UI / RHF / shadcn) = 무관,
  보존 (회귀 0)**. SC-E 는 *폐기 아닌 재정의* (운영 모델만).

### (b) ko 게이트 라우팅 세그먼트 매핑 = ADR-0033 §Amendment 2 가 단일 출처

- ko 게이트의 정확한 경로/세그먼트 매핑 (어느 경로를 basic-auth 가
  보호하는가) 의 잠금 결정은 **[ADR-0033](0033-i18n-next-intl-introduction.md)
  §Amendment 2 (§A2.2 옵션 비교 + 잠금 / §A2.5 DoD)** 가 단일 출처다.
  본 ADR (페이즈 2 입력 플로우) 은 §T1 라우팅 *구조* 만 소유 — i18n
  세그먼트/locale 라우팅은 ADR-0033 §T1 소유 (Amendment 1 (b) 위임
  연장). 중복 기술 금지 (P5 단일 출처).

### 결과

- ✅ SC-E 재정의 명문화 (ADR-0034 D1 잠금 형식 기록).
- ✅ §T1~§T9 보존 — 페이즈 2 입력 플로우 회귀 0.
- 🔁 ko 게이트 구현 세그먼트 매핑 = ADR-0033 §Amendment 2 위임 (단일 출처).

### 검증

- ADR-0033 §Amendment 2 §A2.5 D1~D6 (PLAN 4.5.j.1 DoD) 와 통합.
- `pnpm harness:plan` 정합 (PLAN 항목 수 불변 — 본 amend 본문만).

## Amendment 3 (2026-06-06) — §T1/§T6 5단계 → 4단계 (`/bill` 제거, [ADR-0041](0041-home-hero-redesign.md) Amendment 2)

### 상태

**Accepted (2026-06-06)** — 운영자 PR #34 머지 직후 자가 신호 봉합. 본 절은
§Status Amendment 3 블록의 본문 확정판 (ADR-0041 Amendment 2 동반).

### 변경 골격

- 라우팅 5→4: `/compare/[category]/bill` 페이지 제거 → `postal → current-provider
  → household → preview` 4단계.
- progress bar `1/5~5/5` → `1/4~4/4` 자동 갱신.
- §T6 SC-A "없이 진행" 단일 버튼 결정 = *deprecated* (페이지 자체 부재).

### 결과 + 검증

- ADR-0041 §검증 V1~V4 와 통합. 운영자 자가 V1 통과.

## Amendment 4 (2026-06-07) — §T1/§T3/§T6 4단계 → 3단계 (`/postal` 제거, [ADR-0043](0043-telecom-flow-zip-removal-data-model-preservation.md))

### 상태

**Accepted (2026-06-07)** — 운영자 자가 진단 ("zip code 는 가격 변동 비교요인에
영향을 안줘") + architect 정찰 (시장 사실, ADR-0043 Context §3) + 옵션 D 잠금.
본 절은 §Status Amendment 4 블록의 본문 확정판 ([ADR-0043](0043-telecom-flow-zip-removal-data-model-preservation.md)
D5 동반).

### (a) §T1 라우팅 4→3단계 변경

```
/compare                                    # 카테고리 선택 (§T2 그대로)
/compare/[category]                         # = /compare/[category]/current-provider redirect (변경)
/compare/[category]/current-provider        # 단계 1 (구 단계 2, §T5)
/compare/[category]/household               # 단계 2 (구 단계 3, §T4)
/compare/[category]/preview                 # 단계 3 (구 단계 4, §T7)
```

- 삭제: `/compare/[category]/postal` 라우트 (구 단계 1, §T3)
- redirect: `/compare/[category]` → `postal` → **`current-provider`** (단일 진입 hop)

### (b) §T3 = `DEPRECATED but data model preserved`

- §T3 결정 (postal Zod schema + UI 컴포넌트) = *통신 흐름* 에서 폐기.
- 단, **데이터 모델 보존** ([ADR-0043 §D2](0043-telecom-flow-zip-removal-data-model-preservation.md)):
  - `POSTAL_COUNTRIES` / `postalCountrySchema` / `postalCodeSchema` (`src/types/comparison-input.ts`
    §32-87) = **보존**
  - `comparison_request.postal_code` DB 컬럼 (ADR-0007 §T2) = **보존** (nullable)
  - `sessionStateSchema.data.postalCountry/postalCode` = 이미 `.optional()` (변경 0)
  - `comparisonInputSchema.postal` = `.optional()` 격상 (통신 흐름 미제출, 미래
    카테고리 제출)
- **미래 카테고리 reverse 트리거** (ADR-0043 §D4): 에너지 BE / 모기지 BE / 보험 BE
  진입 시 별 ADR (ADR-NNNN-zip-reintroduction) 로 재신설 가능.

### (c) §T6 step indicator 4→3 갱신

- progress bar `n/4` → `n/3`
- step badge `1/4 단계 · 약 4분` → **`1/3 단계 · 약 3분`** (P2 5분 예산 마진 +1)
- sessionStateSchema `step` enum (line 165 of `src/types/comparison-input.ts`):
  `['postal', 'household', 'current-provider', 'preview']` →
  `['current-provider', 'household', 'preview']`
- `stepSchemas` (line 145-149) `postal` 키 제거 → `StepName` 자동 축소

### (d) §T8 sessionStorage 호환성

- 기존 v1 sessionStorage 키 (`postalCountry` / `postalCode`) = 이미 `.optional()`
  → 복원 시 자동 통과 (회귀 0). version bump 불필요.

### 결과

- ✅ 4→3단계 골격 명문화 (운영자 자가 진단 봉합)
- ✅ §T3 데이터 모델 보존 (미래 카테고리 reverse 가능)
- ✅ 헌법 §3 P2 5분 예산 마진 +1단계 확보
- ✅ 헌법 §3 P3 투명성 — carrier availability caveats (ADR-0043 §D3) 신설
- 🔁 §T1 / §T3 / §T6 의 *5단계 가정* 일부 본문은 amendment 본문이 권위 (충돌 시 본 절 우선)

### 검증

- ADR-0043 §검증 V1~V5 와 통합 (PLAN 4.16 DoD)
- `pnpm test:e2e` — `compare-flow.spec.ts` 3-step flow 통과
- `pnpm harness:plan` 정합 (PLAN 4.16 +1)
- Vercel 배포 URL 5 locale Pieter Chrome MCP 실측 (운영자 자가 V5)
