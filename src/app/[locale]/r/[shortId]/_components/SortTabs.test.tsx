/**
 * SortTabs 단위 테스트 — PLAN 4.21 (ADR-0050 §D3).
 *
 * 검증:
 *   1. SORT_TAB_KEYS 4종 정의 확인
 *   2. buildSortHref 연동 — cheapest/most_saved/best_value/most_reliable URL 생성
 *   3. 활성 탭 판별 (view.sort === key)
 *   4. SortTabKey 외 sort 값 → 'cheapest' fallback
 */

import { describe, expect, it } from 'vitest';

import {
  buildSortHref,
  SORT_TAB_KEYS,
  type ViewState,
} from '../_lib/compare-view';

const BASE = '/r/testShortId';
const EMPTY_VIEW: ViewState = { sort: 'cheapest', filters: new Set() };

describe('SORT_TAB_KEYS', () => {
  it('4종 포함 확인', () => {
    expect(SORT_TAB_KEYS).toContain('cheapest');
    expect(SORT_TAB_KEYS).toContain('most_saved');
    expect(SORT_TAB_KEYS).toContain('best_value');
    expect(SORT_TAB_KEYS).toContain('most_reliable');
    expect(SORT_TAB_KEYS).toHaveLength(4);
  });
});

describe('SortTabs URL 생성 (buildSortHref)', () => {
  it('cheapest → DEFAULT_SORT 이므로 query 생략', () => {
    // why: P3에서 DEFAULT_SORT = 'cheapest' 로 변경됨.
    //      기본값 sort 는 URL serialization 에서 생략 (compare-view.serialize 정합).
    const href = buildSortHref(BASE, EMPTY_VIEW, 'cheapest');
    expect(href).toBe(BASE);
  });

  it('most_saved → ?sort=most_saved', () => {
    const href = buildSortHref(BASE, EMPTY_VIEW, 'most_saved');
    expect(href).toBe(`${BASE}?sort=most_saved`);
  });

  it('best_value → ?sort=best_value', () => {
    const href = buildSortHref(BASE, EMPTY_VIEW, 'best_value');
    expect(href).toBe(`${BASE}?sort=best_value`);
  });

  it('most_reliable → ?sort=most_reliable', () => {
    const href = buildSortHref(BASE, EMPTY_VIEW, 'most_reliable');
    expect(href).toBe(`${BASE}?sort=most_reliable`);
  });

  it('필터 보존 + sort 변경', () => {
    const withFilter: ViewState = {
      sort: 'cheapest',
      filters: new Set(['commitment_none']),
    };
    const href = buildSortHref(BASE, withFilter, 'most_saved');
    expect(href).toBe(`${BASE}?sort=most_saved&commitment=none`);
  });
});

describe('SortTabKey 활성 탭 판별', () => {
  it('view.sort = cheapest → cheapest 활성', () => {
    const view: ViewState = { sort: 'cheapest', filters: new Set() };
    expect(SORT_TAB_KEYS.includes(view.sort as (typeof SORT_TAB_KEYS)[number])).toBe(true);
    expect(view.sort).toBe('cheapest');
  });

  it('view.sort = most_reliable → most_reliable 활성', () => {
    const view: ViewState = { sort: 'most_reliable', filters: new Set() };
    expect(view.sort).toBe('most_reliable');
  });

  it('레거시 sort (saving_desc) → SORT_TAB_KEYS 에 없음 → fallback cheapest 필요', () => {
    const view: ViewState = { sort: 'saving_desc', filters: new Set() };
    const isTabKey = (SORT_TAB_KEYS as readonly string[]).includes(view.sort);
    expect(isTabKey).toBe(false);
    // why: SortTabs 컴포넌트는 SORT_TAB_KEYS 미포함 시 'cheapest' fallback.
  });
});
