# Changelog — Slim

이 파일은 Slim의 모든 변경사항을 기록합니다.
한 줄 한 줄이 사용자가 신뢰할 근거입니다.

형식: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) + [Semantic Versioning 2.0](https://semver.org/)

---

## [Unreleased]

### Added

- Phase 3.5 — **3.5.1.b' first-load JS budget 확정 — per-route 2-tier** (ADR-0023 §Amendment 1):
  - 실측(`harness:perf`, 커밋 `29baf6e`): postal 161.5KB, /·/compare·/r/[shortId] ~100KB → 단일 임계값 무의미 판단.
  - `light` 120/140 KB · `form` 170/200 KB (advisory/hard). 산식 = light 평균×1.10/×1.30, form 최대×1.05/×1.20, 10KB ceil(`ceilToTen`).
  - route→tier: form = postal/household/current-provider/bill/preview, light = 그 외. PLAN 정정: `/r/[shortId]` form→light (무게 기준, 의미론 아님).
  - SEO 카테고리 게이트에서 `/r/[shortId]` 제외 — ADR-0021 §T9 `noindex` 의 의도된 부수효과(SEO 63).
  - `scripts/harness/perf-budget.ts`: `ceilToTen`/`routeTier`/`JS_BUDGET`/`isSeoExempt` export, first-load JS 가 advisory-only → tier 기반 hard/soft 게이트.
  - 검증: typecheck 0 / lint 0 / **249 unit tests** (perf-budget 81, 회귀 0) / `pnpm build && pnpm harness:perf` advisory 위반 0건.
  - 커밋: 결정 + 코드 = `c6e8093` (`docs(adr): ADR-0023 Amendment 1 — first-load JS budget`).

- Phase 3.5 — **3.5.1.c axe 커버리지 보강** (ADR-0023 §T2):
  - `e2e/accessibility.spec.ts`: 페이즈 3 신규 axe 케이스 — `/r/[shortId]` 실 shortId(`/api/compare` POST 로 획득)에 0 violations 추가. `/compare/mobile/preview` 는 마운트 즉시 sessionStorage→`/api/compare`→`/r/[shortId]` redirect 라 axe 실행 불가 → `test.skip(true, ...)` (접근성은 `/r/[shortId]` 가 커버). axe 검증 페이지 6→8 케이스(7 active + 1 skip). `/compare/[category]/{postal,household,current-provider,bill}` 4단계는 페이즈 2 부터 이미 포함돼 있었음(직접 URL 진입 가능 — `'use client'` + 빈 sessionStorage emptyState 렌더).
  - `scripts/harness/perf-budget.ts`: 측정 4페이지에 `@axe-core/playwright` violations 를 advisory 컬럼으로 동반 출력(`AxeBuilder`, `formatAxeCell`, `PageMetrics.axeViolations`). **비-게이트** — violations>0 여도 exit code 영향 X(진짜 게이트는 `accessibility.spec.ts`). `computeExitCode` 무변동. 새 dep 0(`@axe-core/playwright` 기존 devDep).
  - 검증: typecheck 0 / lint 0 / **253 unit tests** (perf-budget 85, `formatAxeCell` 4 케이스 신규) / **`pnpm test:e2e` 25 passed / 5 skipped / 0 failed** (axe 전부 0 violations).
  - 커밋: `98db938` (`feat(plan-3.5.1.c): axe 커버리지 보강 — 페이즈 3 라우트 + perf-budget axe advisory`).

- Phase 3.5 — **3.5.1.d `/ship` 통합 + 3.5.1 완료** (ADR-0023 §T6):
  - `.claude/commands/ship.md` 코드 품질 섹션에 `pnpm harness:perf` 체크박스 추가 — `next build && pnpm start` 선행 필수, LCP/TBT/first-load JS hard + Lighthouse Perf/Acc 점수 advisory, ADR-0023 §T5(CI 머지 차단 X — `/ship` advisory) 명시.
  - `PLAN.md` "Phase 3 검증" 라인 → `harness:perf` 실행 근거로 갱신 (Lighthouse Perf/Acc soft + LCP/TBT hard + first-load JS per-route 2-tier; BP/SEO 는 표시만, SEO 는 `/r/[shortId]` noindex 제외). harness:e2e→harness:perf 정정 + ADR-0023 cross-ref 는 3.5.1 본문·sub-task 들에 이미 반영. ci.yml 무변동(§T5).
  - **3.5.1 본 항목 [x]** — sub-task a/b/c/d 통과. 3.5.1.e(next-build-출력 4페이지 실측 편입)는 비차단 백로그로 잔존. 합계 44→45.
  - 검증: typecheck 0 / lint 0 / harness:plan 82 항목 정합 / harness:data 통과. (코드 무변동 — 253 unit tests 유지.)
  - 커밋: `7f6e66f` (`feat(plan-3.5.1.d): /ship 에 harness:perf 통합 + 3.5.1 완료`).

- Phase 3.5 — **3.5.2 SEO 메타 / sitemap.xml / robots.txt** (베타 시드 — ADR 없음, architect 판정):
  - 색인 대상 라우트(`/`, `/compare`, `/compare/[category]` 알려진 카테고리, `/data-sources`, `/legal/affiliate-disclosure`) 메타 정의 + 정적 sitemap.xml 생성 + robots.txt 규칙 정의. 색인 금지 라우트(`/r/[shortId]`, `/compare/[category]/{postal,household,current-provider,bill,preview}` 입력 폼) noindex 명시.
  - **3.5.2.a** 루트 메타 기반 — `src/lib/site.ts` 신설 (`SITE_ORIGIN='https://slim.lu'` 단일 상수). `src/app/layout.tsx` — `metadataBase: new URL(SITE_ORIGIN)` + `openGraph`(type:website / locale:ko_KR / siteName:Slim) + `twitter`(card:summary_large_image) + title template (`%s · Slim`). og:image 미설정(ADR-0021 §T8 페이즈 4 ADR-OG 이연).
  - **3.5.2.b** 색인 대상 라우트별 메타 — `/`, `/compare`, `/data-sources`, `/legal/affiliate-disclosure` 각각 고유 title/description/canonical. `/compare/[category]` generateMetadata 동적 구현 (알려진 카테고리만 canonical, 미지원 → robots noindex).
  - **3.5.2.c** 색인 금지 라우트 명시 — `/compare/[category]/{postal,household,bill,preview}` 각각 layout.tsx 신설 (robots noindex). `/compare/[category]/current-provider` page.tsx 직접 메타 추가. `/r/[shortId]` 기존 generateMetadata 무변동(ADR-0021 §T8 유지).
  - **3.5.2.d** sitemap.ts / robots.ts — `src/app/sitemap.ts` 신설 (6 URL: / + /compare + /compare/{mobile,internet_fixed} + /data-sources + /legal/affiliate-disclosure, /r/ 부재). `src/app/robots.ts` 신설 (Disallow: /r/ + /compare/*/postal·household·current-provider·bill·preview + /api/; Sitemap 라인).
  - **3.5.2.e** e2e SEO 스모크 — `e2e/seo-meta.spec.ts` 신설 (11 케이스): 색인 대상 4개 canonical 존재·noindex 부재 + 색인 금지 6개 noindex 존재 / /sitemap.xml 200+XML+/r/ 부재 / /robots.txt 200+Sitemap:+Disallow:/r/. `e2e/landing.spec.ts` strict 회귀 수정.
  - 범위 밖: 동적 og:image(페이즈 4 ADR-OG) / JSON-LD / hreflang.
  - 검증: typecheck 0 / lint 0 / **253 unit tests** (회귀 0) / **`pnpm test:e2e` 37 passed / 5 skipped / 0 failed** (seo-meta 11 신규) / harness:plan 82 항목 정합 / harness:data 통과. PLAN 45→46.
  - **3.5.2 본 항목 [x]** — sub-task a/b/c/d/e 통과.
  - 커밋: `<배포 후 채움>`.

- Phase 3.5 — **3.5.1.b 성능 하네스 임계값 게이트** (ADR-0023 §T4/§T5 구현):
  - `scripts/harness/perf-budget.ts` 확장 — hard 임계값 (LCP ≤ 2.5s + TBT ≤ 200ms, exit 1) / soft 임계값 (Performance ≥ 90 + Accessibility ≥ 95, warn) / advisory only (first-load JS ≤ ~130 KB gz, dev 빌드 감지 시 보류). 측정 실패/서버 미가동/hard 위반 exit code 우선순위 명시.
  - `scripts/harness/perf-budget.test.ts` 확장 — **38 unit tests** (경계값 ≤/≥ 케이스 + exit code 우선순위 + advisory-only 검증).
  - 함수 export (`evaluateMetric` / `computeExitCode` / 임계값 상수) → 테스트 직접 import (단일 진실 원천) / `require.main === module` 가드로 vitest import 시 main() 미실행.
  - 근거: ADR-0023 (§T4 hard/soft 임계값 / §T5 CI 머지 차단 X — 로컬 + `/ship` + 페이즈 종료 advisory, ADR-0002 Amendment 1 flaky→noise 교훈 정합).
  - 검증: typecheck 0 / lint 0 / **206 unit tests** (회귀 0, 신규 22 케이스) / harness:plan 82 항목 / harness:data 통과.

- Phase 3.5 — **3.5.1.a 성능 하네스 설정** (ADR-0023 측정 기반 구축):
  - `scripts/harness/perf-budget.ts` 신설 — Playwright 헤드리스 Chromium 에 Lighthouse CDP 연결, mobile 프리셋으로 대표 4 페이지(`/`, `/compare`, `/compare/[category]/postal`, `/r/[shortId]`) 측정. LCP/TBT + Performance/Accessibility/BestPractices/SEO 점수 표 출력.
  - `package.json` `harness:perf` 스크립트 신설 + `lighthouse` ^12.8.2 devDependency 추가 (1건).
  - `scripts/harness/perf-budget.test.ts` 신설 (16 unit tests — 임계값 판정 + 메트릭 추출 순수 함수).
  - `vitest.config.ts` — `scripts/**` 를 node 환경으로 포함.
  - 가드: `next build && next start` (또는 `E2E_BASE_URL`) 대상. shortId 시드 부재 시 `/r/[shortId]` skip+warn (게이트 실패 아님). 서버 미가동 시 가드 메시지 + exit 2.
  - 근거: ADR-0023 (Lighthouse/axe-core 자동화 하네스, Accepted 2026-05-11). 후속 sub-task (3.5.1.b 임계값 게이트/3.5.1.c axe 커버리지/3.5.1.d `/ship` 통합)는 별도.
  - 검증: typecheck 0 / lint 0 / **168 unit tests** (회귀 0) / `pnpm harness:perf` 가드 메시지 정상 (exit 2, 서버 미가동) / 4 페이지 측정 일치.

- Phase 3 — **ADR-0021 §T9 Amendment 1: 인쇄 친화 뷰(`@media print`) 페이즈 6 → 페이즈 3 환원** (옵션 D 철회):
  - 근거: 페이즈 3 결과 페이지가 이미 풀 구현(`ResultConclusionCard`/`ComparisonTable`/`CalculationDetails`/`ExcludedProvidersSection`/`ComparisonControls`)됐고 Tailwind 4 `print:` variant 내장이라 "큰 작업" 추정이 과대평가 — 지금 하면 1라운드, 페이즈 6까지 미루면 컴포넌트 재학습 비용 + 충돌 위험. 추가로, 인쇄/PDF 사본에 `source_url`/`fetched_at`/어필리에이트 디스클로저가 안 보이면 P1/P3 위반인데 기본 브라우저 인쇄로는 그 품질 보장 불가 → 옵션 D 유지 = P1/P3 리스크를 페이즈 6까지 안고 감.
  - 접근: 단일 `@media print` 블록(`src/app/globals.css`) + 컴포넌트 단위 Tailwind `print:hidden`/`print:block` — 새 라우트·새 dep·DB 변동 0. 별도 `/r/[shortId]/print` 라우트(영구 링크 단일성 위반)·paged.js류 라이브러리(새 dep)·별도 ADR-PRINT(ADR 인플레이션) 모두 거부 — Amendment 가 ADR-PRINT 자리를 대체.
  - PLAN 3.7: "옵션 D / 페이즈 6 이연" → "Amendment 1 페이즈 3 환원" + DoD(print 모드 chrome/컨트롤/disabled CTA 비노출 + P1/P3 요소 노출 유지 + `<details>` 펼침 + 외부 링크 href 텍스트화 + `break-inside: avoid` + harness:perf 회귀 0 + print axe 0) + sub-task a(print CSS 골격)/b(컴포넌트 `print:` 클래스, 신설 0)/c(`e2e/result-page-print.spec.ts` 신설).
  - **3.7 구현 완료 (2026-05-11)** — `src/app/globals.css` `@media print { }` 블록(`.print-hide` 유틸 + `tr`/`details` `break-inside:avoid` + `a[href^="http"]::after` URL 노출 + `.print-hide a::after{content:none}` 노이즈 차단 + `details > *:not(summary){display:block!important}` 펼침 + 신뢰도 배지 색상 폴백; **화면 CSS 무변동** — P2 LCP 격리). 컴포넌트: `src/app/r/[shortId]/page.tsx`(nav CTA `print:hidden` + `<footer>` 어필리에이트 디스클로저 줄 신설) / `ComparisonControls`(루트 `print:hidden`) / `ResultConclusionCard`(disabled "변경하기" CTA `print:hidden` + 신뢰도 배지 `print:border-current` neutral 폴백) / `ComparisonTable`(desktop `<table>` `print:block` + mobile 카드 stack `print:hidden` + 배지 `print:border-current`). `ExcludedProvidersSection`/`CalculationDetails` 변경 0. 신설 `e2e/result-page-print.spec.ts` — `page.emulateMedia({media:'print'})` 후 무조건 케이스(숨김 요소 부재 / 빈상태 P1·P3 노출 — h1·영구 ID·`/data-sources`·`/legal/affiliate-disclosure`·90일 배너 print visible / axe 0 violations / 스크린샷) + 풀-결과-경로 전용 케이스 4개는 별도 describe `test.skip` (시드 스텁 fetcher `confidence='low'` → 후보 0건이 정상 → 결론 카드·비교 표·`CalculationDetails` 미렌더; `confidence='high'` 시드 도입 시 활성). `harness:perf`(LCP 회귀)는 3.5.1 미구현이라 globals.css diff 로 `@media print{}` 바깥 변경 0 확인으로 갈음.
  - 검증: typecheck 0 / lint 0 / **168 unit tests** (회귀 0) / **`pnpm test:e2e` 24 passed / 4 skipped / 0 failed** / harness:plan 82 항목 (3.7 + 3.7.a/b/c `[x]`, 페이즈 3 7/7 종료, 합계 43→44) / harness:data 통과. PLAN 작업추적 표·prologue·scope cut 옵션 D 표기 정합화. ADR-0021 §Status 격상 이력 + `docs/adr/INDEX.md` 반영.
  - ADR-0021 §Status 격상 이력 + `docs/adr/INDEX.md` 표·본문 반영. (페이즈 3 작업추적 표 합계 7 유지 — 3.7은 [ ] 그대로, 환원만.)
- Phase 3.5 — **3.5.1 설계 완료 + ADR-0023 발행** (Lighthouse / axe-core 자동화):
  - **`docs/adr/0023-lighthouse-axe-perf-harness.md` 신설 — Accepted (2026-05-11, GATE-P 승인)**. 6 결정(T1~T6): (T1) 러너 = `lighthouse` 프로그래매틱 Node API + Playwright Chromium CDP 연결(devDep 1건, 새 브라우저 0; `@lhci/cli`/`unlighthouse`/`playwright-lighthouse` 거부) (T2) **`pnpm harness:perf` 신설**(`harness:e2e`는 P2 walltime 스모크라 관심사 다름 — PLAN 원문 "harness:e2e 통합"을 본 ADR이 정정; `harness:all` 무변동) (T3) 측정 4페이지(`/`, `/compare`, `/compare/[category]/postal`, `/r/[shortId]`) (T4) hard = LCP ≤ 2.5s + TBT ≤ 200ms(헌법 P2, exit 1) / soft = Perf ≥ 90 + a11y ≥ 95(warn) / first-load JS advisory (T5) **CI 머지 차단 X** — 로컬 + `/ship` + 페이즈 종료 advisory(ADR-0002 Amendment 1의 flaky→noise 교훈) (T6) PLAN 3.5.1 = 4 sub-task. 외부 의존성 1건(`lighthouse`, GATE-C amend), 새 SaaS 0, 마이그레이션 0, ci.yml 변경 0.
  - **PLAN 3.5.1 분해** — 1줄 stub → DoD + sub-task a(러너+`scripts/harness/perf-budget.ts`+`package.json` 스크립트)/b(임계값 게이트+단위 테스트)/c(`e2e/accessibility.spec.ts` 페이지 6→~11 커버리지 보강)/d(`/ship` 통합). 구현은 페이즈 3.5 진입(M7 말) builder 트리거 — 본 커밋은 설계 잠금만.
  - **ADR 번호 재지정** — "가칭 ADR-0023 = Neon-side Vercel Integration"(ADR-0020 §결정 6 / PLAN §D.3.e / ADR-0022 §작성 메모)이 ADR-0022 소비(0022)에 이어 ADR-0023(Lighthouse 하네스)도 소비 → **Neon Vercel Integration = 가칭 ADR-0024**. PLAN §D.3.e + `docs/adr/INDEX.md` 반영. (ADR-0020.md / ADR-0022.md 본문의 누적 forward-ref 드리프트는 별도 scribe 정리 패스 — 비차단.)
  - **`scripts/harness/verify-plan.ts` CRLF 안전화** — `text.split('\n')` → `text.split(/\r?\n/)`. Windows 체크아웃(`core.autocrlf=true`)에서 PLAN.md가 CRLF면 줄 끝 `\r` 때문에 `(.+)$` 정규식이 안 맞아 "0개 항목 파싱"으로 `pnpm harness:plan` 게이트가 깨지던 버그(fresh clone에서 재현 가능). 발견 경위: architect 서브에이전트가 `Edit` 도구 부재로 PLAN.md를 `Write`로 클로버 → `git checkout -- PLAN.md` 복구 시 CRLF로 복원되며 노출. PLAN.md는 LF로 재정규화(레포 컨벤션).
  - 검증: typecheck 0 / lint 0 / **168 tests passed** (회귀 0) / harness:plan 82 항목 통과 / harness:data 통과.
- Phase 0.5 — **D.4 완료** (DB 환경 분리 정책, ADR-0022) — D.4.b/d/e 운영자 작업 후속 반영:
  - **`development` Neon 브랜치 = `ep-noisy-meadow-aliaxayq`** (parent=production, Frankfurt eu-central-1). Neon Console 확인 시 production[Default]/development/preview 3 브랜치 이미 존재 → D.4.b 신규 생성 불필요.
  - **`.env.local.example` — `ep-dev-XXXX` 자리표시자 → 실 endpoint ID `ep-noisy-meadow-aliaxayq` 반영** + `DATABASE_URL` 예시 host 를 실제 형식(`...-pooler.c-3.eu-central-1.aws.neon.tech`)으로 + "값은 endpoint ID 만 — verify-db.ts 가 `^(ep-[a-z0-9-]+?)(-pooler)?\.` 로 `-pooler`/region 꼬리 떼고 첫 토큰 비교, pooled/direct 동일 ID" 주석 추가.
  - **운영자 D.4.d** — 로컬 `.env.local`: `DATABASE_URL`=development pooled string, `EXPECTED_DB_ENDPOINTS=ep-fancy-fog-alt18340,ep-autumn-water-all6d93e,ep-noisy-meadow-aliaxayq`. `pnpm verify:db` all-green (allowlist 매칭 / 6 tables / seed 2 rows).
  - **운영자 D.4.e** — Vercel production env `EXPECTED_DB_ENDPOINTS=ep-fancy-fog-alt18340`, preview env `=ep-autumn-water-all6d93e` (각 단일, non-sensitive). D.3.c의 나머지 2 키(`INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY`)는 GATE-K(페이즈 4 베타) 직전 Inngest 셋업과 함께 처리.
  - PLAN: D.4 + D.4.b/c/d/e → `[x]`, D.4.a 기 완료. 페이즈 0.5 합계 1→2, 전체 42→43. DoD 4항 충족(ADR / dev 브랜치+verify:db / .env.local prod host 0건 / `pnpm dev`는 dev만).
- Phase 0.5 — D.1 마무리 (코드 잔여) + D.4.c (ADR-0022 코드 인계):
  - **`.github/workflows/ci.yml` 인코딩 정리** — 파일 선두 UTF-8 BOM 제거(EF BB BF), 깨진 em-dash 스텝명 `Harness ??plan integrity` / `Harness ??data fidelity` → `Harness - plan integrity` / `Harness - data fidelity` 로 교정, ADR-0002(+Amendment 1) 주석 추가. 4단 게이트(typecheck → test → harness:plan → harness:data) 구성 자체는 불변.
  - **D.1 DoD #1 검증** — `pnpm build` 로컬 통과, 빌드 로그에 `Skipping validation of types` / `Skipping linting` 확인 → `next.config.ts:12-13` 의 `ignoreBuildErrors`/`ignoreDuringBuilds` 활성 (검증 권한 = 로컬 stop-gate + GitHub Actions, ADR-0002). PLAN D.1.a/b/d → `[x]`. 잔여(D.1.c GitHub 브랜치 보호, DoD #2 Vercel preview, DoD #3 음성테스트 PR `test/build-gate-negative`)는 운영자 작업.
  - **`.env.local.example` 신설** (ADR-0022 D.4.c) — `DATABASE_URL` 기본값 = Neon `development` 브랜치(자리표시자 `ep-dev-XXXX`), `EXPECTED_DB_ENDPOINTS` 3-endpoint 콤마 allowlist 주석(production/preview/development), production 작업용 인라인 `$env:DATABASE_URL=...` 메모(ADR-0022 D4 — `.env.local` 에 prod string 영속 저장 금지). `.gitignore` 는 `.env.local` 만 무시 → `.env.local.example` 은 정상 커밋. `scripts/verify-db.ts` 는 이미 `EXPECTED_DB_ENDPOINTS` 콤마 allowlist 지원(`L66-72`) — 코드 변경 불필요 확인. PLAN D.4.c → `[x]`.
  - **`docs/runbook.md` §5.3 동기화** — `.env.local` 복구 절차를 ADR-0022 정책에 맞춰 갱신 (`.env.local.example` 템플릿 사용, DATABASE_URL 기본 = development, prod string Console-only, `EXPECTED_DB_ENDPOINTS` 복수형).
  - 검증: typecheck 0 / lint 0 / **168 tests passed** (회귀 0) / harness:plan 82 항목 통과 (top-level 완료 수 불변 — D.1·D.4 전체는 운영자 잔여로 `[ ]` 유지) / harness:data 통과 / `next build` 통과.
- Phase 3 — e2e 재검증 통과 + 시드 스크립트 버그 픽스 (마이그레이션 0004 dev 브랜치 적용 후 운영자 액션 완료):
  - **`scripts/seed-stub-tariffs.mts` → `scripts/seed-stub-tariffs.ts` 이름 변경 + `main()` 비동기 래퍼.** `.mts` 는 tsx (esbuild) 의 ESM 로더가 tsconfig `@/*` path alias 를 모듈 잡에서 못 풀어 `SyntaxError: ... does not provide an export named 'persistFetchResult'` 로 실행 불가였음 (이전 세션이 실제로 돌려본 적 없었던 듯). `.ts` 는 tsx 가 CJS 로 변환 → alias 정상, 단 top-level await 불가 → `main().catch()` 래퍼 (`scripts/verify-db.ts` 동형). `eslint.config.mjs` 의 `.mts`/`.cts` 오버라이드는 무해한 leftover 로 유지 (향후 `.mts`/`.cts` 스크립트 대비).
  - **`src/app/r/[shortId]/page.tsx` — "비교 후보가 없습니다" 빈 상태 `<article>` 에 `aria-labelledby` 추가** (h2 에 id 부여). 결론 카드(`ResultConclusionCard`)는 이미 labeled landmark 였으나 빈 상태 article 은 accessible name 이 없어 `e2e/result-page.spec.ts` 의 `getByRole('article', { name: /\S+/ })` 가 매치 못 했음. 스텁 fetcher 는 의도적으로 `confidence='low'` (P1 정직성, `src/fetchers/confidence.ts` + `proximus.test.ts` 강제) → `getCandidateSnapshots` 가 'low' 제외 (ADR-0006 §T5/§T7) → 시드 데이터로는 비교 후보 0건이 정상 동작 → 빈 상태 경로가 e2e 가 검증하는 경로. test 의 의도(0건 케이스 수용)와 정합되도록 컴포넌트 측 a11y 보강.
  - **운영자 액션 완료** — `pnpm verify:db` (endpoint 가드 통과: `ep-fancy-fog-alt18340`, allowlist 매칭) → `pnpm db:push` (마이그레이션 0004 의 3 컬럼 적용, dev 브랜치) → `pnpm exec tsx --env-file=.env.local scripts/seed-stub-tariffs.ts` (8 tariff 시드) → `pnpm test:e2e` **19/19 통과**. production 브랜치 적용은 별도 (`.env.local` 을 prod 로 전환 후 동일 절차).
  - 검증: typecheck 0 / lint 0 / **168 tests passed** (회귀 0) / harness:plan·data 통과 / **e2e 19/19**.
- Phase 3 라운드 (d) — 계산 근거 펼치기 풀 (PLAN 3.5, [ADR-0021](docs/adr/0021-phase-3-results-page-design.md) §T7 + §T5 계산 근거 컬럼):
  - **`src/app/r/[shortId]/_lib/caveat-triggers.ts` 신설** — 순수 `deriveCaveatTriggers`. `deriveCaveats()` (src/engine/caveats.ts) 가 한국어 caveat 텍스트만 출력해 "왜 떴는지" 를 노출 못 하므로, 저장된 스냅샷 데이터(commitmentMonths / activationFeeCents / promoMonths·promoPriceCents / attributes.data_gb / eu_roaming_included / download_mbps / confidence) + lockedInputs 의 usageProfile 로 deriveCaveats 규칙 1~7 을 거울 평가 → 트리거/미트리거 근거 행 (`CaveatTriggerRow` = condition + triggered + note). 규칙 8(현재 요금제 신뢰도)은 baseline confidence 가 별도 컬럼 미저장(caveats 배열로만 보존)이라 생략 — flat caveats 리스트가 이미 노출. `+26 unit tests` (`caveat-triggers.test.ts` — 각 규칙 경계 + 카테고리별 행 포함/제외 + 입력 변형 X + 결정성).
  - **`src/app/r/[shortId]/_components/CalculationDetails.tsx` 확장** — "주의사항 트리거 조건" 섹션 추가 (`triggerRows` prop — 트리거 dot + condition + note 리스트, undefined 시 비노출) + `inputsAbsent` prop (90일 보관 정책으로 `lockedInputs` 부재/일반화 시 상단 정직 안내 + "사용한 가정" 의 사용량 출처를 "재구성값" 으로 표기 — ADR-0007 §T9). `<details>`/`<summary>` native·breakdown·engineVersion 골격은 sub-task 1-3 그대로. mock-data 헤더 주석 정정 (실 데이터 출처 명시).
  - **`src/app/r/[shortId]/page.tsx` 변경** — `allItems.find(rank === 1)` 으로 rank=1 item 의 tariff/snapshot 컬럼 + `view.usageProfile` 로 `deriveCaveatTriggers` 호출 → `<CalculationDetails>` 에 `triggerRows` + `inputsAbsent`(= `piiAnonymizedAt !== null`) 전달.
  - 검증: typecheck 0 / lint 0 / **168 tests passed** (142 → 168, +26 caveat-triggers) / harness:plan 81 항목 (3.5 [x] 격상, 합계 41 → 42) / harness:data 출처/신선도 통과. 부수: PLAN 3.5 본문의 ``usage-estimator.ts`` 인라인 코드를 ``src/engine/usage-estimator.ts`` 풀 경로로 정정 (verify-plan fileRe completed-but-missing 위양성 방지).
- Phase 3 라운드 (c) — 원본 링크 (PLAN 3.3) + 제외 공급사 섹션 (PLAN 3.4) ([ADR-0021](docs/adr/0021-phase-3-results-page-design.md) §T2 3층 + §T6):
  - **`src/app/r/[shortId]/_lib/stale.ts` 신설** — `formatRelativeTime(target, now?)` 순수. 5 경계 ("방금 전" / "X분 전" / "X시간 전" / "X일 전" / "30일 이상 전") + 음수 diff 보수 처리. `+7 unit tests` (`stale.test.ts`).
  - **`src/app/r/[shortId]/_components/ComparisonTable.tsx` 확장** — 7번째 컬럼 "원본" (desktop) + 모바일 카드 footer line. `SourceLink` 내부 컴포넌트 — `target="_blank" rel="nofollow noopener"` + sr-only "(새 창에서 열림)" + 마지막 확인 상대 시간. `now` prop 주입 가능(SSR/테스트 결정성).
  - **`src/app/r/[shortId]/_components/ExcludedProvidersSection.tsx` 신설** — 비교 제외 공급사 section. provider.name + provider.excludedReason 직접 표시 (헌법 §3 P3). 0건 시 섹션 자체 비노출. Orange BE 등 모든 제외 공급사를 마스터 데이터 그대로 노출 — 특수 분기 0.
  - **`src/db/queries/providers.ts` 확장** — `getExcludedProviders(country)` helper. `provider.excluded_reason IS NOT NULL` + country 필터. ExcludedProvider 타입 + name asc 정렬. /data-sources 페이지(ADR-0011 §T2 항목 3) 와 공유 가능 형태.
  - **`src/app/r/[shortId]/page.tsx` 변경** — `extractCountry(lockedInputs.postal_country)` 신설 (NULL/잘못된 값 시 'BE' fallback, SC-B 1차 정합). 3 쿼리 병렬화 (topItem + allItems + excludedProviders). `<ExcludedProvidersSection>` 비교 표/empty 안내 아래, CalculationDetails 위에 배치.
  - 검증: typecheck 0 / lint 0 / **142 tests passed** (135 → 142, +7 stale) / harness:plan 81 항목 (3.3 + 3.4 [x] 격상, 합계 39 → 41) / harness:data 출처/신선도 통과.
- Phase 3 라운드 (b) — 비교 표 (PLAN 3.2, [ADR-0021](docs/adr/0021-phase-3-results-page-design.md) §T2 2층 + §T4 SC-F):
  - **`src/app/r/[shortId]/_components/ComparisonTable.tsx` 신설** — 6 컬럼 비교 표 (순위 / 공급사·요금제 + 카테고리별 보조 텍스트 / 월 비용 + 프로모·활성화비 보조 / 약정 / 절약(월·연) / 신뢰도 배지). Desktop md+ native `<table>` + Mobile `<md` 카드 stack(각 카드 = `<article>`). 음수 절약 정직 표기, 다크 패턴 회피 — 강조 색상 X.
  - **`src/app/r/[shortId]/_components/ComparisonControls.tsx` 신설** — 정렬 3옵션(절약액 큰 순 / 월 비용 적은 순 / 약정 없음 우선) + 필터 2 토글(약정 없음만 / 데이터 무제한). `<Link>` 만 사용 — dep 0, client state 0, URL params 가 단일 출처. aria-current/aria-pressed 표면화.
  - **`src/app/r/[shortId]/_lib/compare-view.ts` 신설** — 순수 모듈. `parseSearchParams` (sort/filter 검증 + fallback) / `applyView` (필터 → 정렬 → top N, tariffSlug ASC tie-break) / `buildSortHref` + `buildFilterToggleHref` (URL 직렬화, 기본 sort 는 query 생략). `+18 unit tests` (`compare-view.test.ts`).
  - **`src/db/queries/comparison.ts` 확장** — `getResultItems(resultId)` 신규. comparison_result_item × tariff_snapshot × tariff × provider 4단 INNER JOIN, ORDER BY rank ASC. 22 필드 (`ResultRowData`) — 비교 표 + 후속 라운드 c (3.3 원본 링크) 입력.
  - **`src/app/r/[shortId]/page.tsx` 변경** — `searchParams` Promise prop 추가. `getTopResultItem` + `getResultItems` 병렬 fetch. `parseSearchParams` → `applyView(allItems, view)` → `<ComparisonControls>` + `<ComparisonTable>` 결론 카드 아래 노출. 후보 0건 시 비교 표 섹션 전체 skip (기존 fallback 안내 유지).
  - 검증: typecheck 0 / lint 0 / **135 tests passed** (117 → 135, +18 compare-view) / harness:plan 81 항목 (3.2 [x] 격상, 합계 38 → 39) / harness:data 출처/신선도 통과.
- Phase 3 라운드 (a) — 결론 카드 (PLAN 3.1) + 영구 링크 풀 격상 (PLAN 3.6) ([ADR-0021](docs/adr/0021-phase-3-results-page-design.md) §T2 1층 + §T1/§T8):
  - **`src/app/r/[shortId]/_components/ResultConclusionCard.tsx` 신설** — 1위 추천 카드. 4 상태 분기: (a) 신규 가입자 = "신규 가입자에게 가장 저렴한 요금제" (b) positive saving = "월 €X 절약" + 월/연 보조 (c) zero = "현재 요금제와 동일" (d) negative = "더 저렴한 후보 없음 — 유지 권장" (정직 표기, 헌법 P3). 신뢰도 배지(confidence != 'high' 시 노출, T5 매트릭스), caveats list, CTA disabled placeholder("변경하기 (페이즈 4 활성 예정)"). 다크 패턴 회피 — neutral 색상, 부풀린 강조 X.
  - **`src/app/r/[shortId]/page.tsx` 풀 격상** — placeholder 헤더("비교 결과 페이지는 곧 추가됩니다") 제거 → "비교 결과" h1 + 영구 ID code 라인. `export const revalidate = 3600` ISR 1h 명시 (PLAN 3.6). topItem 존재 시 ResultConclusionCard, 후보 0건 시 인라인 정직 안내(ADR-0011 §T2 항목 5 동형) + /data-sources 링크. 90일 익명화 배너(§T9) 헤더 영역으로 이동. 새로 비교/홈 두 CTA 푸터.
  - **lockedInputs 좁힘 확장** — `current_tariff_id` 추출 (null = 신규 가입자, ADR-0010 §T7 케이스 6). `derivePageView.isNewSubscriber` 신호 신설, 결론 카드 메시지 분기.
  - **`src/db/queries/comparison.ts` 확장** — `getTopResultItem` JOIN 에 tariff + provider 추가 → `providerName` / `tariffName` / `confidence` (tariff_snapshot.confidence) 표면화. comparison_result_item → tariff_snapshot → tariff → provider 3단 INNER JOIN.
  - **`e2e/result-page.spec.ts` + `e2e/compare-flow.spec.ts` 회귀 수정** — placeholder 헤더 기대("비교 결과 페이지는 곧 추가됩니다") 제거, "비교 결과" h1 + role=article (결론 카드) 확인. 시각 회귀 0 가정 (axe 0 유지 기대).
  - 검증: typecheck 0 / lint 0 / **117 tests passed** (회귀 0, 라운드 a 는 컴포넌트만 — 단위 테스트는 b~d 라운드에서 통합) / harness:plan 81 항목 (3.1 + 3.6 [x] 격상, 합계 36 → 38) / harness:data 출처/신선도 통과.
- Phase 3 builder M6 sub-task 5 후속 — `comparison_result_item.breakdown` 평탄 컬럼 3종 + getTopResultItem 신설 ([ADR-0010](docs/adr/0010-comparison-engine.md) §T3/§T4):
  - **마이그레이션 `drizzle/0004_sudden_sprite.sql`** — `comparison_result_item` 에 `monthly_avg_12_cents` / `monthly_avg_24_cents` / `monthly_saving_24_cents` 3 컬럼 추가 (모두 `bigint NOT NULL DEFAULT 0`). 결정: 평탄 컬럼 (ADR-0005 §T2 / ADR-0006 §T2 정합 — hot path 는 평탄 + 아카이브는 JSONB). compare() 재실행은 거부 — engineVersion drift + tariff_snapshot append 로 결과 비결정성. activation/modem/promo 는 별도 컬럼 X (tariff_snapshot RESTRICT FK 로 동결, JOIN 으로 충분).
  - **`src/db/schema/comparison_result.ts` 변경** — 3 신규 컬럼 + 의도 주석 (왜 별도 저장 / 왜 activation/modem 은 별도 X).
  - **`src/db/queries/comparison.ts` 확장** — `insertComparisonResultItems` 에 3 신규 필드 + `getTopResultItem(resultId)` 신설 (rank=1 결과 + tariff_snapshot.activationFeeCents INNER JOIN, 후보 0건 시 null 반환).
  - **`src/app/api/compare/route.ts` 변경** — `result.ranked` map 시 `item.breakdown.monthlyAvg12/24Cents` + `monthlySaving24Cents` 도 insert 페이로드 포함.
  - **`src/app/r/[shortId]/page.tsx` 변경** — `getTopResultItem(row.resultId)` 호출 → `CalculationDetails.breakdown` 에 실 값 전달. `activationAmortizedPerMonthCents = Math.round(activationFeeCents / 12)` (ADR-0010 §T4 12개월 amortize 1차 단위). 후보 0건 (topItem null) 시 모두 0 fallback.
  - **운영자 액션 필요** — `pnpm verify:db && pnpm db:push` (production 적용 전 endpoint allowlist 확인, ADR-0017 사고 방지 1.5.5 정합). dev/local 환경 동기화 후 e2e 재검증 (`pnpm tsx --env-file=.env.local scripts/seed-stub-tariffs.mts` + `pnpm test:e2e`).
  - 검증: typecheck 0 / lint 0 / **117 tests passed** (회귀 0) / harness:plan 81 항목 정합 / harness:data 출처/신선도 통과.
- Phase 3 builder M6 sub-task 5 — `/api/compare` 풀 흐름 + `/r/[shortId]` DB 존재 검증 ([ADR-0021](docs/adr/0021-phase-3-results-page-design.md) §T3 + ADR-0007 §T9/§T10):
  - **`src/db/queries/comparison.ts` 신설** — 5종 helper. `insertComparisonRequest` (RETURNING id) / `getCandidateSnapshots(category, country)` 후보 SELECT (`selectDistinctOn([tariffSnapshot.tariffId])` + 3단 JOIN + `is_active`/`country`/`NOT is_anomaly`/`confidence != low` 필터, ADR-0006 §T7 hot path) / `getCurrentTariffSnapshot(tariffId)` baseline SELECT (필터 0 — 비교 baseline 신뢰도 보존) / `insertComparisonResult` + `insertComparisonResultItems` bulk (neon-http no-tx, persist.ts 동형 순차) / `getResultByShortId(shortId)` LEFT JOIN request (T8 SET NULL 정합).
  - **`src/db/queries/comparison-helpers.ts` 신설** — db-free 순수. `snapshotRowToTariffLike(row)` Drizzle row → 비교 엔진 입력 1:1 매핑 + `buildLockedInputs(args)` ADR-0007 §T9 권장 키 직렬화 (postal_country / postal_code / household_type / current_provider_id / current_tariff_id / input_attributes / assumptions { usage_profile, estimator_version }). `+8 unit tests` (필드 매핑 + null 보존 + 변형 X + 순수성).
  - **`src/lib/with-timeout.ts` 신설** — `Promise.race` 5초 timeout helper. `TimeoutError` 클래스 + finally clearTimeout. neon-http AbortSignal 미지원이라 timeout 시 orphan request row 가능성 명시 (ADR-0021 §T3 "부분 실패 시 분석 가치" 정합).
  - **`src/app/api/compare/route.ts` 풀 흐름** — stub → 7단계: (1) Zod 재검증 → (2) `comparison_request` INSERT (postalCountry 는 `input_attributes.postalCountry` 봉인, 컬럼 신설 0) → (3+4) 후보 + 현재 요금제 병렬 SELECT → (5) `deriveUsageProfile` + `compare()` → (6) `nanoid(12)` + `comparison_result` + `comparison_result_item` bulk INSERT → (7) `{ ok, shortId }` 반환. `withTimeout` 외곽 — TimeoutError 504 / 기타 Error 500. orphan 가능성은 ADR-0021 §T3 명시.
  - **`src/app/r/[shortId]/page.tsx` 변경** — regex 통과 후 `getResultByShortId(shortId)` 호출, null 시 `notFound()` (sub-task 4 형식 검증과 정합). 페이지는 placeholder 헤더 유지 (3.1~3.7 본 항목은 후속 라운드) + 실 `engineVersion` 전달 + `lockedInputs.assumptions.usage_profile` 추출해 `CalculationDetails` 에 실 데이터 props. `piiAnonymizedAt` 있으면 90일 익명화 안내 배너 노출 (T9 정합). breakdown 컬럼 미저장 → CalculationDetails.breakdown 은 0 cents fallback (후속 라운드 결정).
  - **`e2e/result-page.spec.ts` 리팩터** — 정상 진입 4 케이스가 fake nanoid 대신 `playwrightRequest.newContext().post(/api/compare)` 로 실 shortId 받아 사용. "DB 미존재 12자 shortId → 404" 케이스 1건 신설 (sub-task 5 새 검증 면).
  - **`eslint.config.mjs` 수정** — `scripts/**` 오버라이드 패턴에 `.mts`/`.cts` 추가. pre-existing 버그 — `seed-stub-tariffs.mts` (sub-task 5 외 파일) 가 console.log 사용으로 `no-console: warn` 룰 적용되던 문제 1-char 정정으로 해소.
  - 검증: typecheck 0 / lint 0 (`--max-warnings=0`) / **117 tests passed** (+8 comparison-helpers, 109 → 117) / harness:plan 81 항목 정합 / harness:data 출처/신선도 통과. e2e 는 자동 게이트 외 — 운영자 수동 (`pnpm tsx --env-file=.env.local scripts/seed-stub-tariffs.mts` + `pnpm test:e2e`).
- Phase 3 builder M6 sub-task 6 — `/compare/[category]/current-provider` sub-step 활성 ([ADR-0021](docs/adr/0021-phase-3-results-page-design.md) §T5 + ADR-0016 §T5):
  - **`src/db/queries/providers.ts` 신설** — `getActiveProviders(country)` + `getActiveTariffsByProviders(providerIds, category)` Drizzle helper. country 필터 + `excluded_reason IS NULL` (비교 가능 공급사만) + `is_active = true` (활성 tariff만).
  - **`providers-helpers.ts` + `providers-types.ts` 분리** — `groupTariffsByProvider` 순수 변환 helper와 `ActiveProvider`/`ActiveTariff` 타입을 별도 모듈로. vitest 가 `@/db` (DATABASE_URL 필수) import 회피하도록. comparison-stats.test.ts 와 동형 패턴.
  - **`/compare/[category]/current-provider/page.tsx` RSC 변경** — `'use client'` → RSC + `revalidate=3600` ISR. RSC가 BE provider + 카테고리별 tariff prefetch → `CurrentProviderForm` props 전달. **0건 fallback** — "공급사 목록 불러오지 못했어요" 안내 + 신규 가입자 스킵 단일 CTA (P3 정합).
  - **`CurrentProviderForm.tsx` 신설** — client 컴포넌트. Provider `<Select>` 선택 시 tariff `<Select>` sub-step conditional render. "이 공급사 요금제는 모르겠어요" 동등 버튼(`tariffUnknown` 플래그) + "모르겠어요/스킵 — 신규 가입자" 동등. sessionStorage 즉시 저장.
  - **`e2e/compare-flow.spec.ts` 새 spec 추가** — Proximus 선택 → tariff 모르겠어요 → bill → /r/[shortId] path 통과 (2.0s). 기존 스킵 path 회귀 0 (7.4s).
  - 검증: typecheck 0 / lint 0 / **109 tests passed** (+6 helper) / harness:plan 81 항목 / **e2e 18** (compare-flow 2/2 + accessibility 6/6 + result-page 9/9 + landing 1). DB 검증: `pnpm verify:db` provider 2개 (proximus-be + telenet-be) 시드 확인.
- Phase 3 builder M6 sub-task 4 — `/r/[shortId]` 잘못된 shortId 404 방어 ([ADR-0021](docs/adr/0021-phase-3-results-page-design.md) §T1):
  - **`src/app/r/[shortId]/not-found.tsx` 신설** — Next.js App Router not-found 표준. 한국어 안내 ("이 결과는 더 이상 존재하지 않습니다") + "새로 비교 시작" + "홈으로" 두 CTA + 영구 링크 형식 안내.
  - **`/r/[shortId]/page.tsx` 변경** — params 진입 시 정규식 `/^[A-Za-z0-9_-]{12}$/` 검증, 형식 미달 시 `notFound()` 호출 (HTTP 404 응답). `generateMetadata`도 잘못된 shortId 시 noindex/nofollow 신호.
  - **`e2e/result-page.spec.ts` 신설** — 9 테스트: 정상 진입 4 (placeholder 헤더 + CalculationDetails 펼치기 + SC-G 메타 noindex/canonical 검증 + axe 0 violations) + 404 케이스 4 (11자/13자/`.` 문자/공백 12자) + not-found 페이지 axe 0 violations.
  - DB 존재 여부 검증은 별도 작업 — Sub-task 5 (`/api/compare` 풀 + comparison_result SELECT) 영역.
  - 검증: typecheck 0 / lint 0 / **103 tests passed** (회귀 0) / harness:plan 81 항목 / **e2e 17/17 passed** (5단계 7.0s + accessibility 6/6 + result-page 9/9).
- Phase 3 builder M6 sub-task 1-3 — 결과 페이지 골격 ([ADR-0021](docs/adr/0021-phase-3-results-page-design.md) §T7 + §T8 + §T10 + §T3 §5):
  - **국가 선택 (T10)**: `/compare/[category]/postal` 에 BE/NL/LU 국가 `<Select>` 추가. NL PC4 ("1011") + PC6 ("1011 AB") 자동 대문자화. LU 4자리 (BE 형식). `postalCodeSchema` `discriminatedUnion` (BE/NL/LU). `+13 unit tests`. NL/LU 비교 후보는 페이즈 5 fetcher 추가 전까지 0 — 정직 안내.
  - **결과 페이지 메타 (T8 SC-G)**: `/r/[shortId]` `generateMetadata` — `noindex` + `canonical: https://slim.lu/r/{shortId}` + textOG (og:image 미설정, 페이즈 4 ADR-OG 동적 OG 일괄). 영구 링크 SEO 표면 정직.
  - **계산 근거 펼치기 (T7)**: `CalculationDetails` 컴포넌트 신설 — HTML `<details>` native (JS 0, a11y 표준) + 사용 가정 + 사용량 수치 + 12/24개월 평균 + caveats + engineVersion. props 모양은 페이즈 3 후속 라운드(`/r/[shortId]` 풀 격상) 시 실 `compare()` 결과 전달 가능.
  - **사용량 추정 모듈 (T3 §5)**: `src/engine/usage-estimator.ts` 신설 — `deriveUsageProfile(category, householdType, inputAttributes) → UsageProfile`. 4 카테고리 × 3 householdType 기본 프로파일 (BIPT 2024 + 베네룩스 시장 관찰값 기반). 명시 inputAttributes 가 fallback 우선. `+19 unit tests` (음수/문자열/NaN/0 안전). `USAGE_ESTIMATOR_VERSION = 'usage-estimator@2026-05-10'` 노출.
  - **a11y fix 3건 (axe color-contrast AA)**: `--color-accent-dark` (#B8412F) 토큰 신설. `FormLabel` + `FormMessage` 에러 색상 `text-accent` → `text-accent-dark` 으로 변경 — bg #FAF7F2 대비 ~6.7 (AA 통과). 6 페이지 axe 0 violations 유지.
  - 검증: typecheck 0 / lint 0 / **103 tests passed** (84→103, +19 usage-estimator) / harness:plan 81 항목 정합 / e2e accessibility 6/6 통과 / e2e compare-flow BE 1000 회귀 0.
- Phase 2 1차 (PLAN 2.1~2.9, [ADR-0016](docs/adr/0016-phase-2-input-flow-design.md) Accepted — T9 옵션 A RHF + T10 SC-E 한국어 단일):
  - `src/types/comparison-input.ts` — 5단계 입력 Zod schema 단일 출처 (postal/household/current-provider) + 누적 ComparisonInput + sessionStorage 직렬화 모양. 22 unit tests.
  - `src/components/ui/` — 6 컴포넌트 신설 (Card / Input / Label / RadioGroup / Select / Progress / Form). shadcn/ui 패턴 + minimal cn() (cva 없음).
  - `src/app/compare/page.tsx` — 카테고리 선택 (4 카드, T2). RSC.
  - `src/app/compare/[category]/page.tsx` — `/postal` redirect (T1).
  - `src/app/compare/[category]/{postal,household,current-provider,bill,preview}/page.tsx` — 5 단계 입력 페이지 (T3~T7). 모두 client + RHF + Zod resolver + sessionStorage 자동 동기화.
  - `src/app/compare/[category]/_components/{useCompareSession.ts, CompareLayout.tsx}` — sessionStorage 훅 (`slim:compare:[category]:state` v1, T8) + 진행 표시 + 백 버튼 공통 레이아웃.
  - `src/app/api/compare/route.ts` — POST. Zod 재검증 + nanoid 12자 shortId. 페이즈 2 1차는 stub (DB insert + compare() 풀 호출은 페이즈 3 진입 시 추가 — ADR-0011 §T2 항목 5 동형 정직 노출).
  - `src/app/r/[shortId]/page.tsx` — 영구 결과 링크 placeholder. 페이즈 3 진입 시 풀버전.
  - PLAN §2.1~§2.9 본문에 ADR-0016 §T1~T10 cross-ref + SC-A/B/C 표기. PLAN Scope cut 옵션 표에 SC-B/SC-C/SC-D/SC-E 신설 (옵션 C "적용됨" 갱신).
  - 검증: 4단 게이트 통과 (typecheck 0 / lint 0 / **71 tests passed**: 49 → 71 / harness:plan 81 항목 정합성).
  - **5단계 자동 시연** (`e2e/compare-flow.spec.ts`, Playwright + reuseExistingServer): mobile + 1000 + single + skip + bill skip → `/r/[shortId]` 도달. **완주 6.7초** (P2 5분 = 300_000ms 대비 44배 마진), **콘솔 에러 0**, nanoid 12자 placeholder 표시 검증. 6 스크린샷 (`e2e/screenshots/01~06.png`).
  - **PLAN 2.9 axe-core 0 violations** (`e2e/accessibility.spec.ts`): 6 페이지 (`/compare` + 4 단계 + `/r/[shortId]`) WCAG 2.1 AA + best practices 통과 (4.2s). a11y 수정 3건: `--color-muted` AA 대비 (#8A958F→#5F6864), `CardTitle` h3→h2 (heading-order), `/compare` + `/r/[shortId]` wrap → `<main>` (landmark-one-main + region). dep `+1`: `@axe-core/playwright` (devDep, gzip ~30KB). SC-C 부분 적용 — Playwright E2E 풀 인프라는 페이즈 4 deploy 직전 유지.
- Phase 0.5 (PLAN D.1.a/D.1.b/D.2.a) — 운영 부채 정리:
  - `next.config.ts`: `typescript.ignoreBuildErrors: true` + `eslint.ignoreDuringBuilds: true` 추가. Vercel 빌드 차단 해소. 검증 권한은 로컬 stop-gate + GitHub Actions로 일원화.
  - `.github/workflows/ci.yml` 신설: push/PR마다 4단 게이트 실행 (typecheck → test → harness:plan → harness:data). (lint는 ADR-0002 Amendment 1로 D.1.d에서 제거됨 — 아래 Changed 참조.)
  - `scripts/hooks/pre-tool-guard.sh`: jq 미존재 환경(Windows 등)용 sed/grep fallback 추가.
  - `scripts/harness/verify-plan.ts`: PLAN.md의 알파벳-숫자 항목 ID(`D.1`, `D.2`) 파싱 지원.
  - 결정 근거: [ADR-0002](docs/adr/0002-build-gate-ownership.md).
  - 후속: D.1.c (GitHub 브랜치 보호 규칙)는 GitHub UI 수동 작업으로 사용자 처리 예정.
- Phase 1 (PLAN 1.1) — `provider` 테이블 (공급사 마스터): 베네룩스(BE/NL/LU) 공급사 정보 저장. 필드는 `id`, `country` enum, `name`, `legal_name`, `slug`, `vat_id`, `vat_id_verified_at` (VIES 검증), `website`, `affiliate_status` enum (6값: `none`/`pending`/`active_b2b_intra_eu`/`active_b2b_domestic_be`/`paused`/`terminated`), `excluded_reason` (비교 제외 사유, null이면 비교 가능). 결정 근거: [ADR-0001](docs/adr/0001-provider-schema.md).

### Changed

- Phase 0.5 (PLAN D.1.d, [ADR-0002 Amendment 1](docs/adr/0002-build-gate-ownership.md)) — `.github/workflows/ci.yml`에서 `Lint` 단계 제거. GitHub Actions ubuntu-latest에서 `pnpm lint`가 `@next/eslint-plugin-next` ESLint 9 호환성 이슈로 매번 실패하여 운영 노이즈 발생. lint는 로컬 stop-gate 단독 책임으로 환원. `continue-on-error: true` 같은 거짓 안전 신호 옵션은 거부. CI 게이트는 5단 → 4단 (typecheck/test/harness:plan/harness:data).
- Phase 1.5 (PLAN 1.5.6, [ADR-0013](docs/adr/0013-fetcher-real-scraping-risk-assessment.md)) — 분기 결정 옵션 C (MEDIUM, 2.75/5.0) 채택. 1.5.6 실 스크래핑 fetcher 구현은 페이즈 5/6 재평가 시점까지 차단([!]) 마킹. 1.5.6 + Orange BE(5.0) + 1.5.1(N=3 fetcher 공통화) 통합 평가가 시간 효율 ↑. 베타(페이즈 4)는 ADR-0013 §평가 6 옵션 X (스텁 + "추정값" 표기)로 무영향 진행. ADR Status: Proposed → Accepted (옵션 C 채택, 2026-05-10).
- Phase 3 진입 결정 묶음 ([ADR-0021](docs/adr/0021-phase-3-results-page-design.md) Accepted, 2026-05-10) — T1~T11 11 결정 + SC-F (URL params 정렬/필터, dep 0) + SC-G (static OG, 페이즈 4 동적 OG ADR-OG) + SC-H (OCR 별도 ADR-OCR, 페이즈 3 결과 페이지 직후) + 옵션 D (인쇄 뷰 페이즈 6 이연). PLAN 3.1~3.7 + §1.13 본문에 cross-ref 추가, 페이즈 2 1차 부채 종결 명세 (`/api/compare` stub→풀, `/r/[shortId]` placeholder→풀, current-provider sub-step 활성, NL/LU 우편번호 discriminatedUnion 추가). builder 인계 = 8~12 신설/변경 파일, 외부 의존성 추가 0 (T4 native checkbox + 자체 Badge). DB schema 무변동. 페이즈 3 진입 시점 = M6 시작 → 베타(M8~M10) 일정 정합. 운영자 GATE-N 4 분기 모두 권장 채택.
- ADR-0021 §T5 **Amendment 1** (2026-05-10) — `caveats-i18n.ts` 모듈 미신설로 변경. 사유: `src/engine/caveats.ts` 가 페이즈 1 시점부터 한국어 직접 출력 (ADR-0010 §T6 "nl-BE 단일" 표현은 의도였고 실 코드는 한국어). 단일 로케일 단계에서 별도 i18n 매핑 모듈은 *코드 0줄 가치*. 향후 페이즈 4 i18n ADR (SC-E 발동) 진입 시 caveats.ts 를 *caveat ID + 데이터* 모양으로 리팩터 → 별도 i18n 함수 도입 재검토.
- ADR-0007 §T7 **Amendment 1** (2026-05-10) — nanoid alphabet 명세 정정. 원안은 customAlphabet `0-9a-z` (36 chars, 36^12 ≈ 4.7e18 공간) 가정이었으나, 실 구현(`/api/compare/route.ts`)은 nanoid default URL-safe 64-char alphabet (`A-Za-z0-9_-`, 64^12 ≈ 4.7e21 공간) 사용. 본문 정정으로 실 구현 정합. 진입 검증 정규식 `/^[A-Za-z0-9_-]{12}$/` 명시. 사용자 노출 영향 0 (URL 길이 동일 12자).
- Phase 2 진입 — `next.config.ts`에서 `experimental.typedRoutes` 옵션 제거 (deprecation 워닝 해소 + 페이즈 2 1차 비활성 결정 유지). Next.js 15.5에서 `experimental → top-level` 이전됐고, 동적 라우트 cast 부담이 학습자 모드에 부적합해 비활성 유지. 페이즈 4 베타 진입 시 라우트 안정 후 재활성화 검토.
- Phase 2 진입 — `package.json` dep **+7건** (운영자 GATE-J 명시 승인): `react-hook-form` (~10KB) + `@hookform/resolvers` (~5KB) — ADR-0016 §T9 옵션 A. shadcn 컴포넌트 implicit 동반: `@radix-ui/react-label` / `radio-group` / `select` / `progress` / `slot`. 모두 zero-dep + accessibility 표준. 49 packages 추가 (transitive 포함).

### Deprecated

### Removed

### Fixed

### Security

- Phase 1.5 (PLAN 1.5.7) — Bash 보안 패턴 자동 차단 hook:
  - `scripts/hooks/pre-tool-guard.sh`에 CLAUDE.md §8 #6 헌법 룰 자동 강제
    추가. 따옴표 인자 안 `개행 + #` (path validation 우회), 더블쿼트 인자 안
    `backtick` 또는 `$(...)` (command substitution) 패턴을 PreToolUse 단계에서
    `permissionDecision: deny`로 차단. 차단 메시지에 안전 대안(Edit/Write,
    임시 파일+mv, `command --file=- <<'EOF' ... EOF` stdin 패턴) 자동 첨부.
  - 닫는 따옴표 강제 매칭 + 0x0B(vertical tab) 센티넬로 멀티라인 처리해
    heredoc body false positive 회피. 싱글쿼트 안 `$()`/backtick은 bash literal
    처리라 통과.
  - JSON fallback 경로(`jq` 부재 — Windows + Git Bash 기본 환경) 디코딩 강화:
    `\\`/`\"` 외 `\n`, `\t`까지 센티넬 기반 sed 파이프라인으로 정확 처리.
  - 음성 테스트 8 케이스 통과 (안전 4 / 위험 4).
  - 후속: 헌법 §8 #6 세 번째 항목("escape 안 된 큰따옴표 끼어듦")은 false
    positive 비율 과다로 자동 탐지 보류, hook 주석에 진입점 명시.

### Fixed

- `scripts/harness/verify-plan.ts` — 파일 경로 추출 정규식(`fileRe`) 강화.
  백틱 안 첫 글자가 공백·백틱이면 매치 제외하도록 변경 (`[^`\s]` 클래스 추가).
  PLAN.md 본문 nested-backtick 표기(예: 인라인 코드 안의 ` >> file.md` 토큰)
  를 실제 검증 대상 파일로 잘못 추출해 `completed-but-missing` 위양성을
  발생시키던 버그 해소. 1.5.7 작성 중 발견 → 함께 수정.

---

## [0.0.0] — 2026-05-09

**내부 마일스톤**: Phase 0 (기반) 완료. bootstrap 스크립트로 Next.js 15 + TypeScript strict + Tailwind 4 + Drizzle + Vitest 환경 준비.
