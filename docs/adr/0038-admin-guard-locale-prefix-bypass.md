# ADR-0038: admin 가드 locale-prefix 우회 봉합 — 경로 매칭 일반화

## 상태
Proposed (2026-05-29, architect — 프로덕션 실측 취약점 진단)

## 맥락

PLAN **D.8** (Phase 0.5 운영 부채) 신설 항목과 연결된다.

`src/app/[locale]/admin/page.tsx` = 운영 메트릭 대시보드 (일별 비교 수, 월별
전환율, fetcher 24h 헬스). `dynamic='force-dynamic'` + robots noindex. 의도된
정책 = PLAN 4.5.1.a + ADR-0033 §A2.5 D2 — `ADMIN_TOKEN` 쿠키/쿼리 게이트.

그러나 `src/middleware.ts:183` 의 admin 가드 트리거 조건이
`pathname === '/admin' || pathname.startsWith('/admin/')` **뿐**이다.
next-intl `localePrefix: 'as-needed'` (routing.ts, locales =
`['nl-BE','nl-NL','fr-BE','fr-LU','en']`, defaultLocale = `nl-BE` 무프리픽스)
환경에서 prefixed 경로 `/en/admin`, `/nl-NL/admin`, `/fr-BE/admin`,
`/fr-LU/admin` 는 이 매칭에 걸리지 않아 가드를 **완전히 우회**하고 `[locale]/admin`
세그먼트로 라우팅되어 200 으로 공개된다.

**프로덕션 실측 (2026-05-29, 운영자)**:
- `https://slim.lu/admin` → 404 (가드 `adminDeny()` 평문 "Not Found")
- `https://slim.lu/en/admin` → **200** (토큰 없이 운영 메트릭 HTML 전체 노출 —
  신선도 비율 86.7% 등 실값 읽힘)
- `/nl-BE/admin` → 307 (as-needed 가 무프리픽스로 redirect)
- `/fr/admin` → 404 (`fr` 은 locale 아님 — `fr-BE`/`fr-LU` 만)

노출 데이터는 PII/시크릿이 아닌 B2B 집계 메트릭이나, **익명 공개는 정책 위반**이다
(PLAN 4.5.1.a "토큰 없으면 404"). 4개 공개 locale prefix 전부가 우회 경로다.

## 결정

admin 가드 트리거를 **"pathname 에서 알려진 locale prefix 를 1회 벗긴 정규화
경로(canonical path)가 `/admin` 또는 `/admin/*` 인가"** 로 일반화한다.

- prefix 집합은 `routing.locales` 에서 `defaultLocale` 제외 4개로 **도출**한다
  (하드코딩 금지 — ko-gate 주석 동일 원칙: middleware.ts §A2.5 D2 "단일 출처 =
  routing.ts").
- deny 시맨틱은 기존 404 (`adminDeny`) 유지 — "존재 자체를 숨김" 일관성.
- **쿠키 path = `/`** 로 변경 (현재 `/admin`). 이유는 §결과 참조.
- 쿠키 발급 후 clean-URL redirect 는 **원래 요청 경로(prefix 보존)** 로 한다 —
  `?token=` 만 제거. prefix 를 임의로 벗기면 next-intl as-needed 와 충돌.

의사코드 (builder 인계 명세, middleware.ts):

```
const PREFIXES = routing.locales
  .filter(l => l !== routing.defaultLocale)
  .map(l => `/${l}`);            // ['/nl-NL','/fr-BE','/fr-LU','/en']

function adminCanonical(pathname): string {
  for (const p of PREFIXES) {
    if (pathname === p || pathname.startsWith(p + '/')) {
      return pathname.slice(p.length) || '/';   // '/en/admin' → '/admin'
    }
  }
  return pathname;                                // 무프리픽스 = nl-BE = 그대로
}

function isAdminPath(pathname): boolean {
  const c = adminCanonical(pathname);
  return c === '/admin' || c.startsWith('/admin/');
}

// middleware():
if (isAdminPath(pathname)) {
  const r = handleAdmin(req);
  if (r !== null) return r;
  return intlMiddleware(req);
}
```

handleAdmin 의 쿠키 set 은 `path: '/admin'` → `path: '/'` 로만 변경하고 나머지
로직(constantTimeEqual, query→cookie redirect)은 불변.

## 대안

- **대안 A: matcher 정규식에 prefix 분기 추가** (config.matcher 에서 막기).
  장점: 미들웨어 본문 무변경. 단점: matcher 는 "이 경로에 미들웨어를 실행할지"만
  결정 — 이미 admin 경로는 매칭됨(공개로 흘러가는 게 문제). 분기 책임이 정규식에
  숨어 가독성/테스트성 악화. **거부**.
- **대안 B: page.tsx 안에서 서버 토큰 검사** (가드를 페이지로 이동).
  장점: 라우팅 무관 확실 차단. 단점: 정책 단일 출처(미들웨어) 분산 — 다른 admin
  하위 라우트 추가 시 누락 위험 + force-dynamic 렌더 비용 후 차단(404 대신 200+빈).
  **거부** — 가드는 엣지에서 끝나야 함.
- **대안 C (채택): 미들웨어 경로 정규화 일반화** — 위 결정.
- **쿠키 path 대안**: `path: '/admin'` 유지 + prefixed 경로마다 별도 발급.
  장점: 범위 최소. 단점: `/en/admin` 인증 → 쿠키 path `/admin` → `/en/admin`
  요청에 쿠키 미전송 → **매 요청 재인증 루프**. `path: '/'` 가 정답 — admin
  쿠키는 httpOnly+secure 이고 토큰 자체가 단일 시크릿이라 path 넓혀도 노출면
  증가 없음. **`path: '/'` 채택**.

## 결과

- 모든 locale prefix admin 경로(`/admin`, `/en/admin`, `/nl-NL/admin`,
  `/fr-BE/admin`, `/fr-LU/admin`) 가 토큰 없이 404.
- 쿠키 path `/` 로 prefixed 경로 재인증 루프 해소.
- **사이트 전체 fail-closed 위험 0** (2026-05-17 P0 비대칭 이해): admin 가드는
  `ADMIN_TOKEN` 미설정 시 `adminDeny()` (fail-closed) 이나 이는 **admin 경로에만
  국한** — ko-gate 처럼 공개 표면 전체가 아니다. 가드 매칭을 admin 경로로만
  확장하므로 공개 루트/`/compare`/locale 홈은 매칭에 안 걸려 intl 직접 위임 =
  무영향. **공개 표면 회귀 0 이 본 결정의 안전 핵심.**
- ⚠️ 무프리픽스 `/admin` 가드 통과 후 실제 렌더 경로(`[locale]/admin`, nl-BE)는
  실측 미검증 상태 — `/admin` 은 토큰 없이 404 라 통과 후 200 여부 미확인.
  builder DoD 에 "토큰 쿠키로 `/admin` 200 렌더" 포함 필수.

## 검증 방법

- `e2e/admin-guard.spec.ts` 확장 (기존 4건 → +음성 4 locale): 토큰 없이
  `/en/admin`·`/nl-NL/admin`·`/fr-BE/admin`·`/fr-LU/admin` 전부 404; 토큰 쿠키로
  각 경로 200; 쿠키 재진입 200 (루프 없음).
- 공개 회귀: `/`·`/compare/mobile`·`/en`·`/fr-BE` 200 유지 (가드 미적용 확인).
- 게이트: typecheck/lint/test:run/harness:plan/harness:data 0.
- 프로덕션 머지 후 운영자: `curl /en/admin` → 404 재실측.

## legal 검토 필요 여부

**불요 (1줄 의견)**: 노출 데이터는 PII 없는 B2B 집계 메트릭 — GDPR 개인정보 침해
아님. 다만 "익명 공개 차단"은 사업 비밀/정책 준수 사안이므로 보안 수정으로 충분,
legal 에이전트 호출 불필요.
