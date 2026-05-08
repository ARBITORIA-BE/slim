# Slim — 베네룩스 비교 플랫폼

**비교는 쉽게, 절약은 두툼하게.**

전기·통신·보험·금융을 BE / NL / LU에서 5분 안에 비교하는 플랫폼.
이 저장소는 Claude Code 기반 자동 워크플로우로 운영됩니다.

---

## 시작하기 (한 줄)

```bash
git clone <repo>
cd slim
pnpm bootstrap     # ← 이거 하나로 Phase 0.1~0.7 완료
```

`pnpm bootstrap`이 자동으로 처리:

1. **preflight** — Node 22+ / pnpm / git / hook syntax 점검
2. **pnpm install** — 의존성 설치
3. **husky 초기화** — Git pre-commit 훅 (lint-staged)
4. **git init** + 초기 커밋
5. **PLAN.md 갱신** — Phase 0의 7개 항목을 [x] 마킹, 합계 표 자동 갱신
6. **게이트 검증** — typecheck / harness:plan / harness:data / test 모두 통과 확인

이게 끝나면:

```bash
pnpm dev          # 로컬 확인 (http://localhost:3000)
claude            # Claude Code 시작 → Phase 1.1부터
```

세션 시작 시 받게 되는 메시지:

```
👋 Pieter 세션 시작
📊 PLAN: 7✅ / 0🔄 / 0🚫 / 54⏳ (총 61)
▶️ 다음 작업: 1.1 provider 테이블 (공급사 마스터)
🕒 마지막 커밋: chore(phase-0): bootstrap — Next.js 15 + Tailwind 4...
```

---

## 트러블슈팅

### `pnpm: command not found` 또는 `0: syntax error in expression`
`bash scripts/preflight.sh`로 환경부터 점검. v0.1 초기 버전의 bash 카운팅 버그(`grep -c ... || echo 0`)는 v0.3에서 해결됨 (`scripts/hooks/_lib.sh`의 `count_pattern` 사용).

### Stop 게이트가 모두 빨강
`node_modules`나 `package.json`이 없는 상태일 가능성. v0.3부터 게이트가 환경 미준비를 감지해 자동 스킵하고 명확한 메시지를 표시.

### `pnpm bootstrap` 중간 실패
Step별로 진행 상황이 표시됩니다. 실패 직전 단계만 수동으로 다시 실행 가능:
- Step 2 실패: `pnpm install` 재시도 (네트워크 확인)
- Step 5 실패: `python3` 미설치 — `apt install python3` 또는 `brew install python3`
- Step 6 실패: 위 검증 명령 직접 실행해서 어느 게이트가 깨지는지 확인


---

## 이 프로젝트의 작동 원리

```
┌─────────────────────────────────────────────────────┐
│  CLAUDE.md  (프로젝트 헌법 + 페르소나 'Pieter')         │
│  ────────────────────────────────────────────────   │
│  P1 정보 우선 / P2 쉽고 빠르게 / P3 투명성             │
│  P4 타입 안전 / P5 결정은 ADR로                       │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  PLAN.md  (단일 출처, 58개 체크박스, 7개 페이즈)        │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   ┌────────┐ ┌────────┐ ┌────────┐
   │architect│ │builder │ │verifier│  +  scribe
   │ (Opus) │ │(Sonnet)│ │ (Haiku)│     (Haiku)
   └────────┘ └────────┘ └────────┘
   설계/ADR    구현/코드  검증/게이트   문서/CHANGELOG
        │          │          │
        └──────────┴──────────┘
                   │
                   ▼  Hook이 자동 실행
       ┌───────────────────────────┐
       │ 5단 게이트:                │
       │  1. typecheck             │
       │  2. lint                  │
       │  3. test                  │
       │  4. harness:plan + data   │
       │  5. PLAN 동기화           │
       └───────────────────────────┘
```

---

## 핵심 명령어

| 명령 | 용도 |
|---|---|
| `pnpm dev` | 로컬 개발 |
| `pnpm typecheck` | tsc --noEmit (절대 깨면 안 됨) |
| `pnpm test` | Vitest |
| `pnpm test:e2e` | Playwright |
| `pnpm harness:plan` | PLAN.md ↔ 코드 정합성 |
| `pnpm harness:data` | 데이터 출처 강제 (P1) |
| `pnpm harness:price` | 가격 비정상 감지 |
| `pnpm harness:bias` | 어필리에이트 편향 감사 (P3) |
| `pnpm harness:e2e` | 5분 비교 약속 검증 (P2) |

## Claude Code 슬래시 커맨드

| 명령 | 용도 |
|---|---|
| `/verify-plan` | 현재 진행 + 다음 항목 |
| `/checkpoint <PLAN-ID> <메시지>` | 작업 마감 (게이트 + 커밋 + 동기화) |
| `/ship` | 배포 전 종합 점검 |

---

## 디렉토리 지도

```
slim/
├── CLAUDE.md             ⭐ 페르소나 + 헌법 (모든 세션 자동 로드)
├── PLAN.md               ⭐ 마스터 플랜, 58개 체크박스
├── MONETIZATION.md       ⭐ 4 스트림 수익화 + 윤리 KPI
├── README.md             이 파일
│
├── .claude/
│   ├── settings.json     훅 라우팅 + 권한
│   ├── agents/           5명의 서브에이전트
│   │   ├── architect.md  설계/ADR (Opus)
│   │   ├── builder.md    구현 (Sonnet)
│   │   ├── verifier.md   검증/게이트 (Haiku)
│   │   ├── scribe.md     문서/CHANGELOG (Haiku)
│   │   └── legal.md      GDPR/디스클로저/다크패턴 자체 검토 (Sonnet)
│   ├── skills/           재사용 워크플로우
│   │   ├── plan-tracker/        PLAN.md 안전 갱신
│   │   ├── data-contract/       FetchResult 타입 강제
│   │   └── transparency-audit/  분기 KPI 자동 리포트
│   └── commands/         슬래시 커맨드 3종
│
├── scripts/
│   ├── hooks/            6개 lifecycle 훅
│   │   ├── prompt-context.sh        매 메시지마다 PLAN 컨텍스트 주입
│   │   ├── pre-tool-guard.sh        rm -rf, force push, secret 차단
│   │   ├── pre-edit-baseline.sh     편집 전 typecheck 베이스라인
│   │   ├── post-edit-typecheck.sh   편집 후 회귀 감지
│   │   ├── stop-gate.sh             5단 종합 게이트
│   │   ├── subagent-handoff.sh      서브에이전트 인계
│   │   └── session-start.sh         세션 시작 보고
│   └── harness/          5개 검증 하네스
│       ├── verify-plan.ts        PLAN ↔ 코드
│       ├── data-fidelity.ts      P1 강제
│       ├── price-snapshot.ts     가격 비정상
│       ├── bias-audit.ts         어필리에이트 편향 감지 (P3)
│       └── e2e-smoke.ts          5분 약속 검증
│
└── src/                  (페이즈 0에서 생성될 Next.js 앱)
```

---

## 진행 상황 트래커

이 표는 Claude Code의 `verifier` 에이전트가 자동 갱신합니다.
실제 데이터는 `PLAN.md`의 합계 표를 보세요.

| 페이즈 | 항목 | 진행 |
|---|---|---|
| 0 기반 | 7 | ⏳ |
| 1 데이터 | 13 | ⏳ |
| 2 입력 | 9 | ⏳ |
| 3 결과 | 7 | ⏳ |
| 4 전환 | 5 | ⏳ |
| 5 멀티카테고리 | 6 | ⏳ |
| 6 운영 | 6 | ⏳ |
| 7 출시 | 5 | ⏳ |

---

## 라이선스 + 약속

이 코드는 **AGPL-3.0**입니다 (포크해서 비교 사이트를 만드는 것 환영).
다만 P1~P5 원칙을 변경한 포크는 "Slim 호환"이라 부르지 마세요.
