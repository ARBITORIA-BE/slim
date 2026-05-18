'use client';

/**
 * /compare/[category]/bill — 단계 4 청구서 (ADR-0016 §T6, SC-A 적용).
 *
 * 페이즈 2 1차: OCR 미구현, "청구서 없이 진행" 단일 버튼만. 페이즈 3 결과 페이지
 * 직후 OCR 도입 별도 ADR (ADR-OCR 가칭).
 *
 * i18n: useTranslations (client 컴포넌트) — 'compare.bill' 네임스페이스.
 */

import { use } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';

import { Button } from '@/components/ui/button';
import {
  TARIFF_CATEGORIES,
  type TariffCategoryInput,
} from '@/types/comparison-input';

import { CompareLayout } from '../_components/CompareLayout';
import { useCompareSession } from '../_components/useCompareSession';

export default function BillPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  // why: useTranslations 은 client 컴포넌트에서 동기 호출.
  const t = useTranslations('compare.bill');

  const router = useRouter();
  const { category: rawCategory } = use(params);

  if (!(TARIFF_CATEGORIES as readonly string[]).includes(rawCategory)) {
    router.replace('/compare');
    return null;
  }
  const category = rawCategory as TariffCategoryInput;

  const { setStep } = useCompareSession(category, 'bill');

  const proceed = () => {
    setStep('preview');
    router.push(`/compare/${category}/preview`);
  };

  return (
    <CompareLayout step="bill">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {t('heading')}
        </h1>
        <p className="text-sm text-fg-soft">
          {t('supportNote')}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Button type="button" onClick={proceed}>
          {t('skipButton')}
        </Button>
      </div>
    </CompareLayout>
  );
}
