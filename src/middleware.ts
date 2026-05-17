/**
 * 통합 middleware (ADR-0033 §T1 + PLAN 4.5.1.a admin 가드 + PLAN 4.5.j.1 ko 게이트).
 *
 * 세 역할 통합:
 *   1. next-intl locale routing — createMiddleware(routing)
 *   2. /admin 접근 가드 — ADMIN_TOKEN 쿠키/쿼리 검증
 *   3. ko 게이트 — KO_GATE_TOKEN 으로 nl-BE 무프리픽스 경로 보호 (ADR-0033 §A2.2 옵션 b)
 *
 * 실행 순서 (ADR-0033 §A2.5 D2 — admin → ko 게이트 → intl):
 *   (a) /admin 경로 → admin 가드 먼저. 미인증 시 404 즉시 반환.
 *   (b) locale prefix 없는 경로 → ko 게이트. 미인증 시 401 반환.
 *   (c) 그 외 (공개 locale prefix) → next-intl middleware에 위임.
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
 *
 * ko 게이트 정책 (PLAN 4.5.j.1 → 4.5.j.2 Phase A — ADR-0033 §A2.5 + §A2.7):
 *   [4.5.j.1] handleKoGate: KO_GATE_TOKEN 쿠키/쿼리 검증 (admin 동형).
 *   [4.5.j.2] isKoGateTarget 해제: nl-BE 무프리픽스 경로를 게이트 비대상으로 전환.
 *     isKoGateTarget 이 항상 false → handleKoGate 호출 안 됨 → intl 직접 위임.
 *     handleKoGate env 미설정 pass-through (핫픽스 10dee59) 와 수렴 = 정상 상태.
 *     ko 보호 1차선 = request.ts G1-a 오버레이 쿠키 (constantTimeEqual).
 *   게이트 대상 = 없음 (게이트 해제, Phase A 이후).
 *   게이트 비대상 = 전체 (공개 locale prefix + nl-BE 무프리픽스 모두).
 *   prefix 집합은 routing.locales에서 defaultLocale 제외 4개로 도출 — 하드코딩 금지.
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

// ─── ko 게이트 ────────────────────────────────────────────────────────────────

const KO_GATE_COOKIE_NAME = 'ko_gate_token';
// admin 과 동일 30일 — 운영자가 자주 재인증할 필요 없도록.
const KO_GATE_MAX_AGE = 60 * 60 * 24 * 30;

// [Phase A] PUBLIC_LOCALE_PREFIXES 는 4.5.j.2 게이트 해제로 isKoGateTarget 이
// 항상 false 를 반환하므로 현재 미사용 → 선언 제거.
// Phase B(번역 완료) 이후 게이트 로직 복원 시 아래 형태로 재구성:
//   routing.locales.filter(l => l !== routing.defaultLocale).map(l => `/${l}`)
// 단일 출처 = routing.ts (ADR-0033 §A2.5 D2)

function koGateDeny(): NextResponse {
  // 401 — "Unauthorized" (존재 노출 없이 접근 차단).
  // 404 가 아닌 401 을 쓰는 이유: admin 은 존재 자체를 숨기지만,
  // ko 게이트는 "운영자 전용 영역이 있다"는 사실 자체는 숨기지 않아도 됨.
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

/**
 * ko 게이트 핸들러 (ADR-0033 §A2.5 D1).
 * handleAdmin 과 완전히 동형 — 쿠키 이름 / 쿼리 파라미터 / env 이름만 다름.
 *
 * 반환값:
 *   null  → 인증 통과, 호출자가 intlMiddleware 로 위임.
 *   NextResponse → 차단(401) 또는 쿠키 발급 후 redirect.
 */
function handleKoGate(req: NextRequest): NextResponse | null {
  const expected = process.env.KO_GATE_TOKEN;
  // env 미설정 = 게이트 비활성 (pass-through). 왜 fail-closed 가 아닌가:
  //   게이트 대상 = 무프리픽스 경로 전체 = 현재 공개 사이트 표면 전부
  //   (nl-BE 슬롯). 따라서 KO_GATE_TOKEN 미등록 시 fail-closed 면
  //   slim.lu 공개 루트 전체가 401 = 사이트 다운 (2026-05-17 P0 인시던트
  //   실제 발생 — 4.5.j.1 단독 배포 + Vercel prod 토큰 미등록).
  //   토큰을 명시 등록(= 게이트 켜겠다는 의도)했을 때만 보호 활성.
  //   ⚠️ ADR-0033 §A2.5 D1 "env 미설정 fail-closed" 에서 의도적 일탈 —
  //   4.5.j.2(게이트+nl 실콘텐츠+해제 동시)에서 정식 재조정 (architect amend).
  if (!expected) return null; // 게이트 비활성 — intl 에 위임 (공개 서빙)

  const cookieToken = req.cookies.get(KO_GATE_COOKIE_NAME)?.value;
  if (cookieToken && constantTimeEqual(cookieToken, expected)) {
    return null; // 통과 — next-intl 에 위임
  }

  const queryToken = req.nextUrl.searchParams.get('ko_token');
  if (queryToken && constantTimeEqual(queryToken, expected)) {
    // 쿼리 파라미터로 토큰 전달 → 쿠키로 전환 후 쿼리 제거 redirect.
    // 이유: 토큰이 URL 에 남으면 로그/히스토리에 노출 — 쿠키로 이동해 숨김.
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete('ko_token');
    const res = NextResponse.redirect(cleanUrl);
    res.cookies.set(KO_GATE_COOKIE_NAME, expected, {
      httpOnly: true, // JS 접근 차단 — XSS 보호
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: KO_GATE_MAX_AGE,
      path: '/', // nl-BE 슬롯 전체 경로에 쿠키 적용
    });
    return res;
  }

  return koGateDeny();
}

/**
 * 주어진 경로가 ko 게이트 대상인지 판정.
 *
 * [4.5.j.2 Phase A — 게이트 해제 (ADR-0033 §A2.7 A3 + §A2.3 필수 스위치)]
 *   nl-BE 무프리픽스 경로를 게이트 비대상으로 전환한다.
 *   이 함수는 항상 false 를 반환 → 모든 경로가 게이트 비대상 → intl 직접 위임.
 *
 * 왜 이렇게 바꾸는가 (학습자 'why' 코멘트):
 *   4.5.j.1 에서 nl-BE 무프리픽스(루트 `/`, `/compare/*` 등)를 게이트 대상으로
 *   지정한 이유는 "nl-BE 슬롯 = ko 복제본" 이라 ko 콘텐츠가 공개되지 않도록
 *   막기 위해서였다.
 *   4.5.j.2 에서 (a) 이 해제 + (b) nl-BE 슬롯 ko→실nl 교체 +
 *   (c) G1-a ko 오버레이 도입을 동시에 적용한다 (ADR-0033 §A2.3 원자 스위치).
 *   해제 후 무프리픽스 = 실 nl 공개 → pass-through 가 정상·안전
 *   (handleKoGate env 미설정 pass-through 핫픽스 10dee59 와 수렴).
 *   ko 보호는 이제 미들웨어 게이트가 아닌 request.ts G1-a 오버레이 쿠키가 담당.
 *
 * Phase B 이후 이 함수는 삭제되거나 PUBLIC_LOCALE_PREFIXES 로직으로
 * 대체될 수 있으나, Phase A 에서는 "무조건 false" 가 명세 정합.
 */
function isKoGateTarget(_pathname: string): boolean {
  // 4.5.j.2 게이트 해제: nl-BE 무프리픽스 경로 포함 전체 = 게이트 비대상
  return false;
}

// ─── next-intl middleware 인스턴스 ────────────────────────────────────────────

const intlMiddleware = createIntlMiddleware(routing);

// ─── 통합 미들웨어 ────────────────────────────────────────────────────────────

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // (1) /admin 경로 — admin 가드 선처리 (ADR-0033 §A2.5 D2 실행 순서)
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const adminResult = handleAdmin(req);
    if (adminResult !== null) return adminResult;
    // 인증 통과 시 next-intl에 위임 (locale prefix 처리)
    return intlMiddleware(req);
  }

  // (2) ko 게이트 대상 — locale prefix 없는 경로 전체 (nl-BE 슬롯 = ko 콘텐츠)
  if (isKoGateTarget(pathname)) {
    const koResult = handleKoGate(req);
    if (koResult !== null) return koResult;
    // 인증 통과 시 next-intl에 위임
    return intlMiddleware(req);
  }

  // (3) 공개 locale prefix 경로 — 게이트 없이 next-intl에 위임
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
