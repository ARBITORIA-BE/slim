# 페이즈 6 일괄 격상 — 11건 DoD + builder 4라운드 분해

ADR-0048 §결정 §D4 부속 명세. 각 항목 DoD (Definition of Done) 100자 이하 + builder 위임 라운드 분해.

---

## 11건 DoD (각 항목 100자 이하)

| # | 항목 | Claude 트랙 산출물 | 운영자 트랙 잔여 | 4.5.2 동형 |
|---|---|---|---|---|
| **5.5** | 카테고리별 입력 플로우 | `components/category-input-flow.tsx` 추출 + 통신 BE 재사용 + 테스트 | 없음 (통신 BE 단일) | ✅ |
| **5.6** | 카테고리간 교차 추천 | 통신 결과 CTA 컴포넌트 + 카피 3 locale + ADR-0034 D2 footnote (범위 밖 카테고리 = 컴포넌트 내부 텍스트만, 별도 라우트 ❌) | 없음 (통신 외 카테고리 = ADR-0034 D2 범위 밖, 컴포넌트 내부 footnote 텍스트만) | ✅ |
| **6.1** | 어드민 대시보드 v1 | `/admin` 카테고리별 평균 절약액 카드 + DB 쿼리 + basic-auth 동일 | 없음 (basic-auth 4.5.1 v0 동일) | ✅ |
| **6.2** | Sentry fetcher 알림 | Sentry SDK init 4 파일 + 알림 룰 YAML(`sentry-rules.yml`) | Sentry EU dashboard 룰 등록 (4.5.2와 통합) | ✅ (4.5.2 흡수) |
| **6.3** | 가격 변동 cron | `harness:price` Inngest cron 등록 (일 1회) + DB diff 테이블 | 없음 (Inngest 무료 티어) | ✅ |
| **6.4** | GDPR 도구 | `/account/export` ZIP/JSON + `/account/delete` 확인 + Drizzle 쿼리 | 없음 (자체 구현) | ✅ |
| **6.5** | 쿠키 동의 | 자체 `CookieBanner.tsx` + ePrivacy 카테고리 3종 + 동의 저장 | 없음 (CookieBot 거부, 자체 €0) | ✅ |
| **6.6** | Status 페이지 | `app/status/page.tsx` + fetcher 헬스 API + DB 쿼리 + ISR 5분 | `status.slim.eu` DNS CNAME 등록 (운영자 GoDaddy) | ✅ |
| **6.7** | Bias audit cron | `harness:bias` Inngest cron (월 06:00 UTC) + Sentry 알림 연결 | 없음 (cron 코드 완결) | ✅ |
| **6.8** | GDPR 처리 등록부 | `docs/legal/gdpr-register.md` legal 에이전트 작성 + 6개 처리 활동 | 없음 (문서 머지) | ✅ |
| **6.9** | affiliate-disclosure | `app/legal/affiliate-disclosure/page.tsx` 파트너 + 단가 + legal 검수 | 없음 (정적 페이지) | ✅ |

**6.10 (외부 GDPR 감사 €800)** = 격상 ❌ (수익 €5,000/월 트리거 — ADR-0048 §V1 §V4)

---

## builder 4라운드 분해

각 라운드 = builder 1회 + verifier 6단 게이트 1회 + scribe PLAN [x] 격상. 라운드 간 의존 = 없음 (병렬 가능하나 순차 권장 = 운영자 가시성).

### 라운드 1 — 정적 페이지 + 문서 (3건, ~3일)

**산출물**:
- `app/status/page.tsx` + `app/api/health/route.ts` (6.6)
- `docs/legal/gdpr-register.md` (6.8) — legal 에이전트 호출
- `app/legal/affiliate-disclosure/page.tsx` + 3 locale 번역 (6.9) — legal 에이전트 검수

**의존**:
- 6.8/6.9 = legal 에이전트 선행 (scribe ❌ — legal 도메인)
- 6.6 = `lib/db/fetcher-health.ts` 신설 (DB 쿼리 헬퍼)

**6단 게이트 후 PLAN [x]**: 6.6 / 6.8 / 6.9

### 라운드 2 — cron + 모니터링 (3건, ~4일)

**산출물**:
- `inngest/functions/sentry-fetcher-alert.ts` + `sentry.server.config.ts` 룰 (6.2)
- `inngest/functions/price-diff-cron.ts` + DB diff 테이블 마이그레이션 (6.3) — 1.5.2 정식화
- `inngest/functions/bias-audit-cron.ts` (월 06:00 UTC) + Sentry 알림 (6.7)

**의존**:
- 6.2 = ADR-0046 4.5.2 Sentry init 4 파일 위에 룰 추가 (선행 머지됨)
- 6.3 = 1.5.2 harness:price 기존 스크립트 cron 등록만
- 6.7 = harness:bias 기존 스크립트 cron 등록만

**6단 게이트 후 PLAN [x]**: 6.2 (Claude 트랙) / 6.3 / 6.7. 6.2 자식 운영자 트랙은 [~] 유지 (4.5.2 동형).

### 라운드 3 — 어드민 + GDPR 도구 + 쿠키 (3건, ~5일)

**산출물**:
- `/admin` 카테고리별 평균 절약액 카드 확장 (6.1) — 4.5.1 v0 위에 컴포넌트 추가
- `app/account/export/route.ts` (ZIP/JSON) + `app/account/delete/page.tsx` 확인 플로우 (6.4)
- `components/CookieBanner.tsx` + ePrivacy 카테고리 3종 + 동의 저장 cookie/localStorage (6.5)

**의존**:
- 6.1 = 4.5.1 v0 admin 페이지 (선행 완료)
- 6.4 = Drizzle user/affiliate_click/consent 테이블 쿼리 (선행 완료)
- 6.5 = legal 에이전트 ePrivacy 카테고리 정의 선행 (1회 검토)

**6단 게이트 후 PLAN [x]**: 6.1 / 6.4 / 6.5

### 라운드 4 — 페이즈 5 공통 인프라 (2건, ~2일)

**산출물**:
- `components/category-input-flow.tsx` 추출 + 통신 BE 재사용 + 테스트 (5.5) — 페이즈 2 carousel 추출
- `components/cross-category-cta.tsx` + 통신 결과 페이지 통합 + 3 locale 카피 (5.6) — 통신 외 카테고리 = ADR-0034 D2 footnote

**의존**:
- 5.5 = 페이즈 2 carousel 컴포넌트 (선행 완료)
- 5.6 = 페이즈 3 결과 페이지 (선행 완료) + ADR-0034 D2 footnote 카피

**6단 게이트 후 PLAN [x]**: 5.5 / 5.6

---

## 누적 카운트 추적

| 라운드 | 격상 건 | done 누적 | PLAN 합계 |
|---|---|---|---|
| 시작 | — | 78 | 98 |
| 라운드 1 | 6.6 / 6.8 / 6.9 | 78 → 81 | 98 |
| 라운드 2 | 6.2 / 6.3 / 6.7 | 81 → 84 | 98 |
| 라운드 3 | 6.1 / 6.4 / 6.5 | 84 → 87 | 98 |
| 라운드 4 | 5.5 / 5.6 | 87 → 89 | 98 |

**최종**: 89/98 (78 + 11). 페이즈 6 행 = 10 항목 중 9 done (6.10 보류).

---

## 6단 게이트 라운드별 예상 신규 테스트

| 라운드 | test:run 신규 | 누적 |
|---|---|---|
| 시작 | — | 786 |
| 라운드 1 | +8 (status API + GDPR register markdown + affiliate-disclosure render) | 794 |
| 라운드 2 | +12 (cron Inngest mock 3종) | 806 |
| 라운드 3 | +15 (admin v1 + GDPR export/delete + CookieBanner) | 821 |
| 라운드 4 | +6 (category-input-flow + cross-category-cta) | 827 |

---

## 운영자 트랙 잔여 정리 (격상 PR 머지 ≠ 운영자 완료)

ADR-0048 §V1 정직성 검증 대상:

| 항목 | 운영자 트랙 잔여 | 정직 표시 |
|---|---|---|
| **6.2** | Sentry EU dashboard 룰 등록 (4.5.2 흡수) | 4.5.2 자식 b [~] 유지 |
| **6.6** | `status.slim.eu` DNS CNAME 등록 (GoDaddy) | 6.6 본문 footnote "DNS 등록 = 운영자 트랙" |

다른 9건 = 운영자 트랙 잔여 0 = 부모 [x] 자식 [x] 정합.
