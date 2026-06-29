/**
 * /guides/[slug] — MDX 가이드 상세 페이지 (RSC, ADR-0051 §D1/§D3).
 *
 * 왜 이 라우트가 필요한가?
 *   ADR-0051 §D1: 콘텐츠 마케팅 = informational intent 가이드 → Google 권위 신호 확보.
 *   ADR-0034 §D5 organic SEO 런치 보강 — 비교 도구 단독 → 비교 도구 + 가이드 하이브리드.
 *
 * RSC 전용 (dynamic = 'force-static') → LCP ≤ 2.5s (ADR-0023 §T4 정합).
 * MDX 파일은 src/content/guides/*.mdx — 운영자 직접 작성 트랙 (ADR-0051 §D3).
 *
 * generateStaticParams: src/content/guides/ 디렉토리 정찰 → 모든 slug 자동 추출.
 * generateMetadata: frontmatter → title/description/hreflang (ADR-0033 Amd 6 3 locale).
 * noindex X → 색인 트리거 (P1 정합).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/lib/alternates';
import { getGuideEntries, getGuideFrontmatter } from '@/lib/guides';

// ADR-0051 §D1 hotfix (2026-06-29): 'force-static' 제거 — Next.js 15 + Turbopack
// 정적 import map 조합에서도 prod 404 회귀가 잡혀, fallback ISR (revalidate 기본
// 1년) 로 전환. 가이드 페이지는 정적 텍스트 + small bundle = LCP 영향 미미
// (ADR-0023 §T4 ≤ 2.5s 잠금 유지). dynamicParams=true 기본값 유지 → 첫 요청 시
// 정적 생성 + edge cache.

/**
 * 정적 import map — Next.js 15 + Turbopack이 빌드 시 모든 MDX 모듈을 명시적으로 등록.
 *
 * 왜 정적 map인가 (template literal dynamic import 대신)?
 *   `await import(\`@/content/guides/${slug}.mdx\`)` 패턴은 Next.js 15 + Turbopack +
 *   `force-static` + `pageExtensions: ['mdx']` 조합에서 슬러그별 모듈을 컴파일 단계에
 *   등록하지 못해 prod에서 모든 슬러그 페이지가 404 반환 (2026-06-29 prod 회귀 봉합).
 *   정적 import = 빌드 시 명시적 dep graph에 포함 → 정적 페이지 생성 보장.
 *
 * 운영자 트랙 (ADR-0051 §D3 정합):
 *   새 가이드 추가 시 (1) `src/content/guides/{slug}.mdx` 작성 + (2) 본 map 갱신.
 *   완전 자동 추출은 별 PR 트랙 (빌드 시 코드 생성 인프라 — 본 hotfix 범위 밖).
 */
const GUIDE_MODULES: Record<
  string,
  () => Promise<{ default: React.ComponentType<Record<string, never>> }>
> = {
  'proximus-vs-telenet-vs-orange-be': () =>
    import('@/content/guides/proximus-vs-telenet-vs-orange-be.mdx'),
};

interface GuidePageProps {
  params: Promise<{ locale: string; slug: string }>;
}

/**
 * generateStaticParams — src/content/guides/ 디렉토리 내 모든 slug 자동 추출.
 *
 * 왜 자동 추출인가?
 *   운영자가 새 .mdx 파일을 추가하면 코드 변경 없이 자동으로 정적 페이지 생성.
 *   locale × slug 매트릭스 전체 생성 (3 locale × N guides).
 */
export async function generateStaticParams(): Promise<
  Array<{ locale: string; slug: string }>
> {
  const { routing } = await import('@/i18n/routing');
  const entries = await getGuideEntries();

  return routing.locales.flatMap((locale) =>
    entries.map((entry) => ({ locale, slug: entry.slug })),
  );
}

/**
 * generateMetadata — frontmatter 자동 추출 → title/description/hreflang.
 *
 * ADR-0033 Amd 6: 3 locale (nl/fr/en) hreflang 정합.
 * noindex 없음 — 색인 트리거 (P1 SEO 목적).
 */
export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const frontmatter = await getGuideFrontmatter(slug);
  if (!frontmatter) {
    return { robots: { index: false, follow: false } };
  }

  const alts = buildAlternates(locale, `/guides/${slug}`);

  return {
    title: frontmatter.title,
    description: frontmatter.description,
    alternates: alts,
    // noindex 없음 — 색인 트리거 (ADR-0051 §D1)
  };
}

/**
 * 가이드 페이지 컴포넌트 — MDX 본문 RSC 렌더.
 *
 * MDX 파일을 dynamic import 로 로드한다.
 * 왜 dynamic import 인가?
 *   slug 는 빌드 시 알 수 없는 값 → 런타임에 결정 (generateStaticParams 가 빌드 시 고정).
 *   @next/mdx 가 .mdx 파일을 RSC 컴포넌트로 변환하므로 <GuideContent /> 처럼 사용 가능.
 */
export default async function GuidePage({ params }: GuidePageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const frontmatter = await getGuideFrontmatter(slug);
  if (!frontmatter) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'guides' });

  // MDX 모듈 정적 map 조회 — 빌드 시 명시적 dep graph 등록 (Turbopack 정적 빌드 정합)
  const loader = GUIDE_MODULES[slug];
  if (!loader) {
    notFound();
  }
  let GuideContent: React.ComponentType<Record<string, never>>;
  try {
    const mod = await loader();
    GuideContent = mod.default;
  } catch {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      {/* 가이드 메타 헤더 */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight text-fg mb-3">
          {frontmatter.title}
        </h1>
        <p className="text-fg/70 text-base mb-4">{frontmatter.description}</p>
        <div className="flex gap-4 text-sm text-fg/50">
          {frontmatter.publishedAt && (
            <span>
              {t('publishedAt', { date: frontmatter.publishedAt })}
            </span>
          )}
          {frontmatter.author && (
            <span>{t('author', { name: frontmatter.author })}</span>
          )}
        </div>
      </header>

      {/* MDX 본문 — 운영자 작성 트랙 (ADR-0051 §D3) */}
      <article className="prose prose-neutral max-w-none">
        <GuideContent />
      </article>
    </main>
  );
}
