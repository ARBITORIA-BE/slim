# ADR Index

이 문서는 Slim 프로젝트의 모든 Architectural Decision Records를 인덱싱합니다.
각 ADR은 설계 결정의 근거, 대안 검토, 장단점을 기록합니다.

---

## 현황

| ID | 제목 | 상태 | 발행 |
|---|---|---|---|
| [ADR-0001](0001-provider-schema.md) | `provider` 테이블 스키마 (공급사 마스터) | Accepted | 2026-05-09 |
| [ADR-0002](0002-build-gate-ownership.md) | Build gate 책임 분리 + Hook jq fallback 통일 | Accepted (+ Amendment 1) | 2026-05-09 |

---

## 설명

### [ADR-0001: `provider` 테이블 스키마](0001-provider-schema.md)

**상태**: Accepted (verifier 통과: typecheck/lint/test/migration-sql/harness:plan 모두 통과)

**요약**: PLAN 항목 1.1의 첫 테이블. 베네룩스 공급사 마스터 데이터. 세무 처리(BTW 21% vs 0% 리버스 차지)를 분기하는 6값 `affiliate_status` enum으로 설계. VIES VAT ID 검증 시각 추적 (`vat_id_verified_at`). 비교 제외 사유 공개 (`excluded_reason`) — P3 투명성 강제.

**영향**: 1.2 `tariff`, 1.3 `tariff_snapshot`, 4.1 `affiliate_click` 후속 테이블의 기초.

### [ADR-0002: Build gate 책임 분리 + Hook jq fallback 통일](0002-build-gate-ownership.md)

**상태**: Accepted (verifier 통과: typecheck/lint/test/harness:plan/harness:data/build/ci.yml/jq-fallback 음성테스트 모두 통과). **Amendment 1 (2026-05-09)** — CI lint 단계 제거 (GitHub Actions ESLint 9 호환성). 4단 게이트로 축소.

**요약**: Vercel production build 실패(D.1) + Windows에서 `pre-tool-guard.sh`의 jq 의존(D.2)을 한 사이클로 묶어 정리. **옵션 C 채택**: `next.config.ts`에 `ignoreBuildErrors` + `ignoreDuringBuilds` 추가하여 Vercel을 순수 빌드 머신으로 환원하고, 검증 권한을 로컬 stop-gate + GitHub Actions CI 워크플로로 이중화. PreToolUse hook은 `_lib.sh`의 jq fallback 패턴으로 통일. **Amendment 1**: GitHub Actions에서 `pnpm lint`가 매번 실패 → CI에서 lint 단계 제거, lint는 로컬 stop-gate 단독 책임으로 환원. 거짓 안전 신호 회피 (`continue-on-error: true` 거부).

**영향**: 페이즈 0.5 D.1, D.2, **D.1.d** (Amendment 1)의 헌장. 헌법 P4 강제 위치를 hook 단일점 → hook + CI 이중점으로 격상 (단 lint는 hook 단일점 유지). 회귀 트리거: stop-gate 우회 push 발견 시 ADR 재검토 + lint 우회 push 발견 시 Amendment 2 검토.
