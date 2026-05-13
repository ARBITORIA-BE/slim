/**
 * compare-view 단위 테스트 — 라운드 b (PLAN 3.2).
 *
 * 검증:
 *   1. parseSearchParams — sort default + 알 수 없는 값 fallback + 필터 누적
 *   2. serialize via buildSortHref / buildFilterToggleHref — 기본 sort 는 URL 생략
 *   3. applyView — 필터 적용 + 3 정렬 모드 + tie-break tariffSlug ASC
 *   4. 순수성 — 입력 rows 변형 X
 */

import { describe, expect, it } from 'vitest';

import type { ResultRowData } from '@/db/queries/comparison';

import {
  applyView,
  buildFilterToggleHref,
  buildSortHref,
  parseSearchParams,
  type ViewState,
} from './compare-view';

function row(overrides: Partial<ResultRowData> = {}): ResultRowData {
  return {
    itemId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    rank: 1,
    tariffSnapshotId: '11111111-1111-1111-1111-111111111111',
    providerName: 'Proximus',
    providerSlug: 'proximus',
    tariffName: 'Mobile Smart',
    tariffSlug: 'mobile-smart',
    category: 'mobile',
    monthlySavingCents: 1000,
    yearlySavingCents: 12000,
    monthlyAvg12Cents: 1500,
    monthlyAvg24Cents: 1400,
    monthlySaving24Cents: 1100,
    monthlyPriceCents: 1500,
    activationFeeCents: 0,
    modemRentalCents: null,
    promoPriceCents: null,
    promoMonths: null,
    commitmentMonths: 24,
    attributes: {},
    confidence: 'high',
    caveats: [],
    sourceUrl: 'https://example.com',
    fetchedAt: new Date('2026-05-11T00:00:00Z'),
    ...overrides,
  };
}

describe('parseSearchParams', () => {
  it('빈 입력 → 기본 sort + 필터 0', () => {
    const v = parseSearchParams({});
    expect(v.sort).toBe('saving_desc');
    expect(v.filters.size).toBe(0);
  });

  it('알 수 없는 sort → 기본 fallback', () => {
    const v = parseSearchParams({ sort: 'random_unknown' });
    expect(v.sort).toBe('saving_desc');
  });

  it('알 수 없는 filter 값 → 무시', () => {
    const v = parseSearchParams({ commitment: 'maybe', data: 'limited' });
    expect(v.filters.size).toBe(0);
  });

  it('유효한 sort + 2 필터 누적', () => {
    const v = parseSearchParams({
      sort: 'price_asc',
      commitment: 'none',
      data: 'unlimited',
    });
    expect(v.sort).toBe('price_asc');
    expect(v.filters.has('commitment_none')).toBe(true);
    expect(v.filters.has('data_unlimited')).toBe(true);
  });

  it('배열 값 → 첫 요소 사용', () => {
    const v = parseSearchParams({ sort: ['price_asc', 'saving_desc'] });
    expect(v.sort).toBe('price_asc');
  });
});

describe('buildSortHref / buildFilterToggleHref', () => {
  const base: ViewState = { sort: 'saving_desc', filters: new Set() };

  it('기본 sort 변경 시 query 없음', () => {
    expect(buildSortHref('/r/abc', base, 'saving_desc')).toBe('/r/abc');
  });

  it('non-default sort → ?sort=...', () => {
    expect(buildSortHref('/r/abc', base, 'price_asc')).toBe(
      '/r/abc?sort=price_asc',
    );
  });

  it('필터 보존 + 정렬 변경', () => {
    const withFilter: ViewState = {
      sort: 'saving_desc',
      filters: new Set(['commitment_none']),
    };
    // URLSearchParams 순서 = set 순서 (sort 먼저 set 됨)
    expect(buildSortHref('/r/abc', withFilter, 'price_asc')).toBe(
      '/r/abc?sort=price_asc&commitment=none',
    );
  });

  it('필터 토글 — 추가', () => {
    expect(buildFilterToggleHref('/r/abc', base, 'commitment_none')).toBe(
      '/r/abc?commitment=none',
    );
  });

  it('필터 토글 — 제거', () => {
    const withFilter: ViewState = {
      sort: 'saving_desc',
      filters: new Set(['commitment_none']),
    };
    expect(
      buildFilterToggleHref('/r/abc', withFilter, 'commitment_none'),
    ).toBe('/r/abc');
  });
});

describe('applyView', () => {
  const rows: ResultRowData[] = [
    row({
      rank: 1,
      tariffSlug: 'a-tariff',
      monthlySavingCents: 2000,
      monthlyAvg12Cents: 1500,
      commitmentMonths: 24,
    }),
    row({
      rank: 2,
      tariffSlug: 'b-tariff',
      monthlySavingCents: 500,
      monthlyAvg12Cents: 2500,
      commitmentMonths: 0,
    }),
    row({
      rank: 3,
      tariffSlug: 'c-tariff',
      monthlySavingCents: 1000,
      monthlyAvg12Cents: 2000,
      commitmentMonths: 12,
      attributes: { data_gb: 'unlimited' },
    }),
  ];

  it('saving_desc 기본 — rank 순서와 일치 (이미 정렬됨)', () => {
    const v = applyView(rows, { sort: 'saving_desc', filters: new Set() }, 5);
    expect(v.map((r) => r.tariffSlug)).toEqual([
      'a-tariff',
      'c-tariff',
      'b-tariff',
    ]);
  });

  it('price_asc — 월 비용 적은 순', () => {
    const v = applyView(rows, { sort: 'price_asc', filters: new Set() }, 5);
    expect(v.map((r) => r.tariffSlug)).toEqual([
      'a-tariff',
      'c-tariff',
      'b-tariff',
    ]);
  });

  it('commitment_none_first — 약정없음 위로 + 안에서 saving_desc', () => {
    const v = applyView(
      rows,
      { sort: 'commitment_none_first', filters: new Set() },
      5,
    );
    expect(v.map((r) => r.tariffSlug)).toEqual([
      'b-tariff',
      'a-tariff',
      'c-tariff',
    ]);
  });

  it('필터 commitment_none — 약정없음 행만', () => {
    const v = applyView(
      rows,
      { sort: 'saving_desc', filters: new Set(['commitment_none']) },
      5,
    );
    expect(v.map((r) => r.tariffSlug)).toEqual(['b-tariff']);
  });

  it('필터 data_unlimited — attributes.data_gb=unlimited 만', () => {
    const v = applyView(
      rows,
      { sort: 'saving_desc', filters: new Set(['data_unlimited']) },
      5,
    );
    expect(v.map((r) => r.tariffSlug)).toEqual(['c-tariff']);
  });

  it('limit — 상위 N 제한', () => {
    const v = applyView(rows, { sort: 'saving_desc', filters: new Set() }, 2);
    expect(v).toHaveLength(2);
  });

  it('tie-break — 절약액 동일 시 tariffSlug ASC', () => {
    const tied: ResultRowData[] = [
      row({ tariffSlug: 'zzz', monthlySavingCents: 1000 }),
      row({ tariffSlug: 'aaa', monthlySavingCents: 1000 }),
    ];
    const v = applyView(tied, { sort: 'saving_desc', filters: new Set() }, 5);
    expect(v.map((r) => r.tariffSlug)).toEqual(['aaa', 'zzz']);
  });

  it('순수성 — 입력 rows 변형 X', () => {
    const before = rows.map((r) => r.tariffSlug);
    applyView(rows, { sort: 'price_asc', filters: new Set() }, 5);
    expect(rows.map((r) => r.tariffSlug)).toEqual(before);
  });
});
