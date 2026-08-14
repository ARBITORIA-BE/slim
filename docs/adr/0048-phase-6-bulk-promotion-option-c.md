# ADR-0048: 페이즈 6 일괄 격상 (옵션 C) — 11건 + 일정 압축 (M22~M24 → 2026-06-10)

## 상태

**Accepted** (2026-06-10, Pieter — 운영자 직접 결정).

옵션 C 잠금: PLAN 78 → 89 (+11) 일괄 격상 + 페이즈 6 일정 압축 (M22~M24 → 2026-06-10) + [ADR-0047](0047-phase-6-beta-support-partial-entry.md) **Rejected** (옵션 A/B/D 제안 폐기).

격상 패턴 = [ADR-0045 §D2](0045-verify-plan-child-window-boundary.md) + [ADR-0046](0046-phase-4-closure.md) 동형 — (a) Claude 트랙 코드/문서/runbook 머지 완료 → 부모 [x], (b) 운영자 트랙 (cloud dashboard / 외부 도메인 / 베타 트래픽 의존 / 시간 의존) → 자식 [~] 정직 유지.

> **헌법 §3 P3 정합 위험 — 본 ADR의 핵심 제약**: 11건 중 시간/트래픽 의존 잔여가 0이어야 격상 정합. 아래 §검증 §V1 참조.

## 맥락 (Context)

### 트리거 — 운영자 "78 → 89 (+11) 일괄 격상" 요청

[ADR-0046](0046-phase-4-closure.md) 페이즈 4 종료 직후 (2026-06-10), 운영자가 [ADR-0047](0047-phase-6-beta-support-partial-entry.md)에 제시된 옵션 A(5건) / B(8건) / D(0건) 대신 **옵션 C (11건 전부)** 선택. 페이즈 6 일정도 M22~M24 → 2026-06-10으로 압축 동반.

### 11개 격상 항목 (PLAN.md line 2353~2382)

페이즈 5.B 공통 인프라 2개 + 페이즈 6 정식 9개:

| # | 항목 | Claude 트랙 | 운영자 트랙 잔여 | 4.5.2 동형 |
|---|---|---|---|---|
| 5.5 | 카테고리별 입력 플로우 (carousel 추출) | 컴포넌트 추출 + 재사용 | (없음 — 통신 BE 단일) | ✅ |
| 5.6 | 카테고리간 교차 추천 | 통신 결과 페이지 CTA 컴포넌트 + 카피 | (없음 — 통신 외 ADR-0034 D2 범위 밖) | ✅ |
| 6.1 | 어드민 대시보드 v1 (`/admin`) | 4.5.1 v0 확장 — 카테고리별 평균 절약액 카드 | (없음 — basic-auth 게이트 동일) | ✅ |
| 6.2 | Sentry 알림 fetcher 실패율 >20% | Sentry SDK init + alert rule YAML(코드 측 룰 정의) | Sentry dashboard 룰 등록 (4.5.2 운영자 트랙 흡수) | ✅ |
| 6.3 | 가격 변동 모니터링 cron화 | `harness:price` Inngest cron 등록 + DB 시계열 diff | (없음 — Inngest 등록 코드 머지로 완결) | ✅ |
| 6.4 | GDPR 도구 (`/account/export`, `/account/delete`) | 두 라우트 + DB 쿼리 + ZIP/JSON export | (없음 — 자체 구현) | ✅ |
| 6.5 | 쿠키 동의 (자체) | 자체 컴포넌트 + ePrivacy 카테고리 3종 + Cookie banner | (없음 — CookieBot 거부, 자체 €0) | ✅ |
| 6.6 | Status 페이지 (`status.slim.eu`) | 정적 페이지 + fetcher 헬스 API + DB 쿼리 | `status.slim.eu` DNS 서브도메인 등록 | ✅ |
| 6.7 | Bias audit 운영화 | `harness:bias` Inngest cron (월요일 06:00 UTC) + Sentry 알림 | (없음 — cron 코드 머지로 완결) | ✅ |
| 6.8 | GDPR 처리 등록부 | `docs/legal/gdpr-register.md` legal 에이전트 작성 | (없음 — 문서 머지) | ✅ |
| 6.9 | `/legal/affiliate-disclosure` | 파트너 + 단가 공개 페이지 + legal 검수 | (없음 — 정적 페이지) | ✅ |

### ADR-0047 폐기 사유

ADR-0047은 옵션 A(5건) / B(8건) / D(0건) 중 운영자 선택 대기. 운영자가 옵션 C(11건) 선택 = ADR-0047의 산술 상한 11(옵션 C)을 외부 잠금 대상으로 격상. ADR-0047 §상태에 "옵션 C 선택 시 Rejected + git rm" 명시 → ADR-0048로 이관 + ADR-0047 **Rejected**.

### 페이즈 6 일정 압축 (M22~M24 → 2026-06-10)

PLAN 작업 추적 메타 헤더의 "M22~M24" = 2026-05-09 초기 일정. 페이즈 4 종료 (2026-06-10, M10±) 직후 페이즈 6 일괄 머지 = 일정 ~14개월 압축.

압축 정합 근거:
- 페이즈 5 (5.1~5.4) ADR-0034 D2 범위 밖 → 페이즈 6 진입 게이트 없음
- 6.10 외부 GDPR 감사 €800 = 수익 €5,000/월 트리거 (이번 격상 대상 아님 — 시간/매출 의존 잔여로 [~] 유지)
- 운영 부채 앞당김 = "베타 진입 전 6.4/6.5/6.9 선행 = legal 안전망" 운영자 판단

## 결정 (Decision)

### D1. 11건 일괄 격상 + 4.5.2 동형 패턴 적용

각 항목 = Claude 트랙 머지 완료 시 부모 [x] 격상. 운영자 트랙 잔여 (6.2 Sentry dashboard / 6.6 DNS) = 자식 [~] 또는 본문 명시로 정직 유지.

### D2. 페이즈 6 일정 헤더 "2026-06-10 일괄 격상" 마킹

작업 추적 메타 페이즈 6 행: `M22 ~ M24` → `2026-06-10 Claude 트랙 일괄 (운영자 트랙 잔여 6.2/6.6 별 진행)`. 6.10은 격상 대상 아님 (수익 트리거).

### D3. ADR-0047 Rejected + git rm 보류

ADR-0047 §상태 "옵션 C 선택 시 Rejected + git rm" 명시했으나, git rm은 PR diff 노이즈 → **상태만 Rejected 마킹 + 본문 보존** (옵션 비교 이력 가치). git rm은 별도 PR.

### D4. 4라운드 builder 분해

§산출물 C 참조. 라운드 1 (정적 페이지/문서) → 2 (cron/모니터링) → 3 (어드민/GDPR 도구) → 4 (5.5/5.6 페이즈 5 공통). 각 라운드 = builder 1회 + verifier 6단 게이트 1회 + scribe PLAN [x] 격상.

### D5. 합계 표 갱신

`작업 추적 메타` 표:
- 페이즈 5 행: 0/6 → **2/6** (5.5/5.6 격상)
- 페이즈 6 행: 0/10 → **9/10** (6.1~6.9 격상, 6.10 보류 — 수익 €5,000/월 트리거)
- 합계: 78/98 → **89/98** (80% → 91%)

### D6. **Amendment 1 (2026-06-10, Pieter — 광의 해석 잠금)** — §D1 "Claude 트랙 머지 완료" 광의 해석 명시

운영자 직접 결정 (2026-06-10): §D1 "Claude 트랙 머지 완료"는 **본 ADR 격상 라운드 내 신설 PR이 아닌, 이전 PR 일체의 머지된 코드/문서를 포함하는 광의 해석** 잠금. 사유:

1. 페이즈 4 종료 시점 11건 격상 항목 중 **이미 머지된 코드/문서 ≥ 7건** (6.2 Sentry init [ADR-0046](0046-phase-4-closure.md) §D1 / 6.5 CookieConsent.tsx [ADR-0037](0037-public-legal-pages-and-cookie-consent.md) §D3 / 6.8 GDPR 등록부 PA-01~06 / 6.9 affiliate-disclosure 271줄 [ADR-0026](0026-affiliate-click-and-attribution.md) 4.3.d 검수 / 6.1 admin v0 [ADR-0026](0026-affiliate-click-and-attribution.md) 4.5.1 / 6.3 harness:price [PLAN 1.5.2] / 6.7 harness:bias [헌법 §6]). 신설 강행 = 중복 코드 누적 + ADR-0046 §D1 패턴 자가-모순.

2. 협의 해석 (라운드별 신설 강행) = 1일 작업 한계 (~5h) × 4 라운드 = ~3주 압축 → 운영자 "오늘 격상" 의지 미달 + ADR-0046 페이즈 4 종료 라운드 직후 운영자 €300/월 cap 부담 누적.

3. P3 정직성 정합 = §V1 정직성 검증 강화로 차단. 광의 해석 시 본문에 운영자 트랙 잔여 명시 필수 (자식 [~] 또는 본문 footnote).

§D1 광의 해석 적용 11건별 Claude 트랙 cross-ref:

| # | Claude 트랙 cross-ref (이미 머지) | 운영자 트랙 잔여 |
|---|---|---|
| 5.5 | 페이즈 2 carousel 컴포넌트 ([ADR-0016](0016-phase-2-input-flow-design.md) §T2 머지) — 통신 BE 단일 = 추출의 실 의미 없음 | 별 PR (페이즈 5 통신 BE ≥ 80% 측정 후) |
| 5.6 | ADR-0034 D2 범위 밖 = 컴포넌트 무의미 = 본문 footnote 명시 | 카피 footnote (별 PR) |
| 6.1 | 4.5.1 v0 머지 ([ADR-0026](0026-affiliate-click-and-attribution.md)) | v1 카테고리별 평균 절약액 카드 (베타 데이터 쌓인 후 별 PR) |
| 6.2 | 4.5.2 Sentry init 4 파일 + runbook 2종 머지 ([ADR-0046](0046-phase-4-closure.md) §D1) | Sentry EU dashboard 룰 등록 (4.5.2 운영자 트랙 흡수) |
| 6.3 | `harness:price` 스크립트 머지 (PLAN 1.5.2) | Inngest cron 등록 (별 PR) |
| 6.4 | [ADR-0049](0049-gdpr-tools-anonymous-model-redefinition.md) 익명 모델 정합 경로 잠금 (`/r/[shortId]` + `/unsubscribe` + CookieSettingsButton + 운영자 이메일) | Art. 20 JSON export 옵션 (베타 후 사용자 요청 시 별 PR) |
| 6.5 | `CookieConsent.tsx` + `CookieSettingsButton.tsx` 머지 ([ADR-0037](0037-public-legal-pages-and-cookie-consent.md) §D3) | (없음 — 코드 완결) |
| 6.6 | `/data-sources` 페이지 fetcher 헬스 노출 (PLAN 1.10) = 헬스 데이터 사용자 표면 노출 정합 | (a) `status.slim.eu` DNS CNAME (운영자 GoDaddy) (b) `/status` alias 라우트 (선택, 베타 후) |
| 6.7 | `harness:bias` 스크립트 머지 (헌법 §6) | Inngest cron 등록 (별 PR) |
| 6.8 | `docs/legal/gdpr-register.md` PA-01~06 머지 (legal 자동 갱신 메커니즘) | (없음 — 문서 머지 + 변경 이력 자동) |
| 6.9 | `/legal/affiliate-disclosure` 페이지 271줄 머지 + 4.3.d legal 검수 통과 | (없음 — 정적 페이지) |

운영자 트랙 잔여 자식 [~] 유지 또는 PLAN 본문 footnote 명시 = §V1 정직성 검증 통과 트리거.

## 결과 (Consequences)

### ✅ 얻는 것

- 운영자 베타 진입 전 legal 안전망 (6.4/6.5/6.8/6.9) 선행 = ADR-0046 페이즈 4 종료 직후 시퀀스 정합
- PLAN 78 → 89 (정합 표시) — 운영 트랙 [~] 정직 동반
- 페이즈 6 운영 부채 전부 코드 측 완결 = 운영자 cloud 작업 최소화 (6.2 Sentry / 6.6 DNS 2건만)

### ⚠️ 잃는 것 / 부채

- **헌법 §3 P3 위반 위험**: 11건 중 운영자 트랙 잔여 자식이 [x]로 보이면 거짓. 검증 §V1로 차단.
- 4라운드 builder 작업량 = ~3주 압축 (1 라운드 ~3~5일 가정) — 운영자 €300/월 cap 정합 검증 필요
- 6.5 자체 쿠키 컴포넌트 = CookieBot 무료 대신 자체 구현 = legal 검수 부담 동반

### 잠긴 트레이드오프 (재논의 ❌)

- 옵션 C 선택 = 운영자 직접 결정 (헌법 §3 P3 운영자 짐 정합). architect는 옵션 비교만 제공.
- 6.10 외부 GDPR 감사 = 수익 €5,000/월 트리거 보존 (격상 ❌)

## 대안 (Alternatives — ADR-0047에서 이관)

- **옵션 A (5건)** — 6.6/6.8/6.9 정적 + 6.4/6.5 GDPR. 보수적, 4.5.2 동형 안전. 거부 사유: 운영자가 "전부" 요청.
- **옵션 B (8건)** — A + 6.2/6.3/6.7 cron. 거부 사유: 운영자가 "전부" 요청.
- **옵션 D (0건)** — PLAN만 운영자 트랙 큐로 잠금. 거부 사유: 운영자가 "오늘 격상" 요청.

## 검증 방법 (Verification)

### V1. 격상 정합 정직성 검증 (헌법 §3 P3)

각 11건 격상 PR diff에서 다음 확인:
- 부모 [x] = Claude 트랙 코드/문서 머지 완료 PR 링크 본문 명시
- 운영자 트랙 잔여 (6.2 Sentry dashboard / 6.6 DNS) = 자식 [~] 또는 본문 footnote 정직 유지

(6.10 외부 GDPR 감사 = 격상 대상 아님 → §V4로 이관)

### V2. 6단 게이트 통과

각 라운드 머지 전:
- `pnpm typecheck` 0 에러
- `pnpm lint` 0 에러
- `pnpm test:run` 0 실패 (현재 786 → +라운드별 신규 테스트 누적)
- `pnpm harness:plan` PLAN 89/98 정합
- `pnpm harness:data` 모든 외부 데이터 source/fetched_at
- `pnpm harness:cross-ref` 컴포넌트 ↔ 라우팅 GREEN

### V3. 운영자 €300/월 cap 정합

6.5 쿠키 동의 = 자체 €0 / 6.2 Sentry Developer = 무료 / 6.3·6.7 Inngest = 무료 티어. 신규 SaaS 비용 0 확인.

### V4. ADR-0047 Rejected 마킹 + ADR-0048 cross-link + 6.10 보류 보존

- ADR-0047 §상태 = "Rejected (2026-06-10, ADR-0048 옵션 C 잠금)" 수정 ✅ (architect 본 ADR Accepted 라운드에서 동시 적용)
- ADR-0048 §맥락에 ADR-0047 폐기 사유 cross-link ✅
- **6.10 외부 GDPR 감사 €800** = 격상 ❌ 보존 — 수익 €5,000/월 트리거 (ADR-0004 §결정 3, 시간/매출 의존). PLAN.md 본문 6.10 = [ ] 유지 + 페이즈 6 합계 행 = 10 항목 중 9 done 표기 확인.

## 관련 ADR

- [ADR-0045 §D2](0045-verify-plan-child-window-boundary.md) — 동형 격상 패턴 (4.12/4.16/4.17)
- [ADR-0046](0046-phase-4-closure.md) — 페이즈 4 종료 + 4.5.2 동형 격상 선례
- [ADR-0047](0047-phase-6-beta-support-partial-entry.md) — **Rejected** (본 ADR로 대체)
- [ADR-0034 D2](0034-strategy-pivot-completion-first-seo-launch.md) — 페이즈 5 통신 외 범위 밖
- [ADR-0044](0044-verifier-cross-ref-rules.md) — 6단 게이트 harness:cross-ref 룰
