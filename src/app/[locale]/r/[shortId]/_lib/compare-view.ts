/**
 * compare-view — 비교 표(PLAN 3.2)의 정렬/필터 URL params 파싱 + 적용.
 *
 * ADR-0021 §T4 SC-F (URL params 정렬/필터, RSC 재렌더, dep 0):
 *   - 정렬 (P2 레거시): saving_desc / price_asc / commitment_none_first
 *   - 정렬 (P3 ADR-0050 §D3): cheapest / most_saved / best_value / most_reliable
 *   - 필터: commitment=none / data=unlimited (라운드 b 1차 — promo=exclude 는
 *     display-only 토글이라 별도 라운드)
 *
 * 순수 (db-free) — vitest 단위 테스트 가능. page.tsx (RSC) 가 searchParams 를
 * 받아 parseSearchParams → applyView 순서 호출. 빌더 함수 (buildSortHref /
 * buildFilterToggleHref) 는 URL 정합 직렬화.
 */

import type { ResultRowData } from '@/db/queries/comparison';
import type { Confidence } from '@/db/schema/tariff_snapshot';

// ─── 키 카탈로그 ───────────────────────────────────────────────────────────

export const SORT_KEYS = [
  // P2 레거시 (ComparisonControls 하위 호환)
  'saving_desc',
  'price_asc',
  'commitment_none_first',
  // P3 신규 (ADR-0050 §D3, SortTabs 4종)
  'cheapest',
  'most_saved',
  'best_value',
  'most_reliable',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

// P3 SortTabs 에서 사용하는 4종 (URL param 값)
export const SORT_TAB_KEYS = [
  'cheapest',
  'most_saved',
  'best_value',
  'most_reliable',
] as const;
export type SortTabKey = (typeof SORT_TAB_KEYS)[number];

export const FILTER_KEYS = ['commitment_none', 'data_unlimited'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export const DEFAULT_SORT: SortKey = 'cheapest';
// why: P3에서 기본 정렬을 cheapest (월 요금 낮은 순) 으로 변경.
//      ADR-0050 §D3 정합. 구 URL ?sort=saving_desc 는 레거시로 허용.
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
    sortRaw !== undefined && (SORT_KEYS as readonly string[]).includes(sortRaw)
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

// ─── confidence 순위 매핑 (most_reliable 정렬용) ─────────────────────────

/**
 * ADR-0006 confidence enum 5단 순위 (높을수록 신뢰도 높음).
 * why: Confidence DB enum = high/medium/low 3단. UI 확장 = verified/stub.
 *      현재 DB 저장값 기준: verified > high > medium > low > stub.
 */
const CONFIDENCE_RANK: Record<Confidence | 'verified' | 'stub', number> = {
  verified: 5,
  high: 4,
  medium: 3,
  low: 2,
  stub: 1,
};

function confidenceScore(c: Confidence): number {
  return CONFIDENCE_RANK[c] ?? 0;
}

// ─── 정렬/필터 적용 ─────────────────────────────────────────────────────────

/**
 * rows (이미 rank ASC) → 필터 → 정렬 → top N.
 *
 * 정렬 tie-break = tariffSlug ASC (결정적 — 동일 입력 동일 결과, ADR-0010 정합).
 *
 * P3 신규 정렬 4종 (ADR-0050 §D3):
 *   cheapest       — monthlyPriceCents ASC (요금 낮은 순)
 *   most_saved     — monthlySavingCents DESC (절약액 큰 순)
 *   best_value     — (savings/price) DESC, price=0 시 Infinity → 0 처리
 *   most_reliable  — confidence enum 5단 DESC
 *
 * P2 레거시 3종 (하위 호환):
 *   saving_desc / price_asc / commitment_none_first
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
    // ── P3 신규 4종 ──────────────────────────────────────────────────────
    case 'cheapest':
      // monthlyPriceCents ASC (요금 낮은 순, ADR-0050 §D3)
      result.sort(
        (a, b) => a.monthlyPriceCents - b.monthlyPriceCents || tieBreak(a, b),
      );
      break;
    case 'most_saved':
      // monthlySavingCents DESC (절약액 큰 순)
      result.sort(
        (a, b) =>
          b.monthlySavingCents - a.monthlySavingCents || tieBreak(a, b),
      );
      break;
    case 'best_value': {
      // (savings / price) DESC — 가성비 순.
      // why: price=0 은 이론상 불가 (DB constraint) 이지만 방어적으로 0 처리.
      //      헌법 §8 #2 가격 가공 금지: 공급사 가격을 표시용으로 변경하지 않음.
      //                                 정렬 비교 값만 파생하는 것은 허용.
      const valueScore = (r: ResultRowData): number =>
        r.monthlyPriceCents > 0
          ? r.monthlySavingCents / r.monthlyPriceCents
          : 0;
      result.sort((a, b) => valueScore(b) - valueScore(a) || tieBreak(a, b));
      break;
    }
    case 'most_reliable':
      // confidence enum 5단 DESC (ADR-0006 §T4)
      result.sort(
        (a, b) =>
          confidenceScore(b.confidence) -
          confidenceScore(a.confidence) ||
          tieBreak(a, b),
      );
      break;
    // ── P2 레거시 3종 (하위 호환) ─────────────────────────────────────────
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
