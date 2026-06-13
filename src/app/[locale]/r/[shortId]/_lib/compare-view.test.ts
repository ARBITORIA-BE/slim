/**
 * compare-view 단위 테스트 — P3 확장 (PLAN 4.21, ADR-0050 §D3).
 *
 * 검증:
 *   1. parseSearchParams — sort default(cheapest) + 알 수 없는 값 fallback + 필터 누적
 *   2. serialize via buildSortHref / buildFilterToggleHref — 기본 sort 는 URL 생략
 *   3. applyView — P2 레거시 3종 + P3 신규 4종 정렬 + tie-break tariffSlug ASC
 *   4. 순수성 — 입력 rows 변형 X
 */

import { describe, expect, it } from 'vitest';

import type { ResultRowData } from '@/db/queries/comparison';

import {
  applyView,
  buildFilterToggleHref,
  buildSortHref,
  parseSearchParams,
  SORT_TAB_KEYS,
  type ViewState,
} from './compare-view';

function row(overrides: Partial<ResultRowData> = {}): ResultRowData {
  return {
    itemId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    rank: 1,
    tariffSnapshotId: '11111111-1111-1111-1111-111111111111',
    providerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    providerName: 'Proximus',
    providerSlug: 'proximus',
    affiliateStatus: 'none',
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
    isStub: false,
    ...overrides,
  };
}

describe('parseSearchParams', () => {
  it('빈 입력 → 기본 sort = cheapest + 필터 0 (P3 DEFAULT_SORT 변경)', () => {
    const v = parseSearchParams({});
    expect(v.sort).toBe('cheapest');
    expect(v.filters.size).toBe(0);
  });

  it('알 수 없는 sort → 기본 fallback = cheapest', () => {
    const v = parseSearchParams({ sort: 'random_unknown' });
    expect(v.sort).toBe('cheapest');
  });

  it('알 수 없는 filter 값 → 무시', () => {
    const v = parseSearchParams({ commitment: 'maybe', data: 'limited' });
    expect(v.filters.size).toBe(0);
  });

  it('유효한 sort + 2 필터 누적 (레거시 price_asc 허용)', () => {
    const v = parseSearchParams({
      sort: 'price_asc',
      commitment: 'none',
      data: 'unlimited',
    });
    expect(v.sort).toBe('price_asc');
    expect(v.filters.has('commitment_none')).toBe(true);
    expect(v.filters.has('data_unlimited')).toBe(true);
  });

  it('P3 신규 sort — cheapest/most_saved/best_value/most_reliable 파싱', () => {
    for (const key of SORT_TAB_KEYS) {
      const v = parseSearchParams({ sort: key });
      expect(v.sort).toBe(key);
    }
  });

  it('배열 값 → 첫 요소 사용', () => {
    const v = parseSearchParams({ sort: ['price_asc', 'saving_desc'] });
    expect(v.sort).toBe('price_asc');
  });
});

describe('buildSortHref / buildFilterToggleHref', () => {
  // P3: DEFAULT_SORT = 'cheapest'
  const base: ViewState = { sort: 'cheapest', filters: new Set() };

  it('기본 sort (cheapest) 변경 시 query 없음', () => {
    expect(buildSortHref('/r/abc', base, 'cheapest')).toBe('/r/abc');
  });

  it('non-default sort → ?sort=...', () => {
    expect(buildSortHref('/r/abc', base, 'price_asc')).toBe(
      '/r/abc?sort=price_asc',
    );
  });

  it('P3 신규 sort → ?sort=most_saved', () => {
    expect(buildSortHref('/r/abc', base, 'most_saved')).toBe(
      '/r/abc?sort=most_saved',
    );
  });

  it('P3 best_value → ?sort=best_value', () => {
    expect(buildSortHref('/r/abc', base, 'best_value')).toBe(
      '/r/abc?sort=best_value',
    );
  });

  it('P3 most_reliable → ?sort=most_reliable', () => {
    expect(buildSortHref('/r/abc', base, 'most_reliable')).toBe(
      '/r/abc?sort=most_reliable',
    );
  });

  it('필터 보존 + 정렬 변경', () => {
    const withFilter: ViewState = {
      sort: 'cheapest',
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

  it('필터 토글 — 제거 (DEFAULT_SORT=cheapest 이므로 sort 생략)', () => {
    const withFilter: ViewState = {
      sort: 'cheapest',
      filters: new Set(['commitment_none']),
    };
    expect(
      buildFilterToggleHref('/r/abc', withFilter, 'commitment_none'),
    ).toBe('/r/abc');
  });
});

describe('applyView', () => {
  // why: monthlyPriceCents 명시 — cheapest 정렬 테스트 결정성 확보.
  //      row() 기본값 monthlyPriceCents=1500 이어서 명시 오버라이드 필요.
  const rows: ResultRowData[] = [
    row({
      rank: 1,
      tariffSlug: 'a-tariff',
      monthlySavingCents: 2000,
      monthlyAvg12Cents: 1500,
      monthlyPriceCents: 1500,
      commitmentMonths: 24,
    }),
    row({
      rank: 2,
      tariffSlug: 'b-tariff',
      monthlySavingCents: 500,
      monthlyAvg12Cents: 2500,
      monthlyPriceCents: 2500,
      commitmentMonths: 0,
    }),
    row({
      rank: 3,
      tariffSlug: 'c-tariff',
      monthlySavingCents: 1000,
      monthlyAvg12Cents: 2000,
      monthlyPriceCents: 2000,
      commitmentMonths: 12,
      attributes: { data_gb: 'unlimited' },
    }),
  ];

  it('saving_desc — rank 순서와 일치 (이미 정렬됨, 레거시)', () => {
    const v = applyView(rows, { sort: 'saving_desc', filters: new Set() }, 5);
    expect(v.map((r) => r.tariffSlug)).toEqual([
      'a-tariff',
      'c-tariff',
      'b-tariff',
    ]);
  });

  it('cheapest (P3) — monthlyPriceCents ASC', () => {
    // rows: a=1500, b=2500, c=2000
    const v = applyView(rows, { sort: 'cheapest', filters: new Set() }, 5);
    expect(v.map((r) => r.tariffSlug)).toEqual([
      'a-tariff',  // 1500
      'c-tariff',  // 2000
      'b-tariff',  // 2500
    ]);
  });

  it('most_saved (P3) — monthlySavingCents DESC', () => {
    // rows: a=2000, c=1000, b=500
    const v = applyView(rows, { sort: 'most_saved', filters: new Set() }, 5);
    expect(v.map((r) => r.tariffSlug)).toEqual([
      'a-tariff',  // 2000
      'c-tariff',  // 1000
      'b-tariff',  // 500
    ]);
  });

  it('best_value (P3) — savings/price DESC', () => {
    // a: 2000/1500 = 1.33, b: 500/2500 = 0.2, c: 1000/2000 = 0.5
    const v = applyView(rows, { sort: 'best_value', filters: new Set() }, 5);
    expect(v.map((r) => r.tariffSlug)).toEqual([
      'a-tariff',  // 1.33
      'c-tariff',  // 0.5
      'b-tariff',  // 0.2
    ]);
  });

  it('most_reliable (P3) — confidence DESC', () => {
    const reliabilityRows = [
      row({ tariffSlug: 'low-row', confidence: 'low', monthlySavingCents: 3000 }),
      row({ tariffSlug: 'high-row', confidence: 'high', monthlySavingCents: 100, rank: 2 }),
      row({ tariffSlug: 'medium-row', confidence: 'medium', monthlySavingCents: 500, rank: 3 }),
    ];
    const v = applyView(reliabilityRows, { sort: 'most_reliable', filters: new Set() }, 5);
    expect(v.map((r) => r.tariffSlug)).toEqual([
      'high-row',    // 4
      'medium-row',  // 3
      'low-row',     // 2
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

// ─── ADR-0013 Amendment 1 — isStub propagation ───────────────────────────

describe('ResultRowData.isStub propagation', () => {
  it('isStub=true row → applyView 후 isStub 값 보존', () => {
    const stubRow = row({ isStub: true, tariffSlug: 'stub-tariff' });
    const nonStubRow = row({ isStub: false, tariffSlug: 'live-tariff', rank: 2, monthlySavingCents: 500 });
    const result = applyView(
      [stubRow, nonStubRow],
      { sort: 'saving_desc', filters: new Set() },
      5,
    );
    const found = result.find((r) => r.tariffSlug === 'stub-tariff');
    expect(found).toBeDefined();
    expect(found?.isStub).toBe(true);
  });

  it('isStub=false row → applyView 후 isStub=false 유지', () => {
    const liveRow = row({ isStub: false, tariffSlug: 'live-only' });
    const result = applyView(
      [liveRow],
      { sort: 'saving_desc', filters: new Set() },
      5,
    );
    expect(result[0]?.isStub).toBe(false);
  });

  it('적어도 1 row isStub=true → some(isStub) 트리거', () => {
    const items: ResultRowData[] = [
      row({ isStub: true }),
      row({ isStub: false, rank: 2 }),
    ];
    expect(items.some((i) => i.isStub)).toBe(true);
  });

  it('전체 isStub=false → some(isStub) 미트리거', () => {
    const items: ResultRowData[] = [
      row({ isStub: false }),
      row({ isStub: false, rank: 2 }),
    ];
    expect(items.some((i) => i.isStub)).toBe(false);
  });
});
