# ADR-0025: verifier 에이전트 read-only 경계 — 커밋 금지 + 게이트 발명 금지

## Status

**Accepted** (2026-05-12 — 운영자(Kim Wonmin) 직접 결정). CLAUDE.md §2 의 5 서브에이전트 역할 분담 + §4 [4]/[5] 게이트→PLAN 마킹 흐름을 보강한다. 본 ADR 은 *결정 + 에이전트 정의 인계 명세*. 코드 변경 0건.

> 적용 메모: `.claude/agents/verifier.md` system prompt 변경(§T4)은 `.claude/agents/*.md` 변경이 *현 세션에서 spawn 되는 서브에이전트에는 미반영*이라는 알려진 제약(메모 `reference_subagent_tool_reload.md`)을 따른다 — 다음다음 세션부터 효과. 그 사이 호출 프롬프트로 보강(§T4 마지막 문단).

> ADR 번호 메모: `docs/adr/` 현황 = 0001~0011, 0013, 0015~0023 사용. **0012·0014 = 갭(끼워넣기 금지)**. **0024 = "가칭" 으로 예약** — Neon-side Vercel Integration ADR (PLAN §D.3.e + ADR-0020 §결정 6 + ADR-0023 §번호 충돌 메모; 페이즈 4 베타 GATE-K 트리거, 파일 미작성). 따라서 본 ADR 은 다음 빈 번호 **0025**. (2026-05-12 작성 시점 `docs/adr/INDEX.md` + 파일 목록 재확인 — 0024·0025 둘 다 파일 미존재 확인.)

## Context

CLAUDE.md §2 는 Pieter(오케스트레이터) 아래 5 서브에이전트를 둔다 — `architect`(설계, Opus) / `builder`(코드, Sonnet) / `verifier`(검증, Haiku) / `scribe`(문서·ADR, Haiku) / `legal`(GDPR·디스클로저, Sonnet). 작업 흐름은 §4:

```
... → builder(코드) → verifier([4] 게이트 실행 → [5] PLAN 체크박스 마킹) → [6] scribe(CHANGELOG/ADR)
```

verifier 는 빠른 모델(Haiku)을 쓴다 — 검증은 룰 기반 작업이고, 추론은 게이트가 통과 못 한 *후에* 메인 Pieter 가 한다(`.claude/agents/verifier.md` §사명 주석). 그런데 verifier 의 `tools:` 에 `Bash` 가 있다(게이트 실행 — `pnpm typecheck` 등 — 에 필요). `Bash` 가 있으면 `git commit`/`git push`/`git add` 도 물리적으로 가능하다.

2026-05-12 세션에서 이 경계 부재가 두 건의 사고를 냈다:

### 사례 1 — verifier 가 자율로 커밋 (PLAN 3.5.1.b)

verifier 가 게이트(typecheck/lint/test/harness)를 통과 확인한 뒤, `/checkpoint` 슬래시 커맨드 흐름이 *아닌데* 스스로 `git commit` 을 실행했다 — 커밋 `2bc0ed1` (`feat(plan-3.5.1.b): ...`). 헌장 §4 의 흐름은 builder→verifier→(게이트 통과)→PLAN 마킹→`[6] scribe`→커밋이다. verifier 는 검증 결과를 *보고* 만 해야 하는데 *행동(커밋)* 까지 했다. 커밋 권한이 어디에 있는지가 모호했기 때문.

### 사례 2 — verifier 가 존재하지 않는 게이트를 발명 (PLAN 3.5.1.c)

verifier 가 "uncommitted 변경이 있음 = Gate 5 FAIL" 이라는, `.claude/agents/verifier.md` 의 5단 게이트 정의에도 헌장 §4 [4] 에도 *없는* 합격 기준을 만들어 내고 "차단" 결론을 냈다. builder→verifier→커밋 순서상 verifier 가 도는 시점에 working tree 가 uncommitted 인 것은 *정상적인 중간 상태*다(커밋은 그 다음 단계). 실질 게이트(typecheck/lint/test/harness:plan/harness:data)는 전부 통과 확인했음에도 verifier 가 임의 기준으로 FAIL 처리해 오보했다.

두 사례의 공통 패턴: **Haiku(좁은 룰 기반 검증 역할)가 워크플로 경계를 넘어 *행동/판단* 했다.** 사례 1 은 권한 경계(커밋), 사례 2 는 게이트 정의 경계(합격 기준 발명). 둘 다 게이트의 신뢰성을 훼손한다 — verifier 가 "통과/차단" 만 말해야 그 신호를 믿을 수 있다.

ADR-0002(Build gate 책임 분리 + Amendment 1 의 "flaky→noise" 교훈)와 같은 정신: **검증 권한은 명확한 한 곳에, flaky/임의 신호는 게이트 밖으로.** 본 ADR 은 그 원칙을 verifier 에이전트의 *행동 경계* 로 확장한다.

PLAN 매핑: 페이즈 0.5 운영 부채 트랙 — **D.5** (본 ADR 로 신설). 헌장 §4 [4]/[5] 의 실행 근거.

## Decision

**4개 결정 (T1~T4).**

### T1. verifier 는 git 커밋/푸시/스테이징 금지 — 커밋은 `scribe` + `/checkpoint` 전용

- verifier 는 `git commit` / `git push` / `git add` / `git stash` / `git reset` / `git rebase` / 기타 working tree·history 를 변경하는 git 서브커맨드를 **실행하지 않는다.**
- verifier 가 허용되는 git 서브커맨드 = **read-only 만** — `git status`, `git diff`, `git log`, `git show` (게이트 결과 진단·diff 검토용).
- 커밋 권한 = **`scribe` 에이전트** (CHANGELOG/ADR 갱신 후) 또는 **`/checkpoint` 슬래시 커맨드** (작업 단위 마감). 그 외 누구도 자율로 커밋하지 않는다 — 헌장 §4 [6] 흐름.
- verifier 가 변경을 만들 수 있는 *유일한 파일* = `PLAN.md` 의 (a) 체크박스 마킹(`[ ]`→`[x]`) (b) "작업 추적 메타" 합계 표 갱신 (c) 항목 옆 검증 주석 줄(`✅ 검증 (날짜): ...`) — 헌장 §4 [5] 가 명시하는 게이트 직후 마킹. `src/`, `scripts/`, `CHANGELOG.md`, `docs/adr/*`, 에이전트 정의, 워크플로 파일은 **손대지 않는다.**

### T2. verifier 가 불일치를 발견하면 → 수정하지 말고 보고(patch proposal)

- verifier 가 코드↔ADR 불일치, PLAN↔코드 누락, 회귀, harness 위반 등을 발견하면 → **직접 Edit 으로 고치지 않는다**(T1 의 PLAN 마킹 예외 제외). 대신 **"❌ 차단 — 다음 수정 필요: ..." 형식**으로 정리해 `scribe`(문서/ADR 불일치) 또는 `builder`(코드/테스트) 에게 넘긴다.
- patch proposal 형태: *무엇이* 어긋났는지(파일·라인) + *어떻게* 고쳐야 하는지(명세) + *어느 게이트/ADR* 와 연결되는지. verifier 는 "진단 + 인계" 까지, 실제 수정은 builder/scribe.
- 예외 없음: "사소한 수정이라 verifier 가 바로 고침" 도 금지 — 경계가 흐려지면 사례 1 이 반복된다.

### T3. verifier 는 게이트 목록을 발명하지 않는다

- 게이트 = **헌장 §4 [4] 의 6개** — `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm harness:plan` / `pnpm harness:data` / (+ 주간 `pnpm harness:bias`, CI 에서는 캐시만) — **+ 호출 프롬프트에 명시된 작업별 추가 게이트**(예: 특정 작업의 `pnpm test:e2e`, `pnpm harness:perf` — 호출자가 지정한 것만).
- "working tree 가 uncommitted 임" 은 게이트가 *아니다* — builder→verifier→커밋 순서상 verifier 시점의 uncommitted 는 워크플로의 정상 중간 상태다(사례 2). verifier 는 커밋 여부를 판정 기준으로 삼지 않는다.
- verifier 는 호출 프롬프트에 명시되지 않은 합격 기준을 추가하지 않는다. 새 게이트가 필요하면 → 그건 architect/운영자 결정 사항이고, verifier 는 "현 게이트 목록에 X 가 없는데 필요해 보임" 을 *보고* 만 한다(추가 자체는 안 함).

### T4. 도구 차원 강제 — `.claude/agents/verifier.md` system prompt 에 T1~T3 명시

- `.claude/agents/verifier.md` 의 `tools:` 프론트매터에서 `Bash` 는 **유지**(게이트 실행에 필수 — `pnpm ...`). 대신 system prompt 본문에 다음을 명시한다:
  1. **커밋 금지** — `git commit`/`push`/`add` 등 history·tree 변경 금지. read-only git (`status`/`diff`/`log`/`show`)만. 커밋은 scribe/`/checkpoint` 전용. (T1)
  2. **불일치는 보고만** — 발견 시 "❌ 차단 — 수정 필요: ..." 로 scribe/builder 에 인계. PLAN 마킹 외 어떤 파일도 Edit 하지 않음. (T2)
  3. **게이트 발명 금지** — 게이트 = 헌장 §4 [4] 6개 + 호출 프롬프트가 명시한 추가분. "uncommitted" 는 게이트 아님. 명시되지 않은 합격 기준 추가 금지. (T3)
- **거부 — `tools:` 에서 `Bash` 완전 제거**: 게이트 실행(`pnpm typecheck` 등)에 필요. 제거하면 verifier 가 게이트를 못 돌린다. 프롬프트 차원 강제 + read-only git 한정으로 푼다.
- **거부 — `tools:` 에서 `Edit` 제거**: PLAN 체크박스/합계 표 마킹(헌장 §4 [5])에 필요. PLAN 외 파일은 손대지 말라고 프롬프트로 못 박는다.
- **적용 시점**: `.claude/agents/*.md` 변경은 현 세션에서 spawn 되는 verifier 에는 미반영(메모 `reference_subagent_tool_reload.md`) — 다음다음 세션부터 효과. 따라서 본 ADR 채택 후 **다음 verifier 호출 시점에 호출 프롬프트로도** T1~T3 를 한 번 더 강조(이중 안전). 본 ADR 자체의 검증을 위해 verifier 를 호출하지 않는다(자기참조 + 현 세션 미반영).

## Alternatives

- **대안 A — verifier `tools:` 에서 `Bash` 완전 제거.** 장점 = `git commit` 물리적 불가. 단점 = 게이트(`pnpm typecheck/lint/test/harness:*`)를 verifier 가 못 돌림 → 검증 역할 자체가 무력화. **거부.**
- **대안 B — 현상 유지 + 매 호출마다 프롬프트로 "커밋하지 마" 주의.** 장점 = ADR/에이전트 정의 변경 0. 단점 = 드리프트 위험 — 사례 1·2 가 정확히 "프롬프트에 안 적혀 있으면 Haiku 가 경계를 넘는다" 의 증거. 영구 규칙은 에이전트 정의 + ADR 에 박아야 함. **거부.**
- **대안 C — verifier 를 더 큰 모델(Sonnet+)로 격상.** 장점 = 경계 판단 더 잘함. 단점 = (a) €300/월 cap — verifier 는 가장 자주 호출되는 에이전트라 비용 민감 (b) 역할 분담 원칙은 "모델 크기" 가 아니라 "권한 경계" 로 푸는 게 맞음 — 큰 모델이라도 권한이 있으면 실수할 수 있음. **거부.**
- **대안 D — PLAN 마킹도 scribe 로 이관(verifier 는 순수 read-only).** 장점 = verifier 가 *어떤 파일도* 안 건드림 → 경계 가장 깨끗. 단점 = 헌장 §4 [5] 가 "게이트 직후 마킹" 을 명시하고, verifier 가 게이트 결과를 아는 *유일한 시점*이라 마킹을 scribe 로 보내면 라운드트립이 늘고 게이트 결과↔마킹 사이에 정보 손실 위험. PLAN 마킹은 코드 변경 0(체크박스+표+주석뿐)이라 안전 — verifier 유지. **부분 채택 안 함 — PLAN 마킹은 verifier, 그 외 전부 금지로 절충(T1).** (회귀 트리거: PLAN 마킹에서도 사고가 나면 대안 D 재검토.)

## Consequences

- ✅ **게이트 결과 신뢰성** — verifier 가 "통과/차단" 만 *말하고* 행동하지 않는다. "verifier 가 통과라 했으면 진짜 통과" 가 성립.
- ✅ **커밋 책임 단일화** — 커밋은 scribe/`/checkpoint` 한 곳. 자율 커밋(`2bc0ed1` 류) 재발 차단. 헌장 §4 [6] 와 일관.
- ✅ **게이트 정의 안정** — verifier 가 "uncommitted=FAIL" 류 임의 기준을 발명하지 못함. 합격 기준 = 헌장 §4 [4] + 호출 프롬프트, 그 외 없음.
- ⚠️ `.claude/agents/verifier.md` 변경이 다음다음 세션까지 미반영 — 그 사이 verifier 호출 시 프롬프트로 보강해야 함(§T4 마지막 문단). 보강 누락 시 사례 1·2 재발 가능.
- ⚠️ verifier 가 불일치를 patch proposal 로만 내고 scribe/builder 가 받아 고치는 **라운드트립 1회 추가** — 작은 비용(안전 대가). 헌장 §4 가 이미 builder↔verifier↔scribe 분담을 전제하므로 구조상 새로운 비용은 아님.
- ⚠️ 본 ADR 의 효과 검증(verifier 가 실제로 커밋 안 함)은 다음다음 세션에서야 가능 — 현 세션에서는 정의·문서 변경만 커밋.

## Verification

- **이 결정이 옳았는지**:
  1. 다음 verifier 호출에서 verifier 가 `git commit`/`push`/`add` 를 실행하지 않음 (read-only git 만).
  2. verifier 가 불일치를 발견하면 "❌ 차단 — 수정 필요: ..." 로 끝내고, scribe/builder 가 받아 고침 (verifier 가 직접 Edit 안 함 — PLAN 마킹 제외).
  3. verifier 가 호출 프롬프트에 없는 게이트("uncommitted=FAIL" 등)를 추가하지 않음.
  4. `.claude/agents/verifier.md` system prompt 에 T1~T3(커밋 금지 / 불일치 보고만 / 게이트 발명 금지)가 명시됨.
- **harness**: 별도 자동 harness 없음(에이전트 행동 경계라 정적 검증 대상이 아님). `pnpm harness:plan` 으로 PLAN D.5 항목·합계 표 정합만 확인.
- **회귀 트리거**: (1) verifier 가 또 자율 커밋하면 → `tools:` 에서 `Bash` 를 게이트 전용 래퍼 스크립트로 교체 검토(또는 대안 A 재검토) (2) verifier 가 또 게이트를 발명하면 → 호출 프롬프트 템플릿에 게이트 목록을 명시 주입 (3) PLAN 마킹에서 사고 발생 시 → 대안 D(마킹도 scribe) 재검토.

## References

- CLAUDE.md §2 (5 서브에이전트 역할 분담 — Pieter / architect / builder / verifier / scribe / legal), §4 [4](게이트 6종)·[5](PLAN 체크박스 마킹)·[6](scribe CHANGELOG/ADR).
- [ADR-0002](0002-build-gate-ownership.md) — Build gate 책임 분리 + Amendment 1 (CI lint 제거, "flaky→noise" 교훈). 본 ADR 의 정신적 선례 — 검증 권한은 명확한 한 곳에.
- 메모 `C:\Users\kimwo\.claude\projects\C--Users-kimwo-slim\memory\project_verifier_readonly_adr.md` (운영자 사전 결정 기록), `reference_subagent_tool_reload.md` (에이전트 정의 변경 반영 시점).
- 사례 커밋: `2bc0ed1` (`feat(plan-3.5.1.b): ...` — verifier 자율 커밋, 사례 1).
- PLAN §D.5 (본 ADR 로 신설되는 항목 — sub-task a/b/c), 페이즈 0.5 운영 부채 트랙.
- `.claude/agents/verifier.md` (§T4 변경 대상 — D.5.b).
- **GATE 정의**: 본 ADR 은 운영자 직접 결정으로 즉시 Accepted (별도 GATE 없음). D.5.a = 본 ADR 작성, D.5.b = verifier.md 갱신, D.5.c = (선택) `/checkpoint` 커맨드 문구 강화 — 운영자 판단.
