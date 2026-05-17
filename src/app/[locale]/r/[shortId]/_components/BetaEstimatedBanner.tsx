/**
 * BetaEstimatedBanner — 베타 추정값 경고 배너 (PLAN 1.5.6.1, ADR-0013 Amendment 1).
 *
 * 위치: <ResultConclusionCard /> 바로 위 (page.tsx).
 * 트리거: view.items 중 1건 이상 isStub === true (현 단계 = 전체 row stub).
 *
 * 결정 사항:
 *   - role="status" — 정보성, 긴급 X (Amendment 1 결정).
 *   - AlertTriangle aria-hidden="true" — 텍스트가 의미 전달.
 *   - bg-warning/10 + border-warning/30 스타일:
 *       AffiliateDisclosureLine (4.3.c) 의 border-t/text-xs/text-fg-soft 와는 달리
 *       이 배너는 *시각적 구분이 필요한 warning* 상태 — 눈에 띄지만 빨간/긴급
 *       다크패턴 색상(CSS custom property --color-warning 미정의 시 amber 계열)
 *       사용. text-sm leading-relaxed 는 4.1.d 인터스티셜 톤과 일관.
 *
 * RSC (서버 컴포넌트) — 'use client' 불필요.
 * 헌법 §8 #1 자가: headers().get / cookies() 0건.
 */

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export function BetaEstimatedBanner() {
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
          ⚠️ 베타 단계: 추정값
        </h2>
        <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-300">
          가격은 운영자가 2026-05-09에 수동 검증한 추정값입니다. 실시간 가격은
          페이즈 5 이후 격상 예정.
        </p>
        <Link
          href="/data-sources"
          className="text-sm text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
        >
          자세히: /data-sources
        </Link>
      </div>
    </div>
  );
}
