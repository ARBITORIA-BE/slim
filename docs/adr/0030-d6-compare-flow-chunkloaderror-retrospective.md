# ADR-0030: D.6 compare-flow ChunkLoadError 회고 — Claude 세션 환경 특이성으로 close

## Status

**Accepted** (2026-05-13 — 운영자 직접 결정, Pieter 단일 세션 검증). PLAN §0.5 **D.6** ([!] blocker, 2026-05-13 신설)을 close 처리하고 **4.6 베타 모집** 진입 차단 해제. 코드 변경 0건 / e2e spec 변경 0건 / `playwright.config.ts` 변경 0건.

> ADR 번호 메모: `docs/adr/` 현황 = 0001~0011, 0013, 0015~0023, 0025~0029 사용. **0012·0014 = 갭(끼워넣기 금지)**. **0024 = "가칭" 예약** (Neon-side Vercel Integration, GATE-K 트리거, 파일 미작성). 따라서 본 ADR 은 다음 빈 번호 **0030**. (작성 시점 `docs/adr/INDEX.md` + 파일 목록 재확인.)

## Context

**D.6 발견 경위 (2026-05-13)**: 3.5.1.e 후속 색상 fix 커밋 `e7c6f69` 작업 중 builder 가 `git stash` 로 *기존* 실패 확인 → preview 색상 변경과 무관, 그 이전부터 존재하는 회귀. PLAN §0.5 **D.6** 신설 + [!] 4.6 배포 blocker 로 잠금.

**증상**: `pnpm test:e2e e2e/compare-flow.spec.ts` 2건 모두 *5단계 입력 → `/r/[shortId]` redirect* 단계에서 timeout 10s 초과. Playwright `error-context.md` page snapshot:

```yaml
- 'heading "Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)." [level=2] [ref=e4]'
```

**1차 정찰 (architect, 2026-05-13, 커밋 `a7fc480`)**: Playwright trace 분석 → `ChunkLoadError: Loading chunk 68 failed` 식별. `pageError` event 안 stack trace 가 webpack runtime `r.f.j` 에서 발생. **React render throw 가 아님** — Explore 초기 가설 폐기. preview/page.tsx 의 `useEffect` / `submit` / `safeParse` / `useCompareSession` / `use(params)` 는 모두 정상 (정찰 완료). 백엔드(`/api/compare`) + 페이지 라우트(`/compare/mobile/preview` 200 + RSC HTML 정상) 단독 검증 통과.

**`.next/` 캐시 클리어 + 재실행 시도 (1차 세션)**: 동일 ChunkLoadError 재현. Claude 환경 (Windows bash + dev server background) 의 *dev mode chunk hash race* 가능성 — dev 서버 hot reload 가 chunk 재생성하는데 e2e spec 의 browser 가 *stale hash* 요청. **사용자(별개 dev 서버 + 다른 timing) 환경 재현 여부 확인 필요**로 D.6.b 분기.

**2차 검증 (본 세션, 2026-05-13)**: 좀비 dev server (PID 28080, 1차 세션 잔류) 정리 후 클린 재기동. `pnpm test:e2e e2e/compare-flow.spec.ts` 재실행:

```
[검증] 5단계 완주 시간: 2154ms (P2 5분 = 300_000ms)
[검증] 콘솔 에러 수: 0
  ok 1 e2e\compare-flow.spec.ts:17:5 › 5단계 입력 → /r/[shortId] 도달 (mobile + 1000 + single + skip + bill skip) (2.2s)
  ok 2 e2e\compare-flow.spec.ts:90:5 › 5단계 + provider 선택 path (Proximus) + tariff 모르겠어요 → /r/[shortId] (Sub-task 6) (2.2s)

  2 passed (5.1s)
```

**SSR/청크/엔드포인트 단독 재검증** (좀비 정리 후, 본 세션 curl):
- `/compare/mobile/preview` HTML 200 + 25.9KB + "결과를 준비 중입니다" 텍스트 정상.
- 청크 3건 (`src_app_compare_[category]_preview_page_tsx_*`, `src_*`, `node_modules__pnpm_*`) 모두 HTTP 200 + 정상 사이즈.
- `POST /api/compare` (valid input) → `{"ok":true,"shortId":"j-21va0hBxqZ"}` 200.
- `GET /r/j-21va0hBxqZ` → HTML 200 + h1 "비교 결과" 노출.

**결론**: D.6 ChunkLoadError 는 **1차 세션의 좀비 dev process(PID 28080) + 누적된 turbopack 상태** 에서 비롯된 transient 환경 특이성. 코드/스펙/설정의 결함 아님. 운영자 환경(별개 dev 프로세스 lifecycle)에서는 재현 안 됨으로 추정 — 4.6 베타 진입 *직전* 운영자 본인 환경 1회 확인으로 정직성 잠금 충족.

PLAN 매핑: §0.5 **D.6** (전체) close. D.6.a 정찰 결과 보존, D.6.b "환경 특이성 close" 분기 채택. D.6.c (Fix 옵션 a/b/c 적용) **미실행** — 본 ADR 이 close 근거.

## Decision

**3개 결정 (T1~T3).**

### T1. D.6 = "Claude 세션 환경 특이성" 분류 → close, 코드 변경 0건

- D.6.b 분기 채택 — 본 세션(좀비 정리 후) e2e 2/2 통과 + curl 단독 검증 4건 통과로 환경 특이성 입증.
- **거부**: Fix 옵션 (a) `playwright.config.ts` 의 webServer 를 `pnpm dev` → `pnpm build && pnpm start` 변경. 사유 = 재현이 안 되는 상태에서 production build 강제 시 e2e 시간 5~10분 증가 + 페이즈 2 5분 walltime 검증의 dev-mode 신호 약화(ADR-0016 §검증 2 의 5분 정합은 *사용자가 실제로 만나는 dev 빌드와 가까운 신호* 가 의도). flaky→noise 회피 (ADR-0002 Amendment 1 정합).
- **거부**: Fix 옵션 (b) `next.config.ts` 의 `output: 'standalone'` 또는 webpack `optimization.runtimeChunk`. 사유 = 재현 안 되는 상태에서 설정 변경은 추측. 복잡도 + 회귀 위험.
- 4.6 베타 진입 *직전* 운영자 본인 환경에서 `pnpm test:e2e e2e/compare-flow.spec.ts` 1회 통과 확인을 D.6 final close 게이트로 둔다 (§Verification).

### T2. 재발 방지 = "좀비 dev process 감지" 1차 가드만 추가 — 그 외 코드/설정 무변경

- 추가 코드 0건. 추가 hook 0건 (현 세션). PLAN §D.6 close 메모에 *재발 트리거* 만 남긴다:
  - 트리거: `pnpm test:e2e e2e/compare-flow.spec.ts` 2건 중 1건 이상 client exception (`Application error: a client-side exception...`) 실패.
  - 1차 대응: `lsof -i :3000` (Win: `Get-NetTCPConnection -LocalPort 3000`) 로 좀비 dev process 확인 → kill → 재실행.
  - 2차 (1차 후 재발): `.next/` 삭제 → 재실행.
  - 3차 (2차 후 재발): D.6 재진입 + 본 ADR Amendment 작성 + Fix 옵션 (a) 적용 재검토.
- **거부**: 사전 hook 으로 좀비 감지 자동화. 사유 = 재발률 미관측(1회) + Windows/POSIX 명령 분기 hook 복잡도 + 운영자 1회 cost 가 hook 유지보수 cost 보다 낮음.
- **거부**: `app/global-error.tsx` 추가(ChunkLoadError 시 자동 `window.location.reload()`). 사유 = 재현 안 되는 환경 특이성에 대한 방어 코드는 *검증 불가능* — unit test 만으로 통과 신호를 만들면 가짜 안심.

### T3. 4.6 베타 진입 시 정직성 잠금 = 운영자 본인 환경 manual + e2e 1회 검증

- 4.6 베타 모집 카피 ("5분 안에 결과", ADR-0029 §T2 정직성 토큰 4) 배포 *직전* 운영자가:
  1. 본인 dev 환경에서 `pnpm dev` 클린 기동 (좀비 없는 상태).
  2. `pnpm test:e2e e2e/compare-flow.spec.ts` 1회 통과 확인.
  3. 사용자 브라우저(Chromium/Firefox/Safari 중 ≥2 종)에서 manual 5단계 흐름 1회 통과 확인 — preview → `/r/[shortId]` 도달.
- 위 3단 통과 시 4.6 모집 카피 배포. 1건이라도 실패 시 D.6 재오픈 + Fix 옵션 (a) 적용.
- 본 ADR Verification 섹션이 게이트 정의 — 운영자가 위 3단을 PLAN §D.6 close 줄에 날짜 + 결과로 표기.

## Verification (D.6 final close 게이트)

운영자 본인 환경에서 4.6 베타 모집 카피 배포 *전* 다음 3단 모두 통과:

| 단계 | 명령/액션 | 통과 조건 |
|---|---|---|
| V1 | `pnpm dev` 클린 기동 (port 3000 free 확인) | `Ready` 출력 + 3000 단일 점유 |
| V2 | `pnpm test:e2e e2e/compare-flow.spec.ts` | 2/2 passed, 콘솔 에러 0 |
| V3 | 브라우저 manual 5단계 (≥2 브라우저) | `/compare/mobile/postal` → ... → `/preview` → `/r/[12자 shortId]` h1 "비교 결과" 도달 |

3단 모두 통과 → PLAN §D.6 [!] → [x] + 본 ADR §Status "운영자 환경 검증 완료 (YYYY-MM-DD)" 추가.

본 세션(Claude) 검증 = V2 단독 + curl 단독 4건 (§Context). V1·V3 은 운영자 환경 의존 — close 게이트 미충족 시점에 PLAN 마킹 보류.

## Alternatives Considered

1. **Fix 옵션 (a) — `pnpm build && pnpm start` 강제** (PLAN §D.6 원안). 거부: §T1.
2. **Fix 옵션 (b) — Next.js/webpack 설정 변경** (PLAN §D.6 원안). 거부: §T1.
3. **`global-error.tsx` 방어 코드 추가** (본 세션 architect 제안 B 갈래). 거부: §T2.
4. **사전 hook 으로 좀비 dev process 자동 감지** (재발 방지 자동화). 거부: §T2.
5. **D.6 무시하고 4.6 진입** — 거부. P3 (투명성은 운영자의 짐) + ADR-0029 §T2 정직성 토큰 4 위반 — 사용자가 같은 에러를 만날 1% 위험도 4.6 카피 ("5분 안에 결과") 와 정면 충돌.

## Impact

**코드 변경 0건**. `playwright.config.ts` 무변동. `next.config.ts` 무변동. `src/app/compare/[category]/preview/page.tsx` 무변동. 신규 파일 0건 (본 ADR 제외).

**PLAN.md 변경**:
- §0.5 **D.6** 항목 `[!]` → `[x]` (단, V1·V3 운영자 검증 미완료 시 보류 — §Verification).
- D.6 본문 끝에 "본 ADR cross-ref + close 메모 + V1/V3 재발 트리거" 추가.
- "작업 추적 메타" 합계 표: 차단 1↓ (D.6 해제) + 완료 1↑ — verifier 가 D.6 마킹 시 갱신.

**INDEX.md 변경**: `ADR-0030` 행 추가 + 설명 섹션 추가.

**4.6 베타 영향**: D.6 close 시점에 4.6 모집 카피 배포 차단 해제. 단, §Verification V1·V3 게이트는 운영자 환경 의존 — 본 ADR 만으로는 V2 (Claude 환경 e2e) 충족 + V1·V3 운영자 후처리. ADR-0029 §T2 정직성 잠금 = V1·V3 통과 후 카피 배포.

**외부 의존성 변경 0건**. €300/월 cap 영향 0. Vercel 빌드 영향 0. 마이그레이션 0건.

**회귀 트리거 3개**:
1. `pnpm test:e2e e2e/compare-flow.spec.ts` 1건 이상 client exception 재발 → §T2 1차/2차/3차 대응 단계 진입.
2. 운영자 환경 V3 manual 실패 → D.6 재오픈 + Fix 옵션 (a) 적용 + 본 ADR Amendment 1.
3. 다른 5단계 e2e (`accessibility.spec.ts`, `result-page.spec.ts`) 에서 동일 ChunkLoadError 패턴 발견 → 환경 특이성 가설 폐기 + Fix 옵션 (a/b) 재검토 + 본 ADR Amendment.

## References

- PLAN.md §0.5 **D.6** (2026-05-13 신설, 본 ADR 로 close).
- ADR-0002 (Build gate 책임 분리) + Amendment 1 — flaky→noise 교훈 (§T1 (a) 거부 근거).
- ADR-0016 §검증 2 (페이즈 2 5분 walltime) — dev-mode 신호 유지 정당성 (§T1).
- ADR-0029 §T2 (4.6 베타 정직성 토큰 4 "5분 안에 결과") — V1·V3 게이트 근거 (§T3).
- ADR-0017 (DB 미스매치 사건 종결 보고) — 환경 특이성 진단 패턴 선례.
- 커밋 `a7fc480` (architect 1차 정찰 — ChunkLoadError 식별).
- 커밋 `d3cc762` (D.6 신설 — 4.6 blocker 잠금).
- 커밋 `e7c6f69` (3.5.1.e 후속 색상 fix — D.6 발견 trigger 커밋).
