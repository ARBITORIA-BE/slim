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

import {
  buildFilterToggleHref,
  buildSortHref,
  type SortKey,
  type ViewState,
} from '../_lib/compare-view';

export interface ComparisonControlsProps {
  readonly basePath: string;
  readonly view: ViewState;
}

export async function ComparisonControls({ basePath, view }: ComparisonControlsProps) {
  // why: RSC 이므로 getTranslations 사용.
  const t = await getTranslations('result.controls');

  // 정렬 키 목록 (SortKey 유형 보존)
  const sortKeys: SortKey[] = ['saving_desc', 'price_asc', 'commitment_none_first'];
  const filterKeys: ('commitment_none' | 'data_unlimited')[] = ['commitment_none', 'data_unlimited'];

  return (
    <div
      role="group"
      aria-label={t('ariaLabel')}
      // PLAN 3.7.b — 정렬/필터 컨트롤은 인쇄에서 숨김 (클릭 불가 + URL 노이즈).
      className="print:hidden flex flex-col gap-3 rounded-xl border border-fg/10 bg-bg p-3 md:flex-row md:items-center md:justify-between"
    >
      <div role="group" aria-label={t('sortLabel')} className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          {t('sortLabel')}
        </span>
        {sortKeys.map((k) => {
          const active = view.sort === k;
          const label = t(`sorts.${k}` as Parameters<typeof t>[0]);
          return (
            <Link
              key={k}
              href={buildSortHref(basePath, view, k)}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'rounded-full bg-fg px-3 py-1 text-xs font-medium text-bg'
                  : 'rounded-full border border-fg/15 bg-bg px-3 py-1 text-xs font-medium text-fg-soft transition hover:border-fg/30'
              }
            >
              {label}
            </Link>
          );
        })}
      </div>
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
