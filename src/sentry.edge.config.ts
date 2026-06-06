/**
 * Sentry edge runtime 초기화 (PLAN 4.5.2.a, ADR-0037 §6.1 정합).
 *
 * Why: middleware / Edge Function 의 에러가 Sentry 로 전파되도록.
 *      현재 fluid-compute 기본이라 edge runtime 사용 0건이지만, 향후 middleware
 *      도입 시 자동 커버 (Next.js instrumentation hook 가 NEXT_RUNTIME 분기).
 *
 * Spec: `sentry.server.config.ts` 와 동일 정책.
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
