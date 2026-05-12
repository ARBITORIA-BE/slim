---
description: 배포 전 종합 점검 — 페이즈 완료 시점에만 실행
---

배포 가능 여부를 다음 체크리스트로 검증한다. 하나라도 ❌면 배포 불가.

## 코드 품질
- [ ] `pnpm typecheck` (0 에러)
- [ ] `pnpm lint` (0 warnings)
- [ ] `pnpm test` (모두 통과, 커버리지 ≥ 70%)
- [ ] `pnpm test:e2e` (메인 플로우 5분 이내)
- [ ] `pnpm harness:perf` (perf budget — `next build && pnpm start` 선행 필수. LCP ≤ 2.5s / TBT ≤ 200ms = hard / first-load JS per-route 2-tier = hard / Lighthouse Perf·Acc 점수 ≥ 90/95 = advisory. ADR-0023 §T5: CI 머지 차단 X — `/ship` advisory 게이트가 누적 회귀 잡는 자리)

## 데이터 / 정보 우선 (P1)
- [ ] `pnpm harness:data` 통과 — 모든 가격에 출처
- [ ] `pnpm harness:price` — 최근 24h 가격 비정상 없음
- [ ] `/data-sources` 페이지가 모든 활성 fetcher를 나열

## 플랜 정합성
- [ ] `pnpm harness:plan` 통과
- [ ] 현재 페이즈 100% 완료 (또는 사용자가 부분 출시 명시 승인)

## 윤리 / 투명성 (P3)
- [ ] 어트리뷰션 코드가 알고리즘 순위에 영향 없음 (단위 테스트 확인)
- [ ] `pnpm harness:bias` 통과 — 모든 카테고리 시장 점유율 +5%p 이내
- [ ] 모든 비교 결과 카드에 수수료 디스클로저
- [ ] `/transparency-report` 최신 분기 게시됨
- [ ] `legal` 에이전트 검토 통과 (정책 변경 PR이 있을 시)
- [ ] GDPR 처리 등록부(`docs/legal/gdpr-register.md`) 최신 상태

## 운영
- [ ] Sentry 활성, 알림 라우팅 확인
- [ ] PostHog 이벤트 펀널 정의
- [ ] GDPR 도구 (`/account/export`, `/account/delete`) 동작
- [ ] 쿠키 동의 배너 표시

## 마지막 단계
- [ ] CHANGELOG의 [Unreleased] 섹션을 새 버전으로 닫고 [Unreleased] 비움
- [ ] git tag v${VERSION}
- [ ] Vercel 프로덕션 배포 + 헬스 체크
- [ ] Status 페이지 업데이트
