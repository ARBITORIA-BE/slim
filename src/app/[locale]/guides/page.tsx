/**
 * /guides — 가이드 인덱스 페이지 (RSC, ADR-0051 §D1/§D3).
 *
 * 왜 이 페이지가 필요한가?
 *   Google 색인 진입 — /guides/{slug} 개별 페이지로의 내부 링크 허브.
 *   ADR-0051 §D1: 가이드 목록 = sitemap 자동 통합 + 색인 가속.
 *
 * 다크패턴 회피 잠금 (ADR-0050 §D6 동형):
 *   1위 임의 하이라이트 0 / "추천" 라벨 0 / 색상 다중화 0.
 *   가이드 0건 시 정직 표시 (ADR-0011 §T2 동형).
 *
 * RSC, 정적 생성 (가이드 파일 변경 시 재빌드).
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/lib/alternates';
import { getGuideEntries } from '@/lib/guides';
import { Link } from '@/i18n/navigation';

interface GuidesIndexPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: GuidesIndexPageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'guides' });
  const alts = buildAlternates(locale, '/guides');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: alts,
  };
}

export default async function GuidesIndexPage({ params }: GuidesIndexPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'guides' });

  const entries = await getGuideEntries();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      {/* 인덱스 헤딩 */}
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-fg mb-3">
          {t('indexHeading')}
        </h1>
        <p className="text-fg/70 text-base">{t('indexDescription')}</p>
      </header>

      {/* 가이드 목록 */}
      {entries.length === 0 ? (
        // 가이드 0건 — ADR-0011 §T2 / ADR-0029 §T2 정직 표시
        <p className="text-fg/50 text-sm">{t('empty')}</p>
      ) : (
        // ADR-0050 §D6 정합: <ul role="list"> + <li> 카드 (1위 임의 하이라이트 0 / "추천" 라벨 0 / 색상 다중화 0)
        <ul role="list" className="space-y-6">
          {entries.map((entry) => (
            <li
              key={entry.slug}
              className="border border-fg/10 rounded-lg p-5 hover:border-fg/20 transition-colors"
            >
              <article>
                <h2 className="text-xl font-semibold text-fg mb-2">
                  <Link
                    href={`/guides/${entry.slug}`}
                    className="hover:underline"
                  >
                    {entry.frontmatter.title}
                  </Link>
                </h2>
                {entry.frontmatter.description && (
                  <p className="text-fg/70 text-sm mb-3">
                    {entry.frontmatter.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  {entry.frontmatter.publishedAt && (
                    <span className="text-xs text-fg/40">
                      {t('publishedAt', { date: entry.frontmatter.publishedAt })}
                    </span>
                  )}
                  <Link
                    href={`/guides/${entry.slug}`}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    {t('readMore')} →
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
