/**
 * admin-metrics pure helpers — DB import 분리 (테스트 친화).
 * SQL 쿼리는 admin-metrics.ts 가 본 helper 를 import 하여 사용.
 */

import type { TariffCategory } from '@/db/schema/tariff';

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

// ─── Method CASE expression ──────────────────────────────────────────────────

/**
 * (provider slug, tariff category) 쌍 하나 — scraping / manual 매핑용.
 */
export interface MethodMapping {
  readonly slug: string;
  readonly category: TariffCategory;
}

/**
 * SQL 인젝션 방어: slug 와 category 값이 안전한 식별자인지 검증.
 *
 * - slug: 영문 소문자, 숫자, 하이픈만 허용 (provider slug 컨벤션 준수).
 * - category: TariffCategory enum 값 (mobile / internet_fixed / bundle_internet_tv).
 *   TypeScript 컴파일 타임 타입 보장이 있지만 런타임에서도 방어적으로 검증.
 *
 * 왜 직접 이스케이프 대신 화이트리스트?
 *   호출처가 항상 registry 의 자체 검증된 값을 넘기지만, helper 가 순수 함수로
 *   사용되는 한 입력 신뢰를 가정하지 않는 것이 P4 원칙에 부합한다.
 */
const SLUG_RE = /^[a-z0-9-]+$/;
const VALID_CATEGORIES = new Set<string>([
  'mobile',
  'internet_fixed',
  'bundle_internet_tv',
]);

function assertSafe(slug: string, category: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new Error(
      `buildMethodCaseExpression: unsafe slug "${slug}" — only [a-z0-9-] allowed`,
    );
  }
  if (!VALID_CATEGORIES.has(category)) {
    throw new Error(
      `buildMethodCaseExpression: unknown category "${category}"`,
    );
  }
}

/**
 * (p.slug, t.category) 쌍 배열로 SQL CASE WHEN ... END 프래그먼트를 빌드.
 *
 * 목적:
 *   admin-metrics 의 `getFetcherHealth24h` 가 tariff 를 method 별로 분류하기
 *   위해 사용한다. DB 에 method 컬럼이 없으므로 (ADR-0008 §T5 — method 는
 *   registry 코드 레벨 개념), registry 를 런타임에 읽어 SQL 에 인라인한다.
 *
 * 출력 형식 (scraping 1개 + manual 1개 예시):
 *   CASE
 *     WHEN (p.slug = 'proximus-be' AND t.category = 'mobile') THEN 'scraping'
 *     WHEN (p.slug = 'x-be' AND t.category = 'mobile') THEN 'manual'
 *     ELSE 'stub'
 *   END
 *
 * 에지 케이스:
 *   - scrapingMappings 빈 배열 + manualMappings 빈 배열 → `'stub'` 리터럴 (CASE 없이).
 *   - scrapingMappings 빈 배열 → scraping WHEN 절 미생성.
 *   - manualMappings 빈 배열 → manual WHEN 절 미생성.
 *
 * @throws {Error} slug 또는 category 값이 화이트리스트 패턴 미준수 시.
 */
export function buildMethodCaseExpression(
  scrapingMappings: readonly MethodMapping[],
  manualMappings: readonly MethodMapping[],
): string {
  // 둘 다 비면 CASE 불필요 — 모든 row 가 'stub'.
  if (scrapingMappings.length === 0 && manualMappings.length === 0) {
    return `'stub'`;
  }

  const lines: string[] = ['CASE'];

  if (scrapingMappings.length > 0) {
    const conditions = scrapingMappings
      .map(({ slug, category }) => {
        assertSafe(slug, category);
        return `(p.slug = '${slug}' AND t.category = '${category}')`;
      })
      .join(' OR ');
    lines.push(`  WHEN ${conditions} THEN 'scraping'`);
  }

  if (manualMappings.length > 0) {
    const conditions = manualMappings
      .map(({ slug, category }) => {
        assertSafe(slug, category);
        return `(p.slug = '${slug}' AND t.category = '${category}')`;
      })
      .join(' OR ');
    lines.push(`  WHEN ${conditions} THEN 'manual'`);
  }

  lines.push(`  ELSE 'stub'`);
  lines.push('END');

  return lines.join('\n');
}
