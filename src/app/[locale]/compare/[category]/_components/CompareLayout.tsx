'use client';

/**
 * CompareLayout — 5단계 입력 공통 레이아웃 (ADR-0016 §T8 진행 표시 + 백 버튼).
 *
 * - 모바일 우선 (375px) → md: 768 → lg: 1024 (T9)
 * - sticky top 진행 표시 + 단계 라벨 + 백 버튼
 *
 * i18n: useTranslations (client 컴포넌트) — 'compare.layout' 네임스페이스.
 * why: 'use client' 이므로 useTranslations 사용. await 없이 동기 호출.
 */

import { ChevronLeft } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { Link, useRouter } from '@/i18n/navigation';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { compareSteps, type CompareStep } from './useCompareSession';

interface CompareLayoutProps {
  step: CompareStep;
  children: ReactNode;
}

export function CompareLayout({ step, children }: CompareLayoutProps) {
  // why: useTranslations 은 client 컴포넌트에서 동기적으로 호출.
  // 'compare.layout' 네임스페이스의 steps.* / previous / cancel 키 사용.
  const t = useTranslations('compare.layout');

  const router = useRouter();
  const stepIndex = compareSteps.indexOf(step);
  const total = compareSteps.length;
  const progressValue = ((stepIndex + 1) / total) * 100;

  // 백 버튼 = history-based router.back(). 새로고침으로 history 손실 시
  // 사용자는 헤더 "취소" 링크 (/) 또는 /compare 직접 진입으로 회피.
  const handleBack = () => router.back();

  const stepLabel = t(`steps.${step}` as Parameters<typeof t>[0]);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-6 md:px-6 md:py-10">
      {/* sticky 진행 표시 */}
      <header className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            className="!px-3 !py-2 text-sm"
            aria-label={t('previousAriaLabel')}
          >
            <ChevronLeft className="mr-1 inline h-4 w-4" />
            {t('previous')}
          </Button>
          <span
            className="text-sm font-medium text-fg-soft tabular-nums"
            aria-live="polite"
          >
            <span className="md:hidden">
              {stepIndex + 1}/{total}
            </span>
            <span className="hidden md:inline">
              {stepIndex + 1}/{total} · {stepLabel}
            </span>
          </span>
          <Link
            href="/"
            className="text-sm text-muted underline-offset-4 hover:underline"
          >
            {t('cancel')}
          </Link>
        </div>
        <Progress
          value={progressValue}
          className="mt-3"
          // why: t() ICU 인자 — {current}/{total} 을 각 언어 번역에 주입.
          aria-label={t('stepProgressAriaLabel', { current: stepIndex + 1, total })}
        />
      </header>

      <main className="flex flex-col gap-6">{children}</main>
    </div>
  );
}
