# ADR-0033: i18n 도입 — next-intl 인프라 + 시나리오 γ (베타 전 배선/ko 키화, 콘텐츠 backfill 런치 게이트)

## Status

**Accepted (2026-05-16)** — 운영자 잠금 결정 D-1~D-4 승인 완료. §T1 (라우팅)
은 architect 결정 (D-5 위임) — 본문에 근거 + trade-off 명문화. §T2~T5 는 D-2
(시나리오 γ) + CLAUDE.md §5 locale 정합.

**Amendment 2 (2026-05-17, [ADR-0034](0034-strategy-pivot-completion-first-seo-launch.md) D1)**
— **시나리오 γ → 4 locale 공개 + ko basic-auth 게이트**. §T1 라우팅 골격
(`app/[locale]/` + `src/middleware.ts` + `src/i18n/routing.ts|request.ts`)
**보존 — 회귀 0 (핵심 자산)**. §T2 변경: ~~"ko = 베타 콘텐츠 언어, 4.9
backfill"~~ → **ko = 운영자 전용 hidden (basic-auth 게이트, ADR-0034 D1
구현 = middleware basic-auth + env 1개) / nl·fr·en 콘텐츠 backfill 이
*4.9 런치 게이트 → 완성 동시* 로 당겨짐**. §T3 (DeepL Free + base
fallback) / §T4 (`legal.*` 별도 legal 검수 게이트) / §T5 (키화 우선순위)
는 **유지 — 시점만 당김** (4.9 게이트 → PLAN 4.5.j.2/4.5.j.3). §SCOPE 표
+ §Verification #6 (4.9 게이트) 재정의. 본 문서 끝 §Amendment 2 참조 (해당
절 없으면 본 Status 블록이 단일 출처). **다음 단계 결정 (구현 상세 — 잠금값
아님)**: 현 `src/i18n/routing.ts` 는 ko 를 `locales` 비포함 + nl-BE 슬롯에
`messages/ko.json` 매핑 구조 — basic-auth 게이트가 보호하는 정확한 경로/
세그먼트 매핑은 builder 진입 시 결정 (ADR-0034 D1 §다음 단계 결정 참조).

**격상 이력**:
- Proposed (2026-05-16) — landline 제거 + i18n 당김 통합 분석 (architect)
- Accepted (2026-05-16) — 운영자 결정 잠금 (D-1 흔적 제거 / D-2 시나리오 γ /
  D-3 cross-ref만 / D-4 4.5.i·4.5.j / D-5 architect §T1 위임)
- Amendment 2 (2026-05-17) — γ → 4 locale 공개 + ko basic-auth 게이트
  (ADR-0034 D1, §T1 보존 / §T2 운영 모델 변경 / §T3~T5 시점 당김)

본 ADR 은 **ADR-0016 §T10 SC-E + §회귀 트리거 7번 (i18n 일괄 도입)** 의 발동
산출물이다. SC-E 는 **폐기가 아니라 발동 + 시점 앞당김** — 직전 분석 결론 그대로.
(Amendment 2 이후: ko 운영 모델만 "베타 콘텐츠" → "운영자 basic-auth 게이트"
변경, 라우팅 골격 §T1 은 무변경.)

## Context

### 무엇이 우리를 이 결정 앞에 세웠는가

1. **landline 제거 (D-1)** — `tariff_category` enum 4값 중 `landline` 은
   ADR-0005 §T6 시점에 "시니어 대상 드물게 존재" 가정으로 넣었으나, 페이즈
   1.8 fetcher 2개 (Proximus + Telenet, ADR-0009) + 페이즈 2~3 실제 구현에서
   landline 행이 **단 한 번도 시드/픽스처로 삽입된 적 없음**. 레포 전수 확인:
   - `drizzle/0001_mighty_husk.sql` — `CREATE TYPE tariff_category` enum
     정의에만 존재 (label)
   - `drizzle/meta/0001~0006_snapshot.json` — Drizzle 스냅샷 enum 미러
   - `src/db/schema/tariff.ts` / `comparison_request.ts` — enum 정의 + 주석
   - `src/types/comparison-input.ts` / `tariff-attributes.ts` /
     `engine/usage-estimator.ts` / fetcher / UI — 코드 분기
   - **seed / fixture / 실데이터 landline 행 = 0건**. 베타 미시작 → 손실 0.
   - P3 위반 아님 (직전 분석 §A.3): landline 은 사용자에게 *제공된 적 없는*
     카테고리. "제외된 공급사 이름 공개" (P3) 와 무관 — 카테고리 자체가
     베타 콘텐츠에 진입한 적 없음.

2. **i18n 당김 압력 (D-2)** — ADR-0016 §T10 SC-E 는 "페이즈 4 베타 직전 일괄
   도입 (next-intl + 4 locale)" 으로 미뤘다. 그러나:
   - **하드코딩 한국어 문자열이 페이즈 2~3 전반에 누적** (compare 5단계 /
     결과 페이지 / caveats.ts 8규칙 / legal placeholder / metadata). 베타
     직전 *전량 키화* 는 단일 거대 작업 → 회귀 표면적 최대 + 일정 위험.
   - ADR-0029 (Amendment 2, 2026-05-15) 가 베타 모집 카피 **한국어 단일** 로
     잠금 (r/BENL banned → 3채널 모두 한국어). 즉 베타 *콘텐츠 언어 = 한국어*
     는 확정 사실 — 이를 깨면 ADR-0029 충돌.
   - 직전 분석의 시나리오 비교: α(베타 직전 일괄, SC-E 원안) / β(베타 전 풀
     4 locale 콘텐츠) / **γ(인프라+ko 키화만 베타 전, 콘텐츠 backfill 런치
     게이트)**. 운영자 잠금 = **γ**.

3. **ADR-0010 §T6 L233-234 명시 예약 발동** — "각 caveat 은 i18n key 가
   아닌 nl-BE 단일 문자열 (페이즈 1~4 시점). 페이즈 2 i18n 도입 시 키화 —
   ADR Amendment." 본 ADR + ADR-0010 Amendment 1 이 그 예약을 발동한다.
   (실제 caveats 는 한국어 단일로 구현됨 — ADR-0010 §T6 의 "nl-BE 우선"
   표기는 ADR-0016 SC-E 채택으로 한국어 단일이 됨. 본 ADR 이 키화 대상.)

### 본 ADR 이 직접 받는 의존성

- **CLAUDE.md §5** — i18n = next-intl, locale = `nl-BE / nl-NL / fr-BE /
  fr-LU / en` (기술 스택 확정, 변경 시 ADR 필수). 본 ADR §T2 가 이 목록을
  그대로 채택 — CLAUDE.md §5 변경 0.
- **ADR-0016 §T10 SC-E** — "한국어 단일 → 페이즈 4 베타 직전 일괄 도입".
  본 ADR + ADR-0016 Amendment 1 이 *시점 앞당김* (베타 직전 → 4.6 진입 전
  인프라+ko 키화) + *분리* (콘텐츠 backfill = 4.9 런치 게이트).
- **ADR-0029 (Amendment 1/2)** — 베타 모집 카피 한국어 단일 (r/BENL banned,
  3채널). 본 ADR §T2 시나리오 γ 는 ko 를 *locale 목록에 넣지 않고 베타
  콘텐츠 언어로만 운영* → ADR-0029 한국어 베타 잠금 100% 보존 (D-3).
- **ADR-0011 §T5** — i18n 페이즈 1 한국어 단일 (ADR-0016 §T10 으로 연장됨).
  본 ADR 이 그 연장의 종료점 정의.
- **ADR-0016 §T1** (`/compare/[category]/[step]` REST 라우팅) + **ADR-0021**
  (`/r/[shortId]` 결과 페이지) — 본 ADR §T1 라우팅 결정이 *기존 라우트
  마이그레이션 비용* 으로 직결 (D-5 평가 대상).

### 외부 사실 (검증된 출처 — 2026-05-16)

- **next-intl App Router routing** — 두 전략: (a) `[locale]` 세그먼트
  라우팅 (`app/[locale]/...` + middleware) — locale 별 URL + `<Link>` /
  `redirect` / `getPathname` 자동 prefix, hreflang/sitemap 자연 정합;
  (b) "without i18n routing" — 단일 URL, locale 은 쿠키/헤더/사용자 선호로
  결정, 정적 export 친화. 출처: [next-intl — Routing](https://next-intl.dev/docs/routing)
  / [next-intl — App Router setup](https://next-intl.dev/docs/getting-started/app-router)
  / [next-intl — without i18n routing](https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing).
- **next-intl 메시지 네임스페이스** — `messages/{locale}.json` + `useTranslations('namespace')`
  + 서버 컴포넌트 `getTranslations`. 출처: [next-intl — Messages](https://next-intl.dev/docs/usage/messages).
- **hreflang / SEO** — locale 별 고유 URL 이 `<link rel="alternate"
  hreflang>` + `sitemap.ts` 다국어 항목의 전제. 단일 URL + 동적 locale 은
  검색엔진이 locale variant 를 색인 불가 (canonical 1개). 출처:
  [Next.js — Internationalization](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
  / [Google — Localized versions / hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions).
- **DeepL API Free** — 500,000 자/월 무료, REST API, 키 발급 즉시. nl/fr/en
  지원. 출처: [DeepL — API Pro/Free plans](https://www.deepl.com/pro-api)
  / [DeepL — Languages](https://developers.deepl.com/docs/resources/supported-languages).
  ※ 정확 분량은 키화 완료 후 측정 (T3 — 추정 아님 명시).

## Decision — T1~T5

### T1 — 라우팅 = **`[locale]` 세그먼트 라우팅 채택** (`app/[locale]/...` + middleware) [D-5 architect 결정]

next-intl 의 `[locale]` 세그먼트 전략을 채택한다. 단 시나리오 γ 의 베타
구현 부담을 최소화하기 위해 **단계적 적용** — T5 우선순위 참조.

**결정:**
- `src/app/[locale]/...` 세그먼트 + `src/middleware.ts` (next-intl
  `createMiddleware`) + `src/i18n/routing.ts` (locale 목록 + defaultLocale)
- locale 별 URL: `/{locale}/compare/[category]/[step]`,
  `/{locale}/r/[shortId]`, `/{locale}/legal/*`, `/{locale}/data-sources`
- `localePrefix` = `as-needed` 검토 (defaultLocale 무프리픽스 — 단 베타
  콘텐츠 = ko 인 γ 특수성으로 §Migration 에서 확정)

**근거 (왜 세그먼트 라우팅):**
- **hreflang / SEO 정합 (P1·P2 직결)** — Slim 의 핵심 자산은 비교 결과
  페이지의 SEO (CLAUDE.md §5 "SSR + ISR 로 비교 결과 SEO + 신선도 양립").
  Google 은 locale variant 색인을 위해 *고유 URL + hreflang* 을 요구
  (외부 사실). 단일 URL + 동적 locale 은 nl-BE / fr-BE 검색 노출을
  구조적으로 포기하는 것 — 베네룩스 시장 진입 신호 자체를 잃는다.
- **`sitemap.ts` 다국어 정합** — 기존 `src/app/sitemap.ts` 가 이미 존재.
  세그먼트 라우팅은 locale × 경로 곱집합을 sitemap 에 자연 표현. 단일
  URL 은 sitemap 에 locale 표현 불가.
- **결과 페이지 공유 (`/r/[shortId]`)** — 사용자가 nl-BE 로 본 비교 결과를
  공유하면 수신자도 nl-BE 로 봐야 신뢰 (P1 정보 무결성). 쿠키 기반 locale
  은 공유 링크에서 깨짐. URL 에 locale 이 있어야 공유가 결정적.
- **학습자 모드 친화 (FOUNDER §5)** — `app/[locale]/...` 는 next-intl 공식
  문서의 *기본 권장 경로* → 6개월 후 운영자가 Stack Overflow / 공식 docs
  검색 시 적용 가능. "without i18n routing" 은 비표준 경로 → 디버깅 부담.

**Trade-off (잃는 것 — 정직하게):**
- ⚠️ **기존 라우트 전량 마이그레이션** — `src/app/compare/...` /
  `src/app/r/[shortId]/...` / `src/app/legal/...` / `src/app/data-sources/...`
  / `src/app/sitemap.ts` / 루트 `page.tsx` 가 `src/app/[locale]/` 하위로
  이동. ADR-0016 §T1 (`/compare/[category]/[step]`) + ADR-0021
  (`/r/[shortId]`) 의 URL 구조는 **보존** (locale prefix 만 추가) — 라우트
  *의미* 변경 0, *위치* 변경만. e2e (`compare-flow.spec.ts` 등) 의 URL
  단언이 `/{locale}` prefix 반영 필요 (builder 인계).
- ⚠️ middleware 1개 추가 — Edge runtime 실행. Vercel Hobby/Pro 영향 0
  (€300 cap 무관, next-intl middleware 는 경량 redirect).
- ⚠️ 시나리오 γ 베타 = ko 단일 콘텐츠인데 라우팅은 multi-locale 구조 —
  **베타 시점에 ko 만 messages 채워짐**. nl/fr/en URL 은 존재하나 콘텐츠
  fallback (T3) → 베타 사용자에게는 ko 만 노출 (ADR-0029 정합). 라우팅
  구조를 미리 깔아두면 4.9 런치 시 콘텐츠 backfill 만 하면 됨 (회귀 0).

**거부된 대안 — "without i18n routing" (단일 URL + 선호 기반 locale):**
- 장점: 기존 라우트 마이그레이션 0 (`app/[locale]` 이동 불요). γ 베타
  구현 부담 최소.
- 단점: (a) hreflang/sitemap 다국어 색인 **구조적 불가** → 베네룩스 SEO
  포기 (P1·P2 핵심 자산 손실). (b) 공유 링크 (`/r/[shortId]`) locale
  비결정 → 정보 무결성 손상. (c) 4.9 런치 시 SEO 를 살리려면 *그때*
  세그먼트 라우팅으로 재마이그레이션 → 부채 이연일 뿐 회피 아님 + 런치
  직전 대규모 라우트 변경 = 최악 타이밍.
- 거부 사유: 마이그레이션 비용 절약(일회성) < SEO 자산 영구 손실 +
  부채 이연. **단 — γ 베타는 ko 단일이므로, 라우팅 마이그레이션을 4.6
  진입 전 인프라 배선 단계에 포함하되 ko locale 만 실콘텐츠로 채우는 것이
  비용-효익 최적** (§Migration + §T5).

**D-5 라우팅 결정이 베타 전 구현 부담에 미치는 영향 (운영자 요청 명시):**
시나리오 γ 에서 베타 콘텐츠 = ko 단일이므로, 4.6 진입 전 작업은
**(1) 라우트를 `app/[locale]/` 로 이동 + middleware/routing.ts 배선
(2) `messages/ko.json` 키화 (T5 우선순위 순)** 두 가지. nl/fr/en messages
파일은 *빈 골격 또는 ko fallback* 으로 두면 됨 (콘텐츠 backfill = 4.9).
즉 라우팅 유 선택의 베타 전 추가 부담 = "라우트 디렉터리 1단 이동 +
middleware 1개" — 키화 작업과 동일 라운드에서 흡수 가능 (4.5.j DoD).
라우팅 무 선택 대비 베타 전 순증 부담은 *제한적*이며, 4.9 재마이그레이션
회피 가치가 이를 압도한다.

### T2 — locale 목록 = `nl-BE / nl-NL / fr-BE / fr-LU / en` (CLAUDE.md §5 정합), ko 는 시나리오 γ 베타 콘텐츠 언어 (locale 목록 비포함)

**결정:**
- `routing.ts` `locales` = `['nl-BE', 'nl-NL', 'fr-BE', 'fr-LU', 'en']`
  (CLAUDE.md §5 그대로 — 변경 0)
- `defaultLocale` = `nl-BE` (베네룩스 1차 시장 — ADR-0009 BE ≥ 75%)
- **`ko` 는 locale 목록에 넣지 않는다.** 시나리오 γ 에서 ko 는 *베타
  콘텐츠 언어* 로서 `messages/ko.json` 을 운영하되, next-intl `locales`
  배열 / URL 세그먼트 / hreflang 에는 **포함하지 않음**.
- **ko 는 한시적이 아니다 (명확화)** — γ 는 ko 를 "임시 locale" 로 넣었다
  빼는 게 아니라, *처음부터 locale 이 아닌 베타 운영 콘텐츠* 로만 다룬다.
  런치 시 (4.9) ko 콘텐츠를 nl/fr/en 으로 backfill 하고 `messages/ko.json`
  은 제거 — locale 추가/제거 마이그레이션이 아니라 *콘텐츠 소스 교체*.

**근거:**
- CLAUDE.md §5 가 이미 5 locale 을 헌장으로 확정 → ADR 은 이를 *집행*만.
- ko 를 locale 로 넣으면 URL `/ko/...` + hreflang `ko` 노출 → 베네룩스
  검색엔진/사용자에게 한국어 URL 이 색인됨 (P3 투명성 혼선 + ADR-0029
  의 "한국어 = 베타 모집 채널 한정" 의도와 충돌). 베타 콘텐츠로만 두면
  ADR-0029 잠금 100% 보존 (D-3).
- 베타 운영 모델: 베타 사용자(한인 커뮤니티)는 ko 콘텐츠를 본다. next-intl
  `defaultLocale` 의 messages 를 *베타 동안 ko 내용으로 채우는* 방식 또는
  별도 ko 메시지 + 빌드 환경 분기 — 구현 방식은 builder 자유도 (§Migration
  에서 권고: `messages/ko.json` + `defaultLocale` 메시지를 베타 빌드에서
  ko 로 매핑하는 것이 가장 단순. 런치 시 nl-BE 실콘텐츠로 교체).

### T3 — 번역 소스 = DeepL API Free (500K 자/월) + 수동 검수, nl/fr base fallback

**결정:**
- 번역 1차 = **DeepL API Free** (500,000 자/월 무료, nl/fr/en 지원 —
  외부 사실). €300 cap 영향 = **0 추정** (무료 티어). 정확 분량 = ko 키화
  완료 후 총 문자 수 측정하여 확정 (추정 아님 — 측정 후 ADR §Verification
  에 기록).
- 번역 2차 = **수동 검수 필수** — DeepL 출력을 그대로 노출하지 않는다
  (P1: UI 텍스트 정확성). 특히 가격/절약 관련 caveats 는 오역 시 사용자
  손해 → 검수 우선순위 최상.
- **Fallback 패턴:** `nl-BE ↔ nl-NL` 은 `nl` base 공유, `fr-BE ↔ fr-LU`
  는 `fr` base 공유. 즉 메시지 구조 = `messages/nl.json` (base) +
  `messages/nl-BE.json` / `messages/nl-NL.json` (override only — 통화/
  우편번호/지역 표현 차이만). next-intl 메시지 병합으로 중복 번역 최소화
  (DeepL 분량 절약 — base 1회 번역 + region delta).
- en = fallback 없음 (독립). defaultLocale(nl-BE) 미스 키 → `nl` base →
  최후 `en` (next-intl `getMessageFallback`).

**근거:**
- 솔로 + €300 cap (FOUNDER) → 유료 번역 외주 불가. DeepL Free 500K 자
  = 키화 텍스트 (caveats 8 + compare 5단계 + 결과 페이지 + legal +
  metadata) 추정 분량을 충분히 커버할 가능성 높음 (정확 측정 = 키화 후).
- 베네룩스 nl-BE 와 nl-NL 차이는 *대부분 지역/통화/우편번호 표현* — 전량
  재번역은 DeepL 분량 + 검수 시간 낭비. base + delta 가 솔로 운영 정합.
- 수동 검수 = P1 (UI 텍스트 정확성) 강제. DeepL raw 노출은 "출처 없는
  주장" 과 동급 리스크 (특히 caveats — 가격 관련).

**거부된 대안 — Google Translate API / 유료 번역 외주:**
- Google Translate API = 유료 (무료 티어 없음, $20/1M 자) → €300 cap
  잠식. DeepL Free 가 동등 품질 + €0.
- 외주 = 솔로 예산 초과 (FOUNDER). 런치 후 매출 발생 시 재검토 (M16).

### T4 — 법적 텍스트 = 별도 네임스페이스 `legal.*` + legal 에이전트 검수 게이트 (일반 UI 와 분리 트랙)

**결정:**
- `/legal/terms`, `/legal/affiliate-disclosure`, GDPR 동의 문구
  (`src/app/compare/.../page.tsx` 의 동의 UI — ADR-0007 §T3 / ADR-0026
  GDPR Art. 6(1)(a)) 는 메시지 네임스페이스 **`legal.*`** 로 격리.
- `legal.*` 네임스페이스 번역은 **legal 에이전트 검수 게이트 필수** —
  DeepL raw 또는 일반 수동 검수만으로 노출 금지. GDPR 동의/디스클로저
  오역은 법적 리스크 (CLAUDE.md §8 #1, §3 P3, ADR-0026 legal 트리거).
- **일반 UI 트랙과 분리** — 일반 UI 키화/번역은 4.9 런치 게이트로 진행
  가능하나, `legal.*` 는 *별도 후속 트랙* (legal 에이전트 → 외부 변호사
  감사 M16 정합, ADR-0004 §결정 3 / ADR-0026 패턴 일관). 베타(γ)는 ko
  단일이므로 legal 텍스트도 ko (현 상태 유지) — legal 번역 게이트는 4.9
  런치 nl/fr/en backfill 시점에 발동.

**근거:**
- ADR-0026 / ADR-0028 가 이미 legal 에이전트 검수 게이트 패턴 확립
  (GDPR 처리활동 등재 + Art. 6/7/13 + 다크패턴 0). i18n 번역도 동일
  리스크 클래스 → 동일 게이트.
- 법적 텍스트 오역 = 단순 UX 결함이 아니라 *규제 위반* (GDPR 동의 무효
  가능). 일반 UI 와 같은 트랙(DeepL+일반 검수)에 두면 리스크 등급 혼동.

### T5 — 키화 우선순위

1. **`caveats.ts` (8규칙)** — ADR-0010 §T6 예약 발동, 가격 관련 텍스트
   = 정확성 리스크 최상 → 1순위. usage-estimator landline 분기 제거
   (D-1) 와 동일 라운드.
2. **compare 5단계** — `src/app/compare/[category]/{postal,household,
   current-provider,bill,preview}/page.tsx` + `_components` (ADR-0016
   §T3~T8 UI 텍스트 + 진행 표시 라벨).
3. **결과 페이지 `/r/[shortId]`** — `ComparisonTable.tsx` /
   `CalculationDetails.tsx` 등 (ADR-0021). 공유 링크 → locale 결정성
   (T1 근거) 의 핵심 페이지.
4. **legal 트랙** (`legal.*`) — T4 별도 게이트. ko 베타는 현 상태,
   nl/fr/en = 4.9 런치 + legal 에이전트.
5. **metadata / hreflang / sitemap** — `generateMetadata` locale 별 +
   `<link hreflang>` + `sitemap.ts` 다국어 항목 (T1 SEO 정합 마무리).

**시나리오 γ 적용:** 4.6 베타 진입 전 = **(인프라 배선 T1 + 1~3
우선순위의 `messages/ko.json` 키화)**. nl/fr/en 콘텐츠 backfill +
ko 제거 + hreflang 활성 + legal 번역 게이트 = **4.9 런치 게이트**.

## SCOPE / 시나리오 경계

| 시점 | 작업 | 게이트 |
|---|---|---|
| 4.6 베타 진입 **전** | next-intl 인프라 배선 (T1 라우팅 마이그레이션 + middleware + routing.ts) + `messages/ko.json` 키화 (T5 1~3) + landline 제거 (D-1, 별도 트랙) | 4.5.i / 4.5.j DoD. **4.6 비-blocker** (베타 = ko 단일 콘텐츠 그대로, ADR-0029 충돌 0) |
| 4.6 베타 | ko 단일 콘텐츠 운영 (ADR-0029 정합) | — |
| 4.9 런치 **게이트** | nl/fr/en 콘텐츠 backfill (DeepL+검수, T3) + `messages/ko.json` 제거 + hreflang/sitemap 활성 (T5 #5) + `legal.*` legal 에이전트 검수 (T4) | 런치 차단 게이트 |

**SC-E 상태:** ADR-0016 §SCOPE CUT SC-E = **발동 + 시점 앞당김** (폐기
아님). ADR-0016 §회귀 트리거 7번 ("i18n 일괄 도입 → SC-E 발동 → §T10
4 locale 명세 + `app/[locale]/...` 라우팅 결정") 발동 — 본 ADR §T1·§T2 가
그 명세.

## Consequences

### 얻는 것
- 베타 직전 *단일 거대 키화 작업* 해소 → 회귀 표면적을 4.6 전(인프라+ko)
  / 4.9(콘텐츠) 두 단계로 분산. 일정 리스크 ↓.
- hreflang/sitemap SEO 자산 확보 (T1 세그먼트 라우팅) — 베네룩스 시장
  진입 신호 (P1·P2).
- ADR-0029 한국어 베타 잠금 100% 보존 (γ — ko 는 콘텐츠, locale 아님).
- 4.9 런치 시 콘텐츠 backfill 만 (라우팅/인프라 회귀 0).

### 잃는 것 / 부채
- ⚠️ 4.6 전 라우트 마이그레이션 (`app/[locale]/`) — e2e URL 단언 갱신
  필요 (builder). 일회성, §Migration 명세로 흡수.
- ⚠️ `messages/ko.json` 베타 운영 → 4.9 제거 = 콘텐츠 소스 교체 작업
  (locale 마이그레이션 아님 — 부담 제한적).
- ⚠️ nl/fr/en 콘텐츠 backfill 미완 = 4.9 런치 차단 게이트 (부채 명시).
- ⚠️ DeepL Free 분량 한도 = 키화 후 측정 전까지 미확정 (T3 — 초과 시
  나눠 번역 또는 Pro 전환 트리거, M16 매출 시 재검토).

## Migration — 라우팅 유 선택 시 기존 라우트 마이그레이션

**대상 (builder 인계 — 트랙 2):**
- `src/app/page.tsx` → `src/app/[locale]/page.tsx`
- `src/app/compare/**` → `src/app/[locale]/compare/**` (ADR-0016 §T1 URL
  구조 보존 — locale prefix 만 추가)
- `src/app/r/[shortId]/**` → `src/app/[locale]/r/[shortId]/**` (ADR-0021
  shortId 구조 보존)
- `src/app/legal/**` / `src/app/data-sources/**` → `[locale]` 하위
- `src/app/sitemap.ts` → locale × 경로 곱집합 + `alternates.languages`
- 신설: `src/i18n/routing.ts` (locales/defaultLocale) + `src/i18n/request.ts`
  (getRequestConfig) + `src/middleware.ts` (createMiddleware) +
  `messages/{nl,nl-BE,nl-NL,fr,fr-BE,fr-LU,en}.json` 골격 + `messages/ko.json`
  (베타 실콘텐츠)
- `next.config.ts` — next-intl plugin (`createNextIntlPlugin`)
- e2e (`compare-flow.spec.ts` 등) — URL 단언에 `/{defaultLocale}` 또는
  `localePrefix:'as-needed'` 정합 반영
- API 라우트 (`src/app/api/compare/route.ts`) 는 `[locale]` 비대상
  (locale 무관 — 확인 후 유지)

**`localePrefix` 결정:** γ 베타 = ko 단일이므로, defaultLocale 무프리픽스
(`as-needed`) + 베타 빌드에서 defaultLocale 메시지를 ko 로 매핑하는 방식이
URL 변경 최소. 4.9 런치 시 defaultLocale=nl-BE 실콘텐츠로 교체 + 타 locale
prefix 노출. 최종 `localePrefix` 값은 builder 가 next-intl 문서 기준
구현하되 본 §T1 근거 (공유 링크 결정성) 위배 금지.

## Verification — 게이트

1. `pnpm typecheck` / `pnpm lint` / `pnpm test` 0 (라우트 이동 후 import
   경로 + 타입 회귀 0).
2. `pnpm test:e2e` — `/{locale}` URL 단언 반영 후 5단계 플로우 통과.
3. `pnpm harness:plan` — PLAN 4.5.i / 4.5.j + ADR cross-ref literal 매칭.
4. `pnpm dev` → `messages/ko.json` 키 누락 0 (베타 콘텐츠 = ko 완전).
   nl/fr/en = fallback 동작 확인 (4.6 시점 미번역 허용 = γ).
5. DeepL 분량 측정 — ko 키화 완료 후 총 문자 수 기록 (본 ADR §T3 추정
   검증 — 500K 이내 확인 또는 분할 전략 결정).
6. **4.9 런치 게이트** — nl/fr/en 콘텐츠 backfill 100% + hreflang/sitemap
   활성 + `legal.*` legal 에이전트 검수 통과 + `messages/ko.json` 제거.

## References

- 헌법: [`CLAUDE.md`](../../CLAUDE.md) — §3 P1 (정보 우선/SEO), P2 (LCP/
  시장), P3 (투명성), P4 (타입 안전), P5 (ADR), §5 (i18n=next-intl 5 locale),
  §8 #1 (GDPR 동의)
- 운영자: [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, 한국어 모국어,
  €300 cap, 학습자 모드
- 관련 ADR:
  - [ADR-0005](0005-tariff-schema-telecom.md) §T6 + Amendment 1 —
    `tariff_category` 4→3 (landline 제거, D-1)
  - [ADR-0010](0010-comparison-engine.md) §T6 + Amendment 1 — caveats i18n
    키화 예약 발동 (L233-234)
  - [ADR-0011](0011-data-sources-page-and-caveats-boundary.md) §T5 —
    i18n 페이즈 1 한국어 단일 (연장 종료점)
  - [ADR-0016](0016-phase-2-input-flow-design.md) §T1 (라우팅 보존) /
    §T10 SC-E (발동+앞당김) / §회귀 트리거 7번 — Amendment 1
  - [ADR-0021](0021-phase-3-results-page-design.md) — `/r/[shortId]`
    결과 페이지 (라우팅 마이그레이션 대상, 구조 보존)
  - [ADR-0029](0029-beta-recruitment.md) Amendment 1/2 — 한국어 단일 베타
    (γ 가 100% 보존 — cross-ref, D-3)
- 외부 사실 (검증된 출처 — 2026-05-16):
  - [next-intl — Routing](https://next-intl.dev/docs/routing)
  - [next-intl — App Router setup](https://next-intl.dev/docs/getting-started/app-router)
  - [next-intl — without i18n routing](https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing)
  - [next-intl — Messages](https://next-intl.dev/docs/usage/messages)
  - [Next.js — Internationalization](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
  - [Google — Localized versions / hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)
  - [DeepL — API Pro/Free plans](https://www.deepl.com/pro-api)
  - [DeepL — Supported languages](https://developers.deepl.com/docs/resources/supported-languages)

## Amendment 2 (2026-05-17) — γ → 4 locale 공개 + ko basic-auth 게이트 + **세그먼트 매핑 잠금** ([ADR-0034](0034-strategy-pivot-completion-first-seo-launch.md) D1)

> 본 절은 §Status Amendment 2 블록의 **본문 확정판**이다. ADR-0034 D1
> §다음 단계 결정이 "라우팅 세그먼트 매핑은 임의 결정 안 함 — builder
> 진입 시 결정" 으로 *명시 보류* 했던 것을 architect 가 본 절에서 **설계
> 결정으로 잠근다** (PLAN 4.5.j.1 진입 전제 — ADR-0034 §References /
> ADR-0016 §Amendment 2 가 본 절을 단일 출처로 가리킨다).

### A2.1 — 운영 모델 변경 (Amendment 2 §Status 요약의 확정)

- 공개 = `en` / `fr-BE` / `fr-LU` / `nl-BE` / `nl-NL` (§T2 `locales` 배열
  **변경 0** — CLAUDE.md §5 그대로). ko 는 `locales` 비포함 (§T2 원칙 *유지*).
- ko = 운영자 전용 hidden. 구현 = `src/middleware.ts` basic-auth + env
  1개 (§A2.2). "베타 콘텐츠 언어" → "운영자 전용 게이트 콘텐츠" 로
  *운영 모델만* 변경 — §T1 라우팅 골격 무변경 (회귀 0, 핵심 자산 보존).
- §T3 (DeepL) / §T4 (`legal.*` 게이트) / §T5 (키화 우선순위) = *유지,
  시점만 당김* (4.9 런치 게이트 → 완성 동시 = PLAN 4.5.j.2 / 4.5.j.3).

### A2.2 — KO 게이트 라우팅 세그먼트 매핑 — **옵션 비교 + 잠금 결정**

현 `src/i18n/routing.ts` 사실 (architect 레포 직접 확인 2026-05-17):
- `locales = ['nl-BE','nl-NL','fr-BE','fr-LU','en']`, `defaultLocale='nl-BE'`,
  `localePrefix='as-needed'` → **nl-BE = 무프리픽스 = 루트 `/` 가 nl-BE 슬롯**.
- `messages/nl-BE.json` = **ko 복제본 확정** (파일 L2 `_comment`: "베타(γ)
  동안 defaultLocale(nl-BE) 메시지 = ko 내용 … 4.9 런치 시 실 nl-BE
  번역으로 교체") + 본문 한국어 (`messages/ko.json` 과 키·값 동일,
  259줄). nl-NL/fr-BE/fr-LU/en = 빈/stub fallback (§request.ts 빈 객체).

이 구조에서 "ko 게이트" 의 의미를 3 옵션으로 표면화한다.

#### 옵션 (a) — ko 전용 prefix `/ko/*` 를 `locales` 에 추가 + basic-auth 가 `/ko` 가드

- **방식**: `locales` 에 `'ko'` 추가, `localePrefix` 조정, `/ko/...` 진입을
  middleware basic-auth 로 가드.
- ⚠️ **§T2 원칙 정면 위반** — ADR-0034 D1 이 "§T2 원칙 *유지*, `locales`
  배열 변경 0" 을 명시 잠금. ko 를 `locales` 에 넣으면 `generateStaticParams`
  (layout.tsx L49-51) 가 `/ko` 정적 생성 + `routing.locales.includes` 검증
  통과 → **hreflang/sitemap 누출 위험** (ADR-0034 §회귀 #2 + §T2 근거 "ko
  URL 색인 = P3 혼선"). basic-auth 가 콘텐츠는 막아도 URL 존재 자체가
  sitemap 곱집합/`alternates.languages` 에 샐 표면 신설.
- ❌ **거부** — ADR-0034 D1 운영자 잠금 ("`locales` 배열 변경 0") 위반.
  architect 단독으로 헌장 잠금값을 깰 수 없음 (CLAUDE.md §2/§4).

#### 옵션 (b) — nl-BE 슬롯 = ko 콘텐츠 유지 + basic-auth 가 nl-BE 무프리픽스(`/` 및 모든 비prefix 경로) 가드 — **채택**

- **방식**: `routing.ts` / `request.ts` / `layout.tsx` / `messages/*` =
  **무변경**. 현 구조(nl-BE 슬롯 = ko 복제)를 *그대로 유지*. `middleware.ts`
  에 ko 게이트를 추가하되, **게이트가 보호하는 대상 = "locale prefix 가
  없는 모든 경로" (= nl-BE defaultLocale = 현재 ko 콘텐츠를 서빙하는 경로)**.
  즉 `/`, `/compare/...`, `/r/...`, `/data-sources` 등 prefix 없는 URL
  전체가 basic-auth 뒤로. `/nl-NL/...` `/fr-BE/...` `/fr-LU/...` `/en/...`
  (명시적 공개 locale prefix) 는 **게이트 없이 공개**.
- **근거**:
  - §T1 라우팅 골격 **무변경** — ADR-0034 D1 "§T1 보존, 회귀 0" + 본 ADR
    §Status "라우팅 골격 보존(핵심 자산)" 정합. 라우트 파일 이동/추가 0.
  - §T2 원칙 **무위반** — `locales` 배열 변경 0, ko 는 여전히 locale 아님,
    hreflang/sitemap 에 ko 비등장 (sitemap 곱집합은 `routing.locales` 만
    순회 — §T1 / sitemap.ts. ko 누출 표면 신설 0).
  - 4.5.j.2 순서 정합 (§A2.3) — nl-BE 슬롯이 4.5.j.2 에서 실 nl 콘텐츠로
    backfill 되면, **그 시점에 게이트 대상을 nl-BE → 제거** 하는 단일
    스위치 (게이트 해제 = env 미설정 시 fail-open 이 아니라, 4.5.j.2 가
    명시적으로 게이트 매처에서 nl-BE 경로 해제) 로 공개 전환. 라우팅
    재마이그레이션 0.
  - 기존 `/admin` 가드와 **동일 단일점** (`src/middleware.ts`) — 새 인증
    라이브러리 0, 새 SaaS 0, `constantTimeEqual` (edge-safe, 기존 유틸)
    재사용. ADR-0034 D1 "구현 = middleware basic-auth + env 1개" 잠금 정합.
- ⚠️ **잃는 것 (정직하게 — P3)**:
  - 4.5.j.2 (nl/fr/en backfill) **이전**: prefix 없는 모든 경로 = ko
    콘텐츠 = 게이트 뒤 → **공개 진입점이 `/nl-NL` `/fr-BE` `/fr-LU` `/en`
    4 prefix 뿐**. 루트 `/` 가 게이트 뒤이므로 비운영자가 도메인 루트
    접근 시 401/404 (fail-closed). 즉 **4.5.j.1 시점의 공개 사이트는
    nl-NL/fr-BE/fr-LU/en stub fallback 만 노출** — 콘텐츠 미번역(빈 객체
    fallback, §request.ts) 이라 사실상 빈 화면. 이는 **버그가 아니라
    설계된 순서 결과**: 4.5.j.1 = *게이트만*, 실 공개 콘텐츠 = 4.5.j.2
    책임 (§A2.3 경계). organic SEO(ADR-0034 D5)는 4.5.j.2 완료 후 발동
    이므로 색인 손실 0 (D5 는 D1→D3→D4→D5 순차의 *마지막* — ADR-0034
    §대안 E).
  - defaultLocale 무프리픽스 경로가 게이트 뒤이므로, **4.5.j.2 가
    nl-BE 슬롯을 실 nl 로 채울 때 "게이트 대상에서 nl-BE 무프리픽스
    경로 해제" 가 4.5.j.2 DoD 의 명시 항목이어야 함** (§A2.3 에 박음 —
    이 해제를 누락하면 실 nl 콘텐츠가 영구히 게이트 뒤에 갇힘 = 회귀).
- ✅ **채택** — §T1/§T2 무변경 + ADR-0034 D1 잠금값(locales 0, middleware
  basic-auth, env 1개) 100% 정합 + 4.5.j.2 단일 스위치 전환. 3 옵션 중
  유일하게 운영자 잠금값을 깨지 않음.

#### 옵션 (c) — preview/operator 도메인 분리 (별도 배포 타깃 / Vercel preview)

- **방식**: ko = Vercel preview 배포 또는 별도 서브도메인 (예:
  `ko.slim.internal`), 프로덕션 도메인엔 ko 부재.
- ⚠️ ADR-0034 D1 "구현 = middleware basic-auth + env 1개 / 새 SaaS 0 /
  새 인증 라이브러리 0" 잠금 **초과** — 별도 배포 타깃 = 새 인프라 표면
  (Vercel preview protection 설정 / DNS / €300 cap §회귀). 운영자가
  "기존 `/admin` 가드 패턴 동형, env 1개" 로 *명시 좁힘*.
- ⚠️ 운영자 검증 워크플로 마찰 — 운영자가 ko 로 검증하려면 별도
  도메인/preview URL 컨텍스트 전환 (운영자 원문 "편집자 모드처럼" =
  *같은 사이트 안에서* 토글 뉘앙스에 더 가까움 — 단 이는 architect
  해석, 운영자 확정 사항 아님 → §A2.4 운영자 확인 항목).
- ❌ **거부 (architect)** — ADR-0034 D1 구현 잠금값 초과. 단 "운영자가
  검증을 별도 도메인에서 하길 원하는가" 는 architect 가 단정 불가 →
  §A2.4 운영자 확인 대기 항목으로 분리 (잠금값 아님, 옵션 (b) 가 기본).

#### 잠금 결정 (architect)

**옵션 (b) 채택**: ko 게이트 = `src/middleware.ts` 에서 **locale prefix 가
없는 경로(= nl-BE defaultLocale = 현 ko 콘텐츠 서빙 경로) 전체를 basic-auth
가드**. 명시 공개 locale prefix (`/nl-NL` `/fr-BE` `/fr-LU` `/en`) +
`/api/*` (matcher 기 제외) 는 게이트 비대상. `routing.ts` / `request.ts` /
`layout.tsx` / `messages/*` = **무변경**. ADR-0034 D1 잠금값(`locales` 변경
0 / middleware basic-auth / env 1개 / 기존 `/admin` 동형) 100% 정합.

### A2.3 — nl-BE 슬롯 전환 정합 (4.5.j.1 ↔ 4.5.j.2 경계)

- **사실 (P3 정직)**: 현 `messages/nl-BE.json` = ko 복제본 (architect 확인 —
  파일 `_comment` + 본문 한국어). 4.5.j.1 시점에 nl-BE 슬롯이 서빙하는
  것은 **실 nl 이 아니라 ko 텍스트**. 따라서:
- **4.5.j.1 (게이트) 책임 경계**: 4.5.j.1 은 **게이트 추가만**. nl-BE
  슬롯의 ko 내용을 실 nl 로 바꾸지 않음. 옵션 (b) 로 nl-BE 무프리픽스
  경로 = 게이트 뒤 → ko 복제본이 비운영자에게 노출될 표면 자체가 0
  (게이트가 막음) → "ko 복제본이 nl-BE 인 척 공개되는 P3 위반" 이 4.5.j.1
  에서 *구조적으로 차단*. γ "미번역 fallback 허용" 정신 유지 — 공개
  4 prefix 는 stub fallback(빈 객체) 그대로, 게이트 뒤 nl-BE 는 ko 그대로.
- **4.5.j.2 (backfill) 책임 경계 + 필수 스위치**: 4.5.j.2 가
  `messages/nl-BE.json` 을 실 nl 콘텐츠로 교체할 때, **DoD 에 "middleware
  게이트 매처에서 nl-BE 무프리픽스 경로 해제 (= 루트 `/` 등 공개 전환)"
  를 명시 포함**. 이 해제 없이 nl-BE 만 backfill 하면 실 nl 콘텐츠가
  영구히 게이트 뒤 → 회귀 (ADR-0034 §회귀 #2 의 역방향: 게이트 누수가
  아니라 *공개 콘텐츠 미공개*). 본 ADR 이 4.5.j.2 DoD 에 이 스위치를
  박는다 (PLAN 4.5.j.2 본문 amend — architect 본 턴).
- **순서 정합 (ADR-0034 §대안 E D1→D3→D4→D5)**: 4.5.j.1(게이트) →
  4.5.j.2(backfill+스위치) → 4.5.j.3(legal). organic SEO(D5)는 D1~D4
  *이후* 이므로, 4.5.j.1 시점 공개 콘텐츠 부재(빈 fallback)는 SEO 색인
  손실 0 (색인 발동 = D5, 그때는 4.5.j.2 완료 상태).

### A2.4 — 운영자 확인 항목 → ✅ 확정 (2026-05-17, 운영자 Kim Wonmin 직접)

> **확정 (2026-05-17)**: 운영자가 아래 2 항목 모두 architect 기본값으로
> 명시 확정. **① = 옵션 (b) 같은 도메인 basic-auth** (별도 도메인 거부 →
> ADR-0034 D1 Amendment 트리거 **불발화**, 잠금값 envelope 내). **② = 단일
> 토큰 쿠키/쿼리** (`KO_GATE_TOKEN`, 기존 `/admin` 동형). 두 항목 모두
> 잠금값 — §A2.5 DoD 그대로 builder 진행. 미결 0.

다음은 architect 가 *기본값을 옵션 (b) 로 두되* 운영자 확정이 필요했던
항목 (위 블록에서 ✅ 확정 — 이력 보존):

1. **운영자 검증 UX 선호** — ko 검증을 (b) "같은 도메인, 무프리픽스
   경로를 basic-auth 통과 후 열람" 으로 할지, (c) "별도 preview/서브도메인"
   으로 할지. 운영자 원문 "편집자 모드처럼" 의 해석은 architect 가 (b)
   로 추정(명시 추정)했으나, 운영자가 (c) 를 원하면 ADR-0034 D1 구현
   잠금값(env 1개/새 SaaS 0) 재조정 필요 → **운영자 확인 시 ADR-0034 D1
   Amendment 트리거** (본 ADR 아님). 미회신 시 **(b) 진행** (4.5.j.1
   blocker 아님 — 기본값 명확).
2. **basic-auth 자격증명 형식** — env 비밀 1개의 형식 (단일 토큰 =
   기존 `ADMIN_TOKEN` 패턴 동형 `KO_GATE_TOKEN` vs HTTP Basic
   `user:pass`). architect 권고 = **기존 `/admin` 동형 단일 토큰
   쿠키/쿼리** (코드 재사용 최대, `constantTimeEqual` 그대로, 학습
   부담 0 — FOUNDER 학습자 모드). 운영자 명시 거부 없으면 이 권고로
   builder 진행 (잠금값 — §A2.5 DoD 에 반영). 자격증명 *값* 은 운영자가
   `.env` 에 등록 (builder 가 값 생성 X — 기존 `RESEND_API_KEY` 패턴).

### A2.5 — PLAN 4.5.j.1 DoD 구체화 (builder 즉시 구현 가능 수준)

본 ADR §A2.2 잠금 + §A2.4 권고 기준, 4.5.j.1 DoD (PLAN 본문 amend —
architect 본 턴):

- **D1.** `src/middleware.ts` 에 ko 게이트 추가 — 기존 `handleAdmin`
  패턴 동형 `handleKoGate(req)`: env `KO_GATE_TOKEN` (단일 토큰, env
  비밀 1개) 미설정 시 fail-closed (게이트 대상 경로 404/401), 쿠키
  `ko_gate_token` == env → 통과, 쿼리 `?ko_token=` == env → 쿠키 발급
  후 쿼리 제거 redirect (기존 admin 쿼리→쿠키 패턴 동형). `constantTimeEqual`
  재사용 (edge-safe — 신규 crypto 0).
- **D2.** 게이트 대상 = **locale prefix 없는 경로 전체** (`/`,
  `/compare/...`, `/r/...`, `/data-sources`, `/legal/...` 등 — nl-BE
  defaultLocale 슬롯). 비대상 = `/nl-NL/*` `/fr-BE/*` `/fr-LU/*` `/en/*`
  (명시 공개 prefix) + `/api/*` (matcher 기 제외) + `/admin/*` (기존
  admin 가드가 선처리 — 실행 순서: admin → ko 게이트 → intl). 판정
  로직 = `req.nextUrl.pathname` 이 공개 4 prefix 중 하나로 시작하지
  않으면 게이트 대상 (builder: `routing.locales` 중 defaultLocale 제외
  4개로 prefix 집합 도출 — 하드코딩 금지, routing.ts 단일 출처 재사용).
- **D3.** `routing.ts` / `request.ts` / `src/app/[locale]/layout.tsx`
  / `messages/*` = **무변경** (회귀 0 — §T1/§T2 보존 검증).
- **D4.** env 1개 (`KO_GATE_TOKEN`) — `.env.example` +
  `.env.local.example` placeholder 추가 + 운영자 등록 메모 (builder 가
  값 생성 X — 운영자 `.env` 등록, 기존 `ADMIN_TOKEN`/`RESEND_API_KEY`
  패턴 동형).
- **D5.** **게이트 누수 0 검증** (ADR-0034 §회귀 #2): 단위/통합 테스트 —
  (i) env 미설정 → 게이트 대상 경로 fail-closed (ii) 무토큰 `/`,
  `/compare` → 차단 (iii) 유효 토큰 쿠키 → 통과 (iv) 공개 prefix
  (`/en` 등) → 게이트 없이 통과 (v) `/api/*` 게이트 비대상 (vi) 잘못된
  토큰 → 차단 (constant-time). 기존 admin 가드 테스트 패턴 재사용.
- **D6.** typecheck 0 / lint 0 / test 0 (회귀 0 — 기존 e2e locale
  prefix 단언 무영향: 공개 prefix 경로는 게이트 비대상) / `pnpm
  harness:plan` 정합 (88/58 불변 — 본 amend 는 본문만, 항목 수 0) /
  `pnpm harness:data` 통과.
- **비-DoD (명시 경계)**: nl-BE 슬롯 ko→실nl 교체 ❌ (4.5.j.2) /
  hreflang·sitemap 활성 ❌ (4.5.j.2 / PLAN 4.6 / 3.5.3) / DeepL 번역
  ❌ (4.5.j.2) / legal.* 검수 ❌ (4.5.j.3).

### A2.6 — §SCOPE 표 + §Verification #6 재정의

- §SCOPE 표 "4.9 런치 게이트" 행 = **무효** (ADR-0034 D1: 완성 동시로
  당김). 대체 = PLAN 4.5.j.1(게이트) / 4.5.j.2(backfill+nl-BE 스위치) /
  4.5.j.3(legal) 3 sub-task. ko 제거(§T2 "런치 시 messages/ko.json
  제거")는 ADR-0034 "KO 운명 미결(런칭 후 삭제 vs hidden 유지) — 운영자
  명시 보류" 로 *보류* (4.5.j.* 범위 밖, ADR-0034 단일 미결).
- §Verification #6 ("4.9 런치 게이트") = 위 3 sub-task DoD 로 분해
  (§A2.5 + PLAN 4.5.j.2/.3 본문). #1~#5 (typecheck/e2e/harness/ko 키
  누락/DeepL 측정) = 유지.
