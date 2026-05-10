# Changelog — Slim

이 파일은 Slim의 모든 변경사항을 기록합니다.
한 줄 한 줄이 사용자가 신뢰할 근거입니다.

형식: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) + [Semantic Versioning 2.0](https://semver.org/)

---

## [Unreleased]

### Added

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
  - **5단계 자동 시연** (`e2e/compare-flow.spec.ts`, Playwright + reuseExistingServer): mobile + 1000 + single + skip + bill skip → `/r/[shortId]` 도달. **완주 6.7초** (P2 5분 = 300_000ms 대비 44배 마진), **콘솔 에러 0**, nanoid 12자 placeholder 표시 검증. 6 스크린샷 (`e2e/screenshots/01~06.png`). axe-core scan은 SC-C로 페이즈 4 deploy 직전 일괄 추가 — 페이즈 2 1차에선 미실시.
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
