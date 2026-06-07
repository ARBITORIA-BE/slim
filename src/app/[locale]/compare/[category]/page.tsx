/**
 * /compare/[category] — 카테고리 진입 직후 단계 1(current-provider)로 redirect.
 *
 * ADR-0043 (2026-06-08): postal 단계 제거 → current-provider 직진.
 * 기존: postal → household → current-provider → preview (4단계)
 * 변경: household → current-provider → preview (3단계, postal UI 없음)
 * 단, 비교 흐름은 household 먼저이므로 진입점 = household.
 *
 * generateMetadata: CATEGORY_LABELS 한글 제거 → getTranslations('compare.categories') 재사용.
 * ADR-0033 §A2.9.1 — params 에서 locale 추출 후 명시 전달.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { TARIFF_CATEGORIES, type TariffCategoryInput } from '@/types/comparison-input';
import { buildAlternates } from '@/lib/alternates';

/**
 * 왜 generateMetadata 인가?
 *   카테고리명을 title 에 포함해야 하는데 params 가 동적이다.
 *   알려진 카테고리(TARIFF_CATEGORIES 에 있는 것)만 색인 대상 — canonical 부여.
 *   미지원 카테고리는 robots noindex (404 redirect 전에 메타가 먼저 평가되는 경우 대비).
 *
 * §A2.9.2 키 재사용: compare.categories.<cat>.label — 이미 compare/page.tsx 본문에서 사용.
 */
// ADR-0005 §Amendment 1 (2026-05-16): landline 제거 → 3값
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}): Promise<Metadata> {
  const { locale, category } = await params;

  if (!(TARIFF_CATEGORIES as readonly string[]).includes(category)) {
    // 알 수 없는 카테고리 — redirect 전 메타 평가 시 noindex 보장
    return {
      robots: { index: false, follow: false },
    };
  }

  const cat = category as TariffCategoryInput;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'compare' });

  // §A2.9.2 재사용: compare.categories.<cat>.label
  const label = t(`categories.${cat}.label` as Parameters<typeof t>[0]);

  // hreflang: 5 locale × '/compare/<cat>' (PLAN 3.5.4, ADR-0034 D5)
  const alts = buildAlternates(locale, `/compare/${cat}`);

  return {
    title: label,
    description: t('pageDescription'),
    alternates: alts,
  };
}

export default async function CategoryRedirectPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!(TARIFF_CATEGORIES as readonly string[]).includes(category)) {
    // 잘못된 category → 404 (Next.js notFound 또는 redirect to /compare)
    redirect('/compare');
  }
  // ADR-0043: postal 단계 제거 → household 직진 (3단계 진입점).
  redirect(`/compare/${category as TariffCategoryInput}/household`);
}
