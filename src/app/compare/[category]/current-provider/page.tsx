'use client';

/**
 * /compare/[category]/current-provider — 단계 3 현재 공급사 (ADR-0016 §T5).
 *
 * 선택적 + "모르겠어요/스킵" 동등 노출. 페이즈 2 1차에서는 sub-step 요금제 선택은
 * 미구현 (현 공급사 선택만 → currentTariffId null). 페이즈 3 진입 시 sub-step
 * 추가 (T5 본문) — 그때까지는 신규 가입자 케이스(ADR-0010 §T7 케이스 6) 동형
 * 처리.
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

export default function CurrentProviderPage({
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

  const { updateData, setStep } = useCompareSession(category, 'current-provider');

  const proceed = (providerId: string | null) => {
    updateData({ currentProviderId: providerId, currentTariffId: null });
    setStep('bill');
    router.push(`/compare/${category}/bill`);
  };

  return (
    <CompareLayout step="current-provider">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          지금 어디 쓰세요?
        </h1>
        <p className="text-sm text-fg-soft">
          현재 공급사 선택은 비교 정확도를 높이지만 필수는 아닙니다. 모르거나
          신규 가입이라면 스킵해도 됩니다.
        </p>
      </header>

      <div className="rounded-2xl border border-fg/10 bg-bg-warm/40 p-4 text-sm text-fg-soft">
        공급사 목록 + 요금제 sub-step은 페이즈 3 진입 시 추가됩니다. 페이즈 2 1차는
        스킵 동등 동작만 검증합니다.
      </div>

      <div className="flex flex-col gap-3">
        <Button type="button" onClick={() => proceed(null)}>
          모르겠어요 / 스킵 — 신규 가입자 케이스로 진행
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => proceed(null)}
          aria-label="공급사 선택 (페이즈 3 진입 시 활성)"
          disabled
        >
          공급사 선택 (페이즈 3 진입 시 활성)
        </Button>
      </div>
    </CompareLayout>
  );
}
