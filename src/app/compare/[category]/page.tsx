/**
 * /compare/[category] — 카테고리 진입 직후 단계 1(postal)로 redirect (ADR-0016 §T1).
 */

import { redirect } from 'next/navigation';

import { TARIFF_CATEGORIES, type TariffCategoryInput } from '@/types/comparison-input';

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
  redirect(`/compare/${category as TariffCategoryInput}/postal`);
}
