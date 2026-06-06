/**
 * Sentry browser 초기화 (PLAN 4.5.2.a, ADR-0037 §6.1 정합).
 *
 * Why: client-side error (React render / browser fetch) 를 Sentry 로 전파.
 *      tunnel route 로 광고 차단기 우회 + US Sentry 직접 노출 회피
 *      (자사 도메인 경유 = IP/UA 가드).
 *
 * Spec: `docs/runbook/sentry-alert-rules.md`.
 * Privacy: `sendDefaultPii: false` + replayIntegration/feedbackIntegration 비활성
 *          (세션 녹화 = ePrivacy 동의 게이트 필요, CookieConsent 통합 후 reactivate).
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  ...(dsn ? { dsn } : {}),
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
  sendDefaultPii: false,
});
