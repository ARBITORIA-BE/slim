'use client';

/**
 * /compare/[category]/preview — 단계 5 결과 미리보기 (ADR-0016 §T7).
 *
 * 페이즈 2 1차: sessionStorage → /api/compare → shortId 받아 /r/[shortId]
 * redirect. /api/compare 가 stub 응답 (Zod 재검증 + nanoid shortId만) — 풀
 * compare() 호출 + DB insert는 페이즈 3 진입 시 별도 ADR로 추가.
 */

import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  TARIFF_CATEGORIES,
  comparisonInputSchema,
  type TariffCategoryInput,
} from '@/types/comparison-input';

import { CompareLayout } from '../_components/CompareLayout';
import { useCompareSession } from '../_components/useCompareSession';

type SubmitStatus = 'idle' | 'submitting' | 'error';

export default function PreviewPage({
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

  const { state, hydrated } = useCompareSession(category, 'preview');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setStatus('submitting');
    setErrorMessage(null);

    // ADR-0021 §T10 — postalCountry sessionStorage 키 신설. 기존 v1 세션
    // 호환을 위해 fallback 'BE' (페이즈 2 1차는 BE 단일).
    const country = state.data.postalCountry ?? 'BE';
    const candidate = {
      category,
      postal: { country, postalCode: state.data.postalCode ?? '' },
      householdType: state.data.householdType,
      currentProviderId: state.data.currentProviderId ?? null,
      currentTariffId: state.data.currentTariffId ?? null,
      inputAttributes: state.data.inputAttributes ?? {},
    };

    const parsed = comparisonInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setStatus('error');
      setErrorMessage(
        '입력이 완전하지 않습니다. 우편번호 또는 가구 형태 단계로 돌아가세요.',
      );
      return;
    }

    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => ({}));
        const reason =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String((payload as { error: unknown }).error)
            : `서버 오류 (${response.status})`;
        setStatus('error');
        setErrorMessage(reason);
        return;
      }
      const { shortId } = (await response.json()) as { shortId: string };
      router.push(`/r/${shortId}`);
    } catch {
      setStatus('error');
      setErrorMessage('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  }, [category, state, router]);

  // 마운트 + sessionStorage 복원 후 자동 제출 (T7 미리보기 = preview 진입 = 비교 호출)
  useEffect(() => {
    if (!hydrated) return;
    if (status === 'idle') void submit();
  }, [hydrated, status, submit]);

  return (
    <CompareLayout step="preview">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          결과를 준비 중입니다
        </h1>
        <p className="text-sm text-fg-soft">
          입력하신 정보를 바탕으로 비교 결과 영구 링크를 생성하고 있습니다. 완료 후
          자동으로 결과 페이지로 이동합니다.
        </p>
      </header>

      {status === 'submitting' && (
        <div className="rounded-2xl border border-fg/10 bg-bg-warm/40 p-6 text-sm text-fg-soft">
          <p>비교 엔진 호출 중… (보통 1초 미만)</p>
        </div>
      )}

      {status === 'error' && errorMessage !== null && (
        <div
          role="alert"
          className="rounded-2xl border border-accent/30 bg-accent/5 p-6 text-sm text-fg"
        >
          <p className="font-semibold text-accent">결과 생성 실패</p>
          <p className="mt-2">{errorMessage}</p>
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              onClick={() => {
                setStatus('idle');
                setErrorMessage(null);
              }}
            >
              다시 시도
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push(`/compare/${category}/postal`)}
            >
              처음으로
            </Button>
          </div>
        </div>
      )}
    </CompareLayout>
  );
}
