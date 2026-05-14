/**
 * /admin 가드 — PLAN 4.5.1.a
 *
 * 어드민 대시보드는 솔로 운영자 1명만 접근. NextAuth/OAuth 는 과잉, Vercel
 * Password Protection 은 vendor lock-in — `ADMIN_TOKEN` env + 쿠키 30일 방식.
 *
 * 정책:
 *   1. 쿠키 `admin_token` 이 env `ADMIN_TOKEN` 과 일치하면 통과.
 *   2. 쿼리 `?token=...` 가 env `ADMIN_TOKEN` 과 일치하면 쿠키 발급 후 쿼리 제거
 *      리다이렉트.
 *   3. 그 외 → **404** (401 아님). /admin 존재 자체를 비공개 — 헌법 §8 #1
 *      "사용자 데이터 외부 0" 의 운영 측 대칭.
 *   4. `ADMIN_TOKEN` 미설정 → 무조건 404 (fail-closed, env 미구성 상태에서
 *      노출 방지).
 *
 * 쿠키 속성:
 *   httpOnly, sameSite=lax, path=/admin, maxAge 30일, secure=production only.
 *
 * 토큰 비교는 length-equal + XOR 누적으로 timing 차이 회피 (어드민 단일
 * 토큰이지만 운영 위생).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { constantTimeEqual } from '@/lib/constant-time-equal';

const COOKIE_NAME = 'admin_token';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function deny(): NextResponse {
  return new NextResponse('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export function middleware(req: NextRequest): NextResponse {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return deny();

  const cookieToken = req.cookies.get(COOKIE_NAME)?.value;
  if (cookieToken && constantTimeEqual(cookieToken, expected)) {
    return NextResponse.next();
  }

  const queryToken = req.nextUrl.searchParams.get('token');
  if (queryToken && constantTimeEqual(queryToken, expected)) {
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete('token');
    const res = NextResponse.redirect(cleanUrl);
    res.cookies.set(COOKIE_NAME, expected, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: MAX_AGE_SECONDS,
      path: '/admin',
    });
    return res;
  }

  return deny();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
