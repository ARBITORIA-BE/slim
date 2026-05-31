# ADR-0037: 공개 법적 페이지 (terms/privacy) + 쿠키 동의 배너 (ePrivacy opt-in) + PostHog 게이팅

## 상태
Accepted — 코드 (2026-05-31, PR #3/#12 머지: terms/privacy/CookieConsent/링크 정합 + 게이트 730 tests + legal 1차 검수 ko/en 본문 통과)
제안 (2026-05-23, architect — legal 1차 검수 발견 3 블로커 봉합 설계)

> nl/fr 본문 placeholder + 외부 변호사 검토 (€800) = **운영자 트랙 잔여** —
> 본 ADR 의 구조/항목/법적근거 매핑은 잠금. 본문 텍스트 4 locale 확정은
> DeepL Phase B + 베네룩스 변호사 1회 감사 후 별도 라운드 (헌법 §3 P3
> + ADR-0033 §T4 패턴).

> legal 1차 검수 (2026-05-31, PLAN 4.12.f):
> - 다크패턴 0 (Accept/Reject 시각적 동등, GBA Reject-all 원칙)
> - GDPR Art.13 12항목 충족 (gdpr-register.md PA-01~05 + 신설 PA-06 PostHog 쿠키 동의)
> - Art.6(1)(b) "동의 간주" 표현 4 locale 모두 정합 (ko/en/nl/fr)
> - PostHog 게이팅 = 동의 게이트 안 dynamic import (무동의 = 번들 로드 0)
> - PA-04 보안로그(정당이익) ↔ PA-06 분석쿠키(동의) 법적근거 분리

## 맥락

legal 에이전트 1차 검수(2026-05-23 세션)가 공개 전 🔴 법적 블로커 **3건**을 확인했다 (코드 grep 검증 완료):

1. **`/legal/terms` 페이지 부재 + 허위 동의** — `src/app/[locale]/compare/page.tsx:96-100` 가 `<Link href="/legal/terms">{t('termsLink')}</Link>` + "시작 시 이용약관에 동의 간주" 문구(`compare.termsNotice`/`termsLink`/`termsNoticeEnd`, `messages/ko.json:21-23`)를 노출한다. 그런데 `src/app/[locale]/legal/terms/` 라우트가 **없다** (Glob 검증: `legal/` 하위는 `affiliate-disclosure/` 만 존재). → 공개 랜딩에서 **404 링크 + 존재하지 않는 약관에 동의 간주** = 헌법 P3 위반 + UCPD 오인유발.

2. **개인정보처리방침 페이지 부재** — GDPR Art. 13/14. 비교 플로우가 우편번호/가구형태/현재공급사/사용량(`comparison_request`, ADR-0007)을 수집한다. 공개 사이트에 처리방침 링크/페이지가 **0** = Art. 13 정보제공 의무 위반. 처리활동은 `docs/legal/gdpr-register.md` (PA-01~PA-05) 에 이미 정리되어 있으나, **데이터 주체에게 노출되는 공개 단일 페이지가 없다**.

3. **쿠키 동의 배너 부재 + PostHog 미게이팅** — ePrivacy / 벨기에 e-Communications Act. `posthog-js@^1.180.0` 가 `package.json:55` 에 **의존성으로 설치**되어 있다. 단, 현 코드에는 `posthog.init()`/`posthog.capture()` 호출이 **0건** (grep 검증 — 주석/계획 참조만, `data-sources/page.tsx:594` 주석 + `go/.../confirm/route.ts:24` 주석). 즉 PostHog 는 **"패키지만 설치, 미배선"** 상태. PostHog 를 배선하는 순간 사전 동의 없는 분석 쿠키 설치 = 벨기에 GBA / 네덜란드 AP 단속 리스크. → **PostHog 배선은 동의 게이팅과 동시에만** 허용한다.

연결 PLAN 항목: **신규 4.12** (track 2 i18n 완성 + LocaleSwitcher envelope 에 묶음). 기존 track 2 = 4.5.j.4.B(메타데이터)/4.5.j.5(Zod·harness·고아)/4.10(footer 식별정보)/4.11(LocaleSwitcher) + ADR-0033/0035/0036.

### 기존 자산 (재조사 불필요, 본 ADR 의 단일 노출 대상)

- 데이터 컨트롤러 = `LEGAL_ENTITY` (`src/lib/legal.ts`): Kim Wonmin / 기업번호 1037548919 / VAT BE1037548919 / kim.wonmin91@gmail.com / address null.
- GDPR 처리활동: `docs/legal/gdpr-register.md` PA-01(비교요청)/PA-02(결과보존)/PA-03(어필리에이트클릭)/PA-04(보안로그=Sentry·PostHog)/PA-05(후속메일).
- 법적근거 ADR: ADR-0007 (comparison_request 최소화/90일·Art.6(1)(b)) · ADR-0026 (affiliate consent Art.6(1)(a)) · ADR-0028 (follow-up email consent Art.6(1)(a)).
- 제3자 데이터 흐름: 어필리에이트 리다이렉트(동의 후, GDPR상 transfer 아님 — PA-03) / PostHog(분석) / Inngest(cron) / Neon(DB, EU Frankfurt) / Vercel(호스팅) / Resend(follow-up, EU region).
- next-intl: 5 locale(nl-BE 기본/nl-NL/fr-BE/fr-LU/en) + ko 쿠키 오버레이. base(nl/fr/en)+region delta (`src/i18n/request.ts`). `legal.*` 네임스페이스 + `footer.*` 네임스페이스 기존 존재 (`messages/ko.json:306,316`).

## 결정

네 가지를 결정한다 (D1 terms / D2 privacy / D3 cookie consent + PostHog 게이팅 / D4 링크 정합).

### D1 — `/legal/terms` 페이지: RSC + `legal.terms.*` 네임스페이스

`src/app/[locale]/legal/terms/page.tsx` 신설 (affiliate-disclosure 동형 RSC — 동적 데이터 없음, revalidate 불필요).

- **내용 범위** (구조만 — 본문 텍스트 = legal 검수): 서비스 정의(베네룩스 통신 요금 비교, 정보 제공 only) / 비교 결과 면책(공급사 가격 그대로 표시, 가공 0 — 헌법 §8 #2 / 절약액 계산만) / 어필리에이트 관계 cross-ref(`/legal/affiliate-disclosure`) / 데이터 처리 cross-ref(`/legal/privacy`) / 책임 제한 / 준거법(벨기에) / 운영자 식별(`LEGAL_ENTITY` cross-ref = footer).
- **i18n**: `legal.terms.*` 네임스페이스 — **legal.* = legal 검수 게이트** (ADR-0033 §T4). nl/fr/en/ko 4 locale (region delta 상속). 본문 텍스트는 4.12.f legal 검수 후 채움.
- **메타데이터**: `generateMetadata` + `getTranslations` (ADR-0033 Amd5 패턴) — `@i18n-allow metadata` 마커 사용 금지 (신규 페이지는 처음부터 i18n).
- **"동의 간주" 문구 정합**: D4 참조 — compare 동의 문구가 실재하는 terms 를 가리키게 + 처리방침도 동시 링크.

근거: affiliate-disclosure 가 이미 `legal/` 하위 RSC 로 동형 존재 → 패턴 재사용. terms 본문은 규제 텍스트라 `legal.*` 네임스페이스(별도 legal 검수)로 격리 (오역=규제 리스크). 신규 페이지를 처음부터 4 locale i18n 으로 — `/legal/affiliate-disclosure`·`/data-sources` 의 한글 하드코딩+PHASE_B_ALLOWLIST 실수(track 2 가 해소 중) 반복 금지.

### D2 — `/legal/privacy` 페이지: RSC + `legal.privacy.*` + Art. 13/14 항목 전수 매핑

`src/app/[locale]/legal/privacy/page.tsx` 신설 (RSC 동형). gdpr-register.md(내부 Art.30 등록부)를 **데이터 주체용 공개 Art.13 통지**로 단일 노출.

**Art. 13 항목 체크리스트 → 기존 자산 매핑** (gdpr-info.eu/art-13 §1·§2 전수, 본문은 legal 검수):

| Art.13 항목 | 출처 | 비고 |
|---|---|---|
| §1(a) 컨트롤러 신원·연락처 | `LEGAL_ENTITY` (src/lib/legal.ts) | Kim Wonmin / 기업번호 / kim.wonmin91@gmail.com. 대리인 없음. |
| §1(b) DPO 연락처 | gdpr-register §컨트롤러 정보 | DPO 해당없음 (Art.37 — 소규모 솔로). |
| §1(c) 처리 목적 + 법적근거 | PA-01~PA-05 | 목적별 Art.6(1)(b)/(a)/(c)/(f) — 아래 §법적근거 매핑. |
| §1(d) 정당한 이익 (6(1)(f) 시) | PA-04 | 보안 로그 = 정당한 이익 (Sentry/PostHog). |
| §1(e) 수령자/카테고리 | PA-01~05 §수령자 | 비교/결과 = 없음. PA-04 = Sentry/PostHog(처리자). PA-05 = Resend. 어필리에이트 = transfer 아님(PA-03). |
| §1(f) 제3국 이전 | PA-01~05 §국외이전 | Neon EU Frankfurt / Resend EU region / Sentry US(SCCs 외부감사) / PostHog EU 옵션. |
| §2(a) 보존 기간 | PA-01~05 §보존기간 | request PII 90일 / result 영구 / 정산 7~10년(BE 회계) / email 발송후 NULL. |
| §2(b) 정보주체 권리 | PA-05 §데이터주체권리 + 6.4 GDPR도구 | 접근/정정/삭제/제한/이의/이동/철회 (Art.15-21). 행사 = kim.wonmin91@gmail.com (6.4 `/account` 도구 = 페이즈 6). |
| §2(c) 동의 철회권 (6(1)(a) 시) | PA-03/PA-05 | 어필리에이트 동의 철회 + follow-up 1-click unsubscribe + **쿠키 동의 철회(D3)**. |
| §2(d) 감독기관 민원권 | gdpr-register §컨트롤러 | BE: APD/GBA / NL: AP / LU: CNPD. |
| §2(e) 제공 의무 성격 | PA-01 | 비교 입력 = 서비스 제공에 필요(Art.6(1)(b)) — 미제공 시 비교 불가. |
| §2(f) 자동화 의사결정 | — | 비교 엔진 = 절약액 산술 계산. profiling/자동화 *결정* 없음(P1/§8 #4 알고리즘 순위 ≠ 개인 프로파일링) — 명시. |

- **Art. 14 (간접 수집)**: 현 비교 플로우는 데이터 주체로부터 직접 수집(Art.13) — 제3자로부터의 개인정보 수집 없음. 처리방침에 "직접 수집 only" 명시 → Art.14 비대상 확인.
- **i18n**: `legal.privacy.*` (legal 검수). nl/fr/en/ko 4 locale. 메타데이터 = generateMetadata + getTranslations.
- **단일 출처 원칙**: 처리방침은 gdpr-register.md 의 *공개 통지 뷰* — 등록부(내부 Art.30)와 통지(공개 Art.13)는 별개 문서이나 **사실 출처는 동일** (불일치 시 등록부가 SoT, 처리방침이 따라감). legal 검수가 양자 정합 확인.

근거: GDPR Art.13 은 "수집 *시점*" 정보제공 의무 — 단일 처리방침 페이지가 표준 충족 경로. gdpr-register.md 가 이미 PA-01~05 로 항목을 채워둬 **재조사 0** — 공개 뷰로 번역+노출만. 자동화 의사결정(§2f) 없음 명시는 P1/§8 #4(알고리즘 순위는 개인 프로파일링 아님)와 정합.

### D3 — 쿠키 동의 배너: ePrivacy opt-in + PostHog 로드 게이팅 (분석 쿠키 사전 차단)

ePrivacy / 벨기에 GBA = **비필수 쿠키(분석 포함)는 사전 동의(opt-in) 필수**. PostHog 분석 = 비필수 → 동의 *후* 로드.

**D3.1 — 동의 상태 저장**: `localStorage` 키 `slim_cookie_consent` (값: `'accepted'` | `'rejected'`, 또는 카테고리 객체 `{ analytics: boolean }`). 쿠키 대신 localStorage 채택 근거 = 동의 상태 자체는 서버 전송 불필요(클라이언트 게이팅만) + 헌법 §8 #1(서버 PII 최소) 정합 + 무동의 시 서버 쿠키 0(정적 렌더 회귀 0, request.ts ko 오버레이 패턴과 동형 — 무쿠키=공개 경로). **단 ko_gate_token 쿠키와 충돌 0 확인** (별도 키).

**D3.2 — PostHog 로드 게이팅 지점**: PostHog 는 현재 **미배선** (init 코드 0). 따라서 게이팅 = "기존 init 을 동의 뒤로 옮김"이 아니라 **"init 자체를 동의 게이트 안에서만 신설"**. 배선 지점 설계:
- 신규 `src/components/CookieConsent.tsx` (client) 가 동의 상태를 읽어 `analytics === true` 일 때만 `posthog.init(...)` 호출 (lazy — 동의 클릭 시 또는 이미 동의 상태로 마운트 시).
- `posthog.init` 옵션: `persistence` 는 동의 후에만 쿠키/localStorage 사용. 무동의 = init 호출 자체를 안 함 → 쿠키 0.
- **layout 배선**: `src/app/[locale]/layout.tsx` `<body>` 내(현 SiteFooter 인접) `<CookieConsent />` 1회. 배너는 동의/거부 미결 시에만 표시.
- **거부/철회 경로**: 거부 = `'rejected'` 저장 + PostHog init 안 함 + (이미 init 됐으면) `posthog.opt_out_capturing()` + 쿠키 정리. 철회 = 처리방침/footer 의 "쿠키 설정" 링크 → 배너 재호출 또는 설정 UI. **거부 버튼 = 1차 레이어에 Accept 와 동등 비중** (벨기에 GBA: "Reject all" 동등 노출 필수, 다크패턴 금지 — 헌법 §8 #3).

**D3.3 — 필수 vs 분석 구분**: 필수(strictly necessary) = 동의 불요 (예: ko_gate_token 운영자 게이트, 비교 세션 동작에 필요한 것). 분석(PostHog) = 동의 필요. 배너 카피가 이 구분 명시 + 처리방침 cross-ref.

**D3.4 — i18n**: `legal.cookie.*` 네임스페이스 (동의 카피 = 규제 텍스트 → legal 검수). nl/fr/en/ko 4 locale. 배너는 client 컴포넌트 → `useTranslations('legal.cookie' 또는 cookie.*)`. **주의**: client island → `harness:i18n` 확장 스캔(4.5.j.5.b `src/components/**`) 대상 = 한글 하드코딩 0 강제.

근거: PostHog 가 *미배선*이라 "동의 게이팅을 나중에 끼우는" 부채가 없다 — 처음부터 동의 게이트 안에서만 init 하면 ePrivacy opt-in 을 구조적으로 보장(fail-safe). localStorage 동의 저장은 무동의 정적 렌더 회귀 0(헌법 P2)을 ko 오버레이와 동형으로 유지. 거부 동등 비중 + 다크패턴 0 은 벨기에 GBA 가이드 + 헌법 §8 #3 직접 강제.

### D4 — 링크 정합: compare 동의 문구 404 해소 + privacy 링크 + footer 링크

- **compare 동의 문구** (`compare/page.tsx:95-101`): 현 `termsNotice`/`termsLink`(→`/legal/terms`)/`termsNoticeEnd`. terms 페이지 신설(D1)로 **404 해소**. 추가로 **처리방침 링크** 동반 노출 — `compare.privacyLink`(→`/legal/privacy`) 신규 키 + 문구 조정("이용약관 및 개인정보처리방침에 동의 간주"). 동의 간주 법적근거 표현(Art.6(1)(b))은 legal 검수.
- **SiteFooter** (`src/components/SiteFooter.tsx:82-99` 법무 nav): 현 affiliate-disclosure + data-sources 2 링크. **terms + privacy 2 링크 추가** + (D3 철회 경로) "쿠키 설정" 링크/버튼. `footer.termsLink`/`footer.privacyLink`/`footer.cookieSettingsLink` 신규 키. footer 본문 RSC 유지 — 쿠키 설정 버튼만 client(D3 컴포넌트 트리거).

근거: 동의 문구가 실재 페이지를 가리켜야 P3 정합. footer = CDE Art.XII.6 상시 접근 표면(ADR-0035) → terms/privacy 도 상시 접근이 자연스럽다(footer 가 이미 전역 배선됨, layout.tsx:79).

## 대안

### ADR 배치 (신규 0037 vs 0036 확장 vs GDPR ADR Amendment)
- **대안 A — ADR-0036 확장**: i18n 봉합 ADR 에 흡수. 단점: 0036 = "i18n 누출 봉합 3종"(Zod/harness/LocaleSwitcher) — 도메인이 *i18n 인프라*. terms/privacy/cookie 는 *법적 표면 신설 + ePrivacy*. 혼합 시 단일 출처 흐림. **거부**.
- **대안 B — GDPR ADR(0007/0026/0028) Amendment**: 데이터 스키마 ADR 에 분산. 단점: 처리방침 *공개 페이지*는 스키마 결정이 아니라 *통지 표면* — 3개 ADR 에 쪼개면 단일 노출 출처가 없어짐(정확히 본 ADR 이 해소하려는 문제). **거부**.
- **대안 C (채택) — 신규 ADR-0037**: 법적 공개 표면 + ePrivacy 를 1 ADR 로. GDPR ADR 들은 §맥락 cross-ref(데이터 출처), gdpr-register.md 가 항목 SoT. 도메인 분리 + 단일 노출.

### 쿠키 동의 저장 (D3.1)
- **대안 — 서버 쿠키**: 동의 상태를 httpOnly 쿠키로. 단점: 무동의 요청에도 Set-Cookie 발생 가능(정적 렌더 회귀) + 서버가 동의 상태를 알 필요 없음(게이팅은 클라이언트). **거부 — localStorage**.

### PostHog 게이팅 (D3.2)
- **대안 — init 항상 + opt-out 기본**: PostHog 를 항상 init 하되 기본 opt-out. 단점: init 자체가 일부 쿠키/요청 유발 가능 → ePrivacy "사전" 위반 리스크. **거부 — 동의 전 init 호출 0** (fail-safe).

### 동의 배너 도구 (D3 전반)
- **대안 — CookieBot/외부 SaaS** (PLAN 6.5 원안): 외부 동의 관리 플랫폼. 단점: €300 cap + 외부 스크립트 자체가 추적/쿠키 + vendor lock-in. **거부 — 자체 최소 구현** (PostHog 1개만 게이팅 = 복잡도 낮음). PLAN 6.5 는 본 4.12 로 선반영 + 6.5 는 cross-ref/축소.

## 결과

- ✅ 공개 랜딩 404 동의 링크 해소 + 실재 terms 페이지 (D1) — 허위 동의 제거.
- ✅ GDPR Art.13 공개 처리방침 (D2) — gdpr-register 단일 노출, 재조사 0.
- ✅ ePrivacy opt-in 구조 보장 — PostHog 미배선 상태에서 처음부터 동의 게이트 안 init (D3) = fail-safe.
- ✅ 신규 페이지 4 locale i18n 처음부터 — 한글 하드코딩+allowlist 부채 반복 0.
- ⚠️ `legal.terms.*`/`legal.privacy.*`/`legal.cookie.*` 신규 네임스페이스 = legal 검수 게이트 통과 전까지 본문 미확정 (placeholder → legal 검수 후 채움).
- ⚠️ CookieConsent = footer 외 두 번째 client island (헌법 P2 — 배너만 client, 본문 RSC 유지).
- ⚠️ PostHog 실 init 옵션(api key/host/EU region)은 운영자 env(`NEXT_PUBLIC_POSTHOG_KEY`/`_HOST`) 트랙 — 키 없으면 게이팅된 채 no-op(fail-safe).
- ⚠️ 등록 주소 null(ADR-0035) → 처리방침 컨트롤러 주소 줄도 조건부 비노출(LEGAL_ENTITY 동형). 운영자 주소 수령 시 1줄.
- ⚠️ Sentry US 이전 SCCs / PostHog DPA = gdpr-register 외부감사 항목 6 (베타 직전/수익후) — 처리방침은 "EU 옵션/SCCs" 표기, 외부감사가 확정.

## 검증 방법

- `pnpm typecheck`/`lint`/`test:run` 0.
- `pnpm harness:i18n` 확장(4.5.j.5.b) GREEN — `src/components/CookieConsent.tsx` + legal/terms·privacy 페이지 한글 0(legal.* 본문 화이트리스트 정책 정합).
- `pnpm harness:plan` 합계 정합 (4.12 +1 → 90→91).
- Vercel 배포 URL `/legal/terms` + `/legal/privacy` 200 (4 locale, 한글 0 — legal 검수 후).
- Vercel `/compare` 동의 문구의 terms/privacy 링크 → 200 (404 0).
- 무동의 상태에서 PostHog 쿠키 0 (DevTools Application 탭) — 동의 클릭 후에만 PostHog 쿠키/요청 발생.
- 거부 클릭 → PostHog init 0 + 쿠키 0. 철회(쿠키 설정) → opt_out + 쿠키 정리.
- legal 에이전트 검수: terms/privacy/cookie 본문 Critical/Major 0 + Art.13 12항목 충족 + 거부 동등 비중 + 다크패턴 0.
