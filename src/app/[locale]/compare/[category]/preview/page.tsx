'use client';

/**
 * /compare/[category]/preview — 단계 5 결과 미리보기 (ADR-0016 §T7).
 *
 * 페이즈 2 1차: sessionStorage → /api/compare → shortId 받아 /r/[shortId]
 * redirect. /api/compare 가 stub 응답 (Zod 재검증 + nanoid shortId만) — 풀
 * compare() 호출 + DB insert는 페이즈 3 진입 시 별도 ADR로 추가.
 *
 * i18n: useTranslations (client 컴포넌트) — 'compare.preview' 네임스페이스.
 */

import { use, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';

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
  // why: useTranslations 은 client 컴포넌트에서 동기 호출.
  const t = useTranslations('compare.preview');

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

    // ADR-0043: postal 단계 제거 → postal 없이 비교 요청 (optional 필드, undefined).
    // 기존 sessionStorage 에 postalCountry/postalCode 가 있어도 전달하지 않는다.
    // DB 컬럼 (comparison_request.postal_code nullable) — 서버가 null 처리.
    const candidate = {
      category,
      householdType: state.data.householdType,
      currentProviderId: state.data.currentProviderId ?? null,
      currentTariffId: state.data.currentTariffId ?? null,
      inputAttributes: state.data.inputAttributes ?? {},
    };

    const parsed = comparisonInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setStatus('error');
      setErrorMessage(t('inputIncomplete'));
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
            : t('serverError', { status: response.status });
        setStatus('error');
        setErrorMessage(reason);
        return;
      }
      const { shortId } = (await response.json()) as { shortId: string };
      router.push(`/r/${shortId}`);
    } catch {
      setStatus('error');
      setErrorMessage(t('networkError'));
    }
  }, [category, state, router, t]);

  // 마운트 + sessionStorage 복원 후 자동 제출 (T7 미리보기 = preview 진입 = 비교 호출)
  useEffect(() => {
    if (!hydrated) return;
    if (status === 'idle') void submit();
  }, [hydrated, status, submit]);

  return (
    <CompareLayout step="preview">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {t('heading')}
        </h1>
        <p className="text-sm text-fg">
          {t('supportNote')}
        </p>
      </header>

      {status === 'submitting' && (
        <div className="rounded-2xl border border-fg/10 bg-bg-warm p-6 text-sm text-fg">
          <p>{t('submittingMessage')}</p>
        </div>
      )}

      {status === 'error' && errorMessage !== null && (
        <div
          role="alert"
          className="rounded-2xl border border-accent/30 bg-accent/5 p-6 text-sm text-fg"
        >
          <p className="font-semibold text-accent-dark">{t('errorTitle')}</p>
          <p className="mt-2">{errorMessage}</p>
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              onClick={() => {
                setStatus('idle');
                setErrorMessage(null);
              }}
            >
              {t('retry')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push(`/compare/${category}/household`)}
            >
              {t('goToStart')}
            </Button>
          </div>
        </div>
      )}
    </CompareLayout>
  );
}
