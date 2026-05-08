# Changelog — Slim

이 파일은 Slim의 모든 변경사항을 기록합니다.
한 줄 한 줄이 사용자가 신뢰할 근거입니다.

형식: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) + [Semantic Versioning 2.0](https://semver.org/)

---

## [Unreleased]

### Added

- Phase 1 (PLAN 1.1) — `provider` 테이블 (공급사 마스터): 베네룩스(BE/NL/LU) 공급사 정보 저장. 필드는 `id`, `country` enum, `name`, `legal_name`, `slug`, `vat_id`, `vat_id_verified_at` (VIES 검증), `website`, `affiliate_status` enum (6값: `none`/`pending`/`active_b2b_intra_eu`/`active_b2b_domestic_be`/`paused`/`terminated`), `excluded_reason` (비교 제외 사유, null이면 비교 가능). 결정 근거: [ADR-0001](docs/adr/0001-provider-schema.md).

### Changed

### Deprecated

### Removed

### Fixed

### Security

---

## [0.0.0] — 2026-05-09

**내부 마일스톤**: Phase 0 (기반) 완료. bootstrap 스크립트로 Next.js 15 + TypeScript strict + Tailwind 4 + Drizzle + Vitest 환경 준비.
