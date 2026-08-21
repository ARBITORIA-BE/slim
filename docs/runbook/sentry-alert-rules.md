# Sentry 알림 룰 명세 (PLAN 4.5.2.a)

> 운영 부채. 솔로 운영자 1명 — 알림 과부하 회피 + 사이트 침묵 회피 균형.

## 상태 (2026-06-05 정찰)

- **패키지**: `@sentry/nextjs ^8.40.0` 설치됨 (package.json)
- **초기화**: ❌ **미활성** — `instrumentation.ts` / `sentry.*.config.ts` 파일 부재, `Sentry.init` 호출 코드 0건
- **PLAN 4.5.2 가정 정정**: 본문 "Sentry init은 페이즈 0/1에서 setup 됨"은 *부정확* — 페이즈 0/1 시점에도 init 미활성. 본 docs는 *명세 잠금* 만 — 실제 활성은 별 트랙 (운영자 결정).

## 활성화 절차 (운영자 트랙)

1. **Sentry 프로젝트 생성** (sentry.io) — slim 프로젝트 + EU region (GDPR 정합)
2. **DSN 발급** → Vercel env 등록: `SENTRY_DSN` (server) + `NEXT_PUBLIC_SENTRY_DSN` (client)
3. **코드 측 활성** (별 PR):
   - `instrumentation.ts` 신설 (Next.js 15 표준 — server runtime)
   - `sentry.client.config.ts` 신설 (browser)
   - `next.config.js` 에 `withSentryConfig` 래핑
4. **EU 데이터 leakage 가드** — `tunnel` 옵션으로 client → server proxy (US Sentry 직접 노출 회피, ADR-0037 D2 처리방침 §6.1 정합)
5. **PostHog 통합 미설정 유지** (CookieConsent 동의 게이트 안에서만 init — ADR-0037 D3 §나)

## 알림 룰 3종 (Sentry dashboard 설정)

### 룰 1 — Error rate 급증

- **트리거**: 5분 윈도우 안에 `event count >= 5`
- **채널**: 운영자 이메일 `kim.wonmin91@gmail.com` 즉시 (SLA 30분)
- **레벨 필터**: `level:error` OR `level:fatal` (warning 제외 — 노이즈 회피)
- **environment 필터**: `production` 만 (preview/dev 제외)
- **목적**: 신규 배포 직후 회귀 / fetcher API 401 폭주 / DB 연결 실패 등 즉시 감지

### 룰 2 — 신규 issue 첫 발생

- **트리거**: `first_seen` 이벤트 (이전 미발생 fingerprint 신규 등장)
- **채널**: 운영자 이메일 즉시 (SLA 1시간)
- **environment 필터**: `production` 만
- **목적**: 미알려진 에러 패턴 조기 발견 — 솔로 운영 + 사용자 1~10명 단계의 핵심 시그널
- **deduplication**: Sentry 기본 fingerprint (issue 단위 1회만 알림)

### 룰 3 — LCP 성능 회귀

- **트리거**: `measurements.lcp > 5000ms` (5초 초과) sample 발생
- **윈도우**: 매 24시간 1회 요약 (즉시 알림 X — 노이즈 회피)
- **채널**: 운영자 이메일 daily digest
- **environment 필터**: `production` 만
- **목적**: Core Web Vitals 회귀 모니터링 (CLAUDE.md §3 P2 — LCP 2.5s 이하 예산)
- **샘플링**: `tracesSampleRate: 0.1` (10% 샘플 — 비용 절감)

## SLA 매트릭스

| 룰 | 트리거 | SLA | 정당화 |
|---|---|---|---|
| 1 Error rate | 5+ events / 5min | 30분 | 사용자 흐름 차단 시 즉시 조치 |
| 2 신규 issue | 첫 발생 | 1시간 | 패턴 인지 시간 |
| 3 LCP | >5s sample | daily | 점진적 회귀 — 빠른 조치 불요 |

## fetcher 산출 감시가 이 룰들을 타는 방식 (2026-08-21, PLAN 4.27)

[ADR-0054](../adr/0054-fetcher-yield-drop-alerting.md)가 `Sentry.captureMessage(level='error')` 로 **조용한 데이터 유실**(fetcher 가 예외 없이 산출만 줄어드는 고장)을 올린다. 별도 룰 신설 없이 위 룰 1/2 를 그대로 쓴다.

- **왜 warning 이 아니라 error 인가**: 룰 1 이 `level:error` OR `level:fatal` 만 이메일로 보낸다(warning 은 노이즈 회피 목적으로 제외). warning 으로 올리면 *아무도 보지 않는 로그가 하나 더 생길 뿐* 이고, 그건 4.27 이 없애려는 상태 그 자체다.
- **알림 피로 억제**: fingerprint 를 `['fetcher-yield', kind, providerSlug, category]` 로 고정한다. 같은 고장이 매일 반복돼도 issue 는 하나로 묶여 **룰 2(신규 issue 첫 발생)가 1회만** 이메일을 보낸다. 룰 1(5분 내 5건)은 3 fetcher × 카테고리 규모에서 사실상 동시 다발 고장일 때만 걸린다.
- **⚠️ DSN 미등록 시**: `sentry.server.config.ts` 가 `enabled:false` no-op 이므로 **이메일은 발송되지 않고** Inngest 로그 기록만 남는다. 아래 "미해결 (1)" 이 해소되기 전까지 4.27 의 실효는 로그 수준이다.

## 운영자 €300/월 cap 정합

Sentry Developer plan (무료) = 5K events/월 + Performance 10K transactions/월. 솔로 + 사용자 1~10명 단계 충분. 베타 트래픽 증가 시 Team plan (€26/월) reactivate (운영자 시간 cap 정합).

## 미해결 / 후속

- (1) **Sentry init 코드 활성** — 본 docs는 명세만, 실제 활성은 별 PR (운영자 SENTRY_DSN 발급 후 트리거)
- (2) **EU region 보장** — tunnel + region 검증 (ADR-0037 §6.1 §3국 이전)
- (3) **PostHog Sentry 통합** — 양쪽 다 활성 시점에 sentry-integration 추가 검토 (현재 둘 다 미활성)
- (4) **Slack 채널** — 솔로 단계에 불요. 운영자 확장 시 reactivate

## 결정 근거

- [ADR-0037](../adr/0037-public-legal-pages-and-cookie-consent.md) §6.1 처리방침 §3국 이전 (Sentry US SCCs)
- [ADR-0034](../adr/0034-strategy-pivot-completion-first-seo-launch.md) §4.5 운영 부채 트랙
- 메모리 `founder_situation` (€300/월 cap, 솔로 사이드)
- 메모리 `reference_inngest_vercel_logs` (관찰 채널 단일 출처)
