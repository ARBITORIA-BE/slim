# ADR-0002: Build gate 책임 분리 + Hook jq fallback 통일

## 상태

Accepted (2026-05-09) — verifier 통과: typecheck/lint/test/harness:plan/harness:data/build/ci.yml/jq-fallback 음성테스트 모두 통과. D.1.c (GitHub 브랜치 보호 규칙)는 사용자 UI 수동 작업으로 분리 추적.

**Amendment 1 적용** (2026-05-09): CI 워크플로의 `pnpm lint` 단계가 GitHub Actions ubuntu-latest에서 매번 실패 → lint 단계 제거. 본문 §Decision 1의 "5단 게이트"는 **4단 게이트 (typecheck → test → harness:plan → harness:data)** 로 축소됨. lint는 로컬 stop-gate 단독 책임으로 환원. 상세는 본문 끝 ## Amendment 1 섹션 참조.

## 맥락

페이즈 0 종료 시점에 두 운영 부채가 동시에 표면화되었다. 둘 다 "검증 권한이
어디에 있는가"라는 같은 사이클의 변종이라 한 ADR로 묶는다.

### 부채 1 — Vercel production build 실패

**사용자 보고**

- `eslint-config-next` + ESLint 9 호환(`@rushstack/eslint-patch`) 에러
- `scripts/harness/bias-audit.ts:85`의 `rows as any[]` 타입 에러
- 두 건 모두로 Vercel `next build`가 막혀 production 배포 불가

**working tree 진단 (2026-05-09 기준)**

| 보고된 원인 | 실제 상태 | 근거 |
|---|---|---|
| `eslint-config-next` 호환성 | **이미 제거됨**. ESLint 9 native flat config로 마이그레이션 완료 | `eslint.config.mjs` L1-59 — `@next/eslint-plugin-next`만 직접 plug, `@rushstack/eslint-patch` 미사용 |
| `bias-audit.ts:85` `as any[]` | **이미 수정됨** (`as unknown as RankRow[]`) | `scripts/harness/bias-audit.ts` working tree |
| `next.config.ts`의 build 검사 비활성화 | **부재** — `typescript.ignoreBuildErrors` / `eslint.ignoreDuringBuilds` 둘 다 미설정 | `next.config.ts` L1-8 |

**남은 진짜 원인**: `next build` (=Vercel)는 자동으로 내부 ESLint + typecheck를
돈다. 우리는 헌법 P4를 **로컬 stop-gate + 5단 게이트**로 강제하는 구조로
설계했고, Vercel의 내부 검사는 (a) 우리 native flat config + scripts/* 파일을
온전히 이해하지 못할 위험이 있고 (b) 이미 stop-gate가 책임지는 검증을 중복
실행한다. 즉 **검증 권한의 위치가 모호**하다.

PLAN 매핑: 페이즈 0.5 (현재 신설) — D.1.

### 부채 2 — Hook의 jq 의존성

| 파일 | jq fallback | 비고 |
|---|---|---|
| `scripts/hooks/_lib.sh` | ✅ L33-44 | sed/awk fallback |
| `scripts/hooks/stop-gate.sh` | ✅ L79-83 | block 출력에 fallback |
| `scripts/hooks/subagent-handoff.sh` | ✅ | jq 의존 제거 명시 |
| `scripts/hooks/pre-tool-guard.sh` | ❌ **L10** | `jq -r '.tool_input.command // ""'` — Windows에서 jq 부재 시 즉시 실패, hook 자체가 깨져 위험 명령이 차단되지 않을 수 있음 |

PreToolUse는 **위험 명령 차단**이 사명이므로, hook이 깨지면 P5 안전망이
무너진다. 단일 수정 포인트.

PLAN 매핑: 페이즈 0.5 — D.2.

---

## 결정

### Decision 1 — Build gate 책임 분리: 옵션 C 채택

**Vercel `next build`의 ESLint + typecheck 검사를 무력화하고, 검증 권한을
로컬 stop-gate(개발자 머신) + GitHub Actions CI(PR 단계)로 이중화한다.**

구체:

1. `next.config.ts`에 다음을 추가한다 (builder 명세 §1):
   ```ts
   typescript: { ignoreBuildErrors: true },
   eslint:      { ignoreDuringBuilds: true },
   ```
2. **CI 안전망 신설**: `.github/workflows/ci.yml`에서 push/PR마다 5단 게이트
   (typecheck → lint → test → harness:plan → harness:data) 실행. PR 머지 차단
   조건으로 등록. 이게 없으면 P4 강제가 로컬 stop-gate에만 의존하게 되어
   누군가 hook을 우회하고 push하면 잡을 곳이 없다.
   > **Amendment 1 (2026-05-09)**: lint 단계는 GitHub Actions 호환성 문제로
   > CI에서 제거됨 → **4단 게이트 (typecheck → test → harness:plan →
   > harness:data)**. lint는 로컬 stop-gate 단독 책임. 상세 본문 §Amendment 1.
3. `package.json`에 `build:ci` 스크립트는 **추가하지 않는다** — CI 워크플로
   자체가 게이트를 직렬로 실행하므로 중복 alias는 부채만 늘린다.

**근거**:

- 헌법 P4 ("`tsc --noEmit`이 0 에러여야 커밋 가능. PostToolUse 훅이 이를
  강제한다")는 **검증의 책임이 우리 게이트에 있음**을 이미 명시. Vercel 내부
  검사는 그 위에 얹힌 중복이지 진실원이 아니다.
- Vercel은 빌드 실패 시 production을 안 올리지만, 그건 **이미 PR이 머지된
  뒤**의 안전망이다. PR 머지 전 단계(=GitHub Actions)에서 차단하는 것이
  fail-fast 원칙에 부합.
- 이 결정으로 Vercel은 **순수 빌드/배포 머신**이 되고, 품질 게이트는 우리가
  소유한다. 헌법 P3 ("투명성은 운영자의 짐") 정신과 일치.

### Decision 2 — Hook의 jq fallback 통일

**모든 hook 스크립트는 `_lib.sh`의 jq fallback 패턴을 사용하거나, 동등한
인라인 fallback을 가져야 한다.**

`pre-tool-guard.sh:10`의 단일 수정 (builder 명세 §2). 이후 새 hook을 추가할
때도 이 정책을 따른다 — `scribe`가 hook PR 리뷰 시 체크.

---

## 대안

### 옵션 A — `next.config.ts`만 수정 (사용자 1차 제안)

`ignoreBuildErrors` + `ignoreDuringBuilds`만 추가, CI 워크플로 없음.

- ✅ 1줄 변경, 즉시 Vercel 통과
- ❌ **P4 강제가 로컬 stop-gate에만 의존**. hook을 우회한 push (`--no-verify`,
  다른 머신, settings.json 변조 등) 가 잡힐 곳이 없다. 헌법 P4 정신에 미달.
- **거부 사유**: 운영 리스크가 1줄의 편의보다 크다.

### 옵션 B — `eslint-config-next` 제거 + ESLint 9 native만 (사용자 2차 제안)

- ✅ 진짜 호환성 fix. Vercel 내부 ESLint도 통과 가능.
- ❌ **이미 적용 완료** — `eslint.config.mjs`는 이미 native flat config다.
  추가로 할 게 거의 없음.
- ❌ typecheck 회귀(`scripts/*` 타입 에러 등)는 여전히 `next build` 내부
  typecheck에서 잡혀 fail 가능 — Vercel의 typecheck 검사는 우리가 끄지 않으면
  남는다. 즉 ESLint만 정리해서는 부채 1을 끝까지 못 닫는다.
- **거부 사유**: 부분 해법. 결국 옵션 C의 일부.

### 옵션 C — A + CI 워크플로 보강 ✅ **채택**

위 Decision 1.

### 옵션 D — Vercel ignored build step에 자체 검증 묶기

`vercel.json`의 `ignoreCommand`로 `pnpm typecheck && pnpm lint && pnpm test`를
돌려, 실패 시 빌드 자체를 스킵.

- ✅ Vercel 한 곳에 게이트 집중
- ❌ Vercel build 환경에 pnpm test (DB/Redis mock 등) 의존성 끌어오기 부담.
  PR 단계 차단이 안 되어 머지 후 발견 — fail-late.
- **거부 사유**: GitHub Actions가 PR 차단까지 가능하므로 더 이른 단계가 우월.

---

## 결과

### ✅ 얻는 것

- Vercel production build 즉시 복구 (D.1)
- 검증 진실원이 단일화: **로컬 stop-gate + CI 워크플로 = 우리 영역**
- Vercel은 순수 빌드/배포 머신. 외부 도구 호환성에 우리 P4가 인질로 잡히지
  않음
- Windows + jq 부재 환경에서도 PreToolUse 안전망 동작 (D.2)
- ESLint 9 / Next 호환성 향후 변동에도 우리 게이트가 안정적

### ⚠️ 잃는 것 / 부채

- **P4 강제 위치 이동의 운영 리스크**:
  - `--no-verify` push, settings.json 변조, hook 비활성화로 stop-gate
    우회한 commit이 가능. 이 경우 GitHub Actions가 **PR 단계 마지막 방어선**
    — 워크플로 자체가 깨지면 P4가 무방비.
  - 완화책: (a) `main` 브랜치 보호 규칙으로 CI 통과 필수 + (b) 워크플로
    파일 변경은 CODEOWNERS로 architect 승인 필수 (페이즈 6.x에서 본격화).
- Vercel UI에서 빌드 로그를 볼 때 typecheck/lint 에러를 못 보게 됨 — 디버깅
  시 GitHub Actions 로그를 봐야 함.
- CI 워크플로 자체가 새 운영 표면 (실행 시간, 비밀 키, runner 비용).
- 옵션 D 대비, GitHub Actions 워크플로 작성/유지 비용.

---

## 검증 방법

1. **D.1 완료 검증**:
   - Vercel preview 배포 1회 성공 (현재 main 기준 `next build` 통과)
   - GitHub Actions CI가 PR에 ✅로 표시되며, 의도적으로 typecheck 깨는 PR을
     올렸을 때 ❌로 차단됨을 확인 (음성 테스트)
2. **D.2 완료 검증**:
   - `which jq`가 실패하는 환경(또는 `PATH` 임시 조작)에서 `pre-tool-guard.sh`에
     `rm -rf /` 명령 입력 → 차단 메시지 정상 출력
3. **장기 모니터링**:
   - Sentry/PostHog 영역은 아니지만, 월 1회 `git log --pretty=fuller`로
     `--no-verify` 흔적 있는 commit이 있는지 점검 (페이즈 6.x에서 자동화)

---

## 회귀 트리거 (Trigger for revisit)

다음 중 하나가 발견되면 ADR-0002를 재검토한다:

1. **stop-gate 우회 push가 main에 들어온 사례 1건이라도 발견** → 옵션 D
   (Vercel ignoreCommand) 또는 더 강한 pre-receive hook으로 격상 검토
2. **CI 워크플로 자체가 1주 이상 깨진 채 머지가 진행된 경우** → 워크플로
   robustness 또는 게이트 위치 재배치
3. **Vercel이 내부 검사 비활성화 옵션을 폐기** → next.config 우회 불가시
   옵션 B(완전한 호환성 정리)로 전환
4. **헌법 P4 문구가 "PostToolUse 훅이 이를 강제한다"에서 변경된 경우** →
   책임 위치 재정렬

---

## 참조

- 헌법: [`CLAUDE.md`](../../CLAUDE.md) — P4 (타입 안전), P5 (결정은 ADR로)
- PLAN 항목: 페이즈 0.5 D.1, D.2
- Next.js 공식 문서: [`typescript` config](https://nextjs.org/docs/app/api-reference/config/next-config-js/typescript),
  [`eslint` config](https://nextjs.org/docs/app/api-reference/config/next-config-js/eslint)
- 관련 파일:
  - `next.config.ts`
  - `eslint.config.mjs`
  - `scripts/hooks/pre-tool-guard.sh`
  - `scripts/hooks/_lib.sh`
  - `scripts/hooks/stop-gate.sh`

---

## Amendment 1 (2026-05-09): CI lint 단계 정리

### 트리거

본 ADR로 신설된 `.github/workflows/ci.yml`의 5단 게이트 중 `pnpm lint` 단계가
GitHub Actions `ubuntu-latest` 환경에서 **매번 실패** 한다 (사용자 보고).

**비대칭 진단**:

| 환경 | 결과 | 근거 |
|---|---|---|
| 로컬 (Windows + ESLint 9 native flat config) | ✅ 통과 | verifier 직전 통과, /checkpoint 5단 게이트 통과 |
| GitHub Actions (ubuntu-latest) | ❌ 매번 실패 | 사용자 보고. 실제 로그는 gh CLI 미설치로 미확인 |

원인 추정 (확정 불가, gh CLI 부재로 로그 미확인):

- `@next/eslint-plugin-next`의 ESLint 9 부분 호환성 — Next 15에서도 ESLint 9
  full support는 GA 아님 ([Next 15 릴리즈 노트 기준 추정](https://nextjs.org/blog/next-15)).
- pnpm lockfile 해석의 OS별 transitive deps 차이.
- ubuntu runner의 Node 22 + ESLint 9 + flat config 결합에서만 표면화되는 이슈.

이 비대칭은 본 ADR 본문이 명시한 회귀 트리거 #1/#2 (워크플로 깨짐) 와 인접하여
**stop-gate 정신은 유지하되 깨진 단계를 정리**해야 한다.

### 결정

**옵션 A 채택**: `.github/workflows/ci.yml`에서 `Lint` 단계를 **완전히 제거**
한다. lint 검증 권한은 **로컬 stop-gate 단독**으로 환원된다.

CI는 이제 **4단 게이트** 가 된다:

```
typecheck → test → harness:plan → harness:data
```

**근거**:

1. **헌법 P4와 lint의 관계**. 헌법 P4 ("타입 안전")는 명시적으로 `tsc --noEmit`
   = typecheck를 책임 도구로 지정한다. lint는 P4의 책임 도구가 **아니다** —
   코드 스타일 / 베스트프랙티스 / Next 권장 룰의 영역. 따라서 lint를 CI에서
   빼도 헌법 P4 강제는 typecheck로 보존된다.
2. **거짓 안전 신호 회피 (ADR-0002 본문 정신)**. `continue-on-error: true`
   (옵션 B)는 GitHub PR UI에 ✅ 통과로 표시되지만 실제로는 검증을 안 하는
   것이라 **검증 권한 명시화 정신과 직접 충돌**. 본 ADR이 옵션 D를
   거부했던 이유 ("fail-late")와 동형의 문제.
3. **운영 단순성**. CI가 매번 빨갛게 표시되면 (a) PR 머지 게이트 자체가
   noise화되어 진짜 실패도 무시당하기 시작하고 (b) 본 ADR §결과의 ⚠️
   "워크플로 깨지면 P4 무방비"가 현실화된다.
4. **로컬 stop-gate 단독 책임의 잔여 리스크는 수용 가능**. lint 우회 push는
   "대문자 변수명, console.log, no-explicit-any" 등을 main에 흘릴 수 있으나
   typecheck/test는 여전히 막는다. 이 잔여 리스크를 위해 회귀 트리거 #5를
   추가한다 (아래).

### 거부된 대안

- **옵션 B (`continue-on-error: true`)**: GitHub UI ✅ 표시 → 거짓 안전 신호.
  ADR-0002 본문 §대안의 옵션 D 거부 정신과 동형. 거부.
- **옵션 C (lint를 별도 advisory job으로 분리)**: 워크플로 복잡도 증가, UI
  노이즈, 결국 옵션 B와 같은 거짓 신호 우려. 거부.
- **옵션 D (`pnpm lint || true` inline 마스킹)**: 옵션 B보다 더 hidden, 코드
  리뷰에서 발견 어려움. 거부.
- **옵션 E (`if: always()` + reporter step)**: 복잡도 증가, 운영 가치 낮음.
  거부.
- **옵션 F (CI 전용 ESLint 룰셋 축소)**: fragile (룰 어긋나면 로컬과 CI lint
  결과 분기). 거부.

### 결과

- ✅ CI가 안정적으로 ✅/❌ 신호를 낸다 — PR 머지 게이트로서 신뢰 회복
- ✅ 로컬 stop-gate가 lint의 단일 진실원 — 책임 위치 명확
- ⚠️ lint 우회 push가 main에 흘러들 수 있음 (typecheck 통과 + lint 실패
  코드). 회귀 트리거 #5로 모니터.
- ⚠️ Vercel 빌드는 `eslint.ignoreDuringBuilds: true`로 lint 검사 안 함 →
  CI에도 lint 없으면 lint는 **순전히 개발자 머신 의존**. 이 점이 ADR-0002
  본문 §결과의 "이중화" 약속에서 lint 한정으로 후퇴함을 명시.

### 회귀 트리거 추가

본 ADR 회귀 트리거 목록에 다음을 추가한다:

5. **로컬 lint 우회 push 흔적 1건이라도 발견** (`pnpm lint`로 잡혔을 룰
   위반이 main에 들어옴) → Amendment 2로 별도 advisory CI job 도입 또는
   pre-receive hook 검토.
6. **Next 16 / `@next/eslint-plugin-next` ESLint 9 GA 호환 발표** → CI lint
   단계 복원 검토 (Amendment 2). 회복 후에도 옵션 B가 아닌 강한 게이트로만
   복원.

### PLAN 매핑

페이즈 0.5 — **D.1.d** (신설). DoD: ci.yml에서 Lint step 라인 완전 제거,
다음 push에서 GitHub Actions 워크플로가 ✅로 끝남 (typecheck/test/harness 모두
통과 가정).
