/**
 * admin-metrics 단위 테스트.
 *
 * - pure helpers (computeConversionRate, computeFreshnessRatio) — DB 없이.
 * - SQL 정합 검사: buildMethodCaseExpression 이 만드는 SQL 이 올바른 구조인지.
 *   DB 통합 테스트는 development 브랜치 시드 필요 → PLAN 1.5.6 DoD §4 에 따라
 *   verifier 가 production 실측으로 검증 (스킵).
 *
 * E2E (4.5.1.d) 가 라이브 DB 로 메트릭 표시까지 검증.
 */
import { describe, expect, it } from 'vitest';

import {
  buildMethodCaseExpression,
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

// ─── SQL 정합 검사 (DB 없이 문자열 구조만 검증) ──────────────────────────────
//
// getFetcherHealth24h 가 만드는 SQL 에 CASE WHEN + GROUP BY method 가 포함되는지.
// DB 통합 테스트는 development 브랜치 시드 필요 → verifier 가 production 실측으로 검증.
describe('FETCHER_HEALTH_SQL 구조 (buildMethodCaseExpression 기반)', () => {
  it('scraping 매핑이 있으면 CASE WHEN ... scraping ... GROUP BY method 구조', () => {
    const sql = buildMethodCaseExpression(
      [
        { slug: 'proximus-be', category: 'mobile' },
        { slug: 'proximus-be', category: 'internet_fixed' },
        { slug: 'telenet-be', category: 'mobile' },
      ],
      [],
    );

    // CASE WHEN 구조
    expect(sql).toContain('CASE');
    expect(sql).toContain('WHEN');
    expect(sql).toContain("THEN 'scraping'");
    // ELSE stub (고아 tariff 격리)
    expect(sql).toContain("ELSE 'stub'");
    expect(sql).toContain('END');
    // manual 없음
    expect(sql).not.toContain("THEN 'manual'");
  });

  it('빈 매핑이면 stub 리터럴만 반환 (GROUP BY method 에서 모두 stub 으로)', () => {
    const sql = buildMethodCaseExpression([], []);
    expect(sql).toBe(`'stub'`);
  });

  it('scraping + manual 모두 있으면 두 WHEN 절 포함', () => {
    const sql = buildMethodCaseExpression(
      [{ slug: 'proximus-be', category: 'mobile' }],
      [{ slug: 'telenet-be', category: 'internet_fixed' }],
    );
    expect(sql).toContain("THEN 'scraping'");
    expect(sql).toContain("THEN 'manual'");
    expect(sql).toContain("ELSE 'stub'");
  });
});
