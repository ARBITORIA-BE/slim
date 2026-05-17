/**
 * ComparisonControls — 비교 표 정렬/필터 컨트롤 (PLAN 3.2, ADR-0021 §T4 SC-F).
 *
 * 디자인:
 *   - dep 0 — Next Link 만 사용. client state 0 (URL params 가 단일 출처).
 *   - 정렬 3 옵션 = 라디오 의미의 `<a>` (aria-current="page" 활성 표시).
 *   - 필터 2 토글 = 클릭 시 on/off 토글 href (aria-pressed).
 *   - RSC 재렌더 시 자연 정합 — 새 URL 로 page 가 재실행.
 *
 * 학습자 모드 친화: URL 만 보면 정렬/필터 상태 즉시 파악 가능.
 */

import Link from 'next/link';

import {
  buildFilterToggleHref,
  buildSortHref,
  type SortKey,
  type ViewState,
} from '../_lib/compare-view';

const SORT_LABELS: Record<SortKey, string> = {
  saving_desc: '절약액 큰 순',
  price_asc: '월 비용 적은 순',
  commitment_none_first: '약정 없음 우선',
};

export interface ComparisonControlsProps {
  readonly basePath: string;
  readonly view: ViewState;
}

export function ComparisonControls({ basePath, view }: ComparisonControlsProps) {
  return (
    <div
      role="group"
      aria-label="비교 표 정렬 및 필터"
      // PLAN 3.7.b — 정렬/필터 컨트롤은 인쇄에서 숨김 (클릭 불가 + URL 노이즈).
      // globals.css 의 .print-hide 와 Tailwind print:hidden 이중 보호.
      className="print:hidden flex flex-col gap-3 rounded-xl border border-fg/10 bg-bg p-3 md:flex-row md:items-center md:justify-between"
    >
      <div role="group" aria-label="정렬" className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          정렬
        </span>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => {
          const active = view.sort === k;
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
              {SORT_LABELS[k]}
            </Link>
          );
        })}
      </div>
      <div role="group" aria-label="필터" className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          필터
        </span>
        <FilterToggle
          basePath={basePath}
          view={view}
          filter="commitment_none"
          label="약정 없음만"
        />
        <FilterToggle
          basePath={basePath}
          view={view}
          filter="data_unlimited"
          label="데이터 무제한"
        />
      </div>
    </div>
  );
}

function FilterToggle({
  basePath,
  view,
  filter,
  label,
}: {
  readonly basePath: string;
  readonly view: ViewState;
  readonly filter: 'commitment_none' | 'data_unlimited';
  readonly label: string;
}) {
  const pressed = view.filters.has(filter);
  return (
    <Link
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
}
