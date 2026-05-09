# ADR Index

이 문서는 Slim 프로젝트의 모든 Architectural Decision Records를 인덱싱합니다.
각 ADR은 설계 결정의 근거, 대안 검토, 장단점을 기록합니다.

---

## 현황

| ID | 제목 | 상태 | 발행 |
|---|---|---|---|
| [ADR-0001](0001-provider-schema.md) | `provider` 테이블 스키마 (공급사 마스터) | Accepted | 2026-05-09 |
| [ADR-0002](0002-build-gate-ownership.md) | Build gate 책임 분리 + Hook jq fallback 통일 | Accepted (+ Amendment 1) | 2026-05-09 |
| [ADR-0003](0003-plan-realism-solo-side.md) | PLAN.md 리얼리즘 패스 — 솔로 사이드 + 카테고리 우선순위 + 운영 부채 트랙 | Accepted | 2026-05-09 |
| [ADR-0004](0004-monetization-solo-side-rebalance.md) | MONETIZATION.md 솔로 사이드 재조정 — €0 인건비, €300 인프라 cap, 보수적 매출 가정 | Accepted | 2026-05-09 |

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

### [ADR-0003: PLAN.md 리얼리즘 패스 — 솔로 사이드](0003-plan-realism-solo-side.md)

**상태**: Accepted (PLAN.md 본문 갱신 형태로 적용)

**요약**: 운영자 실제 상황(솔로 사이드, 개발 3개월, 월 €300, TVA 대기)에 맞춰 PLAN.md를 재조정. **6개 결정**: (1) 카테고리 우선순위 변경 — 에너지 → **통신 BE (Proximus/Orange BE/Telenet)**, 베네룩스 에너지 비교는 V-test/CREG-Scan/Energyprice/DareToCompare 4중 포화. (2) 페이즈 5는 **M16 평가 게이트** (매출 €1K/월 + CVR 3% + fetcher 95% + 시간 주 10h) 통과 시에만 진입. (3) 운영 부채 트랙(X.5)을 페이즈 1.5/3.5/4.5에 신설 — 페이즈 0.5 패턴 복제. (4) 원 페이즈 4(전환) + 페이즈 7(런치) → 새 페이즈 4로 통합. (5) 일정 단위 주차 → M (Month, 솔로 사이드). 12주 → **18-24개월 (M0~M24)**. (6) Scope cut 옵션 5개(A~E) 명시, 운영자 승인 시 적용.

**영향**: PLAN.md 페이즈 일정 / 카테고리 / X.5 트랙 / 작업 추적 메타 표 갱신. 항목 수 63 → 75. ADR-0004와 짝.

### [ADR-0004: MONETIZATION.md 솔로 사이드 재조정](0004-monetization-solo-side-rebalance.md)

**상태**: Accepted (MONETIZATION.md 본문 갱신 형태로 적용)

**요약**: 풀타임 4명 가정의 비용 모델(M3 €15K, M6 €45K, M12 €90K)을 솔로 사이드 €300/월 cap으로 재조정. **8개 결정**: (1) 인건비 €0 (사이드 전제). (2) 인프라 €300/월 cap, 무료 티어 한계 도달 시점 + 격상 트리거 명시. (3) 법무 자체(legal 에이전트) + 베타 직전 1회 외부 감사 €800. (4) 매출 가정 50% 다운 — M12 €1,800, M16 €3,750, M24 €15,400. (5) Slim Plus 시작 시점 페이즈 6 → M18+ 이연. (6) 시드 모금 M24+ 이연, Vlaio/LU 그랜트 TVA 직후 1주 결정. (7) Slim Insights B2B M24+ 이연. (8) `docs/MONETIZATION-ACTUALS.md` 신설 (분기 자동 갱신).

**영향**: MONETIZATION.md 비용/매출/마일스톤 게이트 재조정. **net positive 진입 시점 M6 → M8** (인건비 €0 효과로 더 빠름, 단 절대 매출 1/15~1/20 작음). ADR-0003과 짝. 회귀 트리거: 분기별 실제 비용/매출이 가정 ±50% 차이 시 Amendment.
