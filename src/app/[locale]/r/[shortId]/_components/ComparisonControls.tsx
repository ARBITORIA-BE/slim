/**
 * ComparisonControls — 비교 표 정렬/필터 컨트롤 (PLAN 3.2, ADR-0021 §T4 SC-F).
 *
 * 디자인:
 *   - dep 0 — Next Link 만 사용. client state 0 (URL params 가 단일 출처).
 *   - 정렬 3 옵션 = 라디오 의미의 `<a>` (aria-current="page" 활성 표시).
 *   - 필터 2 토글 = 클릭 시 on/off 토글 href (aria-pressed).
 *
 * i18n: getTranslations (RSC) — 'result.controls' 네임스페이스.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { buildFilterToggleHref, type ViewState } from '../_lib/compare-view';

export interface ComparisonControlsProps {
  readonly basePath: string;
  readonly view: ViewState;
}

export async function ComparisonControls({ basePath, view }: ComparisonControlsProps) {
  // why: RSC 이므로 getTranslations 사용.
  const t = await getTranslations('result.controls');

  const filterKeys: ('commitment_none' | 'data_unlimited')[] = ['commitment_none', 'data_unlimited'];

  return (
    <div
      role="group"
      aria-label={t('ariaLabel')}
      // PLAN 3.7.b — 정렬/필터 컨트롤은 인쇄에서 숨김 (클릭 불가 + URL 노이즈).
      className="print:hidden flex flex-col gap-3 rounded-xl border border-fg/10 bg-bg p-3 md:flex-row md:items-center md:justify-between"
    >
      {/*
        PLAN 4.28: 정렬 컨트롤은 SortTabs (ADR-0050 §D3) 로 일원화했다.
        같은 페이지에 정렬 UI 가 두 벌 있었고 어휘도 달랐다 —
        "Cheapest" vs "Sorted by lowest monthly cost", "Most saved" vs "Largest savings".
        같은 개념을 두 이름으로 부르면 사용자는 다른 기능이라고 읽는다.
        본 컴포넌트는 **필터 전용** 으로 남는다 (주석이 이미 그렇게 적혀 있었으나
        실제로는 정렬 그룹도 함께 렌더되고 있었다).
      */}
      <div role="group" aria-label={t('filterLabel')} className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          {t('filterLabel')}
        </span>
        {filterKeys.map((filter) => {
          const pressed = view.filters.has(filter);
          const label = t(`filters.${filter}` as Parameters<typeof t>[0]);
          return (
            <Link
              key={filter}
              href={buildFilterToggleHref(basePath, view, filter)}
              aria-pressed={pressed}
              className={
                pressed
                  ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-bg'
                  : 'rounded-full border border-fg/15 bg-bg px-3 py-1 text-xs font-medium text-fg-soft transition hover:border-fg/30'
              }
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
