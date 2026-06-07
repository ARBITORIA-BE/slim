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
- **Amendment 3 (2026-05-17, P0 인시던트 후 architect)** — §A2.5 D1
  "env 미설정 fail-closed" → **pass-through** 정식 재조정 (핫픽스
  `10dee59` 설계 정본 승인 — §A2.5-Amd3). §A2.7 G1=G1-a / Q2 운영자
  ✅ 확정 (2026-05-17) + §A2.7-R1 cross-ref. 코드 변경 0 (핫픽스 기
  반영, 본 amend 는 설계 정합·정당화). 새 ADR 신설 0 (P5).
- **Amendment 4 (2026-05-18, 스코프 갭 정직 기록 후 architect)** —
  §T5 "키화" under-spec 정정: 키화 = S1(추출/배선·완료) + **S2(컴포넌트
  `t()` 소비 마이그레이션·미완)** 2단계로 명시 분해. 4.5.j.2 `[x]→[ ]`
  정정 ADR 차원 기록 + 검증 blind-spot(소비 미검증) 근본원인 + 재발
  방지 게이트 `harness:i18n` 잠금 + PLAN 신규 sub-task 4.5.j.4(.A/.B)
  정의 — §A2.8. 코드/`messages/`/`src/**` 변경 0 (설계 정정, 구현=builder).
  새 ADR 신설 0 (P5). ADR-0034 §미결 침범 0.

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
   **§Verification #5 실측 (2026-05-18, PLAN 4.5.j.2 Phase B):**
   - ko.json 값 총 문자 수: **2,886자** (legal.* 제외 리프 181개)
   - DeepL 호출 분량 추정: 2,886 × 3 base = **8,658자**
   - DeepL 실제 사용량: **7,439자** / 1,000,000 (Free 한도 대비 0.7%)
   - 한도 여유: 992,561자 — 분할 전략 불필요
   - 실행 커맨드: `pnpm tsx --env-file=.env.local scripts/i18n/translate.mjs`
   - nl/fr/en.json placeholder 0건 — DoD 충족 확인
   **§Verification #5 증분 실측 (2026-05-18, PLAN 4.5.j.4.A.1 — placeholder 보정):**
   - ko.json 값 총 문자 수: **3,776자** (Phase B 후 41키 추가: currentProvider.* + result.table.subtitle*/promo/activation + result.notFound.* + result.controls.* + result.excludedProviders.* + result.betaBanner.* + result.affiliateDisclosure.noCommission/noCommissionDetail/commissionUnknown/commissionKnown/policyLink)
   - 증분 번역 대상: 41 keys × 3 locale = **123 텍스트 항목** (--incremental 모드)
   - DeepL 누적 실제 사용량: **8,986자** / 1,000,000 (Free 한도 대비 0.9%) — 이번 증분 +1,547자
   - 증분 실행 커맨드: `pnpm tsx --env-file=.env.local scripts/i18n/translate.mjs --incremental`
   - nl/fr/en.json placeholder 0건 — DoD 충족 확인 (기존 비-placeholder 값 무변경)

  **§Verification #5 재보정 실측 (2026-05-18, PLAN 4.5.j.4.A.1 verifier FAIL 수정):**
   - 수정 근본: DeepL XML tag_handling 이 `<x id="N"/>` 양옆 공백 흡수 버그 → encodeVars/decodeVars 공백 보정 로직 추가 (spaceBefore/spaceAfter 기록 → 복원)
   - 재보정 대상: 36 keys × 3 locale = **108 텍스트 항목** (--retarget 모드, RETARGET_PATHS 목록 기준)
   - DeepL 누적 실제 사용량: **12,612자** / 1,000,000 (Free 한도 대비 1.3%) — 이번 재보정 +3,626자
   - 재보정 실행 커맨드: `pnpm tsx --env-file=.env.local scripts/i18n/translate.mjs --retarget`
   - 수동 보정 키 (DeepL 재번역 후에도 부자연): nl `savingYearly`→`Per jaar {amount}`, nl `activationFee` 콤마 공백, nl `positiveSaving` 마침표 공백, fr `savingYearly`→`Par an {amount}`, fr `commissionUnknown` `d'` 패턴, en `savingYearly`→`{amount} / yr`, en `subtitleVoiceMinutes` 뒤 공백
   - `savingYearly "Yeon"` 분류: result.table.savingYearly = **.A.1 41키 집합** (retarget 재번역에서도 "Yeon" 재출력 → 수동 보정 1회 적용, 의미 복원 확인)
   - nl/fr/en.json placeholder 0건 / 기존 비-.A.1 값 무변경 — DoD 충족

  **§Verification #5 legal.* retarget 실측 (2026-06-05, PLAN 4.5.j.3.a — ADR-0040 D1):**
   - 번역 대상: legal.* 103키 × 3 locale (nl/fr/en) = **309 텍스트 항목**
   - 방식: `scripts/i18n/translate-legal.mjs` (별도 스크립트 — translate.mjs legal.* 제외 경계 유지)
   - 실행 커맨드: `pnpm tsx --env-file=.env.local scripts/i18n/translate-legal.mjs`
   - 처리 내용: [nl]/[fr]/[en] prefix 잔존 키 + affiliateDisclosure.pageTitle 한국어 고정 회귀 retarget
   - DeepL 누적 실제 사용량: **22,539자** / 1,000,000 (Free 한도 대비 2.3%) — 이번 legal 라운드 +9,927자
   - ICU 변수 안전: legal.* 본문 {var} 0건 실증 (ADR-0040 D5) — var-protection.ts 적용 불요
   - nl/fr/en.json legal.* prefix 0건 / affiliateDisclosure.pageTitle 4 locale 번역 완료 / ko 정본 ↔ 3 locale 키 셋 103개 정합 — DoD 충족

  **§Verification #5 다중 네임스페이스 retarget 실측 (2026-06-05, PLAN 4.5.j.4.B.4):**
   - 번역 대상: affiliateInterstitial(26) + legal.affiliateDisclosure 본문 확장(32) + dataSources(50) + unsubscribe(6) + metadata.{dataSources,affiliateDisclosure,admin}(5) = **119키** × 3 locale (nl/fr/en) = **342 텍스트 항목** (114키 × 3 — 기존 번역 제외 incremental)
   - 방식: `scripts/i18n/translate-legal.mjs` 옵션 (a) 확장 — TARGET_NAMESPACES 화이트리스트 다중 지원 + var-protection 인라인 (ICU {var} 4건 실증 대응)
   - 실행 커맨드: `pnpm tsx --env-file=.env.local scripts/i18n/translate-legal.mjs`
   - 처리 내용: [nl]/[fr]/[en] prefix 잔존 키 incremental retarget / ICU 변수 encodeVars/decodeVars 공백 보정 적용
   - ICU 변수 포함 키 4건: `affiliateInterstitial.heading({providerName})`, `affiliateInterstitial.dataFlowRedirect({providerName})`, `dataSources.providerLinkAriaLabel({name})`, `dataSources.comparisonCountRecent({count})` — var-protection 적용, 변수 유실 0건 확인
   - DeepL 누적 실제 사용량: **31,377자** / 1,000,000 (Free 한도 대비 3.1%) — 이번 라운드 +8,838자 (인코딩 후 7,482 encoded chars 송신)
   - nl/fr/en.json 대상 네임스페이스 prefix 0건 / 경계 잠금 (legal.terms/privacy/cookie) 침범 0건 / nl-BE/nl-NL/fr-BE delta 0 — DoD 충족
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
  비밀 1개) 미설정 시 ~~fail-closed (게이트 대상 경로 404/401)~~ **→
  Amendment 3 (2026-05-17) 으로 pass-through 재조정 — 아래 §A2.5-Amd3
  참조**, 쿠키 `ko_gate_token` == env → 통과, 쿼리 `?ko_token=` == env
  → 쿠키 발급 후 쿼리 제거 redirect (기존 admin 쿼리→쿠키 패턴 동형).
  `constantTimeEqual` 재사용 (edge-safe — 신규 crypto 0).
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
  (i) env 미설정 → ~~게이트 대상 경로 fail-closed~~ **pass-through
  (게이트 비활성, 200 — Amendment 3 §A2.5-Amd3 재조정, 핫픽스
  `10dee59` 정본; `src/middleware.ko-gate.test.ts` 케이스 (i) 동기화
  완료)** (ii) 무토큰 `/`,
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

#### A2.5-Amd3 — D1 "env 미설정 fail-closed" 정식 재조정 (Amendment 3, 2026-05-17, P0 인시던트 후 architect)

> **상태**: 채택 (2026-05-17). 본 절은 P0 인시던트 핫픽스(`10dee59`)를
> ADR §A2.5 D1 과 정합화하는 *정식 재조정* 이다. 새 ADR 신설 0 (P5 —
> 기존 §A2 amend). 코드 변경 0 (핫픽스가 이미 코드에 반영됨 — 본 절은
> 그 코드를 설계 정본으로 *승인·정당화*).

**무엇이 일어났는가 (P3 — 숨기지 않음)**: 4.5.j.1(`f232cce`) 가
4.5.j.2 와 분리 단독 배포 + Vercel production `KO_GATE_TOKEN` 미등록
→ `handleKoGate` 의 D1 "env 미설정 fail-closed" 가 발동 → 게이트 대상
= 무프리픽스 경로 전체 = **공개 사이트 표면 전부**(`/`,`/compare`,
`/r`,`/data-sources`,`/legal`) 401 → slim.lu 다운 (curl/MCP 확인:
`/`→401, `/en`→200). 핫픽스(`10dee59`) = `handleKoGate`: env 미설정
시 `koGateDeny()`(401) → `return null`(pass-through, 게이트 비활성).

**fail-closed 가 위험했던 *유일한* 이유 (정직한 논리 전개)**:
fail-closed 자체가 나쁜 게 아니다. 위험의 근원은 **D1→D2 전이 갭**
에 게이트 대상(무프리픽스 슬롯)이 *실 공개 콘텐츠가 아니라 ko 복제
(`nl-BE.json`=ko)* 였다는 점, 그리고 4.5.j.1 이 4.5.j.2 와 분리
단독 배포돼 그 갭이 *프로덕션에 노출* 됐다는 점이다. 즉 "env 미설정
→ 전체 차단" 이 곧 "공개 사이트 전체 차단" 으로 직결되는 구조는
**4.5.j.1 단독 배포 시점에 한정된 과도기 위험** 이었다.

**4.5.j.2 완료 시 pass-through 가 *설계상 올바른 정상 상태* 인 이유**:
PLAN 4.5.j.2 "필수 스위치" 가 이미 **원자성** 을 요구한다 — (a) ko
게이트의 nl-BE 무프리픽스 경로 *해제* + (b) `nl-BE.json` ko→실 nl
*교체* + (c) G1-a ko 오버레이 쿠키 도입 = **동일 항목에서 동시**
적용. 이 셋이 원자적으로 적용되면 그 시점부터:

- 무프리픽스 경로 = **실 공개 nl 콘텐츠** (ko 아님). 따라서 게이트
  비활성(pass-through) = "실 nl 을 공개" = **정상·안전** (ADR-0034
  D1 "EN/FR/NL 공개" 정합).
- ko 는 더 이상 무프리픽스 슬롯 콘텐츠가 아니라 **G1-a 오버레이
  쿠키 뒤** (`constantTimeEqual(cookie, KO_GATE_TOKEN)` 일치 시에만
  메시지 스왑). 쿠키·토큰 없는 요청(검색 봇 포함) = 실 nl. → env
  미설정 = pass-through 라도 **ko 노출 위험 0** (ko 는 환경변수
  fail-closed 가 아니라 *오버레이 비밀 일치* 로 보호 — §A2.7 G1-a).

즉 핫픽스의 pass-through 는 일탈이 아니라 **4.5.j.2 완료 시 설계가
수렴하는 올바른 종착 상태** 다. 핫픽스는 D1→D2 전이의 *과도기
정합* — 4.5.j.2 가 셋을 원자 적용하는 순간 pass-through 의미가
"공개 사이트 차단" 에서 "실 nl 공개 + ko 는 오버레이 뒤" 로 자동
전환된다 (코드 추가 변경 0 — 의미만 전환).

**재조정 결정 (Amendment 3)**:
- D1 "env 미설정 → fail-closed" → **"env 미설정 → pass-through
  (게이트 비활성, intl 위임 = 공개 서빙)"** 로 정정. `handleKoGate`
  본문 = 코드 정본 (핫픽스 `10dee59` 그대로 승인).
- ko 보호의 책임 이동: ~~"env fail-closed 가 ko 를 막는다"~~ →
  **"§A2.7 G1-a 오버레이가 ko 를 막는다 (오버레이 비밀 일치 없으면
  ko 스왑 0)"**. env 는 *게이트 활성 스위치* 일 뿐 ko 보호 1차
  방어선 아님. 보호 1차선 = (4.5.j.2 전) 무프리픽스 게이트 그
  자체가 토큰 등록 시 활성 / (4.5.j.2 후) G1-a 오버레이.

**과도기 리스크 (P3 — 정직 표기, 운영자 수용 부채)**:
- 4.5.j.2 **완료 전** 까지 무프리픽스 경로 = ko 복제 콘텐츠가
  pass-through 로 *공개* 됨 (env 미등록 상태 = 현 프로덕션).
  이는 ADR-0034 D1 "ko = 운영자 전용 hidden" *의도* 와 **과도기
  불일치** — 핫픽스가 "사이트 다운" 과 "ko 과도기 노출" 중 후자를
  택한 운영자 결정의 결과 (둘 다 부채, 다운이 더 큰 손해 → 운영자
  의식적 수용, ADR-0034 §"잃는 것" 패턴과 동류).
- **ADR-0034 §회귀 #2 와의 관계**: §회귀 #2 = "KO 게이트 누수
  (비운영자 ko 콘텐츠 접근 1건) → 게이트 구현 즉시 재설계". 현
  과도기 노출은 *문자적으로* 이 트리거에 해당하나, (i) 노출
  콘텐츠 = ko 복제(개발 중 텍스트, 신뢰 손상 표면은 ADR-0034
  §"⚠️ KO 게이트 보안 표면" 이 이미 인지) (ii) 운영자가 "다운 회피"
  로 의식 수용 (iii) 4.5.j.2 원자 스위치가 *재설계 그 자체* (게이트
  누수의 항구적 해소 = G1-a 오버레이) — 즉 §회귀 #2 의 "즉시
  재설계" 요구는 **4.5.j.2 가 그 재설계** 라는 형태로 충족된다.
  4.5.j.2 는 비-blocker 아닌 **과도기 부채 청산 경로** 로 격상
  (운영자 인지 — 별도 ADR-0034 Amendment 불요: 본 §A2.5-Amd3 +
  §A2.7 R1 cross-ref 로 정합 기록).

**§A2.7 G1 cross-ref**: 본 재조정의 "ko 보호 = G1-a 오버레이" 는
§A2.7 G1-a "게이트 토큰 재사용 + ko URL/hreflang/sitemap 누출 0 +
무쿠키 정적 렌더 회귀 0" 와 동일 비밀·동일 비교(`constantTimeEqual`)
이므로 누수 표면 증가 0 (§A2.7 G1-a "게이트 누수 평가" 와 정합).
4.5.j.2 DoD (3) "잘못된 토큰→nl, constant-time" 가 본 재조정의
검증 항목.

### A2.6 — §SCOPE 표 + §Verification #6 재정의

- §SCOPE 표 "4.9 런치 게이트" 행 = **무효** (ADR-0034 D1: 완성 동시로
  당김). 대체 = PLAN 4.5.j.1(게이트) / 4.5.j.2(backfill+nl-BE 스위치) /
  4.5.j.3(legal) 3 sub-task. ko 제거(§T2 "런치 시 messages/ko.json
  제거")는 ADR-0034 "KO 운명 미결(런칭 후 삭제 vs hidden 유지) — 운영자
  명시 보류" 로 *보류* (4.5.j.* 범위 밖, ADR-0034 단일 미결).
- §Verification #6 ("4.9 런치 게이트") = 위 3 sub-task DoD 로 분해
  (§A2.5 + PLAN 4.5.j.2/.3 본문). #1~#5 (typecheck/e2e/harness/ko 키
  누락/DeepL 측정) = 유지.

### A2.7 — PLAN 4.5.j.2 (nl/fr/en backfill) 설계 잠금 — G1/G2/G3 (architect 2026-05-17)

> 본 절은 PLAN 4.5.j.2 진입 전 설계 잠금이다. §A2.3 이 4.5.j.2 책임
> 경계 + "nl-BE 무프리픽스 게이트 해제 필수 스위치" 를 박았으나, 그
> 스위치를 실행하면 **운영자가 ko 를 볼 유일 경로(nl-BE 무프리픽스
> 슬롯)가 소실**되는 설계 공백(G1)이 드러난다. §A2.7 이 이를 포함한
> G1/G2/G3 를 잠근다. **ADR-0034 §미결("KO 운명: 런칭 후 삭제 vs
> hidden 유지 — 운영자 명시 보류") 침범 0**: §A2.7 은 "개발 중 ko
> 검증 *접근 메커니즘*" 만 잠그며, "런칭 후 ko 삭제/유지" 는 건드리지
> 않는다 (그 미결은 4.5.j.* 범위 밖 — ADR-0034 D1 단일 미결 보존).

#### 현 상태 사실 (architect 레포 직접 확인 2026-05-17)

- `messages/ko.json` = 한국어 본문 (별도 파일, 259줄, `_comment` 없음).
- `messages/nl-BE.json` = `ko.json` **키·값 동일 복제 + L2 `_comment`**
  (베타 동안 nl-BE 슬롯 = ko 내용 — §A2.2). 즉 ko 정본 = `ko.json`,
  nl-BE = 그 복제.
- `messages/{nl-NL,fr-BE,fr-LU,en}.json` = `_comment` 1줄 stub (본문 0).
- `src/i18n/request.ts` 현 구현 = **단일 파일 dynamic import + 빈 객체
  fallback**. `getMessageFallback` 미구현, `nl`/`fr` **base 파일 부재**,
  next-intl 메시지 병합(base+delta) **미배선**. 즉 §T3 의 "nl base +
  region delta fallback 체인" 은 *현재 코드에 존재하지 않음* — 4.5.j.2
  가 이 fallback 을 새로 배선해야 함 (G3 가 그 레이아웃을 잠금).
- ko 게이트(`src/middleware.ts` `handleKoGate`/`isKoGateTarget`) =
  locale prefix 없는 경로 전체 가드. ko 노출 유일 경로 = 이 게이트 뒤
  무프리픽스 슬롯 (= nl-BE defaultLocale).

#### G1 — nl-BE 게이트 해제 후 운영자 ko 검증 접근 메커니즘 [잠금]

**문제**: §A2.3 필수 스위치(nl-BE 무프리픽스 게이트 해제)를 실행하면
루트 `/` 등 무프리픽스 슬롯이 실 nl 콘텐츠로 *공개* 된다. 그런데 ko 는
`routing.locales` 비포함(§T2)이고, ko 를 서빙하던 유일 경로가 바로 그
무프리픽스 슬롯이었다. → **해제 즉시 운영자가 ko 를 볼 방법 0**. 이는
ADR-0034 §"얻는 것" 의 "KO 검증 워크플로 보존 (운영자가 한국어로
검증하며 개발 지속 — 운영자 원문 핵심 요구) — D1 게이트가 구조적으로
보장" 을 정면 위반.

**옵션 비교** (잠금값 envelope = ADR-0034 D1: `locales` 변경 0 /
middleware basic-auth / env 1개 / 새 SaaS 0 / 새 인증 라이브러리 0):

- **옵션 (G1-a) — ko 오버레이 쿠키/쿼리: `request.ts` 가 게이트 쿠키
  보유 시 *어느 locale 위에서나* 메시지를 ko 로 스왑** — **채택**.
  - 방식: 4.5.j.1 이 이미 발급하는 `ko_gate_token` 쿠키(KO_GATE_TOKEN
    == env)를 `request.ts` 에서 재사용. 쿠키 유효 시 `locale` 값과
    무관하게 `messages/ko.json` 을 로드(메시지만 ko 스왑, URL/locale
    세그먼트/hreflang 은 그대로 nl-BE 등). 쿼리 `?ko_view=<token>` →
    쿠키 발급(handleKoGate 가 이미 `?ko_token=` 처리 — **쿼리 파라미터
    추가 없이 기존 `?ko_token=` 재사용 가능**, builder 가 단일 진입점
    유지). next-intl `getRequestConfig` 는 요청 쿠키 접근 가능
    (`next/headers` `cookies()`), 새 env 0 / 새 라이브러리 0.
  - ✅ 얻는 것: (i) 게이트 해제 후에도 운영자가 *공개 사이트 위에서*
    쿠키 한 번으로 ko 검증 — "편집자 모드처럼" (운영자 원문) 정합.
    (ii) `locales` 변경 0, ko URL/hreflang/sitemap 누출 0 (ko 는
    URL 세그먼트가 아니라 *메시지 소스 스왑* — §T2 "ko=콘텐츠, locale
    아님" 원칙 강화). (iii) 새 env/SaaS 0 (게이트 토큰 재사용).
    (iv) 솔로 구현 부담 = `request.ts` 분기 1곳 + 테스트 (게이트
    인프라 4.5.j.1 완성품 재사용).
  - ⚠️ 잃는 것 (P3 정직): (i) `request.ts` 가 쿠키 의존 → next-intl
    static rendering(`setRequestLocale`/`generateStaticParams`) 와의
    상호작용 검토 필요. ko 스왑은 *쿠키 보유 요청만* 동적 — 일반 공개
    요청은 정적 경로 불변(쿠키 없음 → 스왑 없음). builder DoD 에
    "쿠키 분기가 공개(무쿠키) 정적 렌더 회귀 0" 검증 박음. (ii) ko
    오버레이는 *메시지만* — URL/lang 속성은 nl-BE. 운영자가 "ko URL"
    을 기대하면 불일치이나, 운영자 요구 = "ko 텍스트로 검증" 이지
    "ko URL" 아님 (ADR-0034 §미결이 ko 를 locale 로 안 만드는 것 확정).
  - 게이트 누수 평가 (ADR-0034 §회귀 #2): ko 스왑 트리거 =
    `constantTimeEqual(cookie, KO_GATE_TOKEN)` — 4.5.j.1 게이트와
    *동일 비밀·동일 비교*. 쿠키 없거나 토큰 불일치 → 스왑 0 (공개
    locale 그대로). 누수 표면 = 4.5.j.1 게이트와 동일 등급(증가 0).
  - SEO 색인 누출 평가: 검색 봇은 게이트 쿠키 미보유 → 항상 공개
    locale 메시지. ko 는 sitemap/hreflang/`generateStaticParams`
    (routing.locales 순회) 어디에도 안 나타남 — 색인 누출 0.

- **옵션 (G1-b) — ko 전용 게이트 prefix 신설** (`/ko/*` 또는 내부
  경로). ❌ **거부** — §A2.2 옵션 (a) 거부 사유 그대로 재발: ko 를
  경로 세그먼트로 만들면 `generateStaticParams`/sitemap 곱집합/
  hreflang 누출 표면 신설. 4.5.j.1 에서 이미 거부된 형태(§A2.2 (a)).
  §T2 "ko=locale 아님" 잠금 위반 위험. ADR-0034 D1 `locales` 변경 0
  envelope 도 압박.

- **옵션 (G1-c) — operator preview 빌드 / env 분기** (별도 배포 타깃
  또는 `KO_PREVIEW=1` 빌드). ❌ **거부** — §A2.2 옵션 (c) 거부 사유
  재발: 별도 배포 타깃 = 새 인프라 표면(Vercel preview/DNS, €300 cap).
  ADR-0034 D1 "middleware basic-auth + env 1개" envelope 초과. 운영자가
  §A2.4 에서 "같은 도메인 게이트(옵션 b)" 명시 확정 → preview 분리는
  운영자 확정 방향과도 불일치.

**잠금 결정 (architect)**: **옵션 (G1-a) 채택** — `src/i18n/request.ts`
에서 요청 쿠키 `ko_gate_token` 이 `KO_GATE_TOKEN` env 와
`constantTimeEqual` 일치 시, 해석된 `locale` 과 무관하게
`messages/ko.json` 을 메시지 소스로 로드(ko 오버레이). 쿠키 없거나
불일치 → 기존 locale 메시지 그대로(공개 경로 회귀 0). 게이트 토큰
재사용(새 env 0) + ko URL/hreflang/sitemap 누출 0 + ADR-0034 D1
envelope 100% 정합. **이는 ADR-0034 §미결("KO 운명") 과 무관** —
런칭 후 ko 삭제/유지 결정이 아니라 *개발 중 ko 검증 접근 메커니즘*.

> **운영자 확정 (2026-05-17)**: G1 = **G1-a** 명시 잠금. 같은
> 도메인 쿠키 오버레이, `ko_gate_token`==`KO_GATE_TOKEN` 시 locale
> 무관 `ko.json` 로드, URL/hreflang/sitemap = nl-BE 유지, **새 env
> 0** (게이트 토큰 재사용). §A2.4 ① "같은 도메인 게이트(b)" 확정의
> 읽기측 재사용 — envelope·운영자 의도 100% 정합. 미결 0.

#### A2.7-R1 — §A2.5-Amd3 (D1 pass-through 재조정) cross-ref [정합]

§A2.5-Amd3 가 D1 "env 미설정 fail-closed" → pass-through 로 정식
재조정했다. 그 재조정의 **ko 보호 책임 이동 종착점이 본 G1-a**:

- §A2.5-Amd3 결론 = "env 는 게이트 활성 스위치일 뿐 ko 보호 1차
  방어선 아님. 4.5.j.2 완료 후 ko 보호 1차선 = **G1-a 오버레이**".
- 그 정당성의 핵심 = "4.5.j.2 가 (a)게이트 해제 + (b)nl-BE ko→실nl
  + (c)G1-a 오버레이 도입을 **원자 동시** 적용 → 그 순간부터
  무프리픽스 = 실 nl 공개(pass-through 정상) + ko = G1-a 쿠키 뒤".
- 본 G1-a "게이트 누수 평가" (ko 스왑 트리거 =
  `constantTimeEqual(cookie, KO_GATE_TOKEN)`, 쿠키/토큰 없으면 스왑
  0, 누수 표면 = 4.5.j.1 게이트와 동일 등급·증가 0) 가 §A2.5-Amd3
  의 "pass-through 라도 ko 노출 위험 0" 주장의 **기술 근거**.
- 4.5.j.2 DoD (3) "유효 쿠키→ko / 무쿠키→nl / 잘못된 토큰→nl
  (constant-time)" = §A2.5-Amd3 재조정의 회귀 검증 항목 (단일
  출처 — DoD 중복 신설 0).

→ §A2.5-Amd3 ↔ §A2.7 G1-a 는 동일 메커니즘의 양면 (전자=middleware
env 의미 전환, 후자=request.ts 메시지 스왑). 내부 모순 0.

#### G2 — DeepL 실행 모델 [잠금]

- **(i) 번역 실행 주체** = **운영자 발급 DeepL API Free 키 + 일회성
  스크립트** (잠금). 패턴 = 기존 `RESEND_API_KEY`/`KO_GATE_TOKEN` 동형
  — **builder 가 키 값 생성 X**, 운영자가 DeepL 계정에서 발급 후 `.env`
  (`DEEPL_API_KEY`) 등록. builder 는 `.env.example`+`.env.local.example`
  placeholder + 운영자 등록 메모만. 번역 스크립트(`scripts/i18n/` 하위
  일회성, src/** 아님 — 런타임 코드 0)는 ko 정본을 읽어 DeepL 호출 →
  대상 JSON 생성. 키-바이-키 수동/운영자 수동 번역은 ❌ (259줄 × 4
  언어 = 솔로 시간 sink, §T3 "DeepL 1차" 정신 위반).
- **(ii) 번역 소스** = **`messages/ko.json` (한국어 정본)** → DeepL
  ko→{nl,fr,en}. nl-BE.json(ko 복제)이 아니라 ko.json 을 정본으로
  지정 (`_comment` 노이즈 없는 순수 정본). DeepL ko 소스 언어 지원
  확인 = builder 가 §References [DeepL Languages] 재확인 (ko 미지원
  시 fallback = 운영자 보류 항목, 아래 §A2.x 운영자 확인 #3).
- **(iii) 수동 검수 주체 리스크 — P3 정직 표면화**: §T3 가 "오역 =
  사용자 손해, 검수 우선순위 최상" 을 요구하나, 운영자 = **한국어
  모국어, nl/fr 숙련도 미지, en 가능 추정** (founder_profile —
  베네룩스 거주이나 언어 숙련도 미확인). 한국 모국어 솔로 창업자가
  nl/fr/en 3언어 전수 검수는 **현실적으로 불가능에 가깝다** (숨기지
  않음). 완화 전략 (잠금):
  - **우선순위 검수**: `caveats.*` (가격 관련 — 오역 시 사용자 직접
    손해, §T3 "검수 우선순위 최상") + 가격/숫자 표시 네임스페이스를
    **검수 1순위**. 나머지 UI 텍스트는 DeepL raw 허용하되 4.5.j.2
    DoD 에 "caveats.* 는 운영자 검수 체크 1회 통과" 박음.
  - `legal.*` 검수는 **4.5.j.3 별도 트랙(§T4, legal 에이전트)** — G2
    범위 **밖** (명시 경계). 4.5.j.2 는 `legal.*` 번역 산출 X.
  - en 검수 = 운영자 가능 추정(영어). nl/fr 비-caveats 텍스트는
    DeepL raw + organic 사용자 피드백 사후 보정(ADR-0034 §"잃는 것"
    의 "제품 결함 사용자 먼저 발견" 리스크 일부 — 이미 ADR-0034 가
    수용한 부채, §A2.7 이 새로 만드는 부채 아님).

> **운영자 확정 (2026-05-17) — Q2 잠금**: 운영자가 아래를 *의식적*
> 으로 명시 수용 (ADR-0034 의 "운영자 의식적 부채 수용" 패턴 동류):
> 1. **`caveats.*` 1순위 수동 검수** — 가격/절약 관련 (오역 = 사용자
>    직접 손해, §T3 "검수 우선순위 최상"). 운영자 검수 체크 1회 통과
>    = 4.5.j.2 DoD 항목 (1순위 = 그 외 네임스페이스보다 우선).
> 2. **나머지 네임스페이스 = DeepL raw 기계번역 *공개* + 사후 점진
>    보정** — caveats 외 일반 UI 텍스트는 DeepL 산출물을 검수 없이
>    공개하고 organic 사용자 피드백으로 점진 교정. **P1(정보 우선)/
>    P3(투명성) 부채를 운영자가 의식 수용** — 솔로·한국 모국어
>    창업자의 nl/fr 전수 검수 불가 현실(§A2.7 G2-iii) 을 숨기지
>    않고 *raw 공개* 로 정직 처리 (오역 은닉보다 raw 노출 + 빠른
>    보정이 P3 정합 — "투명성은 운영자의 짐" 원칙: 결함을 가리지
>    않음). 이 부채는 ADR-0034 §"잃는 것"("제품 결함 사용자 먼저
>    발견")이 이미 수용 — §A2.7 이 *새로 만드는* 부채 아님.
> 3. **`legal.*` = 4.5.j.3 별도 (§T4)** — Q2 범위 밖 (GDPR/약관
>    오역 = 규제 리스크 → legal 에이전트 검수 게이트, 4.5.j.2 산출
>    X). 본 §A2.7 G2 와 경계 명확.
>
> **blocker 판정**: Q2 자체 = 비-blocker (운영자 확정 완료). 단
> DeepL 키(`DEEPL_API_KEY`) = **소프트 blocker** (배선 선행 가능,
> 번역 *산출* 만 키 대기 — §A2.7 운영자 확인 #2 와 동일).

#### G3 — nl/fr base + region delta 파일 구조 [잠금]

§T3 결정("nl-BE↔nl-NL 은 nl base 공유, fr-BE↔fr-LU 는 fr base 공유,
override only delta, en 독립")의 구체 파일 레이아웃:

- **base 파일 신설**: `messages/nl.json` (nl base — 전체 키 번역 1회)
  + `messages/fr.json` (fr base). `en.json` = 독립 전체 키.
- **region delta 파일** = `messages/{nl-BE,nl-NL,fr-BE,fr-LU}.json` =
  **override only** (통화/우편번호/지역 표현 등 base 와 다른 키만).
  베타(γ) 시점 delta 가 비어도 무방 (base fallback). **현
  `nl-BE.json`(ko 복제) → backfill 시 nl 실콘텐츠 *delta* 로 축소**
  (전체 키가 아니라 nl base 와 다른 키만; 차이 없으면 빈 `{}`+`_comment`).
- **fallback 체인** (§T3): `{region}` 미스 → `{base}`(nl|fr) 미스 →
  `en`. en 미스 → next-intl 기본(키 그대로 노출 — γ 미번역 허용).
  구현 = `src/i18n/request.ts` 에서 region 파일 + base 파일 + en 을
  **얕은 병합**(region 우선) 후 반환. `getMessageFallback` 단독으로는
  파일 병합 불가 → request.ts 가 병합 책임 (G3 핵심 — 현 단일 import
  구조에서 *병합 구조로 전환* 이 4.5.j.2 코어 작업).
- **DeepL 분량 절약 근거**: base 1회 번역(nl 1 + fr 1 + en 1 = 3회)
  + region delta(대부분 빈/소수 키). naive 전량 = 5 locale × 전체 키.
  base+delta = 3 × 전체 키 + ε(delta). **절약 ≈ (5−3)/5 = 40% 추정**
  (정확 수치 = §Verification #5 키화 후 실측 — builder 가 측정).
- **§Verification #5 분량 측정 — builder DoD 명시**: ko 정본 총 문자
  수 + DeepL 호출 분량(nl/fr/en base 합)을 측정. 측정 명령/기록 위치
  = PLAN 4.5.j.2 DoD 에 박음 (아래). 추정 아님 — 실측 후 본 ADR
  §Verification #5 에 기록 (builder→scribe).

#### G1/G2/G3 운영자 확인 항목 → ✅ 확정 (2026-05-17, 운영자 Kim Wonmin 직접)

> **확정 (2026-05-17)**: 운영자가 G1 / Q2(G2 검수 모델) 를
> architect 기본값으로 명시 잠금. **G1 = G1-a** (같은 도메인 쿠키
> 오버레이, 새 env 0). **Q2 = caveats.* 1순위 수동 검수 + 나머지
> DeepL raw 공개 + 사후 보정 (P1/P3 부채 의식 수용) / legal.* =
> 4.5.j.3 분리**. 잠금값 — 4.5.j.2 DoD 그대로 builder 진행. 미결 0
> (잔여 = `DEEPL_API_KEY` 운영자 발급 = 소프트 blocker, 번역 산출
> 한정 — 배선 비블로킹). **ADR-0034 §미결("KO 운명") 침범 0** —
> 아래는 *개발 중 메커니즘* 확정일 뿐, 런칭 후 ko 삭제/유지 무관.

다음은 architect 가 *기본값을 두되* 운영자 확정이 필요했던 항목
(위 블록에서 ✅ 확정 — 이력 보존):

1. **(G1) ko 오버레이 UX** — "게이트 해제 후 ko 검증 = 공개 사이트
   위에서 `?ko_token=` 쿠키로 메시지만 ko 스왑(URL=nl-BE, 텍스트=ko)"
   이 운영자 "편집자 모드처럼" 요구에 부합. **✅ 확정: 옵션 (G1-a)**
   — §A2.4 ① "같은 도메인 게이트(b)" 확정 토큰의 *읽기 측 재사용*,
   envelope·운영자 의도 100% 정합. 운영자가 "ko URL 자체" 가 아니라
   "ko 텍스트 검증" 을 요구함을 명시 확정 (G1-b 재검토 불요). **
   blocker: 아니오** (확정 완료).
2. **(G2-i/ii) DeepL 키 발급 + ko 소스** — 운영자가 DeepL API Free
   계정 생성 + `DEEPL_API_KEY` 발급(무료 티어, 카드 불요). **✅ 확정:
   운영자 발급 + 일회성 스크립트** (builder 값 생성 X — RESEND/
   KO_GATE 패턴). **blocker: 예 (소프트)** — 키 없으면 번역 *산출*
   단계 진입 불가. **코드 배선(Phase A: G1-a 오버레이 + G3 병합
   구조)은 키 없이 선행** (builder 진행). 번역 산출(Phase B)만 키
   대기. **운영자 액션 필요 (블로킹 구간 = Phase B 한정).**
3. **(G2-ii) DeepL ko→nl/fr/en 지원 확인** — DeepL ko 를 *소스
   언어* 로 지원하는지 (지원 시 ko 직역; 미지원 시 ko→en→nl/fr
   2-hop). **✅ 확정: builder 리서치 사항** (§References [DeepL
   Languages] 재확인, 2-hop fallback 존재). **blocker: 아니오** —
   기술 확인, 운영자 확인 불요.

4. **(Q2) 검수 모델** — caveats.* 1순위 수동 검수 / 나머지 DeepL
   raw 공개 + 사후 보정 / legal.* = 4.5.j.3 분리. **✅ 확정** (위
   §A2.7 G2 "운영자 확정 (2026-05-17) — Q2 잠금" 블록 참조 — P1/P3
   부채 운영자 의식 수용, ADR-0034 패턴). **blocker: 아니오** (확정
   완료; DeepL 키만 소프트 blocker = #2 와 동일 구간).

#### A2.7 비-DoD (명시 경계)

- `legal.*` 번역/검수 ❌ → 4.5.j.3 (§T4, legal 에이전트).
- ko 제거(`messages/ko.json` 삭제) ❌ → ADR-0034 §미결(운영자 보류).
- hreflang/sitemap 활성 ❌ → PLAN 4.6 / 3.5.3 (D5).
- ko URL 세그먼트화 ❌ → §T2 잠금 (G1-b 거부).

**ADR-0034 §미결 침범 0 확인**: §A2.7 전체는 "개발 중 ko *검증 접근
메커니즘*(G1)" + "번역 실행/구조(G2/G3)" 만 잠근다. "런칭/개발 완료
후 ko 삭제 vs hidden 유지"(ADR-0034 D1 단일 미결, 운영자 명시 보류)는
1mm 도 건드리지 않음 — 본 ADR §A2.6 의 "ko 제거 = 보류" 와 일관.

### A2.8 — 컴포넌트 t() 소비 마이그레이션 누락 정직 기록 + 재스코프 (architect 2026-05-18)

> 본 절은 PLAN 4.5.j.2 §정정(2026-05-18, 라이브 근거)을 ADR 차원에서
> 정직 기록하고 잔여 작업을 정의한다. **신규 ADR 신설 0 (P5 — 기존
> §A2 amend)**. 코드/`messages/`/`src/**` 변경 0 (본 절은 *설계 정정* —
> 구현은 builder, 신규 sub-task §A2.8.3).

#### A2.8.1 — 무엇이 일어났는가 (P3 — 숨기지 않음)

**라이브 근거 (HEAD=a7e6967, Phase B 배포 고유 URL 직접 fetch,
`x-vercel-cache: MISS`)**: next-intl `messages` 페이로드 = 완전한 실
nl (4.5.j.2 Phase B 번역 산출물 정상). 그러나 렌더 `<main>` =
**하드코딩 한국어** (`<p>비교는 쉽게…</p>` / `<a>지금 비교하기</a>`).
스코프 실측 (`grep -rlP "[가-힣]" src/app --include=*.tsx` + `useTranslations`/
`getTranslations` 사용처):

- `useTranslations`/`getTranslations` 사용 = **1 파일** —
  `src/app/[locale]/layout.tsx` 의 `NextIntlClientProvider` 셋업뿐
  (콘텐츠 번역 0).
- 한글 하드코딩 = **~25~28 page/component .tsx** (테스트/루트 layout
  제외) — `src/app/[locale]/` 전 콘텐츠 컴포넌트.

→ 인프라(라우팅/middleware/`request.ts` base+delta 병합/Provider) +
번역 산출물(nl/fr/en 182키 실번역) 은 정상이나, **컴포넌트가 그
메시지를 `t()` 로 소비하지 않으므로 사용자에게 nl/fr/en 0 전달**.
locale 무관 전부 하드코딩 한국어 렌더.

#### A2.8.2 — 근본 원인 = §T5 "키화" 의 under-spec (정직 진단)

**§T5("키화 우선순위") + §SCOPE 표 + 4.5.j DoD 가 정의한 "키화"
= *문자열 추출 + `messages/*.json` 키 적재 + 인프라 배선* 까지만**.
"컴포넌트 본문의 하드코딩 문자열을 `t('namespace.key')` 호출로
*치환* 하여 메시지를 소비" 하는 단계 — i18n 의 *실제 사용자 전달
경로* — 가 §T5/§SCOPE/DoD 어디에도 명시 deliverable 로 적히지
않았다. next-intl 문서상 "키화(extract)" 와 "소비(consume via
`useTranslations`/`getTranslations`)" 는 **별개 단계**
([next-intl — Messages](https://next-intl.dev/docs/usage/messages):
메시지 정의 ↔ `useTranslations` 소비는 분리 절차). §T5 가 전자만
deliverable 로 잡고 후자를 *암묵 가정* 한 것이 under-spec 의 본질.

- 4.5.j ("ko 키화") `[x]` = 인프라+추출 기준으로는 **정당** (취소
  아님). 단 *사용자 대면 i18n 전달* 은 미완 — PLAN 4.5.j 정정
  cross-ref(2026-05-18) 가 이를 기록.
- 4.5.j.2 ("nl/fr/en backfill") `[x]→[ ]` = backfill DoD 가
  "nl/fr/en 콘텐츠" 를 요구했으나 컴포넌트 미소비 = 사용자에게
  콘텐츠 0 → DoD 미달. 정정 정당 (PLAN 4.5.j.2 §정정).

이는 **개별 에이전트 과실이 아니라 ADR 스펙 자체의 결함**이다
(P3 — 책임 전가 0). §T5 가 "키화" 를 i18n 의 *완결* 로 오해할
여지를 남겼다. 본 §A2.8 이 그 정의 공백을 메운다.

#### A2.8.3 — 잔여 작업의 ADR 차원 정의

§T5 "키화" 정의를 **2 단계로 명시 분해** (정정 잠금):

- **§T5-S1 (추출/배선)** = 문자열 추출 + `messages/*.json` 적재 +
  인프라 배선 + DeepL 번역 산출. **상태: 완료** (4.5.j + 4.5.j.2
  Phase A/B).
- **§T5-S2 (소비 마이그레이션)** = `src/app/[locale]/**` 콘텐츠
  컴포넌트의 하드코딩 문자열을 `t()` 호출로 치환 (server =
  `getTranslations`, client = `useTranslations`), `messages/ko.json`
  네임스페이스(`home`/`compare`/`result`/`caveats` + 중첩) 와 매핑.
  **상태: 미완 → PLAN 신규 sub-task 4.5.j.4(.A/.B) (§A2.8.4)**.

§T5-S2 = **트랙 D1 의 *실제 누락 deliverable***. ADR-0034 D1
("EN/FR/NL 공개") + ADR-0033 §SCOPE("4.9 = nl/fr/en 콘텐츠
100%") 의 *사용자 전달* 조건은 §T5-S2 완료 없이 충족 불가 —
즉 §T5-S2 는 **완성 게이트(PLAN 4.9)의 실질 blocker**.

**잠금값 (재스코프 envelope — 위배 금지)**:
- ADR-0034 D1 / §T1 라우팅 골격 / §T2 `locales` 배열 / §A2.7
  G1-a 오버레이 / G3 base+delta 병합 = **무변경** (S2 = 컴포넌트
  내부 치환만, 인프라 0 변경).
- `messages/ko.json` 정본 = **무변경** (S2 는 키를 *소비* 만,
  키 추가/변경 시 = ko.json amend → 그 자체가 S2 DoD 항목).
- `legal.*` 네임스페이스 = **4.5.j.3 경계** (S2 대상 아님). 단
  `legal/affiliate-disclosure/page.tsx` 의 *비-legal UI 텍스트*
  (페이지 헤딩/네비/구조 라벨)는 일반 트랙 S2 대상 — `legal.*`
  키(동의/디스클로저/약관 본문)만 4.5.j.3 분리 (경계 = "키
  네임스페이스" 기준, 파일 기준 아님).
- ADR-0034 §미결("KO 운명") 침범 **0** — S2 는 컴포넌트가
  *어떤 메시지 소스든* `t()` 로 소비하게 만들 뿐, ko 삭제/유지와
  무관 (G1-a 오버레이가 ko 소스 스왑 담당 — S2 는 그 위에서 동작).

#### A2.8.4 — 검증 파이프라인 blind-spot 근본 원인 + 재발 방지 [잠금]

**P3/P5 정직 기록 — blind-spot 실태**: typecheck / lint /
`pnpm test:run`(523) / `pnpm harness:plan`(88) / `pnpm harness:data`
/ verifier Phase A·B 전부 통과했으나 **어느 게이트도 "컴포넌트가
`t()` 를 소비해 번역된 출력을 렌더하는가" 를 검증하지 않았다**.

- verifier #2("루트 실 nl") = `request.ts` base+delta 병합 *코드
  리딩* 단정 — 렌더 출력 미검증 (병합 페이로드가 옳아도 컴포넌트가
  소비 안 하면 사용자 0).
- 단위 테스트 523 = 병합/`request`/middleware 로직만 — 컴포넌트
  렌더-소비 경로 0 커버.
- 오케스트레이터 = 라이브 "여전히 한국어" 를 *배포 지연/과도기
  부채* 로 오진 (실제 = 구조적 미소비).

**근본 원인**: 모든 게이트가 "메시지 *정의/병합* 정합" 만 검사,
"메시지 *소비/렌더* 정합" 을 검사하는 게이트 부재. i18n 의
사용자 전달 경로(컴포넌트 `t()` 소비)에 대한 정적/렌더 가드가
파이프라인에 없었다.

**재발 방지 — 신규 게이트 `harness:i18n` [잠금]** (옵션 비교 →
권고 1개 + DoD 박음):

- **옵션 (a) — `harness:i18n` 정적 가드 (신규 스크립트)**:
  `scripts/harness/i18n-consumption.ts` — (i) `src/app/[locale]/**/*.tsx`
  (`*.test.tsx` / 루트 `src/app/layout.tsx` 제외) 에 한글 리터럴
  (`/[가-힣]/` JSX 텍스트/문자열) **0** 정적 검사 + (ii) 핵심
  라우트(랜딩/compare 5단계/`r/[shortId]`) 파일에 `useTranslations`
  또는 `getTranslations` import **존재** 정적 검사. **권고 — 채택**.
  - ✅ 얻는 것: 솔로·€300 현실 정합 (라이브 배포 fetch 불요,
    CI 무비용, Stop hook 게이트 1줄 추가). under-spec 재발 = 한글
    리터럴 잔존 = 게이트 fail 로 *즉시* 가시화. harness:plan/data
    동형 패턴 (학습 부담 0 — FOUNDER 모드).
  - ⚠️ 잃는 것: 정적 검사 = "한글 0 + import 존재" 까지만 —
    "런타임에 *옳은* 키를 소비하는가"(잘못된 키 = 키 그대로
    노출)는 미검증. 이는 (c) e2e 1건이 보완 (DoD 에 박음).
    한글 리터럴 *허용 예외* (예: `lang` 속성 주석, ICU 내부) =
    화이트리스트 주석 패턴 필요 (builder 가 §A2.8.5 에서 정의).
- **옵션 (b) — verifier DoD 에 "배포/로컬 렌더 출력 번역 키
  소비 확인" 의무화** (고유 deployment URL fetch 또는 `pnpm
  build` + 렌더 단언). ⚠️ 보강으로 채택하되 *단독 게이트 부적합*
  — 수동/비결정적(배포 타이밍 의존), 솔로 반복 비용 큼. (a) 의
  *보완* 으로 4.5.j.4 DoD 에 "verifier 가 1회 고유 URL fetch 로
  `<main>` 한글 0 + nl 텍스트 노출 육안 확인" 만 박음 (상시
  게이트 아님 = 비용 절감).
- **옵션 (c) — e2e locale 단언** (`/en` 또는 `/fr-BE` 진입 →
  핵심 텍스트가 ko 아닌 해당 locale). ⚠️ 보강 — 기존 `pnpm
  test:e2e` 에 단언 1~2개 추가 (신규 spec 0, 비용 최소). (a)
  정적 가드의 런타임 보완. 4.5.j.4 DoD 에 박음.

**잠금 결정 (architect)**: **(a) `harness:i18n` = 상시 게이트
(권고·잠금)** + (b)(c) = 4.5.j.4 DoD 1회성 보완 항목. (a) 단독으로
under-spec 재발(한글 리터럴 잔존)을 결정적으로 차단 — blind-spot
의 *근본*(소비 미검증)을 게이트화. **운영자 확인 불요** (€300/솔로
envelope 내 — 신규 SaaS 0, CI 무비용, architect 기본값 잠금).
4.6/4.9 진입 전 `harness:i18n` GREEN 필수 (4.9 완성 게이트 보강).

#### A2.8.5 — builder 인계 스펙 (S2 컴포넌트 마이그레이션)

- **server 컴포넌트** (RSC, `async function` / `page.tsx` 다수):
  `import { getTranslations } from 'next-intl/server'` →
  `const t = await getTranslations('namespace')` → `{t('key')}`.
- **client 컴포넌트** (`'use client'`):
  `import { useTranslations } from 'next-intl'` →
  `const t = useTranslations('namespace')` → `{t('key')}`.
- **네임스페이스 매핑** (ko.json 기 구조 — S2 는 *소비* 만):
  랜딩 `page.tsx` → `home.*` / `compare/**` → `compare.*`
  (중첩: `compare.layout.*` `compare.categories.*` 등 기존 키
  경로 그대로) / `r/[shortId]/**` → `result.*` (`result.calculationDetails.*`
  등) / caveats 출력 경로 → `caveats.*`. ICU 변수(`{label}` 등)는
  `t('key', { label })` 형태 — ko↔nl/fr/en ICU 100% 정합 기검증
  (verifier #3 PASS, 4.5.j.2).
- **ko.json 키 부재 시 처리**: 컴포넌트 문자열에 대응 키 부재 시
  builder 가 `messages/ko.json` 에 키 *추가* (네임스페이스 규칙
  준수) → 그 키는 nl/fr/en placeholder 로 남고 다음 DeepL 라운드
  (4.5.j.2 재실행 또는 신규 보정 round) 대상 — *키 추가 자체가
  S2 DoD 항목* (P1: 하드코딩 잔존 금지, 키 누락도 금지).
- **`legal.*` 경계**: legal 본문 키 = 4.5.j.3 (S2 미산출). legal
  페이지의 *비-legal UI 셸*(헤딩/네비)만 S2 대상.
- **테스트 명령 = `pnpm test:run`** (*`pnpm test` 아님 — vitest
  watch 함정*, ADR-0033 4.5.j.2 DoD (6) 동일 주의).

**ADR-0034 §미결 침범 0 재확인 (§A2.8 전체)**: §A2.8 은 컴포넌트
의 *메시지 소비 경로* 만 정의·정정한다. "런칭 후 ko 삭제 vs
hidden 유지"(ADR-0034 D1 단일 미결)는 1mm 도 건드리지 않음 —
S2 는 ko 소스 자체가 아니라 *어떤 소스든 `t()` 로 소비* 하게
만드는 작업 (ko 소스 스왑 = G1-a 오버레이 책임, S2 무관).

---

## Amendment 5 (2026-05-23) — 메타데이터 i18n 패턴 (§A2.9, 4.5.j.4.B 구현 잠금)

**트리거**: 라이브 `slim.lu` 진단 — 페이지 `<title>`/`description` 이 한국어
(브라우저 탭 + SEO 노출). compare 트리 전반 `@i18n-allow metadata 한글은
4.5.j.4.B 대상` 마커로 의도적 Phase B 보류 중이던 메타데이터 i18n 을 본
Amendment 가 패턴 잠금 + 4.5.j.4.B 구현 명세로 확정한다. (Zod 메시지 i18n +
harness 범위 확장 + 언어 전환기는 도메인 분리 → [ADR-0036](0036-i18n-completion-zod-harness-locale-switcher.md).)

### §A2.9.1 — generateMetadata + getTranslations 패턴 (잠금)

영향 파일 = `@i18n-allow metadata` 마커 보유 metadata export 전수 (architect
grep 2026-05-23):

| 파일 | 현 형태 | 전환 패턴 |
|---|---|---|
| `compare/page.tsx` | `export const metadata` (정적, page=server) | → `export async function generateMetadata` + `getTranslations('compare')` |
| `compare/[category]/page.tsx` | 이미 `generateMetadata` (CATEGORY_LABELS 한글) | 한글 라벨 → `getTranslations('compare.categories')` |
| `compare/[category]/{postal,household,bill,preview}/layout.tsx` | `export const metadata` (정적, layout=server) | → `generateMetadata({params})` + `getTranslations('compare.<step>')` |
| `compare/[category]/current-provider/page.tsx` | `export const metadata` (page=server) | → `generateMetadata` + `getTranslations` |
| `r/[shortId]/page.tsx` | 이미 `generateMetadata` (한글 title/desc) | 한글 → `getTranslations('result')` |
| `page.tsx` (home) | `export const metadata` (한글) | → `generateMetadata` + `getTranslations('home')` |
| `[locale]/layout.tsx` | `export const metadata` (한글 default/template/og) | → `generateMetadata({params})` + `getTranslations('metadata')` |

**핵심 규칙**:
1. **`'use client'` page 는 metadata 를 못 export** (Next.js App Router 규칙) →
   부모 `layout.tsx` 의 `generateMetadata` 가 담당 (postal/household/bill/preview
   = 이미 layout.tsx 분리 구조 — 정적 metadata 를 `generateMetadata` 로 격상만).
2. `generateMetadata({ params })` 에서 `const { locale } = await params` →
   `getTranslations({ locale, namespace })`. **`params` 의 `locale` 명시 전달**
   (RSC 외 metadata 컨텍스트는 setRequestLocale 보장 안 됨 — locale 명시 안전).
3. `setRequestLocale(locale)` 를 metadata 함수 진입 시 호출 (next-intl v3 static
   rendering — layout.tsx 이미 동일 패턴).

### §A2.9.2 — 키 네이밍 (재사용 우선)

기존 ko.json 키를 **재사용** (신규 키 최소화):
- `compare.pageTitle`/`compare.pageDescription` → compare/page.tsx metadata 재사용.
- `compare.postal.title`·`household.title`·`bill.title`·`preview.title`·
  `current-provider.title` → 각 step layout metadata (현 ko.json `compare.<step>.title`
  존재 확인 — postal=L53 `우편번호 입력`).
- `result.pageTitle` (ko.json L131 존재) → r/[shortId] metadata.
- `home.*` → home metadata (단 home 은 metaTitle/metaDescription 신규 키 필요 —
  현 home.* 는 headline/tagline/ctaButton 만, metadata 용 분리 키 `home.metaTitle`/
  `home.metaDescription` 신규).
- `[locale]/layout.tsx` = **신규 `metadata.*` 네임스페이스** (defaultTitle/template/
  description/ogTitle 등 — 브랜드 메타). **og:locale 은 locale 별 동적**
  (`ko_KR` 하드코딩 → locale→OG locale 매핑: nl-BE→`nl_BE`, en→`en_US` 등).

**규칙**: metadata 전용 키가 본문 표시 키와 의미 충돌하면 `metaTitle` 접미사로
분리 (예: `home.metaTitle` vs `home.headline`). 같으면 재사용.

### §A2.9.3 — `@i18n-allow` 마커 제거 방침

4.5.j.4.B 구현 시 metadata `@i18n-allow metadata` 마커를 **전부 제거**한다
(getTranslations 전환 = 한글 리터럴 0 → 마커 불요). 단 **dev throw 메시지**
(`@i18n-allow 개발자 에러 메시지` — compare/page.tsx:44, household/page.tsx:57)
는 사용자 미노출 → **마커 유지** (harness 화이트리스트 보존). 루트
`src/app/layout.tsx` 브랜드 metadata = 콘텐츠 0 검토만 (4.5.j.4.B 본문 명시 —
변경 불요 판정 기록, 단 [locale]/layout.tsx 로 metadata 가 이동했으므로 루트는
이미 metadata 없음 — 확인만).

### §A2.9.4 — hreflang/canonical 관계 (3.5.3/3.5.4)

metadata i18n 전환은 `alternates.canonical` (이미 compare/[category]·r/[shortId]
존재) 을 **건드리지 않는다**. hreflang `<link rel="alternate">` 활성은 3.5.3/
3.5.4 (4.6) 트랙 — 본 Amendment 는 title/description 텍스트만 locale-aware 화.
canonical 경로는 locale prefix 를 next-intl `getPathname` 가 처리 (3.5.3 책임).
**경계**: 본 Amendment ⊂ 4.5.j.4.B (텍스트), hreflang/sitemap = 4.6/3.5.3 (구조).

### §A2.9.5 — 잠금 envelope (위배 금지)

§A2.8.3 envelope 전부 상속 + 추가: metadata 전환은 (a) `robots`/`canonical`/
`openGraph.url`/`alternates` 구조 무변경 (b) `revalidate`(r/[shortId] ISR 3600)
무변경 (c) noindex 정책(입력 step layout robots index:false) 무변경. **텍스트만**.

---

## Amendment 6 (2026-06-07) — §T2 locale 5→3 축소 + defaultLocale 변경 (PLAN 4.15, 운영자 결정)

> 본 절은 §T2 (5 locale 목록) 의 **본문 갱신** 이다. ADR-0036 D3 (LocaleSwitcher
> 5 풀 노출) Amendment 1 + ADR-0034 D5 (hreflang/sitemap 다국어) cross-ref 동반 갱신.
> §T1 라우팅 골격 (`[locale]` 세그먼트 + `localePrefix:'as-needed'`) 은 **보존 — 회귀 0**.

### A6.1 — 운영자 결정 (2026-06-07, slim.lu prod 자가 진단)

운영자 Pieter slim.lu prod 실측 후 신호: **"랜딩페이지 언어 프랑스어 lu 프랑스어
be 같은 프랑스어, 네덜란드어도 nl 이랑 be 통합으로 영어 프랑스어 네덜란드어
세개만 표기"**. 결정 = **locale 5→3 통합 (en / fr / nl)**.

**왜 (4.13/4.14 후속 신호)**:
- 헌법 §3 P2 (Easy & Fast) — LocaleSwitcher 5 옵션 = 인지 부하 (사용자 nl-BE/nl-NL
  차이 모름 → ADR-0036 §대안 D3-region "과밀" 예측 실증).
- ADR-0034 D2 (통신 BE 만) — 페이즈 5 NL/LU 진입 보류 = nl-NL/fr-LU 구분은
  현 단계 매출 0 (사용자 단가에 영향 0, 인지 부하 ↑).
- 4.13.c builder 구현 (SiteHeader sticky + LocaleSwitcher above-the-fold) 후
  5 옵션 노출이 hero 첫 fold 시각 비중 ↑ → 정체성 카드 3개 (mobile/internet/bundle)
  와 시각 경합.

### A6.2 — §T2 갱신 — `locales` 3값 + `defaultLocale` 재선정

**기존 §T2 (Amendment 2 후)**:
```ts
locales: ['nl-BE', 'nl-NL', 'fr-BE', 'fr-LU', 'en']
defaultLocale: 'nl-BE'
```

**Amendment 6 갱신**:
```ts
locales: ['nl', 'fr', 'en']
defaultLocale: 'nl'
```

**defaultLocale 재선정 = `nl`** (옵션 비교):
- 옵션 A — `nl` (채택): ADR-0034 D2 통신 BE 만 + ADR-0009 BE ≥ 75% (베네룩스 1차)
  + Belgium 인구 약 60% nl 사용 + Netherlands 흡수 시 nl 1차 = 정합. nl-BE 슬롯이
  지금까지 default 였던 연속성 보존 (회귀 0).
- 옵션 B — `fr`: BE 약 40% fr 사용 + LU 다수 = NL/LU 통합 후 비중 감소. 거부.
- 옵션 C — `en`: SEO 중립이나 베네룩스 1차 시장 정합 0 (ADR-0034 D2 위배). 거부.

`localePrefix:'as-needed'` 유지 → defaultLocale `nl` URL = prefix 없음.
**4.13/4.14 잠금된 URL 구조 회귀 0** (기존 nl-BE 무프리픽스 = 새 nl 무프리픽스로
대응, 사용자 체감 0). 핵심 trade-off = §A6.4 (기존 prefix URL 301 redirect).

### A6.3 — CLAUDE.md §5 i18n 행 갱신 영역

CLAUDE.md §5 "i18n 행" = `next-intl / nl-BE / nl-NL / fr-BE / fr-LU / en` →
**`next-intl / nl / fr / en`** 갱신. 변경 시 ADR 필수 (CLAUDE.md §5 잠금) — 본
Amendment 가 ADR 트랙. PLAN 4.15.b 가 CLAUDE.md §5 외과적 편집 흡수.

### A6.4 — 기존 5 prefix URL 보존 전략 — **301 redirect 채택**

4.6 organic SEO 런치 (2026-06-05 발효, ADR-0034 D5) 후 Google Search Console
sitemap.xml 제출 (8 paths × 5 locales = 40 entries) → Google 색인 진행 중.
locale 5→3 통합 시 기존 `/nl-BE/`/`/nl-NL/`/`/fr-BE/`/`/fr-LU/`/`/en/` URL = 색인
대상 → 변경 시 **SEO 자산 손실 위험**.

**옵션 비교**:
- 옵션 X.1 — **301 redirect (채택)**: `/nl-BE/*` → `/*` (nl 무프리픽스), `/nl-NL/*`
  → `/*`, `/fr-BE/*` → `/fr/*`, `/fr-LU/*` → `/fr/*`, `/en/*` → `/en/*` (유지).
  middleware (`src/middleware.ts`) 가드 1겹 추가. 장점: SEO link equity 보존 +
  사용자 bookmarked URL 동작 유지. 단점: middleware 분기 1겹 + 6개월~1년 유지.
- 옵션 X.2 — 410 Gone: 색인 즉시 제거 신호. 장점: 깨끗. 단점: link equity 0 +
  사용자 bookmark 깨짐. 거부.
- 옵션 X.3 — noindex 메타: Google 재크롤 후 자연 탈락. 장점: 단순. 단점: 사용자
  bookmark 작동하나 깨진 URL 노출 + 색인 탈락 수개월. 거부.

**채택 = X.1 (301 redirect)**. middleware 구현 = `routing.locales` 단일 출처 검사
전 단계 (next-intl 진입 전) 에 deprecated prefix 매칭 + 301 redirect. 6개월 유지 후
Google Search Console "Index" 보고 deprecated URL 0 확인 시 분기 제거 (별 PLAN
trigger, 본 4.15 범위 밖).

### A6.5 — 페이즈 5 NL/LU 진입 BC compatibility 트리거

ADR-0034 D2 "통신 BE 만" → 페이즈 5 진입 시 NL/LU 카테고리 확장 가능성 보존.
NL/LU 별 locale variant 다시 필요 시:
- **옵션 a — locale 5값 재신설**: routing.locales 다시 5값. 본 Amendment 6 reverse.
  새 ADR 필수 (CLAUDE.md §5 변경). 트리거 = 통신 NL/LU 별 가격 차이가 사용자
  체감 ≥ 10% 또는 NL/LU 별 fetcher 신설 시.
- **옵션 b — URL param/cookie 분기**: `nl?region=NL` 또는 cookie `region`. 장점:
  routing 변경 0 + hreflang/sitemap 유지. 단점: SEO 색인 region 별 분리 어려움.

**트리거 조건 (잠금)**: 페이즈 5 진입 + NL/LU 가격 격차 신호 둘 다 만족 시
별도 ADR 트리거. 그 전엔 본 Amendment 6 (3 locale) 유지. **Amendment 6 = BE 단계
통합, 페이즈 5 reverse 가능성 명시 기록**.

### A6.6 — messages/ 파일 정리 + legal 검수 영향

- **messages/nl-BE.json / nl-NL.json / fr-BE.json / fr-LU.json**: delta 패턴
  파일. PLAN 4.15.d 가 **삭제 채택** — 이유 = (1) 페이즈 5 reverse 시 옵션 a
  (5값 재신설) 시 별 ADR + DeepL hybrid 재 round 으로 backfill 가능 (2) 현
  단계 nl/fr/en base 파일만 단일 출처 (3) 운영 부채 ↓.
- **messages/ko.json**: ADR-0033 §A2.3 ko 운영자 hidden 트랙 = 영향 0 (locale
  목록 비포함 잠금 유지).
- **legal 네임스페이스 (ADR-0033 §T4 + ADR-0037 + ADR-0040)**: 검수 트랙은 이미
  ko/en/nl/fr 4 locale 단일 검수 (locale variant 검수 X) = **본 Amendment 6 영향
  0**. 4.12.f 잠금된 legal 1차 검수 PASS 유지 + 4.5.j.3 (ADR-0040 DeepL hybrid)
  retarget 결과 유지.

### A6.7 — 잠금 envelope (위배 금지)

본 Amendment 가 갱신하는 영역만 변경. 그 외 §T1 (라우팅 골격) / §T3 (DeepL)
/ §T4 (legal 네임스페이스) / §T5 (키화 우선순위) / Amendment 2~5 본문 = **모두
유지** (회귀 0). 변경:
- (a) §T2 `locales` 5값 → 3값
- (b) §T2 `defaultLocale` `nl-BE` → `nl`
- (c) middleware ADMIN_LOCALE_PREFIXES 도출 = `routing.locales` 단일 출처 = 자동
  4 prefix → 2 prefix 갱신 (하드코딩 0, 회귀 0). admin 가드 보안 영향 0 (ADR-0038
  잠금 envelope 보존).
- (d) **추가 middleware 1겹** = deprecated prefix 301 redirect (§A6.4 옵션 X.1).
  routing.ts + middleware.ts 두 파일만. admin 가드 / ko 게이트 / next-intl
  middleware 실행 순서 (ADR-0033 §A2.5 D2) 보존 — 신규 redirect 단계는 가장
  먼저 (admin 가드 전).

### A6.8 — 검증

- §V1 Vercel 배포 URL `slim.lu/` (nl 무프리픽스) + `/fr/*` + `/en/*` 3 locale
  모두 200 정상.
- §V2 deprecated URL 4건 (`/nl-BE/compare`, `/nl-NL/compare`, `/fr-BE/compare`,
  `/fr-LU/compare`) curl `-I` → 301 Location 정확 매핑 (`nl-BE`/`nl-NL` → `/compare`,
  `fr-BE`/`fr-LU` → `/fr/compare`). `/en/compare` = 유지 (200, redirect 대상 아님).
- §V3 LocaleSwitcher (footer + SiteHeader) = NL/FR/EN 3 옵션 노출 (5 → 3 회귀 0).
- §V4 hreflang = 8 paths × 3 locale + x-default = 25 entries (40→25), Search
  Console 4 deprecated URL "Crawled - currently not indexed" 또는 "Redirect"
  분류 6개월 내.
- §V5 typecheck/lint/test:run 0 + harness:i18n GREEN (3 locale 한글 0) +
  harness:plan 95 정합 + harness:data 통과.
- §V6 admin 가드 + ko 게이트 + e2e 회귀 0 (4.13/4.14 잠금된 URL 골격 보존 확인).


