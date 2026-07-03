/**
 * /guides — 가이드 인덱스 페이지 (RSC, ADR-0051 §D1/§D3 + §Amendment 1).
 *
 * 왜 이 페이지가 필요한가?
 *   Google 색인 진입 — /guides/{slug} 개별 페이지로의 내부 링크 허브.
 *   ADR-0051 §D1: 가이드 목록 = sitemap 통합 + 색인 가속.
 *
 * ADR-0051 §Amendment 1 (2026-07-08): MDX + fs.readdir 기반 getGuideEntries
 * 폐기 → GUIDE_INDEX 정적 배열 소비 (src/lib/guides-index.ts 단일 출처,
 * sitemap.ts 와 공동 소비). Vercel prod 404 회귀(PR #70/#72/#73) 재발 방지 —
 * 런타임 fs 접근 0.
 *
 * 다크패턴 회피 잠금 (ADR-0050 §D6 동형):
 *   1위 임의 하이라이트 0 / "추천" 라벨 0 / 색상 다중화 0.
 *   가이드 0건 시 정직 표시 (ADR-0011 §T2 동형).
 *
 * RSC, 정적 생성.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/lib/alternates';
import { GUIDE_INDEX } from '@/lib/guides-index';
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

  const entries = GUIDE_INDEX;

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
                    {entry.title}
                  </Link>
                </h2>
                {entry.description && (
                  <p className="text-fg/70 text-sm mb-3">
                    {entry.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  {entry.publishedAt && (
                    <span className="text-xs text-fg/40">
                      {t('publishedAt', { date: entry.publishedAt })}
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
