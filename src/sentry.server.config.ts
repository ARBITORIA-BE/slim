/**
 * Sentry server runtime 초기화 (PLAN 4.5.2.a, ADR-0037 §6.1 정합).
 *
 * Why: server-side error (Inngest fetcher / Next.js Server Action / route handler)
 *      가 Sentry 로 전파되도록. DSN 부재 시 NoOp — 코드 PR 머지 후 운영자가
 *      `SENTRY_DSN` Vercel env 등록 시 즉시 활성.
 *
 * Spec: `docs/runbook/sentry-alert-rules.md` (룰 3종 + EU region + tunnel + 0.1 샘플).
 * Privacy: `sendDefaultPii: false` — IP/cookies 자동 수집 차단 (ADR-0037 §6.1
 *          처리방침 §3국 이전 가드, US Sentry SaaS = SCCs 의존도 낮춤).
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  ...(dsn ? { dsn } : {}),
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV ?? 'development',
  sendDefaultPii: false,
});
