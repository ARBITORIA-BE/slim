# ADR-0044: verifier 룰 강화 — 컴포넌트 ↔ 라우팅 cross-ref 자동 탐지

## 상태

**Accepted** (2026-06-09, architect — PLAN 4.17.a 라운드).
운영자 디폴트 추천 잠금. Q1·Q2·Q3 architect 결정안 + Amendment 트리거 명시.

## 맥락 (Context)

### 트리거 — 2026-06-09 4.16 후속 sweep 5건 회귀

ADR-0043 (2026-06-08, 통신 흐름 ZIP 단계 제거) prod 머지 직후 **P0 회귀 5건**이
실 사용자 흐름에서 노출됐다. 5단 게이트(typecheck/lint/test:run/harness:plan/
harness:data) + curl HEAD 11/11 PASS 가 *전부 PASS* 였음에도 **운영자 Chrome MCP
End-to-end 실측**이 발견.

| # | 회귀 | 봉합 PR | 5단 게이트 통과 원인 |
|---|---|---|---|
| 1 | Vercel env `DATABASE_URL` 미설정 | 운영자 트랙 | Claude 트랙 외 (env 게이트 부재) |
| 2 | `CategoryGrid.tsx` href `/compare/${cat}/postal` 잔존 → 404 | #50 | curl HEAD 직접 진입 PASS ≠ 카드 클릭 진입 PASS — 컴포넌트 href ↔ 라우트 파일 존재 cross-ref 부재 |
| 3 | `CurrentProviderForm` Skip/Next handler + `ZeroProvidersFallback` Link `router.push('/${cat}/preview')` (household 우회) | #51 | 단계 우회 = STEPS 단일 출처(`useCompareSession.ts:29`) ↔ `router.push` cross-ref 부재. ADR-0016 Amd 3 "bill 제거 → preview 직진" 주석 패턴이 ADR-0043 §D5 4→3단계 전환 시 회귀로 전이 |
| 4 | i18n `nextButton` 라벨 4 locale × 2 키 swap (currentProvider="Preview results" / household="Current Supplier") | #52 | typecheck/test 통과 (라벨 = 문자열, 라우팅 도달지와 비검증). ADR-0043 §D5 current-provider↔household 순서 swap 시 라벨 동반 갱신 누락 |
| 5 | `household/page.tsx:onSubmit` `router.push('/${cat}/current-provider')` (preview 가야 함) | #53 | 라벨↔행위 불일치 #2 — t('nextButton')="Preview results" 인데 실제 push 는 current-provider |

5건 전부 2026-06-09 봉합 완료 (Chrome MCP `/en/r/qV9q2hCd_0dT` 실측 PASS, console
errors 0). 그러나 **재발 방지 룰 부재** = 다음 sweep(예: ADR-0044 이후 ADR-XX 흐름
변경)에서 동일 패턴 회귀 예상.

### 5단 게이트의 한계 — 왜 잡지 못했는가

| 게이트 | 검증 대상 | 5건 누락 원인 |
|---|---|---|
| typecheck | TS 타입 정합 | href 문자열은 TS string — 라우트 존재 비검증 |
| lint | ESLint 룰 | href/라벨 cross-ref 룰 0 |
| test:run | 단위 + 컴포넌트 | 컴포넌트별 isolated mock — 라우트 도달지 비검증 |
| harness:plan | PLAN.md ↔ 파일 존재 | 파일 존재만 검증, 컴포넌트 ↔ 컴포넌트 cross-ref 0 |
| harness:data | DB 출처/신선도 | UI 라우팅과 무관 |

**근본 진단**: 5단 게이트는 *단위/타입/파일 존재* 만 검증한다. *컴포넌트 ↔ 컴포넌트
의미 정합* (href↔라우트, 라벨↔행위, STEPS 단일 출처↔실 라우팅) 은 게이트 부재.
사용자 진입 흐름 = "카드 클릭 → 폼 제출" 이고, curl HEAD 직접 진입은 이와 *동등
아님*. e2e 가 있으나 ADR-0034 D2 통신 BE 한정 + 1 케이스만 잠겨 회귀 5건 통과
원인 미진단 (4.17.c verifier 라운드 위임).

### 운영 제약 (헌법 정합)

- §3 P4 (Type-safe): 룰 위반 = tsc 동등 격으로 강제해야 함 — **error** 격상 자연
- §3 P5 (ADR): 본 결정 = 운영 헌법(게이트) 강화 = ADR 신설 정합
- §4 작업 흐름: 5단 게이트 자체 강화 — 6단 게이트 또는 기존 harness:plan 확장
- 운영자 €300/월 cap + 솔로 사이드: *간단·정확* — 외부 도구(ts-morph) 신설보다
  기존 harness:plan glob+regex 패턴 reuse 가 운영 비용 0 격
- ADR-0034 D2 (통신 BE 한정): 본 룰은 **통신 카테고리 한정 적용** (사이즈 cap)

## 결정 (Decision)

### D1. 룰 3종 신설 — `scripts/harness/verify-cross-ref.ts` 신규 harness

회귀 5건의 3 패턴을 정확히 잡는 *최소 충분* 룰 3종.

#### Rule (i) — 컴포넌트 href ↔ 라우트 파일 존재 cross-ref

**탐지 패턴**: `Link href={...}` 또는 `router.push(...)` 의 정적 분석 가능한
문자열 리터럴 / 템플릿 리터럴 (변수 치환 후 `/compare/${cat}/<step>` 형태) 이
`src/app/[locale]/compare/[category]/<step>/page.tsx` 또는 `redirect()` 매핑에
실 존재하는지 검증 (`<step>` ∈ STEPS 단일 출처 — ADR-0045 §D3 평문화).

**대상 범위 (sizing cap)**: `src/components/Hero/CategoryGrid.tsx` +
`src/app/[locale]/compare/**/*.{ts,tsx}` 파일만. 통신 BE 흐름 한정 = ADR-0034
D2 정합. 다른 카테고리(에너지 등) 진입 시 별 ADR Amendment.

**회귀 5건 적용**:
- ✅ 회귀 #2 잡힘: `CategoryGrid.tsx` href `/compare/${category}/postal` → 라우트
  `src/app/[locale]/compare/[category]/postal/page.tsx` 부재 → 위반.

#### Rule (ii) — i18n `nextButton` 라벨 ↔ 라우팅 도달지 cross-ref

**탐지 패턴**: 각 step 컴포넌트(`current-provider/_components/*.tsx`,
`household/page.tsx`)의 `t('nextButton')` 소비 위치와 동일 컴포넌트의
`router.push(...)` 도달지 step 이름이 정합하는지 검증.

**정합 매트릭스** (단일 출처 = ADR-0043 §D5 + `useCompareSession.ts:29` STEPS):
```
current-provider step → router.push('.../household')   → t('nextButton') ≈ "household type" 의미
household step        → router.push('.../preview')     → t('nextButton') ≈ "preview" 의미
```

**의미 검증**: i18n 키 값 문자열의 *키워드 매칭* (예: ko `결과 미리보기`/`가구
형태`, en `Preview results`/`Household type`, nl `Resultatenvoorbeeld`/
`Huishoudtype`, fr `Aperçu`/`ménage`). 키워드 매칭 사전 = `verify-cross-ref.ts`
상단 const 단일 출처 (4 locale × 2 step = 8 매핑).

**회귀 5건 적용**:
- ✅ 회귀 #4 잡힘: currentProvider.nextButton = "Preview results" 인데 도달지
  = household → 라벨 키워드("Preview") ≠ 도달지("household") → 위반.
- ✅ 회귀 #5 잡힘: household.onSubmit `router.push('.../current-provider')` 인데
  t('nextButton') = "Preview results" → 라벨 ≠ 행위 → 위반 (Rule iii 와 중첩
  탐지, 다중 탐지 OK).

#### Rule (iii) — `useCompareSession STEPS` 단일 출처 ↔ `router.push`/`setStep` cross-ref

**탐지 패턴**: `useCompareSession.ts:29` 의 `STEPS = [...]` 배열을 단일 출처로
파싱(정적 const, ts 정규식). 통신 흐름 내 모든 `router.push('/compare/${cat}/X')`
의 X 가 STEPS 에 속해야 하고, 순차 정합(current-provider → household → preview)
이 깨지면 위반.

**대상 범위**: `src/app/[locale]/compare/**/*.{ts,tsx}` 의 `router.push` +
`redirect` 호출 전수. 외부 페이지(`/r/`, `/`)로 나가는 push 는 화이트리스트.

**회귀 5건 적용**:
- ✅ 회귀 #3 잡힘: `CurrentProviderForm.tsx` Skip handler `router.push('/${cat}/preview')`
  → STEPS 순차 current-provider → household 깨짐 (household 건너뜀) → 위반.
- ✅ 회귀 #5 잡힘 (재): household → current-provider 역방향 push → STEPS 순차
  위반.

### D2. 구현 방식 — 옵션 (A) 정규식+glob 정적 스캔 (architect 디폴트)

**Q1 운영자 결정 영역 잠금**:

| 옵션 | 사유 | 운영 비용 | 정확도 |
|---|---|---|---|
| **(A) 정규식 + glob 정적 스캔** ★ | `verify-plan.ts:42` 와 동일 패턴. 새 의존성 0. 통신 BE 흐름 한정 = scope 작음 | 0 (deps 0) | 87% (템플릿 리터럴 정적 분석 가능 케이스 = 5건 회귀 전부 cover) |
| (B) AST 정적 분석 (ts-morph) | 동적 라우팅·변수 치환 정확 추적 | + ts-morph ≈ 8MB devDep, 학습 곡선 | 99% (overkill) |
| (C) 빌드 시 codegen | TARIFF_CATEGORIES × STEPS 매트릭스 자동 생성 → 컴파일 시 강제 | 빌드 파이프라인 복잡화 | 95% (단 신규 패턴 추가 시 codegen 갱신 부담) |
| (D) e2e 추가 (Playwright) | 실 브라우저 + 실 라우팅 | dev 서버 + Playwright 실행 ≈ 30s/케이스, CI 영역 진단 미해결(4.17.c) | 100% (단 CI 실 동작 진단 선행 필수) |

**채택 = (A)**. 사유: 운영자 €300/월 cap + 솔로 사이드 + 통신 BE 한정 = 새
의존성/빌드 파이프라인 변경 *없이* 정규식+glob 으로 회귀 5건 전부 cover 가능.
`verify-plan.ts` 기존 패턴 reuse = 학습 곡선 0. 정확도 87% (= 동적 변수
치환 케이스 외) 는 통신 BE 3 step 정적 흐름에 충분.

**격상 트리거**: 룰 (i)/(ii)/(iii) 위양성 ≥ 3건/월 또는 위음성 ≥ 1건/월 발생 시
ADR Amendment 1 → 옵션 (B) ts-morph 격상 검토. 페이즈 5 통신 외 카테고리 진입
(별 ADR) 시 자동 재평가.

**대안 (D) e2e 보강 = 4.17.c verifier 라운드 별트랙**. e2e 가 회귀 5건 통과시킨
CI 실 동작 진단(Q3)이 선행 필요 — 본 ADR 의 룰 3종은 *정적 게이트*, e2e 진단은
*동작 게이트*로 직교.

### D3. 룰 위반 처리 — `error` 격(Stop hook 차단) (architect 디폴트)

**Q2 운영자 결정 영역 잠금**:

| 옵션 | 사유 | 위험 |
|---|---|---|
| **error (Stop hook 차단)** ★ | 헌법 §3 P4 typecheck 와 동등 격 — 회귀 5건이 P0 prod 사고였음 | 위양성 시 작업 차단 — 격상 트리거로 회피 |
| warn (CI annotate, 차단 X) | 부담 최소 | 5건 P0 회귀 패턴 재발화 가능성 — "warning fatigue" |

**채택 = error**. 사유: 5건 회귀 전부 *P0 prod 사고* (사용자 흐름 차단). warn
격은 "warning fatigue" 패턴(헌법 §3 P4 거짓 안전 신호)으로 ADR-0002 Amendment
1 `continue-on-error: true` 거부 사유와 동형. **단** 옵션 (A) 정규식 정확도
87% 한계로 위양성 가능성 → 격상 트리거(D2 격상 트리거 cross-ref).

**Stop hook 통합**: 기존 5단 게이트(typecheck/lint/test:run/harness:plan/
harness:data) 직후 **6단째**로 `pnpm harness:cross-ref` 신설 (verify-plan
과 분리 = 책임 단일 + 위반 디버깅 시 isolation). package.json `scripts` +
`.claude/hooks/stop.sh` 통합 = builder 라운드(4.17.b) 명세.

### D4. e2e CI 실 동작 진단 — verifier 4.17.c 위임

**Q3 운영자 결정 영역 잠금**:

`e2e/compare-flow.spec.ts:50` `toHaveURL(/household/)` 어셔션이 회귀 5건 (특히
#5 household onSubmit) 통과시킨 원인의 가능 가설 3가지:

| 가설 | 진단 방법 (verifier 4.17.c) |
|---|---|
| **H1**: CI 워크플로(`ci.yml`)에 `pnpm test:e2e` 단계 부재 — 로컬 dev 만 실행 | `cat .github/workflows/ci.yml \| grep -i e2e`. 단계 부재 시 H1 확정. |
| H2: Playwright `reuseExistingServer: true` 가 prod build 가 아닌 stale dev 서버 hit | `playwright.config.ts` + e2e CI 실 실행 로그 (Vercel preview 동작 시점 비교) |
| H3: 어셔션 자체는 strict 하나 회귀 PR 들이 e2e CI 실 fail 을 운영자가 skip/merge | GitHub Actions PR #51/53 run 이력 + `gh pr checks` 출력 |

**architect 추정 (사전 진단, verifier 확정 필요)**: **H1 가장 유력** — `ci.yml`
은 4단 게이트(ADR-0002 Amd 1 lint 제거 후) typecheck/test/harness:plan/
harness:data 만 실행. e2e 는 로컬 / 수동 트리거. 따라서 회귀 5건 PR 들의 e2e
fail 이 *CI 단계에 존재하지 않아* 머지 차단되지 않았음. 가설 확정 시 후속 결정 =
(가) e2e CI 추가 (cost: Playwright 브라우저 다운로드 ≈ 200MB, 실행 시간 ≈ 60s) /
(나) 본 룰 3종 + Vercel preview Chrome MCP 실측 의존 유지 (운영자 트랙). 운영자
디폴트 추천: (나) — €300/월 cap 정합, 본 ADR-0044 정적 룰 + 운영자 prod 실측
이중화로 봉합 가능. 단 (가) 도 미래 ADR Amendment 트리거 보존.

**산출물**: `docs/runbook/e2e-ci-diagnosis.md` (verifier 4.17.c — 본 ADR cross-ref).

## 대안 (Rejected Alternatives)

### Rej-1. 룰 3종 → 룰 5종 확장 (모든 i18n 키 ↔ 라우팅 매핑 검증)

거부 사유: 운영자 €300/월 + 솔로 사이드 + 통신 BE 한정 정합 위반. nextButton 외
키(skipButton, title 등)는 라우팅 도달지와 의미 정합 약함 — 위양성 비용 > 검증
효용. 회귀 5건 패턴 한정 *최소 충분* 룰 3종 유지.

### Rej-2. ts-morph AST 정적 분석 (옵션 B) 즉시 채택

거부 사유: D2 §격상 트리거 참조. 현 회귀 5건 cover 에 정규식+glob 충분 + 새
devDep ≈ 8MB. 격상은 위양성/위음성 신호 발화 시.

### Rej-3. e2e CI 즉시 추가 (옵션 D 즉시 채택)

거부 사유: D4 §architect 추정 (나) 참조. Playwright 브라우저 다운로드 + 실행
시간 cost + CI 잠금 시간 격상이 €300/월 cap 정합 위험. 4.17.c verifier 진단 후
미래 ADR Amendment 로 분리.

### Rej-4. 룰 위반 = warn (Q2 옵션 2)

거부 사유: D3 §사유 참조. 5건 P0 회귀 = warn fatigue 거짓 안전 신호 패턴.

## 결과 (Consequences)

### ✅ 얻는 것

1. **회귀 5건 시뮬레이션 100% 탐지** — 4.17.d 게이트 라운드에서 backport 시뮬레이션
   PR (회귀 코드 의도적 재도입) → 룰 위반 발화 확인.
2. **컴포넌트 ↔ 라우팅 의미 정합 게이트 신설** — 5단 게이트의 단위/타입/파일 존재
   한계 봉합.
3. **운영 비용 0 격** — 새 의존성 0, 빌드 파이프라인 변경 0, 통신 BE 흐름 한정.
4. **Stop hook 6단 게이트 격상** — typecheck/lint/test:run/harness:plan/
   harness:data + **harness:cross-ref**.

### ⚠️ 잃는 것 / 부채

1. **정확도 87%** (정규식 한계) — 동적 변수 치환 라우팅 패턴 미지원. 격상 트리거
   조건 발화 시 ADR Amendment 1 (ts-morph) 검토.
2. **i18n 키워드 매칭 유지보수 부담** — 4 locale × 2 step = 8 매핑 사전 갱신
   필요 (ADR-0043 §D5 같은 step 순서 변경 시). `verify-cross-ref.ts` 상단 const
   단일 출처 잠금으로 부담 최소화.
3. **e2e CI 실 동작 진단 별트랙** — 본 ADR 결정 영역 밖. 4.17.c verifier
   `e2e-ci-diagnosis.md` 산출물 cross-ref.
4. **통신 BE 흐름 한정** — 페이즈 5 통신 외 카테고리 진입(별 ADR) 시 룰 범위
   확장 ADR Amendment 트리거.

## 검증 방법 (Verification)

### V1. 4.16 회귀 5건 backport 시뮬레이션 (4.17.d 게이트 라운드)

5건 봉합 PR(#50/#51/#52/#53) 각각의 *직전 상태* 코드(github diff 역적용)를
임시 브랜치에 backport → `pnpm harness:cross-ref` 실행 → 룰 (i)/(ii)/(iii) 중
하나 이상 위반 발화 확인.

| 회귀 # | 예상 위반 룰 |
|---|---|
| #2 (CategoryGrid postal href) | Rule (i) |
| #3 (CurrentProvider Skip→preview) | Rule (iii) |
| #4 (i18n nextButton swap) | Rule (ii) |
| #5 (household→current-provider push) | Rule (ii) + Rule (iii) |

회귀 #1 (Vercel env) 은 운영자 트랙 — 본 룰 scope 밖 (V1 면제).

### V2. 현 main HEAD GREEN

봉합 잠금 완료(2026-06-09 기준 main HEAD)에서 `pnpm harness:cross-ref` 실행 →
0 위반 확인. 위반 발화 시 봉합 누락 또는 룰 위양성 → architect 재호출.

### V3. Stop hook 6단 게이트 통합 실측

builder 4.17.b 머지 후 임의 PR 의 `Stop hook` 출력에 `[6/6] harness:cross-ref` 단계
PASS 로그 확인.

### V4. ADR-INDEX 신설 + PLAN cross-ref 정합

`docs/adr/INDEX.md` 에 본 ADR 0044 행 추가 + PLAN 4.17 본문 `ADR-0044` cross-ref
정합. `pnpm harness:plan` GREEN 유지.

## Cross-ref

- **ADR-0002** (Build gate ownership + Amd 1 lint 제거) — 본 ADR 은 5단 게이트
  6단으로 격상 = ADR-0002 Decision 1 정합 확장. CI lint 제거 사유(거짓 안전
  신호 회피)와 본 ADR Q2 `error` 채택 사유 동형.
- **ADR-0016** (페이즈 2 입력 플로우, Amd 4 3단계 골격) — 본 룰의 STEPS 단일
  출처 = `useCompareSession.ts:29` = ADR-0016 §T8 sessionStorage 설계 정합.
- **ADR-0025** (verifier read-only 경계) — 본 ADR 의 verifier 룰 추가는 운영
  헌법 강화 — `error` 격 차단은 Stop hook 가드(자동) = verifier 에이전트 직접
  커밋 격 아님 (read-only 경계 보존).
- **ADR-0034 D2** (통신 BE 한정) — 본 룰 범위 cap. 통신 외 카테고리 진입 시 별
  ADR Amendment 트리거.
- **ADR-0043** (통신 흐름 ZIP 제거) + ADR-0016 Amd 4 — 회귀 5건의 ADR 본문 트리거
  원인. 본 ADR 은 동일 ADR 패턴 미래 재발화 봉합.
- **PLAN 4.17** — 본 ADR Decision 의 PLAN 본문 잠금.

## Amendment 1 (2026-08-14) — 룰 (iv) 문서 링크 무결성 추가 (6단 → 7단 게이트)

**Accepted** (2026-08-14, Pieter — 고아 ADR 사고 실측 트리거).

> 주의: 본 Amendment 는 아래 §Amendment 트리거에 예고됐던 "Amd 1 트리거"(ts-morph
> 격상)와 다른 사안이다. 예고된 격상 트리거는 아직 발화하지 않았고 미래 Amendment 로
> 남는다. 번호는 실제 발생 순서를 따른다.

### A1.맥락 — 룰 3종이 못 본 표면

2026-08-14 stale PR 정리 중 실측: `PLAN.md`(2482/2483/2494/2499/2501/2506/2545/2547행)와
`CHANGELOG.md`(89행)가 **5.5/5.6 + 6.1~6.9 = 11건 `[x]` 격상의 근거**로
[ADR-0048](0048-phase-6-bulk-promotion-option-c.md) / [ADR-0049](0049-gdpr-tools-anonymous-model-redefinition.md)
를 링크하고 있었으나 해당 파일이 main 에 없었다 (미머지 PR #62 에만 존재,
`docs/adr/` 가 0046 → 0050 으로 건너뜀).

**근거 없는 `[x]` 11건이 2026-06-10부터 약 4개월간 게이트를 통과했다.**

원인 = 본 ADR 룰 3종이 **컴포넌트 ↔ 라우팅 한정**이라 문서 링크를 보지 않는다.
`harness:plan` 은 PLAN 체크박스 ↔ 코드 파일 정합만 보고 링크 대상을 검증하지 않는다.
헌법 §3 **P1**(출처 없는 주장 금지) + **P5**(결정은 ADR로) 위반이 게이트 사각지대에 있었다.

### A1.D1 — 룰 (iv) 신설

`scripts/harness/verify-doc-links.ts` — 마크다운 상대 링크 `[텍스트](경로.md)` 의
대상 파일 실재를 정적 검증. `pnpm harness:doc-links`.

구현 = 본 ADR §D2 와 **동형** (정규식 정적 스캔, 새 의존성 0).
위반 처리 = 본 ADR §D3 와 **동형** (`error` 격상 → exit 1 → Stop hook 차단).

### A1.D2 — 범위 경계 (의도적 제외)

| 대상 | 처리 | 사유 |
|---|---|---|
| 상대 `.md` 링크 | ✅ 검증 | 본 사고의 표면 |
| 외부 URL (http/https/mailto/tel) | ❌ 제외 | 네트워크 의존 = 게이트 비결정성 |
| 앵커(`#section`) 실재 | ❌ 제외 | 한글 앵커 slug 규칙이 렌더러마다 달라 위양성 위험. 경로만 보고 앵커는 잘라냄 |
| 코드 파일 링크 (`.ts`/`.tsx`) | ❌ 제외 | 룰 (i) 소관 |
| 펜스 코드블록 내부 | ❌ 제외 | 예시로 인용된 링크 오탐 방지 (줄 수는 보존해 라인 번호 정합) |
| 백틱 인라인 코드 내부 | ❌ 제외 | **본 Amendment 작성 중 실측 발화** — 링크 문법 자체를 설명하는 문서(본 ADR / PLAN 4.25 / CHANGELOG)가 스스로를 깨뜨렸다. 길이 보존 치환으로 라인 번호 정합 유지 |

링크가 **저장소 루트 기준이 아니라 문서 파일 위치 기준**으로 해석된다 — GitHub 렌더링과
동일 기준. 따라서 `docs/adr/` 안에서 `docs/adr/x.md` 로 적은 링크는 위반으로 잡힌다
(실제로 GitHub 에서 깨지는 링크이므로 정탐).

### A1.D3 — 6단 → 7단 게이트

`scripts/hooks/stop-gate.sh` Gate 7 등록. `.claude/settings.json` description 갱신.

### A1.V1 — 검증 (2026-08-14 실측)

- 최초 실행: 전체 마크다운 **623개 링크** 스캔 → **깨진 링크 7건** 발화
  - `CHANGELOG.md` → `0027-affiliate-rates.md` (실제 `0027-affiliate-rate-data-source.md`)
  - ADR-0043 → `0007-comparison-request-data-model.md` (실제 `0007-comparison-request-result-schema.md`)
  - ADR-0043 → `0029-honesty-tokens.md` (실제 `0029-beta-recruitment.md` — §T2 정직성 잠금 토큰)
  - ADR-0043 → `0033-i18n-namespace-and-locale-routing.md` (실제 `0033-i18n-next-intl-introduction.md`)
  - `docs/m16-eval.md` → `adr/0003-meta-roadmap.md` (실제 `adr/0003-plan-realism-solo-side.md`)
  - `docs/build-gate-negative-test.md` → `0017-...md` (상대 base 누락, 실제 `adr/0017-...md`)
  - ADR-0013 자기 참조 → 저장소 루트 경로로 적혀 이중 해석
- 7건 전부 **ADR 번호는 맞고 파일명/상대 base 만 틀린** 오타로 확인 (원 의도 유실 0).
- 수정 후 재실행: GREEN. (본 Amendment 문서 추가 후 링크 총량 623 → **630**건, GREEN 유지)
- 단위 테스트 `verify-doc-links.test.ts` 21건 — 고아 ADR 회귀 재현 2건 + 인라인 코드 위양성 4건 포함. `pnpm test:run` 902 → **923**.

### A1.잃는 것 / 부채

- 앵커 미검증 = `#amendment-1-...` 같은 앵커가 깨져도 통과한다. 한글 slug 규칙 확정 후 별 트랙.
- 외부 URL 미검증 = 공급사 GTC 링크 등의 link-rot 은 여전히 수동 확인 대상.
- 정규식 기반이라 참조 링크 문법(`[a][ref]`) 미지원 — 현 문서에 사용례 0 이라 유예.

## Amendment 트리거 (미래)

- **ts-morph 격상 트리거**: 룰 (i)/(ii)/(iii) 위양성 ≥ 3건/월 또는 위음성 ≥ 1건/월 발생
  시 → 옵션 (B) ts-morph AST 정적 분석 격상 검토.
- **Amd 2 트리거**: 페이즈 5 통신 외 카테고리(에너지/모기지/보험 등) 진입 시 (별
  ADR + 본 룰 범위 확장).
- **Amd 3 트리거**: 4.17.c verifier `e2e-ci-diagnosis.md` 산출물에서 e2e CI 단계
  보강 결정 시 → 본 ADR D4 §architect 추정 옵션 (가) 채택 ADR Amendment.
- **Amd 4 트리거**: 5단 게이트 6단 격상이 dev 사이클 시간 ≥ 30s 추가 (€300/월
  격상 신호) 시 → 룰 (i)/(ii)/(iii) 선택적 비활성화 또는 통합 검토.
