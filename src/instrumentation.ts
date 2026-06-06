/**
 * Next.js 15 instrumentation hook — Sentry server/edge runtime 부트스트랩.
 *
 * Why: Next.js 가 server 시작 시 1회 호출. NEXT_RUNTIME 분기로 nodejs/edge
 *      Sentry config 를 lazy import (번들 분리).
 *
 * Spec: PLAN 4.5.2.a, ADR-0037 §6.1.
 * Ref:  https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *       Sentry v8.28+ `onRequestError` hook 으로 RSC/route handler 에러 자동 캡처.
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
