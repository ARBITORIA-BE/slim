/**
 * BetaEstimatedBanner — 베타 추정값 경고 배너 (PLAN 1.5.6.1, ADR-0013 Amendment 1).
 *
 * 위치: <ResultConclusionCard /> 바로 위 (page.tsx).
 * 트리거: view.items 중 1건 이상 isStub === true (현 단계 = 전체 row stub).
 *
 * i18n: getTranslations (RSC) — 'result.betaBanner' 네임스페이스.
 *
 * RSC (서버 컴포넌트) — 'use client' 불필요.
 */

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export async function BetaEstimatedBanner() {
  // why: RSC 이므로 getTranslations 사용.
  const t = await getTranslations('result.betaBanner');

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-amber-300/50 bg-amber-50/60 px-4 py-3 dark:border-amber-700/40 dark:bg-amber-900/10"
    >
      <AlertTriangle
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {/* 이모지(⚠️)는 브랜드/경고 UI 관례 — i18n 텍스트 앞에 고정 */}
          ⚠️ {t('heading')}
        </h2>
        <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-300">
          {t('body')}
        </p>
        <Link
          href="/data-sources"
          className="text-sm text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
        >
          {t('link')}
        </Link>
      </div>
    </div>
  );
}
