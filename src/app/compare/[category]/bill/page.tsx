'use client';

/**
 * /compare/[category]/bill — 단계 4 청구서 (ADR-0016 §T6, SC-A 적용).
 *
 * 페이즈 2 1차: OCR 미구현, "청구서 없이 진행" 단일 버튼만. 페이즈 3 결과 페이지
 * 직후 OCR 도입 별도 ADR (ADR-OCR 가칭).
 */

import { useRouter } from 'next/navigation';
import { use } from 'react';

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
          청구서를 업로드해 정확한 사용량을 자동 입력하시겠어요?
        </h1>
        <p className="text-sm text-fg-soft">
          현재 베타 진행 중 — 청구서 OCR은 페이즈 3 결과 페이지 직후 추가됩니다.
          지금은 가구 형태 기반 추정값으로 비교합니다.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Button type="button" onClick={proceed}>
          청구서 없이 진행 — 결과 미리보기로
        </Button>
      </div>
    </CompareLayout>
  );
}
