/**
 * /guides/proximus-vs-telenet-vs-orange-be — TSX 정적 가이드 페이지
 * (ADR-0051 §Amendment 1 정합).
 *
 * 왜 TSX 정적 라우트인가?
 *   MDX + [slug] dynamic route 조합이 Vercel prod 404 회귀 (PR #70/#72/#73
 *   2회 hotfix 실패) → 옵션 2 (TSX 정적 라우트) 이전.
 *   Next.js 정적 라우트 = 검증된 패턴 + LCP 이상적 + 런타임 fs 접근 0.
 *
 * 본문 = 운영자 직접 작성 트랙 (2-4시간, head term 콘텐츠).
 * 현재 = 스켈레톤 (섹션 헤딩 + placeholder). ADR-0029 §T2 정직성 정합.
 *
 * 다크패턴 회피 잠금 (ADR-0050 §D6 동형): 1위 임의 하이라이트 0 /
 * "추천" 라벨 0 / 색상 다중화 0 — 본 페이지는 단일 가이드 본문, 해당 없음.
 */

import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';

import { buildAlternates } from '@/lib/alternates';
import { Link } from '@/i18n/navigation';
import { GUIDE_INDEX } from '@/lib/guides-index';

interface PageProps {
  params: Promise<{ locale: string }>;
}

const SLUG = 'proximus-vs-telenet-vs-orange-be';

/**
 * GUIDE_INDEX 단일 출처에서 본 가이드 메타 조회 (sitemap.ts 와 중복 방지).
 *
 * 왜 즉시실행함수인가?
 *   `noUncheckedIndexedAccess` 하에서 `Array.find` 결과는 `T | undefined`.
 *   모듈 스코프 `if (!x) throw` 의 narrowing 은 함수 스코프를 넘어 전파되지
 *   않으므로, 즉시실행함수로 감싸 반환 타입을 non-null `GuideIndexEntry` 로
 *   확정한다 (빌드 타임 자가검증 — GUIDE_INDEX 누락 시 즉시 실패, 조용한
 *   404 방지).
 */
const GUIDE_META = (() => {
  const entry = GUIDE_INDEX.find((g) => g.slug === SLUG);
  if (!entry) {
    // Build-time self-check only (never user-facing) — kept in English so
    // harness:i18n's Korean-literal scan (src/app/[locale]/**) stays clean.
    throw new Error(
      `[guides/${SLUG}] missing entry in GUIDE_INDEX — check src/lib/guides-index.ts.`,
    );
  }
  return entry;
})();

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const alts = buildAlternates(locale, `/guides/${SLUG}`);
  return {
    title: GUIDE_META.title,
    description: GUIDE_META.description,
    alternates: alts,
  };
}

export default async function ProximusVsTelenetVsOrangeBePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'guides' });

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="mb-3 text-3xl font-bold leading-tight text-fg">
          {GUIDE_META.title}
        </h1>
        <p className="mb-4 text-base text-fg/70">{GUIDE_META.description}</p>
        <div className="flex gap-4 text-sm text-fg/50">
          <span>{t('publishedAt', { date: GUIDE_META.publishedAt })}</span>
          <span>{t('author', { name: GUIDE_META.author })}</span>
        </div>
      </header>

      <article className="prose prose-neutral max-w-none">
        {/* 스켈레톤 — 운영자 본문 작성 트랙 (ADR-0051 §Amendment 1 §D3 정직성) */}
        <p className="italic text-fg/60">{t('contentComingSoon')}</p>

        <h2>1. Price Comparison</h2>
        <p>[Placeholder — Proximus / Telenet / Orange BE mobile & internet pricing table]</p>

        <h2>2. Contract Terms</h2>
        <p>[Placeholder — 12/24-month contracts, no-contract options]</p>

        <h2>3. Data Freshness & Reliability</h2>
        <p>[Placeholder — Slim.lu data source, fetched_at metrics]</p>

        <h2>4. Conclusion</h2>
        <p>[Placeholder — recommendation matrix by household type]</p>

        <p>
          <Link href="/compare/mobile" className="text-primary hover:underline">
            slim.lu/compare/mobile →
          </Link>
        </p>
      </article>
    </main>
  );
}
