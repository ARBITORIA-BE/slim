# e2e CI 실 동작 진단 — ADR-0044 §D4 verifier 4.17.c 산출물

**작성**: 2026-06-09 (verifier, PLAN 4.17.c)
**cross-ref**: ADR-0044 §D4 / `e2e/compare-flow.spec.ts` / `.github/workflows/ci.yml`

---

## 진단 결론

**H1 확정**: CI 워크플로(`ci.yml`)에 `pnpm test:e2e` 단계가 없다.
e2e는 로컬 수동 실행 전용이었으며, PR #50/51/52/53 병합 시 CI가 e2e를 한 번도 실행하지 않았다.

---

## 가설 3종 검증 결과

### H1 — `ci.yml`에 e2e 단계 부재 ✅ 확정

`.github/workflows/ci.yml` 현재 내용:

```yaml
steps:
  - Typecheck       # pnpm typecheck
  - Test            # pnpm exec vitest run
  - Harness - plan integrity   # pnpm harness:plan
  - Harness - data fidelity    # pnpm harness:data
```

`pnpm test:e2e` 단계 없음. GitHub Actions PR 실행 로그(run ID 27200947029, PR #53 `fix/4.16-household-onsubmit-preview`) 확인:

```
job: gate
  steps: Set up job / checkout / pnpm setup / node setup /
         Install dependencies / Typecheck / Test /
         Harness - plan integrity / Harness - data fidelity
  → e2e 단계 없음. 총 소요 1분 22초.
```

회귀 #3(PR #51), #4(PR #52), #5(PR #53) 모두 동일 패턴. e2e는 CI 게이트에 존재하지 않았으므로 머지 차단 불가능했다.

### H2 — `reuseExistingServer: true` stale dev 서버 ⬜ 해당 없음

`playwright.config.ts`:

```ts
reuseExistingServer: !process.env.CI,
```

CI 환경(`process.env.CI = true`)이면 항상 새 dev 서버를 기동한다. H2는 로컬 실행 시만 해당하고, CI 실행 자체가 없었으므로 이 가설은 적용 불가.

### H3 — 운영자가 e2e CI fail을 skip/merge ⬜ 해당 없음

CI에 e2e 단계가 없으므로 fail 자체가 없었다. 운영자 판단 여지 없음. H3 성립 안 함.

---

## 근본 원인 요약

| 항목 | 내용 |
|---|---|
| 확정 가설 | **H1** — `ci.yml` e2e 단계 부재 |
| 영향 범위 | PR #50/51/52/53 전부 (회귀 #2~#5) |
| e2e 파일 위치 | `e2e/compare-flow.spec.ts` |
| e2e 어셔션 | `:50` `toHaveURL(/household/)` — 회귀 #3/#5 잡을 수 있었던 어셔션 |
| 현재 e2e 실행 방법 | 로컬 `pnpm test:e2e` (수동) 전용 |

---

## 후속 결정 (ADR-0044 §D4 운영자 결정 영역)

architect 사전 추정: **옵션 (나)** — 정적 룰(ADR-0044 룰 3종) + 운영자 prod 실측 이중화로 봉합. e2e CI 추가는 미래 Amendment.

### 옵션 (가) — e2e CI 추가

`ci.yml`에 Playwright 단계 추가:

```yaml
- name: Install Playwright browsers
  run: pnpm exec playwright install --with-deps chromium
- name: E2E
  run: pnpm test:e2e
```

비용: Playwright Chromium 다운로드 약 200MB, 실행 약 60초(dev 서버 기동 포함). GitHub Actions ubuntu-latest 분당 과금 없음(public repo). **운영자 €300/월 cap 영향 0**.

단, `reuseExistingServer: !process.env.CI` → CI에서 `pnpm dev` 기동 필요. `next build` 로컬 환경 버그(WasmHash, MEMORY.md) 와 무관 — `pnpm dev` 는 정상 동작.

### 옵션 (나) — 정적 룰 + 운영자 prod 실측 (현재 채택 중)

ADR-0044 룰 3종(Rule i/ii/iii)이 회귀 #2~#5 패턴을 정적으로 100% 차단. 운영자 Chrome MCP 실측이 동작 검증 담당. CI e2e 없이도 재발 방지 가능.

**운영자 변경 신호 시**: PLAN + ADR-0044 Amendment 3 트리거.

---

## Amendment 트리거 조건 (ADR-0044 §Amd 3)

다음 중 하나 발생 시 옵션 (가) CI 추가 검토:

1. 룰 3종 정적 스캔이 잡지 못하는 위음성 회귀가 prod에서 발화할 때
2. 운영자가 prod 실측 없이 CI 단독으로 회귀 차단을 원할 때
3. 페이즈 5 통신 외 카테고리 진입으로 e2e 케이스가 3건 이상 늘어날 때
