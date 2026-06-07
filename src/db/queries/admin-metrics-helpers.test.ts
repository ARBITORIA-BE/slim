/**
 * admin-metrics-helpers 단위 테스트 (PLAN 1.5.6 architect 잠금 명세).
 *
 * buildMethodCaseExpression: 3 케이스
 *   (a) scraping 1개 + manual 0개
 *   (b) scraping 2개 + manual 2개
 *   (c) 둘 다 빈 배열 → 'stub' 리터럴
 *
 * computeFreshnessRatio: 기존 테스트 유지 (admin-metrics.test.ts 중복이지만
 *   helper 파일 단독 테스트 가능성 보장 — 명세 §3 요건).
 */
import { describe, expect, it } from 'vitest';

import {
  buildMethodCaseExpression,
  computeFreshnessRatio,
  type MethodMapping,
} from './admin-metrics-helpers';

// ─── buildMethodCaseExpression ───────────────────────────────────────────────

describe('buildMethodCaseExpression', () => {
  it('(a) scraping 1개 + manual 0개 → CASE WHEN ... scraping ELSE stub END', () => {
    const scraping: readonly MethodMapping[] = [
      { slug: 'proximus-be', category: 'mobile' },
    ];
    const result = buildMethodCaseExpression(scraping, []);

    // CASE 구조 포함 확인
    expect(result).toMatch(/^CASE\n/);
    expect(result).toContain("THEN 'scraping'");
    expect(result).toContain("p.slug = 'proximus-be'");
    expect(result).toContain("t.category = 'mobile'");
    // manual WHEN 절 없음
    expect(result).not.toContain("THEN 'manual'");
    // ELSE stub + END
    expect(result).toContain("ELSE 'stub'");
    expect(result).toMatch(/END\s*$/);
  });

  it('(b) scraping 2개 + manual 2개 → CASE WHEN scraping WHEN manual ELSE stub END', () => {
    const scraping: readonly MethodMapping[] = [
      { slug: 'proximus-be', category: 'mobile' },
      { slug: 'proximus-be', category: 'internet_fixed' },
    ];
    const manual: readonly MethodMapping[] = [
      { slug: 'telenet-be', category: 'internet_fixed' },
      { slug: 'telenet-be', category: 'bundle_internet_tv' },
    ];
    const result = buildMethodCaseExpression(scraping, manual);

    expect(result).toContain("THEN 'scraping'");
    expect(result).toContain("THEN 'manual'");
    // scraping 절이 manual 절보다 앞에 나와야 함
    const scrapingIdx = result.indexOf("THEN 'scraping'");
    const manualIdx = result.indexOf("THEN 'manual'");
    expect(scrapingIdx).toBeLessThan(manualIdx);
    // 4개 (provider, category) 쌍이 모두 포함
    expect(result).toContain("p.slug = 'proximus-be'");
    expect(result).toContain("t.category = 'mobile'");
    expect(result).toContain("t.category = 'internet_fixed'");
    expect(result).toContain("p.slug = 'telenet-be'");
    expect(result).toContain("t.category = 'bundle_internet_tv'");
    expect(result).toContain("ELSE 'stub'");
    expect(result).toMatch(/END\s*$/);
  });

  it('(c) 둘 다 빈 배열 → CASE 없이 리터럴 stub', () => {
    const result = buildMethodCaseExpression([], []);

    // CASE/WHEN/END 없이 순수 리터럴
    expect(result).toBe(`'stub'`);
    expect(result).not.toContain('CASE');
    expect(result).not.toContain('WHEN');
    expect(result).not.toContain('END');
  });

  it('(d) bundle_mobile_internet / bundle_mobile_internet_tv 신규 카테고리 허용 (ADR-0042)', () => {
    const scraping: readonly MethodMapping[] = [
      { slug: 'orange-be', category: 'bundle_mobile_internet' },
      { slug: 'proximus-be', category: 'bundle_mobile_internet_tv' },
    ];
    const result = buildMethodCaseExpression(scraping, []);
    expect(result).toContain("t.category = 'bundle_mobile_internet'");
    expect(result).toContain("t.category = 'bundle_mobile_internet_tv'");
  });

  it('unsafe slug 는 에러를 던진다', () => {
    const bad: readonly MethodMapping[] = [
      // @builder-justification: 타입 강제 캐스트로 런타임 방어 테스트 — SQL injection guard
      { slug: "'; DROP TABLE tariff; --", category: 'mobile' },
    ];
    expect(() => buildMethodCaseExpression(bad, [])).toThrow(
      /unsafe slug/,
    );
  });
});

// ─── computeFreshnessRatio (기존 테스트 유지) ────────────────────────────────

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
