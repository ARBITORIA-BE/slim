/**
 * admin-metrics pure helpers — DB import 분리 (테스트 친화).
 * SQL 쿼리는 admin-metrics.ts 가 본 helper 를 import 하여 사용.
 */

/**
 * comparisons === 0 → null (정의 불가). 그 외 conversions / comparisons.
 */
export function computeConversionRate(
  comparisons: number,
  conversions: number,
): number | null {
  if (!Number.isFinite(comparisons) || !Number.isFinite(conversions)) return null;
  if (comparisons <= 0) return null;
  return conversions / comparisons;
}

/**
 * totalActive === 0 → null. 그 외 fresh / totalActive.
 */
export function computeFreshnessRatio(
  totalActive: number,
  fresh: number,
): number | null {
  if (!Number.isFinite(totalActive) || !Number.isFinite(fresh)) return null;
  if (totalActive <= 0) return null;
  return fresh / totalActive;
}
