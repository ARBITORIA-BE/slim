/**
 * admin-metrics pure helpers 단위 테스트.
 *
 * SQL 쿼리 자체는 DB 통합 영역 — comparison.ts 패턴 따라 vitest 단위 외.
 * E2E (4.5.1.d) 가 라이브 DB 로 메트릭 표시까지 검증.
 */
import { describe, expect, it } from 'vitest';

import {
  computeConversionRate,
  computeFreshnessRatio,
} from './admin-metrics-helpers';

describe('computeConversionRate', () => {
  it('returns conversions / comparisons for positive comparisons', () => {
    expect(computeConversionRate(100, 5)).toBe(0.05);
    expect(computeConversionRate(10, 10)).toBe(1);
    expect(computeConversionRate(10, 0)).toBe(0);
  });

  it('returns null when comparisons is zero', () => {
    expect(computeConversionRate(0, 0)).toBeNull();
    expect(computeConversionRate(0, 5)).toBeNull();
  });

  it('returns null for non-finite or negative inputs', () => {
    expect(computeConversionRate(-1, 5)).toBeNull();
    expect(computeConversionRate(Number.NaN, 5)).toBeNull();
    expect(computeConversionRate(10, Number.NaN)).toBeNull();
    expect(computeConversionRate(10, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('computeFreshnessRatio', () => {
  it('returns fresh / totalActive for positive total', () => {
    expect(computeFreshnessRatio(10, 7)).toBe(0.7);
    expect(computeFreshnessRatio(4, 4)).toBe(1);
    expect(computeFreshnessRatio(4, 0)).toBe(0);
  });

  it('returns null when totalActive is zero', () => {
    expect(computeFreshnessRatio(0, 0)).toBeNull();
    expect(computeFreshnessRatio(0, 3)).toBeNull();
  });

  it('returns null for non-finite or negative inputs', () => {
    expect(computeFreshnessRatio(-1, 1)).toBeNull();
    expect(computeFreshnessRatio(Number.NaN, 1)).toBeNull();
    expect(computeFreshnessRatio(10, Number.NaN)).toBeNull();
  });
});
