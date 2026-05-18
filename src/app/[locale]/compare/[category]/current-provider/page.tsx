/**
 * /compare/[category]/current-provider — 단계 3 현재 공급사 (ADR-0016 §T5 + Sub-task 6).
 *
 * RSC — DB prefetch + client 컴포넌트로 props 전달. ISR 1h (provider 마스터 변경
 * 빈도 낮음).
 *
 * 흐름:
 *   1. category 검증 (invalid → /compare redirect)
 *   2. getActiveProviders('BE') — 페이즈 3 1차 BE 단일 (NL/LU 페이즈 5 추가).
 *   3. providers 0건 → 안내 + 스킵 단일 CTA (0건 fallback)
 *   4. providers ≥ 1 → getActiveTariffsByProviders + CurrentProviderForm props 전달
 *
 * i18n: getTranslations (RSC) — 'compare.currentProvider' 네임스페이스.
 *
 * 페이즈 5 NL/LU 진입 시점에 country 동적 — sessionStorage `postalCountry` 또는
 * URL search param 으로. 본 라운드는 BE 단일.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import {
  getActiveProviders,
  getActiveTariffsByProviders,
} from '@/db/queries/providers';
import {
  TARIFF_CATEGORIES,
  type TariffCategoryInput,
} from '@/types/comparison-input';

import { CompareLayout } from '../_components/CompareLayout';
import { CurrentProviderForm } from './_components/CurrentProviderForm';

/**
 * 왜 noindex 인가?
 *   현재 공급사 선택 단계는 sessionStorage 상태에 의존하며, 단독 URL 접근 시
 *   의미 있는 콘텐츠가 없다 (공급사 목록만 있고 비교 결과는 없음).
 * @i18n-allow metadata 한글은 4.5.j.4.B 대상
 */
// @i18n-allow metadata 한글은 4.5.j.4.B 대상
export const metadata: Metadata = {
  title: '현재 공급사 선택', // @i18n-allow
  robots: { index: false, follow: false },
};

export const revalidate = 3600; // 1시간 ISR — provider 마스터 변경 빈도 낮음

export default async function CurrentProviderPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: rawCategory } = await params;

  if (!(TARIFF_CATEGORIES as readonly string[]).includes(rawCategory)) {
    redirect('/compare');
  }
  const category = rawCategory as TariffCategoryInput;

  // why: RSC 이므로 getTranslations 사용 (await 필요).
  const t = await getTranslations('compare.currentProvider');

  // 페이즈 3 1차: BE 단일. NL/LU 는 페이즈 5 fetcher 추가 시 country 동적 분기.
  const providers = await getActiveProviders('BE');
  const providerIds = providers.map((p) => p.id);
  const tariffs = await getActiveTariffsByProviders(providerIds, category);

  return (
    <CompareLayout step="current-provider">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {t('heading')}
        </h1>
        <p className="text-sm text-fg-soft">
          {t('supportNote')}
        </p>
      </header>

      {providers.length === 0 ? (
        <ZeroProvidersFallback
          category={category}
          fallbackText={t('zeroProvidersFallback')}
          skipText={t('skipAsNew')}
        />
      ) : (
        <CurrentProviderForm
          category={category}
          providers={providers}
          tariffs={tariffs}
        />
      )}
    </CompareLayout>
  );
}

/**
 * provider 0건 fallback — DB 미시드 또는 비교 가능 공급사 부재 (P3 정직 안내).
 *
 * Sub-task 5 (`/api/compare` 풀 + 운영자 seed) 진입 후 정상 상태에선 도달 0.
 */
function ZeroProvidersFallback({
  category,
  fallbackText,
  skipText,
}: {
  category: TariffCategoryInput;
  fallbackText: string;
  skipText: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-fg/10 bg-bg-warm/40 p-4 text-sm text-fg-soft">
        {fallbackText}
      </div>
      <Link
        href={`/compare/${category}/bill`}
        className="inline-flex items-center justify-center self-start rounded-full bg-fg px-6 py-3 text-sm font-medium text-bg transition hover:bg-primary"
      >
        {skipText}
      </Link>
    </div>
  );
}
