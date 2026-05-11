# ADR-0023: Lighthouse / axe-core 자동화 — `pnpm harness:perf` 신설 + 로컬 advisory 게이트

## Status

**Accepted** (2026-05-11 — GATE-P 운영자 승인 완료: T1~T6, 특히 (a) `lighthouse` devDependency 추가 = GATE-C 의존성 정책 amend, (b) "CI 머지 차단 X" 동의). 본 ADR은 *결정 + builder 인계 명세*. 코드 변경 0건 — 실제 신설(`scripts/harness/perf-budget.ts` 등)은 PLAN 페이즈 3.5 진입 시점(M7 말) builder 라운드. 페이즈 3 자체가 아직 진행 중이므로 본 ADR 승인으로 설계는 잠금, 구현은 트리거 대기.

> 원래 상태: *Proposed (운영자 승인 대기 — GATE-P)*.

> 번호 충돌 해소 메모: PLAN §D.3.e + ADR-0020 §결정 6 + ADR-0022 §작성 메모가 *Neon-side Vercel Integration* ADR 을 "가칭 ADR-0023" 으로 느슨하게 예약("가칭" = tentative)해 뒀다. 그 항목은 페이즈 4 베타 진입(GATE-K) 시점의 *미작성* 트리거이고, 본 ADR(Lighthouse/axe 하네스)은 페이즈 3.5에서 *지금 실제로 작성*된다. **본 ADR이 0023을 소비**하고, Neon Vercel Integration ADR 은 다음 번호 **(가칭 ADR-0024)** 로 재지정한다. PLAN §D.3.e 의 "가칭 ADR-0023" 참조를 "가칭 ADR-0024" 로 갱신한다 (본 follow-up 에서 함께 처리).

## Context

PLAN 항목 **3.5.1** — `Lighthouse / axe-core 자동화 — pnpm harness:e2e에 통합`. 한 줄짜리 stub 이라 분해가 필요하다. 무엇이 우리를 이 결정 앞에 세웠는가:

1. **헌법 P2 가 자동 측정 없이는 무방비다.** "LCP ≤ 2.5s, FID ≤ 100ms (Core Web Vitals). 새 기능이 이 예산을 깨면 머지하지 않는다" — 그런데 현재 이 예산을 *측정하는 자동화가 0건*이다. `package.json` 에 Lighthouse 관련 의존성 없음. PLAN 페이즈 3 검증 라인("Lighthouse 모바일 ≥ 90 Perf/Acc/BP/SEO")도 수동 측정 가정.
2. **axe 는 이미 절반 와 있다.** `e2e/accessibility.spec.ts` 가 `@axe-core/playwright` 로 페이즈 2에서 "6페이지 0 violations" 를 달성했고 `pnpm test:e2e`(= `playwright test`)에 포함돼 있다. 3.5.1 의 axe 부분은 "기존 것을 명령으로 묶기 + 페이지 커버리지가 페이즈 3 신규 라우트(`/r/[shortId]`, `/compare/[category]/*`)까지 닿는지 확인" 수준이지, 새 인프라가 아니다.
3. **`harness:e2e` 와 Lighthouse 는 서로 다른 관심사다.** `scripts/harness/e2e-smoke.ts` 는 *P2 walltime 스모크* — "메인 비교 플로우가 5분 안에 완주되는가" + 출처/신선도 표면 확인. Lighthouse 는 *프론트엔드 성능 예산* — LCP/INP/번들. 둘을 한 명령에 합치면 (a) 실행 시간 길어짐 (Lighthouse 1 페이지 ≈ 10~30초 × 4 페이지) (b) 실패 원인 진단이 흐려짐 (c) `harness:e2e` 가 CI 4단 게이트의 사촌인데 Lighthouse 의 flakiness 가 거기 전염됨. → **별도 명령(`harness:perf`)이 맞다.** PLAN 원문의 "harness:e2e 에 통합"은 stub 작성 시점의 어림이었고, 본 ADR 이 이를 정정한다.
4. **ADR-0002 의 교훈: flaky 한 걸 CI 머지 차단으로 두면 noise 화 → 보호 대상이 오히려 무방비.** Lighthouse 는 CI 러너(ubuntu-latest, 공유 vCPU)에서 perf score 변동폭이 크기로 악명 높다. CI lint 단계를 Amendment 1 으로 제거한 것과 동일한 패턴 위험. → **CI 머지 차단 X.** 로컬 advisory + 임계값 리포트로 시작.
5. **운영자 제약**: 솔로 사이드, 월 €300 cap. 유료 Lighthouse SaaS(`treo.sh`, SpeedCurve, Calibre 등) 비현실. 오픈소스/로컬 도구만. Lighthouse CI 서버(`@lhci/cli` + LHCI server) 도 호스팅 부담 → 거부.
6. **측정 대상 환경**: `next dev --turbo` 는 비프로덕션 번들(소스맵, HMR, 미압축) → perf 숫자가 무의미. **`next build && next start`** (프로덕션 빌드) 대상 측정만 신뢰 가능.

PLAN 매핑: 페이즈 3.5 — **3.5.1** (분해). 페이즈 3 검증 라인("Lighthouse 모바일 ≥ 90")의 자동화 근거.

## Decision

**6개 결정 (T1~T6).**

### T1. Lighthouse 러너 = `lighthouse` 프로그래매틱 Node API (devDependency 1건 추가)

`import lighthouse from 'lighthouse'` + Playwright 가 이미 가져온 헤드리스 Chromium 에 CDP 로 붙인다 (`@playwright/test` 의 `chromium.launch()` → `browser.wsEndpoint()` 또는 `--remote-debugging-port`). 새 브라우저 바이너리 0건.

- **거부 — `@lhci/cli` (Lighthouse CI)**: assertion config + `lhci autorun` 워크플로는 GitHub-status / LHCI server 업로드를 전제로 설계됨. 솔로 advisory 용도엔 과함. 단, 향후 CI advisory 코멘트가 필요해지면 `lhci` 로 교체 검토 (회귀 트리거).
- **거부 — `unlighthouse`**: 사이트 전체를 크롤링해 모든 라우트를 측정. 우리는 대표 4 페이지만 필요 — 오버킬 + 의존성 트리 큼.
- **거부 — `playwright-lighthouse`**: `lighthouse` 를 감싸는 얇은 래퍼. 간접층만 추가, 우리가 직접 CDP 연결하면 됨.

### T2. 통합 위치 = `pnpm harness:perf` 신설 (`scripts/harness/perf-budget.ts`). `harness:e2e` 는 그대로

- `scripts/harness/perf-budget.ts` 가 (a) `next build` 이미 됐다는 가정 하에 `next start` 를 띄우거나 `E2E_BASE_URL` 환경변수가 있으면 그걸 사용 (기존 `e2e-smoke.ts` 와 동형 패턴) (b) 대표 페이지 셋(T3)에 Lighthouse mobile 프리셋으로 측정 (c) 임계값(T4) 비교 (d) 표 출력 + exit code.
- `harness:e2e` (P2 walltime 스모크)는 **무변동** — 관심사 분리.
- axe 부분은 `harness:perf` 에 *얇게* 포함: 같은 4 페이지에 `@axe-core/playwright` 0-violations 재확인을 함께 돌린다 (이미 `accessibility.spec.ts` 에 있지만, 페이즈 3 신규 라우트 커버리지 보강 + perf 와 같은 게이트에서 한 번에 보기 — 중복이지만 비용 무시 가능). `accessibility.spec.ts` 는 그대로 `test:e2e` 에 남는다.
- `package.json` scripts 추가: `"harness:perf": "tsx scripts/harness/perf-budget.ts"`. `harness:all` 은 **변동 X** (= `harness:plan && harness:data && harness:bias` 그대로 — perf 는 빌드 의존이라 `harness:all` 에 넣으면 무거움). 대신 `/ship` 슬래시 커맨드 + 페이즈 3 종료 체크리스트에서 `harness:perf` 를 호출 (T6).

### T3. 측정 페이지 셋 = 4개 (seed 데이터 의존)

| # | 라우트 | 대표성 |
|---|---|---|
| 1 | `/` | 랜딩 — LCP 최우선 (첫인상 + SEO) |
| 2 | `/compare` | 카테고리 선택 — 입력 플로우 진입점 |
| 3 | `/compare/[category]/postal` (예: `/compare/mobile/postal`) | 입력 폼 대표 (RHF + shadcn, 단계 1) |
| 4 | `/r/[shortId]` | 결과 페이지 — 3층 구조, 가장 무거운 RSC + 비교 표 |

`/r/[shortId]` 는 seed 된 `comparison_result` 의 shortId 필요. builder 가 `scripts/seed/*.ts` (이미 페이즈 3 에 seed 스크립트 존재 — 커밋 `eff828d`) 에서 고정 shortId 하나를 보장하거나, `perf-budget.ts` 가 시작 시 `/api/compare` 를 한 번 호출해 shortId 를 얻는다 (builder 자유도). seed 부재 시 4번 페이지는 skip + warn (게이트 실패 아님 — 환경 의존이라).

### T4. 임계값 = Core Web Vitals 2개(헌법 P2) 하드 + Lighthouse 카테고리 점수 2개 soft + 번들 1개 advisory

| 메트릭 | 임계값 | 출처 / 강도 |
|---|---|---|
| LCP (lab, mobile) | ≤ 2.5s | 헌법 P2 — **hard** (exit 1) |
| TBT (lab) — INP/FID 의 lab proxy | ≤ 200ms | 헌법 P2 의 "FID ≤ 100ms" 의 lab 대응. Lighthouse 에 field FID/INP 없음 → TBT 사용 (Web Vitals 권장 매핑). **hard** (exit 1) |
| Lighthouse Performance score (mobile) | ≥ 90 | PLAN 페이즈 3 검증 라인 — **soft** (warn, exit 0). CI 머지 차단 안 함 (T5) |
| Lighthouse Accessibility score (mobile) | ≥ 95 | 페이즈 2 "0 axe violations" 달성 → 95+ 자연 도달 예상. **soft** (warn) — axe 0-violations 가 진짜 게이트 (T2) |
| First-load JS (페이지당, `next build` 출력 파싱) | ≤ 130 KB gzip / 페이지 | advisory only — 회귀 추적용. 임계값은 builder 가 첫 측정 후 PLAN sub-task 에 확정 |

- Best Practices / SEO 점수는 페이즈 3.5.2 (SEO 메타/sitemap/robots) 가 책임 — 본 ADR 범위 밖. 단 `harness:perf` 출력에 *표시*는 한다 (게이트 X).
- a11y 점수, perf 점수가 soft 인 이유: 둘 다 환경 변동 + Lighthouse heuristic 변동에 민감. **hard 게이트는 P2 헌법이 명시한 LCP/TBT 2개로만 한정** — 그래야 실패가 신뢰 가능하고 noise 화 안 됨 (ADR-0002 교훈).

### T5. CI 게이트 여부 = **CI 머지 차단 X. 로컬 + `/ship` advisory.**

- `harness:perf` 는 ADR-0002 의 CI 4단 게이트(typecheck → test → harness:plan → harness:data)에 **추가하지 않는다.** 이유: (a) Lighthouse 는 ubuntu-latest 공유 러너에서 perf score ±10 변동 — hard 게이트라도 LCP 가 러너 부하에 흔들림 (b) `next build && next start` 가 CI 에 추가되면 CI 시간 2~3배 (c) ADR-0002 Amendment 1 (CI lint 제거)의 직접 교훈 — flaky 를 차단 게이트로 두면 noise → 무시 → 보호 대상 무방비.
- **대신**: (1) 로컬 `pnpm harness:perf` (운영자가 페이즈 3/3.5 종료 전 수동 1회) (2) `/ship` 슬래시 커맨드에 `harness:perf` 호출 추가 — 배포 전 종합 점검의 일부 (3) 페이즈 3 종료 체크리스트(PLAN "Phase 3 검증" 라인)의 실행 근거가 `harness:perf` 로 명시됨.
- **헌법 P2 의 "머지하지 않는다" 강제 방식**: 머지 *전* 게이트가 아니라 *배포 전*(`/ship`) 게이트 + *주기적*(페이즈 종료) 게이트로 해석. PR 단위로 LCP 를 흔드는 변경은 코드 리뷰 + 로컬 측정으로 잡고, 누적 회귀는 `/ship` 에서 잡는다. 이건 ADR-0002 의 lint(로컬 stop-gate 단독) / bias-audit(주간, CI 캐시만) 와 동일한 "flaky 한 건 CI 밖에서" 패턴.
- **회귀 트리거**: 배포 후 실측 LCP > 2.5s 가 발견되면 → CI advisory(머지 차단 X, 코멘트만 — `lhci` 도입) 로 격상 검토 (Amendment 1).

### T6. PLAN 항목 분해 = 4 sub-task (a~d). `harness:e2e` 통합 X 는 본 ADR 이 정정.

PLAN 3.5.1 본문이 "harness:e2e 에 통합" 이라 했으나 본 ADR §Context #3 + T2 에 따라 **별도 `harness:perf`** 로 정정. PLAN 항목에 ADR-0023 cross-ref + 정정 주석 1줄 추가. sub-task:

- **3.5.1.a** `lighthouse` devDependency 추가 (GATE-C amend) + `scripts/harness/perf-budget.ts` 신설 — Playwright Chromium 에 CDP 연결, mobile 프리셋, 4 페이지(T3) 측정. `package.json` scripts `harness:perf` 추가.
- **3.5.1.b** 임계값 게이트 (T4) — LCP ≤ 2.5s / TBT ≤ 200ms hard, perf ≥ 90 / a11y ≥ 95 soft, first-load JS advisory. 표 출력 + exit code (hard 위반 시 exit 1).
- **3.5.1.c** axe 커버리지 보강 — `e2e/accessibility.spec.ts` 의 페이지 목록에 페이즈 3 신규 라우트(`/r/[shortId]`, `/compare/[category]/postal|household|current-provider|bill|preview`) 추가, 0 violations 재확인. `perf-budget.ts` 가 같은 4 페이지에 axe 도 돌려 advisory 출력.
- **3.5.1.d** `/ship` 슬래시 커맨드 + 페이즈 3 종료 체크리스트에 `pnpm harness:perf` 호출 추가 (CI ci.yml 변경 X — T5). PLAN 3.5.1 본문에 ADR-0023 cross-ref + "harness:e2e→harness:perf 정정" 주석.

## Alternatives

- **대안 A — `harness:e2e` 안에 합치기 (PLAN 원문 그대로)**: 장점 = PLAN 한 줄 그대로 이행. 단점 = §Context #3 — 관심사 혼합, 실행 시간, 진단 흐려짐, flakiness 전염. **거부.**
- **대안 B — `@lhci/cli` + LHCI server**: 장점 = 시계열 대시보드, GitHub status 통합. 단점 = LHCI server 호스팅 비용 + config 복잡 + 솔로엔 과함. **거부** (회귀 트리거로 재검토 여지).
- **대안 C — `e2e/*.spec.ts` 안에 Playwright assertion 으로**: 장점 = `test:e2e` 한 번에. 단점 = Lighthouse 는 Playwright test runner 와 라이프사이클이 안 맞음 (별도 Chromium 인스턴스, 긴 실행) + `test:e2e` 가 무거워짐. **거부** (axe 만 거기 유지).
- **대안 D — CI 머지 차단 게이트로**: 장점 = P2 를 강하게 강제. 단점 = ADR-0002 lint 교훈 — flaky → noise → 무시 → P2 무방비. **거부** (T5).
- **대안 E — 유료 SaaS (Calibre / SpeedCurve / treo.sh)**: 장점 = 실측 field 데이터 + 알림. 단점 = €20~€100+/월, €300 cap 위협. **거부** — 페이즈 6 운영 인프라 + 실 트래픽 발생 시 재검토 (당시엔 PostHog/Sentry web vitals 또는 Vercel Speed Insights 무료 티어가 1차).

## Consequences

- ✅ 헌법 P2 (LCP ≤ 2.5s, FID ≤ 100ms) 가 처음으로 *자동 측정* 됨 — 페이즈 3 결과 페이지(가장 무거운 RSC + 비교 표)의 회귀를 잡는다.
- ✅ 페이즈 3 검증 라인("Lighthouse 모바일 ≥ 90")의 실행 근거가 명시됨 — 더 이상 "수동으로 어떻게든".
- ✅ axe 커버리지가 페이즈 3 신규 라우트까지 닿는지 확인됨 (페이즈 2 의 "6페이지" → 페이즈 3 후 ~11페이지).
- ✅ 의존성 1건만 추가 (`lighthouse`) — 새 브라우저 바이너리 0, 새 SaaS 0, €300 cap 영향 0.
- ⚠️ `harness:perf` 는 `next build && next start` 가 선행돼야 의미 있음 — 운영자가 이 순서를 기억해야 함 (스크립트에 가드 메시지로 완화).
- ⚠️ CI 머지 차단이 아니므로, PR 단위 perf 회귀는 코드 리뷰 + 로컬 측정에 의존 — 누적 회귀는 `/ship` 에서만 잡힘 (의도된 트레이드오프, T5).
- ⚠️ TBT 를 INP/FID 의 lab proxy 로 씀 — 실측 field INP 와 다를 수 있음. 페이즈 6 에서 PostHog/Vercel Speed Insights field 데이터로 보완 (회귀 트리거).
- ⚠️ ADR 번호 재지정: PLAN §D.3.e + ADR-0020 §결정 6 의 "가칭 ADR-0023" → "가칭 ADR-0024" (Neon Vercel Integration). 본 follow-up 에서 PLAN 갱신, ADR-0020 본문은 P5 정합상 수정 X (cross-ref 만 — scribe 후속).

## Verification

- **이 결정이 옳았는지**: (1) `pnpm harness:perf` 가 로컬에서 4 페이지 측정 완료 + LCP/TBT 표 출력 + hard 위반 시 exit 1 (2) 페이즈 3 결과 페이지 LCP ≤ 2.5s (mobile lab) 실측 (3) axe 0 violations 가 페이즈 3 신규 라우트 포함해서도 유지 (4) `/ship` 실행 시 `harness:perf` 가 호출됨.
- **harness**: `pnpm harness:perf` 자체. + 페이즈 3 종료 시 1회 수동 실행 결과를 PLAN 3.5.1 sub-task 에 기록.
- **회귀 트리거**: (1) 배포 후 실측 LCP > 2.5s → CI advisory(`lhci` 코멘트) 격상 = Amendment 1 (2) `harness:perf` 가 로컬에서 3회 연속 flaky (같은 빌드인데 LCP 판정 흔들림) → 임계값에 마진 추가 또는 N회 측정 median (3) `lighthouse` 가 Chrome 버전과 충돌 → `@lhci/cli` 또는 핀 버전 (4) 페이지 셋 변경 (라우트 추가/삭제) → T3 표 갱신 (5) 페이즈 6 진입 시 field 데이터 도구(Vercel Speed Insights / PostHog web vitals) 도입 → lab/field 매핑 재검토.

## References

- 헌법 P2 (Core Web Vitals 예산), P4 (typecheck/lint/test 0), P5 (ADR).
- [ADR-0002](0002-build-gate-ownership.md) — CI 게이트 책임 분리 + Amendment 1 (CI lint 제거, flaky→noise 교훈). 본 ADR T5 의 직접 선례.
- [ADR-0021](0021-phase-3-results-page-design.md) — 페이즈 3 결과 페이지 (`/r/[shortId]` 3층 구조) — 측정 대상 페이지 4번.
- [ADR-0022](0022-database-environment-separation.md) — §작성 메모의 "가칭 ADR-0023" 예약을 본 ADR 이 소비, Neon Vercel Integration 은 ADR-0024 로 이연.
- [ADR-0020](0020-arbitoria-inventory-and-alignment-corrections.md) §결정 6 — Neon-side Vercel Integration "가칭 ADR-0022→0023" → 본 ADR 로 인해 "가칭 ADR-0024" 재지정.
- PLAN §3.5.1 (분해 대상), §D.3.e (번호 재지정 대상), 페이즈 3 검증 라인.
- 기존 자산: `scripts/harness/e2e-smoke.ts` (동형 패턴 — `E2E_BASE_URL` 가드), `e2e/accessibility.spec.ts` (axe 6페이지 0 violations, 페이즈 2).
- **GATE 정의**: GATE-P = 본 ADR T1~T6 운영자 승인 → Accepted + builder 인계 (페이즈 3.5 진입, M7 말).
