/**
 * 가이드 정적 인덱스 — 단일 출처 (ADR-0051 §Amendment 1).
 *
 * 왜 이 모듈이 필요한가?
 *   MDX 인프라(@next/mdx + [locale]/[slug] dynamic route + fs.readdir 기반
 *   getGuideEntries)가 Vercel prod 404 회귀로 폐기됐다 (PR #70/#72/#73 실패,
 *   2026-07-08 운영자 잠금 — 옵션 2 TSX 정적 라우트 이전).
 *
 *   각 가이드는 이제 `src/app/[locale]/guides/{slug}/page.tsx` 정적 TSX
 *   라우트 하나씩이다. sitemap.ts + 가이드 인덱스 페이지(page.tsx)가 모두
 *   이 배열을 소비 — 슬러그/메타 중복 방지 (단일 출처).
 *
 * 운영자 트랙: 새 가이드 추가 시 (1) `src/app/[locale]/guides/{slug}/page.tsx`
 * 작성 + (2) 본 배열에 GuideIndexEntry 1건 추가. 두 곳 모두 갱신 필요
 * (자동 추출 없음 — fs.readdir 기반 자동 추출은 이번 hotfix로 폐기).
 */

/** 가이드 인덱스 entry — sitemap + 인덱스 페이지 공동 소비. */
export interface GuideIndexEntry {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // ISO 8601 date (YYYY-MM-DD)
  author: string;
}

/**
 * 색인 대상 모든 가이드.
 *
 * 왜 정적 배열인가 (fs.readdir 자동 추출 대신)?
 *   Vercel serverless bundle 에 fs 접근 콘텐츠 디렉토리가 자동 포함되지
 *   않는 문제(PR #70/#72/#73 근본 원인) 자체를 제거 — 런타임 fs 접근 0.
 *   TSX 정적 라우트 = Next.js 검증된 패턴 (ADR-0051 §Amendment 1 §A1.D).
 */
export const GUIDE_INDEX: readonly GuideIndexEntry[] = [
  {
    slug: 'proximus-vs-telenet-vs-orange-be',
    title: 'Proximus vs Telenet vs Orange Belgium: Which Telecom Is Best in 2026?',
    description:
      "An honest, data-driven comparison of Belgium's three main telecom providers — Proximus, Telenet, and Orange Belgium — for mobile and home internet in 2026.",
    publishedAt: '2026-06-24',
    author: 'Pieter (Kim Wonmin)',
  },
] as const;

/** GUIDE_INDEX 에서 slug 만 추출한 배열 — sitemap 반복문 소비. */
export const GUIDE_SLUGS: readonly string[] = GUIDE_INDEX.map((g) => g.slug);
