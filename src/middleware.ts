/**
 * 통합 middleware (ADR-0033 §T1 + PLAN 4.5.1.a admin 가드).
 *
 * 두 역할 통합:
 *   1. next-intl locale routing — createMiddleware(routing)
 *   2. /admin 접근 가드 — ADMIN_TOKEN 쿠키/쿼리 검증
 *
 * 실행 순서:
 *   (a) /admin 경로면 admin 가드 먼저 — 미인증 시 404 즉시 반환.
 *   (b) 그 외는 next-intl middleware에 위임 (locale 감지/redirect).
 *
 * API 라우트 제외 (ADR-0033 §Migration):
 *   /api/ 는 locale 무관 — next-intl 개입 없음 (matcher 제외).
 *
 * localePrefix = 'as-needed' (ADR-0033 §T1):
 *   defaultLocale(nl-BE) URL은 prefix 없음 → 기존 URL 구조 100% 보존.
 *
 * admin 가드 정책 (PLAN 4.5.1.a):
 *   1. 쿠키 `admin_token` = ADMIN_TOKEN env → 통과.
 *   2. 쿼리 `?token=ADMIN_TOKEN` → 쿠키 발급 후 쿼리 제거 redirect.
 *   3. 그 외 / ADMIN_TOKEN 미설정 → 404 (fail-closed).
 */

import createIntlMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';

import { constantTimeEqual } from '@/lib/constant-time-equal';
import { routing } from './i18n/routing';

// ─── admin 가드 ───────────────────────────────────────────────────────────────

const ADMIN_COOKIE_NAME = 'admin_token';
const ADMIN_MAX_AGE = 60 * 60 * 24 * 30; // 30일

function adminDeny(): NextResponse {
  return new NextResponse('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

function handleAdmin(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return adminDeny();

  const cookieToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (cookieToken && constantTimeEqual(cookieToken, expected)) {
    return null; // 통과 — next-intl에 위임
  }

  const queryToken = req.nextUrl.searchParams.get('token');
  if (queryToken && constantTimeEqual(queryToken, expected)) {
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete('token');
    const res = NextResponse.redirect(cleanUrl);
    res.cookies.set(ADMIN_COOKIE_NAME, expected, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ADMIN_MAX_AGE,
      path: '/admin',
    });
    return res;
  }

  return adminDeny();
}

// ─── next-intl middleware 인스턴스 ────────────────────────────────────────────

const intlMiddleware = createIntlMiddleware(routing);

// ─── 통합 미들웨어 ────────────────────────────────────────────────────────────

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // /admin 경로 — 가드 먼저
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const adminResult = handleAdmin(req);
    if (adminResult !== null) return adminResult;
    // 인증 통과 시 next-intl에 위임 (locale prefix 처리)
    return intlMiddleware(req);
  }

  // 그 외 — next-intl에 위임
  return intlMiddleware(req);
}

export const config = {
  matcher: [
    /*
     * 다음을 제외한 모든 경로:
     * - _next/static / _next/image (Next.js 내부 에셋)
     * - api/ (API routes — locale 무관, ADR-0033 §Migration)
     * - 정적 파일 확장자 (.ico .png .svg 등)
     */
    '/((?!_next|api|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt)).*)',
    '/',
  ],
};
