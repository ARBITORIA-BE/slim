# Inngest 알림 룰 명세 (PLAN 4.5.2.b)

> 운영 부채. fetcher cron + follow-up email 실패율 모니터링.

## 상태 (2026-06-05 정찰)

- **함수 등록**: 2개 (`src/inngest/functions.ts`, `src/inngest/follow-up-email.ts`)
  - `dailyFetchAll` — `cron: TZ=UTC 0 6 * * *` (매일 06:00Z) — 3 fetcher (Proximus / Telenet / Orange BE) 실 스크래핑
  - `followUpEmailFn` — `cron: TZ=UTC 0 * * * *` (매시간 정각) — 7일 트리거 follow-up email 발송
- **Production 활성**: ✅ — Vercel 배포 후 Inngest Cloud 대시보드에 연결 확인 (PR #25 머지 후 invoke 성공)
- **Inngest plan**: Free tier (현재) — 5 concurrent steps + 50K function runs/월. 솔로 단계 충분
- **로그 위치**: Inngest 대시보드 (메모리 `reference_inngest_vercel_logs.md` — Vercel runtime logs에는 DB 에러만)

## ⚠️ 선행 정찰 결과 — Inngest 자체 알림 시스템 부재 (2026-06-05)

> **아래 "활성화 절차"는 이 정찰 이전에 작성된 것이라 현재 그대로 실행되지 않을 수 있다.**

2026-06-05 Pieter Chrome MCP 대시보드 직접 정찰 결과:

- **Hobby / Pro / Enterprise 전 plan 에 자체 알림(Notifications/Alerts) 시스템이 없다.**
- Enterprise plan 만 "Dedicated slack channel" 을 명시 — 즉 **Slack/Discord 통합조차 Pro 이하에서는 불가**.
- Pro plan = $75/월 (≈ €70/월). 운영자 €300/월 cap 대비 **비용 대비 효익 낮음** → 격상 거부.

**그래서 4.5.2.b DoD 를 재정의했다**:

| # | 항목 | 상태 |
|---|---|---|
| (i) | 본 문서 명세 잠금 | ✅ |
| (ii) | admin 헬스 페이지 `byMethod.scraping` 모니터링으로 대체 (PLAN 4.7) | ✅ 실측 SCRAPING 14/14 100.0% |
| (iii) | Inngest 자체 알림 | ❌ **시스템 부재** — 외부 통합 별 트랙 (운영자 필요 시 Webhook → self-hosted endpoint 구축, 본 sub-task 범위 밖) |

**재검증 트리거**: 위는 2026-06-05 시점 관찰이다. Inngest 가 이후 알림 기능을 추가했을 수 있으므로,
아래 절차를 실행하기 전에 대시보드에서 Notifications 메뉴 존재를 먼저 확인할 것.

*(출처: PR #33 `chore/4.5.2.b-mark-complete` — 해당 PR 은 PLAN 마킹이 main 의 더 늦은 판단([~] 유지)에
의해 대체되어 close 됐고, 이 정찰 결론만 2026-08-14 본 문서로 이관했다.)*

## 활성화 절차 (운영자 트랙) — 위 정찰 이후 조건부

1. **Inngest Cloud 대시보드** (app.inngest.com) → ARBITORIA-BE 워크스페이스 → production 환경
2. **좌측 사이드바 "Notifications" 또는 "Alerts"** 진입 — **메뉴 부재 시 여기서 중단** (위 §선행 정찰 참조)
3. 아래 룰 2종 등록
4. **수신 채널**: 운영자 이메일 `kim.wonmin91@gmail.com`

## 알림 룰 2종

### 룰 1 — `dailyFetchAll` 실패율 임계값

- **함수**: `daily-fetch-all`
- **트리거**: 24시간 윈도우 안에 실패율 ≥ 10%
  - 정의 = (`failed runs` + `cancelled runs`) / `total runs`
  - 본 함수는 일 1회 cron + 수동 invoke ≈ 일 1~3 runs → 1 fail = 33~100%
  - **현실 임계값 재정의**: 24시간 윈도우에 **2회 이상 실패**도 알림 (실패율 100% on day 1 = fetcher 완전 멈춤)
- **채널**: 운영자 이메일 즉시 (SLA 4시간 — 다음 cron 06:00Z 전에 fix)
- **목적**: 
  - fetcher IP 차단 (메모리 `project_fetcher_prod_ip.md`)
  - 공급사 사이트 구조 변경 (selector fragile)
  - Neon DB 연결 실패
  - Inngest concurrency hang (1.5.8 5m 11s 사고 — 메모리 `project_provider_seed_required.md`)

### 룰 2 — `followUpEmailFn` 실패율 임계값

- **함수**: `follow-up-email`
- **트리거**: 24시간 윈도우 안에 실패율 ≥ 10%
  - 정의 = (`failed runs` + `cancelled runs`) / `total runs`
  - 본 함수는 매시간 정각 cron ≈ 일 24 runs → 10% = 2~3 fail
- **채널**: 운영자 이메일 daily digest (SLA 24시간 — 사용자 행동 영향 미미)
- **목적**:
  - Resend API 401/429 (rate limit, API key 만료)
  - 발송 대상 SELECT timeout
  - 7일 트리거 로직 회귀

## Inngest 대시보드 외 모니터링

- **admin 헬스 페이지** (`slim.lu/{locale}/admin`) — Fetcher 헬스 24시간 신선도 = `dailyFetchAll` 결과의 사용자 측 노출 (PLAN 4.7 통과)
- **Sentry** (4.5.2.a 활성 후) — Inngest 내부 throw가 Sentry로 전파되도록 step.run 내 try/catch 검토

## SLA 매트릭스

| 룰 | 트리거 | SLA | 정당화 |
|---|---|---|---|
| 1 dailyFetchAll | 24h ≥ 10% 또는 2회 이상 실패 | 4h | 다음 cron 전 fix |
| 2 followUpEmailFn | 24h ≥ 10% | 24h | 사용자 미체감, 누적 후 분석 |

## 운영자 €300/월 cap 정합

Inngest Free tier 충분. 베타 트래픽 증가 시 Starter plan ($20/월) reactivate.

## 미해결 / 후속

- (1) **Inngest 대시보드 알림 룰 등록** — 운영자 트랙 (본 docs는 명세만). **단 2026-06-05 정찰 기준 Inngest 자체 알림 시스템이 없어 현재 실행 불가** (§선행 정찰 참조) → 실효 모니터링은 admin 헬스 페이지가 담당
- (2) **fetcher 별 분해 알림** — 현재 `dailyFetchAll` 1개 함수 안에 3 fetcher (Proximus/Telenet/Orange BE) → 함수 단위 알림. fetcher 별 알림은 PLAN 4.7 admin 헬스 페이지로 보완 (byMethod.scraping 측정)
- (3) **Sentry 통합** — 4.5.2.a 활성 시 Inngest step error → Sentry 전파 검토

## 결정 근거

- [ADR-0008](../adr/0008-fetcher-interface-and-cron.md) §T7 (fetcher 격리 — for-loop, 한 fetcher 폭발이 나머지를 안 깸)
- [ADR-0028](../adr/0028-follow-up-email.md) (7일 트리거 follow-up email)
- [ADR-0034](../adr/0034-strategy-pivot-completion-first-seo-launch.md) §4.5 운영 부채 트랙
- 메모리 `reference_inngest_vercel_logs.md` (관찰 채널 단일 출처)
- 메모리 `project_provider_seed_required.md` (1.5.8 invoke 5m 11s hang 사고)
