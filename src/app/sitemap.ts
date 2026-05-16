/**
 * app/sitemap.ts — Next.js App Router 네이티브 sitemap.
 *
 * 왜 이 파일이 필요한가?
 *   검색엔진이 색인 가능한 URL 목록을 /sitemap.xml 로 제공해야 한다.
 *   Next.js 15 App Router 는 app/sitemap.ts 를 빌드 시 /sitemap.xml 로 정적 생성한다.
 *   (next build 출력에 ○ /sitemap.xml 또는 ƒ /sitemap.xml 로 등장 — PLAN 3.5.2.d DoD)
 *
 * 색인 대상 (포함):
 *   / — 홈 (weekly, 1.0)
 *   /compare — 카테고리 선택 (weekly, 0.8)
 *   /compare/mobile — 모바일 비교 진입 (weekly, 0.8)
 *   /compare/internet_fixed — 고정 인터넷 비교 진입 (weekly, 0.8)
 *   /data-sources — 데이터 출처 투명성 페이지 (monthly, 0.5)
 *   /legal/affiliate-disclosure — 제휴 수수료 공개 (monthly, 0.5)
 *
 * 색인 금지 (제외 — 이 sitemap 에 URL 없음):
 *   /r/[shortId] — 개인 비교 결과 (noindex, ADR-0021 §T8).
 *                  사용자별 맞춤 결과 → 개인정보 + 색인 가치 없음.
 *   /compare/[category]/{postal,household,current-provider,bill,preview}
 *                — 입력 단계 폼 (noindex, PLAN 3.5.2.c).
 *                  sessionStorage 상태 의존 + 단독 URL 접근 시 의미 없는 콘텐츠.
 *   /api/* — Next.js API route (HTML 아님, 색인 대상 아님).
 *   /sitemap.xml, /robots.txt — 자기 참조 금지.
 *
 * 카테고리 슬러그 선택 근거:
 *   TARIFF_CATEGORIES = ['mobile','internet_fixed','bundle_internet_tv'] (3값, ADR-0005 §Amendment 1)
 *   현재 실제 fetcher + 비교 결과가 존재하는 카테고리: mobile, internet_fixed (2개).
 *   bundle_internet_tv 는 아직 fetcher 미구현 → 색인해도 빈 결과.
 *   → sitemap 에는 mobile + internet_fixed 만 포함. 카테고리 추가 시 아래 배열도 갱신.
 *
 * ADR 근거: ADR-0020 §결정 7, ADR-0021 §T8, PLAN 3.5.2.d.
 */

import type { MetadataRoute } from 'next';

import { SITE_ORIGIN } from '@/lib/site';

/**
 * 현재 sitemap 에 포함할 알려진 카테고리 슬러그.
 *
 * TARIFF_CATEGORIES 전체가 아니라 실제 fetcher 가 구현된 카테고리만.
 * 카테고리 추가 시 이 배열도 함께 갱신할 것 (단일 진실 원천은 TARIFF_CATEGORIES,
 * 그러나 색인 가치는 fetcher 구현 여부에 종속 → 명시 배열 유지).
 */
const INDEXABLE_CATEGORIES = ['mobile', 'internet_fixed'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  // 빌드 시각 — 정적 라우트는 빌드마다 갱신 (동적 콘텐츠 아님).
  // new Date() 는 빌드 시점에 1회 평가 → 정적 sitemap 으로 출력.
  const now = new Date();

  // 카테고리별 비교 진입 URL (/compare/mobile, /compare/internet_fixed)
  const categoryEntries: MetadataRoute.Sitemap = INDEXABLE_CATEGORIES.map((slug) => ({
    url: `${SITE_ORIGIN}/compare/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    // ─── 홈 ────────────────────────────────────────────────────────────────────
    {
      url: `${SITE_ORIGIN}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // ─── 카테고리 선택 ────────────────────────────────────────────────────────
    {
      url: `${SITE_ORIGIN}/compare`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // ─── 알려진 카테고리 비교 진입 ─────────────────────────────────────────────
    ...categoryEntries,
    // ─── 투명성 / 법적 고지 ────────────────────────────────────────────────────
    {
      url: `${SITE_ORIGIN}/data-sources`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_ORIGIN}/legal/affiliate-disclosure`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
