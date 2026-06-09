/**
 * app/sitemap.ts — Next.js App Router 네이티브 sitemap (다국어 확장).
 *
 * 왜 이 파일이 필요한가?
 *   검색엔진이 색인 가능한 URL 목록을 /sitemap.xml 로 제공해야 한다.
 *   Next.js 15 App Router 는 app/sitemap.ts 를 빌드 시 /sitemap.xml 로 정적 생성한다.
 *   (next build 출력에 ○ /sitemap.xml 또는 ƒ /sitemap.xml 로 등장 — PLAN 3.5.2.d DoD)
 *
 * PLAN 3.5.4 확장: Google Localized Versions 사양 —
 *   각 URL entry 에 alternates.languages (5 locale × 경로) 추가.
 *   Next.js MetadataRoute.SitemapFile 이 alternates.languages 를 지원한다.
 *
 * 색인 대상 (포함):
 *   / — 홈 (weekly, 1.0)
 *   /compare — 카테고리 선택 (weekly, 0.8)
 *   /compare/mobile — 모바일 비교 진입 (weekly, 0.8)
 *   /compare/internet_fixed — 고정 인터넷 비교 진입 (weekly, 0.8)
 *   /data-sources — 데이터 출처 투명성 페이지 (weekly, 0.5)
 *   /legal/affiliate-disclosure — 제휴 수수료 공개 (weekly, 0.5)
 *   /legal/terms — 이용약관 (weekly, 0.5) — PLAN 4.12.a
 *   /legal/privacy — 개인정보처리방침 (weekly, 0.5) — PLAN 4.12.b
 *
 * 색인 금지 (제외 — 이 sitemap 에 URL 없음):
 *   /r/[shortId] — 개인 비교 결과 (noindex, ADR-0021 §T8).
 *                  사용자별 맞춤 결과 → 개인정보 + 색인 가치 없음.
 *   /compare/[category]/{current-provider,household,preview}
 *                — 입력 단계 폼 3단계 (noindex, PLAN 3.5.2.c).
 *                  ADR-0043 §D5: postal 단계 제거. ADR-0016 Amd 3: bill 단계 제거.
 *                  sessionStorage 상태 의존 + 단독 URL 접근 시 의미 없는 콘텐츠.
 *   /api/* — Next.js API route (HTML 아님, 색인 대상 아님).
 *   /sitemap.xml, /robots.txt — 자기 참조 금지.
 *
 * 카테고리 슬러그 선택 근거:
 *   TARIFF_CATEGORIES = ['mobile','internet_fixed','bundle_mobile_internet','bundle_internet_tv','bundle_mobile_internet_tv']
 *   (5값, ADR-0042 §D1 Amendment 2, 2026-06-07)
 *   현재 실제 fetcher + 비교 결과가 존재하는 카테고리: mobile, internet_fixed (2개).
 *   bundle_* 3 카테고리는 fetcher 별 PR 트랙(Q2.A 잠금) — 실 데이터 0건이므로 sitemap 제외.
 *   ADR-0011 §T2: 실 데이터 0건 카테고리는 비교 진입 가능하되 "후보 없음" 정직 표시.
 *   → sitemap 에는 mobile + internet_fixed 만 포함. 카테고리 추가 시 아래 배열도 갱신.
 *
 * ADR 근거: ADR-0020 §결정 7, ADR-0021 §T8, ADR-0034 D5, PLAN 3.5.2.d, PLAN 3.5.4.
 */

import type { MetadataRoute } from 'next';

import { SITE_ORIGIN } from '@/lib/site';
import { routing } from '@/i18n/routing';

/**
 * 색인 대상 모든 경로 (locale prefix 제외).
 *
 * 왜 flat array 인가?
 *   카테고리는 2개뿐이라 INDEXABLE_CATEGORIES 로 동적 생성해도 무방하지만,
 *   PLAN 3.5.4 명세가 INDEXABLE_PATHS 배열로 일관 처리를 지정 → 단일 배열 유지.
 */
const INDEXABLE_PATHS = [
  '/',
  '/compare',
  '/compare/mobile',
  '/compare/internet_fixed',
  '/data-sources',
  '/legal/affiliate-disclosure',
  '/legal/terms',
  '/legal/privacy',
] as const;

/**
 * locale + path → 절대 URL.
 *
 * 왜 defaultLocale 만 prefix 없는가?
 *   localePrefix='as-needed' → defaultLocale(nl-BE) URL prefix 없음 (ADR-0033 §T1).
 *   suffix === '/' 일 때 SITE_ORIGIN 만 반환 (trailing slash 중복 방지).
 */
function localeUrl(locale: string, path: string): string {
  const suffix = path === '/' ? '' : path;
  return locale === routing.defaultLocale
    ? `${SITE_ORIGIN}${suffix}`
    : `${SITE_ORIGIN}/${locale}${suffix}`;
}

/**
 * 경로별 우선순위 결정.
 *   홈 = 1.0, legal/data-sources = 0.5, 그 외 = 0.8.
 */
function priorityFor(path: string): number {
  if (path === '/') return 1.0;
  if (path.startsWith('/legal') || path === '/data-sources') return 0.5;
  return 0.8;
}

export default function sitemap(): MetadataRoute.Sitemap {
  // 빌드 시각 — 정적 라우트는 빌드마다 갱신 (동적 콘텐츠 아님).
  const now = new Date();

  return INDEXABLE_PATHS.map((path) => ({
    // defaultLocale URL 을 entry 대표 URL 로 사용 (Google 권장 — canonical = hreflang 중 하나)
    url: localeUrl(routing.defaultLocale, path),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: priorityFor(path),
    // Google Localized Versions — 5 locale × path 매트릭스 (ADR-0034 D5)
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, localeUrl(l, path)]),
      ),
    },
  }));
}
