/**
 * compare-view — 비교 표(PLAN 3.2)의 정렬/필터 URL params 파싱 + 적용.
 *
 * ADR-0021 §T4 SC-F (URL params 정렬/필터, RSC 재렌더, dep 0):
 *   - 정렬: saving_desc(기본) / price_asc / commitment_none_first
 *   - 필터: commitment=none / data=unlimited (라운드 b 1차 — promo=exclude 는
 *     display-only 토글이라 별도 라운드)
 *
 * 순수 (db-free) — vitest 단위 테스트 가능. page.tsx (RSC) 가 searchParams 를
 * 받아 parseSearchParams → applyView 순서 호출. 빌더 함수 (buildSortHref /
 * buildFilterToggleHref) 는 URL 정합 직렬화.
 */

import type { ResultRowData } from '@/db/queries/comparison';

// ─── 키 카탈로그 ───────────────────────────────────────────────────────────

export const SORT_KEYS = [
  'saving_desc',
  'price_asc',
  'commitment_none_first',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const FILTER_KEYS = ['commitment_none', 'data_unlimited'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export const DEFAULT_SORT: SortKey = 'saving_desc';
export const DEFAULT_LIMIT = 5;

export interface ViewState {
  readonly sort: SortKey;
  readonly filters: ReadonlySet<FilterKey>;
}

// ─── searchParams → ViewState ──────────────────────────────────────────────

/**
 * Next.js RSC searchParams (string | string[] | undefined) → 검증된 ViewState.
 *
 * - 알 수 없는 sort 값 → DEFAULT_SORT (조용히 fallback).
 * - 알 수 없는 filter 값 → 무시.
 */
export function parseSearchParams(
  sp: Readonly<Record<string, string | string[] | undefined>>,
): ViewState {
  const sortRaw = pickFirst(sp['sort']);
  const sort: SortKey =
    sortRaw && (SORT_KEYS as readonly string[]).includes(sortRaw)
      ? (sortRaw as SortKey)
      : DEFAULT_SORT;

  const filters = new Set<FilterKey>();
  if (pickFirst(sp['commitment']) === 'none') filters.add('commitment_none');
  if (pickFirst(sp['data']) === 'unlimited') filters.add('data_unlimited');

  return { sort, filters };
}

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

// ─── ViewState → URL ───────────────────────────────────────────────────────

function serialize(state: ViewState): string {
  const sp = new URLSearchParams();
  if (state.sort !== DEFAULT_SORT) sp.set('sort', state.sort);
  if (state.filters.has('commitment_none')) sp.set('commitment', 'none');
  if (state.filters.has('data_unlimited')) sp.set('data', 'unlimited');
  return sp.toString();
}

function withQuery(base: string, query: string): string {
  return query ? `${base}?${query}` : base;
}

/** 정렬 변경 href. 필터는 보존. */
export function buildSortHref(
  base: string,
  current: ViewState,
  sort: SortKey,
): string {
  return withQuery(base, serialize({ sort, filters: current.filters }));
}

/** 필터 토글 (on/off) href. 정렬은 보존. */
export function buildFilterToggleHref(
  base: string,
  current: ViewState,
  filter: FilterKey,
): string {
  const next = new Set(current.filters);
  if (next.has(filter)) next.delete(filter);
  else next.add(filter);
  return withQuery(base, serialize({ sort: current.sort, filters: next }));
}

// ─── 정렬/필터 적용 ─────────────────────────────────────────────────────────

/**
 * rows (이미 rank ASC) → 필터 → 정렬 → top N.
 *
 * 정렬 tie-break = tariffSlug ASC (결정적 — 동일 입력 동일 결과, ADR-0010 정합).
 *
 * commitment_none_first: 약정없음을 위로 + 그 안에서 saving_desc.
 */
export function applyView(
  rows: readonly ResultRowData[],
  view: ViewState,
  limit: number = DEFAULT_LIMIT,
): ResultRowData[] {
  let result: ResultRowData[] = [...rows];

  if (view.filters.has('commitment_none')) {
    result = result.filter((r) => r.commitmentMonths === 0);
  }
  if (view.filters.has('data_unlimited')) {
    result = result.filter((r) => r.attributes['data_gb'] === 'unlimited');
  }

  const tieBreak = (a: ResultRowData, b: ResultRowData): number =>
    a.tariffSlug.localeCompare(b.tariffSlug);

  switch (view.sort) {
    case 'saving_desc':
      result.sort(
        (a, b) =>
          b.monthlySavingCents - a.monthlySavingCents || tieBreak(a, b),
      );
      break;
    case 'price_asc':
      result.sort(
        (a, b) => a.monthlyAvg12Cents - b.monthlyAvg12Cents || tieBreak(a, b),
      );
      break;
    case 'commitment_none_first': {
      result.sort((a, b) => {
        const aNone = a.commitmentMonths === 0 ? 0 : 1;
        const bNone = b.commitmentMonths === 0 ? 0 : 1;
        if (aNone !== bNone) return aNone - bNone;
        return (
          b.monthlySavingCents - a.monthlySavingCents || tieBreak(a, b)
        );
      });
      break;
    }
  }
  return result.slice(0, limit);
}
