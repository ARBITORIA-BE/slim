'use client';

/**
 * CompareLayout — 5단계 입력 공통 레이아웃 (ADR-0016 §T8 진행 표시 + 백 버튼).
 *
 * - 모바일 우선 (375px) → md: 768 → lg: 1024 (T9)
 * - sticky top 진행 표시 + 단계 라벨 + 백 버튼
 * - 한국어 단일 (T10 SC-E)
 */

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { compareSteps, type CompareStep } from './useCompareSession';

const STEP_LABELS: Record<CompareStep, string> = {
  postal: '우편번호',
  household: '가구 형태',
  'current-provider': '현재 공급사',
  bill: '청구서',
  preview: '결과 미리보기',
};

interface CompareLayoutProps {
  step: CompareStep;
  children: ReactNode;
}

export function CompareLayout({ step, children }: CompareLayoutProps) {
  const router = useRouter();
  const stepIndex = compareSteps.indexOf(step);
  const total = compareSteps.length;
  const progressValue = ((stepIndex + 1) / total) * 100;

  // 백 버튼 = history-based router.back(). 새로고침으로 history 손실 시
  // 사용자는 헤더 "취소" 링크 (/) 또는 /compare 직접 진입으로 회피.
  // 페이즈 2 1차 단순화 — 명시 backHref는 typed routes 호환성 부담으로 보류.
  const handleBack = () => router.back();

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
            aria-label="이전 단계로"
          >
            <ChevronLeft className="mr-1 inline h-4 w-4" />
            이전
          </Button>
          <span
            className="text-sm font-medium text-fg-soft tabular-nums"
            aria-live="polite"
          >
            <span className="md:hidden">
              {stepIndex + 1}/{total}
            </span>
            <span className="hidden md:inline">
              {stepIndex + 1}/{total} · {STEP_LABELS[step]}
            </span>
          </span>
          <Link
            href="/"
            className="text-sm text-muted underline-offset-4 hover:underline"
          >
            취소
          </Link>
        </div>
        <Progress value={progressValue} className="mt-3" aria-label={`${stepIndex + 1}/${total} 단계 완료`} />
      </header>

      <main className="flex flex-col gap-6">{children}</main>
    </div>
  );
}
