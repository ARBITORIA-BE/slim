# ADR-0002: Build gate 책임 분리 + Hook jq fallback 통일

## 상태

Accepted (2026-05-09) — verifier 통과: typecheck/lint/test/harness:plan/harness:data/build/ci.yml/jq-fallback 음성테스트 모두 통과. D.1.c (GitHub 브랜치 보호 규칙)는 사용자 UI 수동 작업으로 분리 추적.

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
