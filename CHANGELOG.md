# Changelog — Slim

이 파일은 Slim의 모든 변경사항을 기록합니다.
한 줄 한 줄이 사용자가 신뢰할 근거입니다.

형식: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) + [Semantic Versioning 2.0](https://semver.org/)

---

## [Unreleased]

### Added

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

### Deprecated

### Removed

### Fixed

### Security

---

## [0.0.0] — 2026-05-09

**내부 마일스톤**: Phase 0 (기반) 완료. bootstrap 스크립트로 Next.js 15 + TypeScript strict + Tailwind 4 + Drizzle + Vitest 환경 준비.
