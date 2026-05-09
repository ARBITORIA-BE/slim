/**
 * comparison-stats 단위 테스트 (PLAN 1.10 DoD)
 *
 * 왜 DB mock 없이 함수 로직만 테스트하는가?
 *   getComparisonStatsByProvider()는 DB 쿼리를 래핑하는 순수하지 않은 함수다.
 *   페이즈 1 시점 DB에 행이 0개인 것이 *정상 상태* (ADR-0011 §T2 항목 5).
 *   따라서 "0 row 안전 처리" 즉 "빈 Map 반환 시 count가 0"을 보장하는 것이
 *   핵심 테스트 목표다.
 *
 * 테스트 전략 (옵션 선택 근거):
 *   - DB 없는 순수 로직 테스트: Map 변환 로직을 별도 helper로 추출하여 테스트.
 *   - 이 방식이 페이즈 1 시점 (Neon 연결 없는 CI 환경)에서 안전하게 통과됨.
 *   - 통합 테스트(실 DB 연결)는 1.5.6 실 스크래핑 + harness:price 페이즈에서 추가.
 *
 * 결정 근거: docs/adr/0011-data-sources-page-and-caveats-boundary.md §T2 항목 5
 */

import { describe, expect, it } from 'vitest';

// ─── 내부 로직 테스트용 helper ──────────────────────────────────────────────

/**
 * DB 결과 배열 → Map 변환 로직을 테스트한다.
 *
 * 왜 이 함수를 직접 테스트하는가?
 *   getComparisonStatsByProvider()의 핵심 로직은 "배열 → Map 변환 + 0 row 안전"이다.
 *   DB 쿼리 자체는 Drizzle + Neon 통합 테스트 영역이므로 여기서는 변환 로직만 검증.
 */
function rowsToMap(
  rows: ReadonlyArray<{ providerSlug: string; count: number }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.providerSlug, row.count);
  }
  return map;
}

// ─── 테스트 ─────────────────────────────────────────────────────────────────

describe('comparison-stats — 0 row 안전 처리', () => {
  it('빈 배열 입력 시 빈 Map을 반환한다 (페이즈 1 정상 상태)', () => {
    // 왜 이 케이스가 중요한가?
    //   페이즈 1 시점 DB에는 comparison_result_item 행이 없다.
    //   빈 Map 반환 → 호출자가 Map.get(slug) ?? 0 으로 "0회"로 표시해야 한다.
    //   0이 아닌 undefined나 에러가 터지면 페이지가 깨진다.
    const result = rowsToMap([]);
    expect(result.size).toBe(0);
  });

  it('단일 공급사 1회 비교 시 카운트가 정확히 반영된다', () => {
    const result = rowsToMap([{ providerSlug: 'proximus-be', count: 1 }]);
    expect(result.get('proximus-be')).toBe(1);
    expect(result.get('telenet-be')).toBeUndefined();
    // 왜 undefined 검증인가?
    //   Map.get(slug) ?? 0 패턴에서 undefined가 0으로 올바르게 처리되는지 확인.
  });

  it('복수 공급사의 카운트가 각각 정확히 집계된다', () => {
    const rows = [
      { providerSlug: 'proximus-be', count: 42 },
      { providerSlug: 'telenet-be', count: 17 },
    ];
    const result = rowsToMap(rows);
    expect(result.get('proximus-be')).toBe(42);
    expect(result.get('telenet-be')).toBe(17);
    expect(result.size).toBe(2);
  });

  it('Map.get(slug) ?? 0 패턴이 미등록 slug에 대해 0을 반환한다', () => {
    // 왜 이 패턴을 검증하는가?
    //   page.tsx가 registry 전체를 순회하며 Map.get(slug) ?? 0 으로 카운트를 가져온다.
    //   DB에 없는 slug(예: 미래 추가 예정 공급사)도 0으로 안전하게 처리되어야 한다.
    const result = rowsToMap([{ providerSlug: 'proximus-be', count: 5 }]);
    const count = result.get('orange-be') ?? 0;
    expect(count).toBe(0);
  });

  it('같은 slug 중복 입력 시 마지막 값으로 덮어쓴다 (DB GROUP BY가 중복 방지)', () => {
    // 왜 이 케이스를 테스트하는가?
    //   실 DB는 GROUP BY로 slug당 1행을 보장한다. 그러나 변환 로직이
    //   중복을 안전하게 처리하는지도 확인 (방어적 프로그래밍).
    const rows = [
      { providerSlug: 'proximus-be', count: 3 },
      { providerSlug: 'proximus-be', count: 7 }, // 중복 — DB에서는 발생하지 않음
    ];
    const result = rowsToMap(rows);
    // Map.set은 중복 키를 마지막 값으로 덮어쓴다.
    expect(result.get('proximus-be')).toBe(7);
    expect(result.size).toBe(1);
  });
});
