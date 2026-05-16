/**
 * /compare/[category] — 카테고리 진입 직후 단계 1(postal)로 redirect (ADR-0016 §T1).
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { TARIFF_CATEGORIES, type TariffCategoryInput } from '@/types/comparison-input';

/**
 * 왜 generateMetadata 인가?
 *   카테고리명을 title 에 포함해야 하는데 params 가 동적이다.
 *   알려진 카테고리(TARIFF_CATEGORIES 에 있는 것)만 색인 대상 — canonical 부여.
 *   미지원 카테고리는 robots noindex (404 redirect 전에 메타가 먼저 평가되는 경우 대비).
 */
// ADR-0005 §Amendment 1 (2026-05-16): landline 제거 → 3값
const CATEGORY_LABELS: Record<TariffCategoryInput, string> = {
  mobile: '모바일 요금제',
  internet_fixed: '고정 인터넷 요금제',
  bundle_internet_tv: '인터넷+TV 번들 요금제',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;

  if (!(TARIFF_CATEGORIES as readonly string[]).includes(category)) {
    // 알 수 없는 카테고리 — redirect 전 메타 평가 시 noindex 보장
    return {
      robots: { index: false, follow: false },
    };
  }

  const cat = category as TariffCategoryInput;
  const label = CATEGORY_LABELS[cat];

  return {
    title: label,
    description: `${label} 비교 — 벨기에 통신사를 5분 안에 비교해 최적 요금제를 찾으세요.`,
    alternates: {
      canonical: `/compare/${cat}`,
    },
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
  redirect(`/compare/${category as TariffCategoryInput}/postal`);
}
