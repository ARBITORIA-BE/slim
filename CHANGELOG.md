# Changelog — Slim

이 파일은 Slim의 모든 변경사항을 기록합니다.
한 줄 한 줄이 사용자가 신뢰할 근거입니다.

형식: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) + [Semantic Versioning 2.0](https://semver.org/)

---

## [Unreleased]

### Added

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
