# ADR-0036: i18n 누출 봉합 3종 — Zod 메시지 locale-aware · harness 범위 확장 · 언어 전환기

## 상태
채택 (2026-05-23)

## 맥락

라이브 사이트 `slim.lu` 진단에서 한국어가 공개 nl/fr/en 표면에 누출되는 3갈래가 확인됐다 (운영자 보고 + architect 진단 2026-05-23):

1. **페이지 메타데이터 한국어** — `<title>`/`description` 이 한국어. compare 트리 전반에 `@i18n-allow metadata 한글은 4.5.j.4.B 대상` 마커로 **의도적 Phase B 보류** 상태. → 이건 **기존 4.5.j.4.B 트랙**이므로 본 ADR이 아니라 [ADR-0033](0033-i18n-next-intl-introduction.md) Amendment 5 로 흡수한다 (메타데이터 i18n 패턴은 동 Amendment 참조).

2. **Zod 검증 메시지가 `.ts` 정적 schema 에 한국어 하드코딩** — `src/types/comparison-input.ts` L59/L70/L79 (우편번호 BE/NL/LU regex 실패 메시지), L107 (`요금제를 선택하려면 먼저 공급사를 선택해야 합니다` superRefine). 두 경로로 공개 노출:
   - 클라이언트: `postal/page.tsx`·`household/page.tsx` 의 RHF `zodResolver` → `<FormMessage />` 가 Zod `message` 텍스트를 그대로 렌더 (검증 실패 시 nl/fr/en 사이트에 한국어 에러).
   - 서버: `src/app/api/compare/route.ts:60-63` 가 `comparisonInputSchema.safeParse(body)` 실패 시 `parsed.error.issues` 를 JSON 응답에 그대로 포함 (한국어 message 노출).
   - **근본 문제**: `.ts` 정적 schema 의 message 는 모듈 로드 시점에 1회 평가 → 요청별 locale 을 알 수 없다.

3. **공유 컴포넌트 `harness:i18n` 사각** — `harness:i18n` (`scripts/harness/i18n-consumption.ts`) 가 `src/app/[locale]/**.tsx` 만 스캔. (a) `.ts` 파일 (Zod 메시지), (b) `src/components/` (공유 컴포넌트 — `PriceWithSource.tsx`/`StaleLabel.tsx` 한국어 하드코딩, `SiteFooter.tsx`) 를 못 잡는다. 그래서 위 2번 + 고아 컴포넌트가 게이트를 통과한 채 잔존.

4. **언어 전환 UI 부재** — `LocaleSwitcher` 컴포넌트도 헤더도 없음. `localePrefix:'as-needed'` 에서 사용자가 `/fr-BE/`·`/en/` 로 갈 UI 경로가 0. nl-BE 기본 슬롯에 갇힘.

연결 PLAN 항목: **4.5.j.4.B** (메타데이터 + 보조 경로 — ADR-0033 트랙) + **신규 4.5.j.5** (Zod + harness 확장 + 고아 컴포넌트) + **신규 4.11** (언어 전환기).

## 결정

세 가지를 결정한다. 메타데이터 i18n 패턴은 ADR-0033 Amendment 5 로 분리 (i18n 인프라 결정 출처 일관).

### D1 — Zod 메시지 i18n: **에러 코드/키 전략** (schema factory 거부)

`.ts` schema 의 메시지를 **사람이 읽는 텍스트가 아닌 안정적 에러 키**로 둔다. schema 는 locale-free 로 유지하고, 표시 시점에 `t()` 로 매핑한다.

- **클라이언트**: Zod `message` = 키 토큰 (예: `'validation.postal.be'`). `<FormMessage />` 가 직접 키 텍스트를 렌더하지 않도록 — RHF `formState.errors.<field>.message` 를 컴포넌트에서 `useTranslations('validation')` 로 매핑해 표시. (FormMessage 직접 children 주입 또는 message 를 키로 받는 작은 래퍼.)
- **서버** (`/api/compare`): `parsed.error.issues` 를 그대로 응답에 넣지 않고, **issue.message (= 키) 만 추출**해 `{ code, path }` 형태로 반환. 클라이언트 우회 방어 경로이므로 사용자 UI 노출은 드물지만 (정상 플로우는 클라이언트 검증 통과), P3 정직성 + 한국어 누출 0 위해 키만 노출한다.

근거: schema 는 단일 출처 (`src/types/comparison-input.ts`) 로 유지되어야 한다 (ADR-0016 §T7 — RHF resolver + 서버 재검증 둘 다 동일 schema 소비). schema factory `makePostalSchema(t)` 는 호출처마다 `t` 주입을 강제해 단일 출처를 깨고, 서버(`getTranslations`)/클라이언트(`useTranslations`) 두 `t` 의 비대칭을 schema 안으로 끌어들인다. 키 전략은 schema 를 순수하게 유지하고 표시 책임만 UI 로 민다 (관심사 분리).

### D2 — harness:i18n 범위 확장: **`src/components/` + `src/types/comparison-input.ts` 추가**

`harness:i18n` 스캔 대상을 확장하되 **오탐 최소화 필터를 보존**한다:
- 추가 스캔: `src/components/**/*.tsx` (`*.test.tsx` 제외) + `src/types/comparison-input.ts` (Zod 메시지 전용 — `.ts` 화이트리스트는 이 1파일만, 무분별한 `src/**/*.ts` 확장 거부 — 주석·dev throw 오탐 폭증).
- 기존 필터 전부 유지: 주석/JSDoc/JSX 블록 주석/`@i18n-allow` 마커/인라인 주석/dev-only throw 메시지 (예: `comparison-input` 아이콘 누락 throw, `@i18n-allow 개발자 에러 메시지`).
- 자가검증 (0파일 FATAL) 유지 — 각 스캔 그룹별로 0파일이면 즉시 경고.
- metadata Phase B 처리: 4.5.j.4.B 완료 시 `@i18n-allow metadata` 마커를 제거하고 generateMetadata `t()` 로 전환 → 화이트리스트 자연 축소.

근거: 게이트가 못 보는 곳에서 누출이 발생했다 (4.5.j.2 §정정 blind-spot 의 연장). 범위를 못 보는 한 동일 사고가 반복된다. 단, `src/**/*.ts` 전체 확장은 dev throw·주석·테스트 픽스처 오탐을 폭증시키므로 **누출 실증된 파일군만** 외과적 추가.

### D3 — 언어 전환기: **SiteFooter 내 client 서브컴포넌트 `LocaleSwitcher`**

전역 푸터 `src/components/SiteFooter.tsx` (RSC) 안에 작은 client 서브컴포넌트 `LocaleSwitcher` 를 분리해 NL/FR/EN 전환 링크를 렌더한다.

- **위치**: SiteFooter 하단 `<nav aria-label>`. RSC footer 는 현재 pathname 을 알 수 없으므로 (서버 컴포넌트 제약) **client 서브컴포넌트**가 `usePathname` (next-intl `@/i18n/navigation`) 으로 현재 경로를 읽어 locale 만 교체한 링크를 생성.
- **대상 locale = nl-BE / nl-NL / fr-BE / fr-LU / en** (routing.locales 단일 출처에서 도출 — 하드코딩 금지). **ko 제외** (운영자 전용 게이트 콘텐츠, locale 목록 비포함 — ADR-0033 §T2). 단, 5개를 다 노출하면 UX 과밀 → **언어(NL/FR/EN) 3 토글 + 지역 변이는 현 region 유지** 권고 (아래 §대안 D3 참조).
- **현재 경로 보존**: next-intl `Link` 의 `locale` prop (또는 `usePathname` + `<Link href={pathname} locale="en">`) — `as-needed` prefix 가 자동 처리.
- **현재 locale 강조** + a11y: `aria-current="true"` + `<nav aria-label>` lang 표기.

근거: `as-needed` prefix 에서 nl-BE 기본 슬롯에 갇힌 사용자에게 탈출구가 없다. RSC footer 에 client 섬을 최소 분리 → footer 본문은 JS 0 유지 (헌법 P2), 전환기만 client.

## 대안

### Zod i18n (D1)
- **대안 A — schema factory `makePostalSchema(t)`**: schema 를 함수로 만들어 `t` 주입. 장점: 메시지가 즉시 번역됨. 단점: 단일 출처(ADR-0016 §T7) 파괴 — 호출처(클라이언트 RHF / 서버 route) 마다 `t` 종류가 달라 schema 시그니처가 비대칭. zodResolver 가 factory 호출을 매 렌더 반복. **거부**.
- **대안 B — zod `errorMap` + next-intl**: 전역 errorMap 에서 issue.code 별 메시지를 `t()` 로. 장점: schema 무변경. 단점: errorMap 도 `t` 컨텍스트가 필요 → 서버/클라이언트 비대칭 동일 + custom message (superRefine L107) 는 errorMap 으로 안 잡힘 (custom issue 는 message 직접). **부분 거부** (custom 케이스 못 덮음).
- **대안 C (채택) — 에러 코드/키**: 위 D1. 장점: schema 순수 유지, custom 포함 일관. 단점: 표시 컴포넌트에 매핑 1겹 추가.

### harness 범위 (D2)
- **대안 A — `src/**/*.ts` 전체 스캔**: 모든 `.ts` 검사. 단점: dev throw·주석·테스트·로그 한국어 오탐 폭증, 게이트 신뢰 훼손. **거부**.
- **대안 B (채택) — 누출 실증 파일군만**: `src/components/**` + `comparison-input.ts`. 정밀 + 오탐 최소.

### 언어 전환기 (D3)
- **대안 A — 헤더 신설 + 전환기**: 전역 헤더 컴포넌트 추가. 단점: 이번 범위 초과 (헤더 디자인 결정 별건), footer 가 이미 전역 배선됨 → 재사용. **거부 (범위)**.
- **대안 B (채택) — footer 내 client 섬**: 최소 변경, 전역 노출.
- **대안 D3-region — 5 locale 전체 vs 3 언어 토글**: 5개 전체 노출 = 명시적이나 과밀 (nl-BE/nl-NL 차이를 사용자가 모름). 3 언어(NL/FR/EN) 토글 = 간결하나 region 변이 접근 불가. **권고 = 3 언어 토글 (현 region 유지: nl→현 nl-region, fr→현 fr-region, default fr-BE)** + builder 가 UX 단순성 우선. 운영자 재량으로 5 전체 fallback 가능.

## 결과

- ✅ 공개 nl/fr/en 표면에 한국어 검증 메시지 0 (D1).
- ✅ harness 가 `.ts` Zod + 공유 컴포넌트 누출을 미래에 자동 차단 (D2) — blind-spot 봉합.
- ✅ 사용자가 footer 에서 언어 전환 (D3) — `as-needed` 갇힘 해소.
- ⚠️ Zod 키 매핑 1겹 추가 = FormMessage 래퍼 또는 message 매핑 코드 부채 (D1).
- ⚠️ `validation.*` 네임스페이스 신규 키 = base(nl/fr/en) + ko 4파일 backfill 필요 (4.5.j.4.A.1 동형 DeepL round).
- ⚠️ LocaleSwitcher = footer 에 client JS 소량 추가 (footer 본문은 RSC 유지 — 섬만 client).
- ⚠️ `PriceWithSource`/`StaleLabel` = JSX 렌더 사용처 0이나 **고아 아님** — `harness:data`(Rule3 `checkStaleLabel` error + Rule2 가격 래퍼) + `e2e-smoke` 가 존재를 P1 계약으로 강제. **2026-05-23 운영자 결정 = i18n 보존**(삭제 거부 — 삭제 시 harness:data error). `'use client'`+useTranslations/useLocale, 상대시간 Intl.RelativeTimeFormat, 신규 `dataDisplay.*`.

## 검증 방법

- `pnpm harness:i18n` 확장 후 GREEN — `src/components/` + `comparison-input.ts` 한국어 0 (화이트리스트 제외).
- `pnpm typecheck`/`lint`/`test:run` 0.
- Vercel 배포 URL `/en/compare/mobile/postal` 에서 우편번호 빈 제출 → 영어 에러 메시지 렌더 (한국어 0).
- Vercel `/en` footer 에서 NL/FR/EN 전환 클릭 → 현재 경로 유지하며 locale 교체 + `aria-current` 정합.
- `POST /api/compare` 잘못된 body → 응답 issues 에 한국어 message 0 (키 토큰만).

---

## Amendment 1 (2026-06-07) — D3 LocaleSwitcher 5→3 옵션 통합 (PLAN 4.15, ADR-0033 Amd 6 동반)

### A1.1 — 결정

D3 (LocaleSwitcher) 의 **대상 locale = 5 풀 노출** → **3 풀 노출 (NL/FR/EN)**
로 갱신. ADR-0033 Amendment 6 (`locales` 5→3 통합) 동반.

기존 D3 본문 "대상 locale = nl-BE / nl-NL / fr-BE / fr-LU / en (routing.locales
단일 출처에서 도출 — 하드코딩 금지). … 단, 5개를 다 노출하면 UX 과밀 → **언어
(NL/FR/EN) 3 토글 + 지역 변이는 현 region 유지** 권고" 와 §대안 D3-region
"3 언어 토글 권고" 가 ADR-0036 채택 시 명시했던 **권고 방향이 실 잠금으로 발화**.

### A1.2 — 갱신 본문

**Amendment 1 갱신 D3 대상 locale**:
```
대상 locale = nl / fr / en (3개, routing.locales 단일 출처 — ADR-0033 Amd 6 §A6.2).
ko 제외 (운영자 hidden 트랙 = locale 비포함, §T2 잠금 유지).
```

**LOCALE_ENDONYMS 맵 갱신** (`src/components/LocaleSwitcher.tsx`):
```ts
const LOCALE_ENDONYMS: Record<(typeof routing.locales)[number], string> = {
  nl: 'Nederlands',
  fr: 'Français',
  en: 'English',
};
```

- 이유: BE/LU/NL region suffix 제거 → "Nederlands (BE)" / "Nederlands (NL)" /
  "Français (BE)" / "Français (LU)" 4 endonym → 2 endonym (단일 nl + fr) 으로
  단순화. 운영자 결정 카피 = "영어 프랑스어 네덜란드어 세개만 표기" 직접 정합.
- 4.13.c builder 잠금된 SiteHeader sticky `<LocaleSwitcher />` 재사용 + SiteFooter
  `<LocaleSwitcher />` 재사용 = 동일 컴포넌트 1 곳 갱신 → 두 위치 자동 반영
  (ADR-0041 Amd 3 §Q10 옵션 A 양쪽 노출 보존).

### A1.3 — 결과 갱신

- ✅ 인지 부하 ↓ — 5 옵션 → 3 옵션 (헌법 §3 P2 Easy & Fast).
- ✅ 운영자 신호 직접 봉합 (2026-06-07 slim.lu prod 자가 진단).
- ⚠️ nl-BE/nl-NL 또는 fr-BE/fr-LU region variant URL 사용자 = ADR-0033 Amd 6 §A6.4
  301 redirect 로 보존 (LocaleSwitcher 영향 0 — switcher 는 새 prefix 만 발화).
- ⚠️ 페이즈 5 NL/LU 재신설 시 LocaleSwitcher 도 5 옵션 reverse 가능성 (ADR-0033
  Amd 6 §A6.5 트리거).

### A1.4 — 검증

- LocaleSwitcher 단위 테스트 갱신 — 3 옵션 렌더 확인 (5→3 회귀).
- Vercel 배포 URL `/` (nl 무프리픽스) footer + SiteHeader 둘 다 NL/FR/EN 3 링크
  노출 + `aria-current` 정합.
- a11y axe-core 0 violations 회귀 (nav aria-label 정합 유지).
- harness:i18n GREEN — LocaleSwitcher LOCALE_ENDONYMS 단일 출처 (한국어 0).
