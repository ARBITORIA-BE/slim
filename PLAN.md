# Slim — 마스터 플랜

> **단일 출처 (Single Source of Truth).** 모든 작업은 이 파일의 항목과 매칭된다.
> 매칭 안 되는 작업은 시작하기 전에 이 문서에 추가한다.
>
> 진행 표기: `[ ]` 미시작 · `[~]` 진행 중 · `[x]` 완료 · `[!]` 차단됨
>
> 자동 검증: `pnpm harness:plan` (PLAN.md ↔ 실제 파일 정합성)

---

## 페이즈 0 · 기반 (Foundation) — 1주차

**목표:** Pieter가 어떤 작업이든 시작할 수 있는 환경.

- [x] **0.1** 모노레포 초기화 (`pnpm init` + workspaces)
  - DoD: `pnpm install`이 0 에러로 끝난다
- [x] **0.2** Next.js 15 (App Router) + TypeScript strict
  - DoD: `pnpm typecheck` 0 에러 / strict, noUncheckedIndexedAccess 활성
- [x] **0.3** Tailwind 4 + shadcn/ui + 디자인 토큰
  - DoD: `<Button>`, `<Card>`, `<Input>` 3종이 `Slim` 브랜드 색으로 렌더
  - 토큰: `--color-bg`, `--color-fg`, `--color-primary`, `--color-accent` (CLAUDE.md 색상)
- [x] **0.4** Drizzle + Neon Postgres 연결
  - DoD: `pnpm db:push`로 빈 스키마 마이그레이션 성공
- [x] **0.5** ESLint + Prettier + lint-staged + husky
  - DoD: 커밋 시 자동 lint
- [x] **0.6** Vitest + Playwright 셋업
  - DoD: `pnpm test`, `pnpm test:e2e` 둘 다 빈 테스트로 통과
- [x] **0.7** `.claude/` 워크플로우 활성화 (이 문서, agents, hooks, harness)
  - DoD: `/verify-plan` 슬래시 커맨드가 응답한다

**Phase 0 검증:** `pnpm harness:plan && pnpm typecheck && pnpm test`

---

## 페이즈 0.5 · 운영 부채 정리 (Operational Debt) — 1주차 잔여

**목표:** 페이즈 0 종료 시점에 표면화된 운영 부채를 페이즈 1 시작 전에 닫는다.
규모는 작지만 P4 강제 위치(=헌법) 와 직결되어 ADR-0002로 결정 기록됨.

> 헌장: [ADR-0002](docs/adr/0002-build-gate-ownership.md) — Build gate 책임
> 분리 + Hook jq fallback 통일. **Amendment 1 (2026-05-09)**: CI lint 단계
> 제거 → D.1.d 신설.

- [ ] **D.1** Vercel build gate 책임 분리 (ADR-0002 Decision 1 + Amendment 1)
  - **D.1.a** `next.config.ts`에 `typescript.ignoreBuildErrors: true` +
    `eslint.ignoreDuringBuilds: true` 추가
  - **D.1.b** `.github/workflows/ci.yml` 신설 — push/PR마다 5단 게이트
    (typecheck → lint → test → harness:plan → harness:data) 직렬 실행
    > Amendment 1으로 D.1.d에서 lint 단계 제거 → 실제 운영은 4단 게이트.
  - **D.1.c** `main` 브랜치 보호 규칙 (GitHub repo settings) — CI 통과 필수
    체크박스 활성화 (수동 작업, scribe가 운영 노트로 기록)
  - **D.1.d** `.github/workflows/ci.yml`에서 `Lint` 단계 제거 (Amendment 1)
    — GitHub Actions ubuntu-latest에서 `pnpm lint`가 ESLint 9 +
    `@next/eslint-plugin-next` 호환성 이슈로 매번 실패. lint는 로컬
    stop-gate 단독 책임으로 환원. `continue-on-error: true` 등 거짓 안전
    신호 옵션은 거부됨 (ADR-0002 Amendment 1 §거부된 대안 참조).
    - DoD: (1) ci.yml에서 `Lint` 단계 라인 완전 제거 (2) 다음 push에서
      GitHub Actions 워크플로가 ✅로 끝남 (typecheck/test/harness 모두
      통과 가정) (3) `pnpm lint`는 로컬 + Husky pre-commit에서 여전히
      강제됨을 verifier가 확인
  - DoD (D.1 전체): (1) `next build` 로컬 통과 (2) Vercel preview 배포 1회
    성공 (3) 의도적으로 typecheck를 깨는 PR이 GitHub Actions에서 ❌로 차단됨
    (4) D.1.d 적용 후 ci.yml이 4단 게이트로 안정 동작
  - 검증: ADR-0002 §검증 방법 1 + Amendment 1 §결과
- [x] **D.2** Hook jq fallback 통일 (ADR-0002 Decision 2)
  - [x] **D.2.a** `scripts/hooks/pre-tool-guard.sh:10`의 jq 의존 제거 — `_lib.sh`
    의 fallback 패턴(또는 동등한 인라인 sed/awk)으로 `tool_input.command` 추출
  - DoD: jq 부재 환경(Windows + PATH에서 jq 제거)에서 `rm -rf /` 입력 시
    차단 메시지 정상 출력
  - 검증: ADR-0002 §검증 방법 2

**Phase 0.5 검증:** `pnpm harness:plan && pnpm typecheck && pnpm lint &&
pnpm test` + 위 DoD 모두 충족.

---

## 페이즈 1 · 데이터 레이어 (Data Foundation) — 2~3주차

**목표:** 한 카테고리(=에너지)에서 100% 정확한 가격 비교가 가능한 데이터 파이프라인.

### 1.A 스키마

- [x] **1.1** `provider` 테이블 (공급사 마스터)
  - 필드: `id`, `country` (BE/NL/LU), `name`, `legal_name`, `vat_id`, `website`, `affiliate_status`
- [ ] **1.2** `tariff` 테이블 (요금제)
  - 필드: `provider_id`, `category`, `name`, `currency`, `unit_price`, `fixed_fee`, `valid_from`, `valid_to`
- [ ] **1.3** `tariff_snapshot` (가격 시계열)
  - 필드: `tariff_id`, `fetched_at`, `source_url`, `raw_payload` (jsonb), `confidence` (high/medium/low)
- [ ] **1.4** `comparison_request` (사용자 입력) — 익명 우선
- [ ] **1.5** `comparison_result` (계산된 결과 + 사용된 스냅샷 ID 들)

### 1.B 데이터 수집

- [ ] **1.6** Inngest cron 셋업 (시간당 1회)
- [ ] **1.7** Fetcher 인터페이스 정의 (`src/fetchers/types.ts`)
  ```ts
  interface Fetcher {
    providerId: string;
    fetch(): Promise<FetchResult>;
    // FetchResult는 source_url, fetched_at, confidence 강제
  }
  ```
- [ ] **1.8** Fetcher 3개 실 구현 (에너지, BE):
  - Engie BE / Luminus / TotalEnergies BE
  - 각 fetcher에 단위 테스트
- [ ] **1.9** Fetcher 실패 격리 (1개 실패해도 나머지는 진행)
- [ ] **1.10** **투명성 페이지**: `/data-sources` — 모든 공급사 + 마지막 수집 시각 + 수집 방법 (API/스크래핑/수동) 공개

### 1.C 비교 엔진

- [ ] **1.11** 절약액 계산 로직 (`src/engine/compare.ts`)
  - 순수 함수, 입력 = `(현재요금제, 사용량 프로파일, 후보 요금제[])`
  - 출력 = `Comparison[]` (각 항목에 `monthly_saving`, `yearly_saving`, `confidence`, `caveats[]`)
- [ ] **1.12** 단위 테스트: 알려진 케이스 12개 (실제 영수증 기반)
  - DoD: 모든 케이스 ±0.01€ 이내
- [ ] **1.13** **caveats 메커니즘**: 결과에 항상 주의사항 (예: "이 요금제는 2년 약정")

**Phase 1 검증:** `pnpm harness:data` — 모든 `tariff_snapshot`이 `source_url` + `fetched_at` 가짐.

---

## 페이즈 2 · 입력 플로우 (User Input) — 4주차

**목표:** 5단계 5분 입력. 이탈률 < 30% (PostHog 측정).

- [ ] **2.1** 카테고리 선택 화면 (랜딩에서 진입)
- [ ] **2.2** 단계 1: 우편번호 (BE/NL/LU 자동 인식)
- [ ] **2.3** 단계 2: 가구 형태 (혼자/커플/3+) → 사용량 추정 fallback
- [ ] **2.4** 단계 3: 현재 공급사/요금제 (선택적, 모르면 스킵)
- [ ] **2.5** 단계 4: 청구서 업로드 (선택적) — OCR로 사용량 추출
  - DoD: tesseract.js로 BE 청구서 5종 읽기 성공률 > 80%
- [ ] **2.6** 단계 5: 결과 미리보기 → "더 보기" 클릭으로 풀 결과
- [ ] **2.7** 진행 표시 + 백 가능 + 데이터 자동 저장 (sessionStorage)
- [ ] **2.8** 모바일 우선 디자인 (375px 기준 시작)
- [ ] **2.9** 접근성: 키보드만으로 완주 가능, axe-core 0 violations

**Phase 2 검증:** Playwright E2E — 입력 → 결과까지 5분 이내 (CI에서 측정).

---

## 페이즈 3 · 결과 페이지 (Results) — 5주차

**목표:** "결론 → 근거 → 원본"의 3층 구조.

- [ ] **3.1** **1층 — 결론 카드** (스크롤 없이 보임)
  - 1위 추천 + 연간 절약액 + "변경하기" CTA
- [ ] **3.2** **2층 — 비교 표** (다나와 스타일 정보 밀도)
  - 상위 5개, 컬럼: 공급사 / 월 비용 / 절약액 / 약정 / 그린 에너지 % / 신뢰도
  - 정렬 가능, 필터 가능 (그린 에너지만, 약정 없음만 등)
- [ ] **3.3** **3층 — 원본 링크**
  - 각 행에 "공식 요금제 페이지 보기" + "마지막 확인: X시간 전"
- [ ] **3.4** **제외된 공급사 섹션** — 왜 비교에서 빠졌는지 (P3)
- [ ] **3.5** **계산 근거 펼치기** — 사용한 가정, 사용량 수치, 적용 산식
- [ ] **3.6** **공유 가능한 영구 링크** (`/r/[id]`) — 결과 스냅샷 영구 보관
- [ ] **3.7** **인쇄 친화 뷰** (`@media print`) — 시니어 사용자 인쇄해서 비교

**Phase 3 검증:** Lighthouse 모바일 ≥ 90 (Perf/Acc/BP/SEO).

---

## 페이즈 4 · 전환 플로우 (Switch Flow) — 6~7주차

**목표:** 결과에서 실제 공급사 변경까지 3클릭.

- [ ] **4.1** 어트리뷰션 시스템 (`affiliate_click` 테이블)
  - 누가 / 언제 / 어느 결과에서 / 어느 공급사로 갔는지
- [ ] **4.2** 제휴 가능 공급사 우선 — **그러나 절대 검색 결과 순위에 영향 X**
  - 알고리즘: 절약액 순. 제휴 여부는 "변경하기" 버튼 색만 다름
- [ ] **4.3** 제휴 비공개시 명시적 디스클로저 (각 결과 카드 하단)
  - 예: "Slim은 변경 시 Engie로부터 €X의 수수료를 받습니다 — 이 금액은 회원님의 요금에 영향이 없습니다"
- [ ] **4.4** 비제휴 공급사도 동등하게 표시 (그냥 외부 링크 + "수수료 없음" 표기)
- [ ] **4.5** 전환 후 7일 이내 후속 메일 (선택 동의)
  - "변경 잘 됐나요?" — 변경 실패시 Slim이 개입할 수 있게

**Phase 4 검증:** 어트리뷰션 정확성 — `pnpm harness:price` + 수동 5건 검증.

---

## 페이즈 5 · 카테고리 확장 (Multi-category) — 8~10주차

**목표:** 5개 카테고리 풀 운영.

- [ ] **5.1** 통신 (모바일 + 인터넷) — fetchers 6개
- [ ] **5.2** 보험 (자동차 + 주택) — partner API (Wegus, Yago)
- [ ] **5.3** 금융 (계좌 + 신용카드) — manual + Tink (Open Banking)
- [ ] **5.4** 여행 (항공 + 호텔) — Skyscanner / Booking 어필리엣
- [ ] **5.5** 카테고리별 입력 플로우 (재사용 가능 컴포넌트)
- [ ] **5.6** 카테고리간 교차 추천 ("전기 €420 절약하셨네요. 보험도 비교해볼까요?")

**Phase 5 검증:** 전 카테고리 ≥ 80% 비교 가능률 (입력 5건 중 4건 이상 결과 표시).

---

## 페이즈 6 · 운영 인프라 (Operations) — 11주차

- [ ] **6.1** 어드민 대시보드 (`/admin`)
  - 일별 비교 수, 전환율, 카테고리별 평균 절약액, fetcher 헬스
- [ ] **6.2** Sentry 알림 — fetcher 실패율 > 20%면 페이지
- [ ] **6.3** 가격 변동 모니터링 — `pnpm harness:price`를 cron화
- [ ] **6.4** GDPR 도구
  - 데이터 다운로드 (`/account/export`) + 삭제 (`/account/delete`)
- [ ] **6.5** 쿠키 동의 (CookieBot 또는 자체) — 베네룩스 GDPR + ePrivacy
- [ ] **6.6** Status 페이지 (`status.slim.eu`) — fetcher 헬스 공개
- [ ] **6.7** **Bias audit 운영화** — `pnpm harness:bias` cron (월요일 06:00 UTC) + Sentry 알림
- [ ] **6.8** **GDPR 처리 등록부** (`docs/legal/gdpr-register.md`) — legal 에이전트가 자동 갱신
- [ ] **6.9** **`/legal/affiliate-disclosure` 페이지** — 모든 파트너 + 단가 공개 (legal가 검증)

**Phase 6 검증:** 외부 GDPR 감사 (€800, 1주) 통과 — legal 자체 검토 후 외부 점검은 잔여 리스크만.

---

## 페이즈 7 · 출시 (Launch) — 12주차

- [ ] **7.1** 베타 — Antwerpen / Amsterdam / Luxembourg 시티에서 100명 모집
- [ ] **7.2** 피드백 1주 + 반영
- [ ] **7.3** PR 매체 5곳 컨택 (De Tijd, FD, Tech.eu, Bright, Trends)
- [ ] **7.4** 런치 — 에너지 카테고리만 전국 오픈
- [ ] **7.5** 4주차 회고 + 페이즈 8 (확장) 플랜

---

## 작업 추적 메타

| 페이즈 | 항목 수 | 완료 | 차단 | 최종 업데이트 |
|---|---|---|---|---|
| 0 | 7 | 7 | 0 | — |
| 0.5 | 2 | 1 | 0 | 2026-05-09 |
| 1 | 13 | 1 | 0 | 2026-05-09 |
| 2 | 9 | 0 | 0 | — |
| 3 | 7 | 0 | 0 | — |
| 4 | 5 | 0 | 0 | — |
| 5 | 6 | 0 | 0 | — |
| 6 | 9 | 0 | 0 | — |
| 7 | 5 | 0 | 0 | — |
| **합계** | **63** | **9** | **0** | 2026-05-09 |

> 이 표는 `verifier` 에이전트가 매 `/checkpoint`마다 자동 갱신한다.
> 페이즈 0.5는 운영 부채 트랙으로, ADR-0002의 결정에 묶여 있다.
> 페이즈 0.5의 "항목 수 = 2"는 **D.1, D.2 최상위 단위** 카운트이며,
> Amendment 1로 추가된 D.1.d는 D.1의 서브태스크라 합계 변동 없음.
