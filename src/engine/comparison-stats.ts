/**
 * comparison-stats — 공급사별 비교 사용 횟수 집계 (PLAN 1.10 §항목 5)
 *
 * 왜 이 helper가 필요한가?
 *   /data-sources 페이지(ADR-0011 §T2 항목 5)는 공급사별로 "이 공급사의 요금제가
 *   비교 결과에 몇 번 등장했는가"를 투명하게 노출한다. P3 (투명성은 운영자의 짐).
 *
 * 쿼리 설계 (ADR-0011 §T2 항목 5):
 *   comparison_result_item.tariff_snapshot_id
 *     → tariff_snapshot.tariff_id
 *     → tariff.provider_id
 *     → provider.slug
 *   3단 join + GROUP BY provider.slug
 *
 * 페이즈 1 시점 정상:
 *   DB에 comparison_result_item 행이 0개 → 모든 카운트 0 → Map 비어있음.
 *   호출자(page.tsx)는 Map.get(slug) ?? 0 으로 안전하게 처리.
 *
 * 미래 재사용:
 *   페이즈 6.1 어드민 대시보드(4.5.1 v0)가 동일 데이터를 필요로 하므로
 *   src/engine/ 위치에 분리 (ADR-0011 §T6).
 *
 * 결정 근거: docs/adr/0011-data-sources-page-and-caveats-boundary.md §T2 항목 5, §T6
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { comparisonResultItem } from '@/db/schema/comparison_result';
import { tariffSnapshot } from '@/db/schema/tariff_snapshot';
import { tariff } from '@/db/schema/tariff';
import { provider } from '@/db/schema/provider';

// ─── 결과 타입 ─────────────────────────────────────────────────────────────

/**
 * 집계 결과 한 행. 공급사 slug → 비교 사용 횟수.
 *
 * 왜 Map<string, number>가 아닌 배열로 DB에서 받는가?
 *   Drizzle GROUP BY 결과는 배열 → 호출자가 Map으로 변환해서 O(1) lookup.
 *   DB 레이어를 Map으로 직접 반환하면 테스트에서 mock 교체가 불편.
 */
interface ProviderComparisonCount {
  readonly providerSlug: string;
  readonly count: number;
}

// ─── 핵심 함수 ─────────────────────────────────────────────────────────────

/**
 * 공급사별 비교 사용 횟수를 집계한다.
 *
 * 왜 Map<string, number>를 반환하는가?
 *   호출자(page.tsx)가 O(1)로 slug → count lookup하기 위함.
 *   registry의 모든 fetcher를 순회하며 Map.get(slug) ?? 0 으로 안전 접근.
 *
 * 페이즈 1 시점: DB에 행이 없으면 빈 Map 반환 → 호출자가 0으로 처리.
 * 페이즈 4 베타 시작 후: comparison_result_item 누적 → 자동으로 카운트 증가.
 *
 * @returns provider slug → 비교 사용 횟수의 Map (0 행 시 빈 Map)
 */
export async function getComparisonStatsByProvider(): Promise<
  Map<string, number>
> {
  // 왜 3단 join인가?
  //   comparison_result_item에는 tariff_snapshot_id만 있다 (ADR-0007 §T6).
  //   provider.slug까지 도달하려면 snapshot → tariff → provider 3단 탐색이 필요.
  //   Drizzle innerJoin으로 표현 — SQL: comparison_result_item
  //     INNER JOIN tariff_snapshot ON tariff_snapshot.id = comparison_result_item.tariff_snapshot_id
  //     INNER JOIN tariff ON tariff.id = tariff_snapshot.tariff_id
  //     INNER JOIN provider ON provider.id = tariff.provider_id
  //   GROUP BY provider.slug
  const rows = await db
    .select({
      providerSlug: provider.slug,
      // sql<number>: Drizzle가 count() 결과를 number로 타입 지정.
      // 왜 sql 템플릿 리터럴인가?
      //   drizzle의 count() 헬퍼는 string을 반환하는 경우가 있어
      //   직접 sql<number>``로 캐스팅하는 것이 noUncheckedIndexedAccess 친화적.
      count: sql<number>`count(*)::int`,
    })
    .from(comparisonResultItem)
    .innerJoin(
      tariffSnapshot,
      eq(tariffSnapshot.id, comparisonResultItem.tariffSnapshotId),
    )
    .innerJoin(tariff, eq(tariff.id, tariffSnapshot.tariffId))
    .innerJoin(provider, eq(provider.id, tariff.providerId))
    .groupBy(provider.slug);

  // 배열 → Map 변환
  const resultMap = new Map<string, number>();
  for (const row of rows) {
    resultMap.set(row.providerSlug, row.count);
  }
  return resultMap;
}

/**
 * DB 쿼리 추상 (테스트 교체용 타입 export).
 *
 * 왜 이 타입을 export하는가?
 *   comparison-stats.test.ts가 DB 없이 단위 테스트하려면 구현이 아닌
 *   *인터페이스* 계약을 테스트해야 한다. 타입 노출로 mock 교체 패턴 지원.
 */
export type { ProviderComparisonCount };
