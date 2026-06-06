/**
 * cheapest-tariff — 카테고리별 최저가 활성 요금제 쿼리 (ADR-0041 D7.4, PLAN 4.13.c).
 *
 * CategoryGrid 컴포넌트가 ISR revalidate=3600 으로 소비.
 * 헌법 P1: source_url + fetched_at 필드 반환 → UI 에서 tooltip 노출.
 *
 * 결정 근거:
 *   - ADR-0005 §T2 (cents 정수, 표시 시 ÷100)
 *   - ADR-0041 D7.4 (카드 가격 예시 — cheapest active tariff per category)
 *   - ISR revalidate=3600 (admin 메트릭 동일 신선도)
 *
 * 주의: Drizzle min() aggregate 미지원(neon-http) — ORDER BY + LIMIT 1 per category.
 *       3 category × LIMIT 1 = 3 쿼리 병렬 실행 (Promise.all).
 */

import { and, asc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { provider } from '@/db/schema/provider';
import { tariff } from '@/db/schema/tariff';
import type { TariffCategory } from '@/db/schema/tariff';
import { TARIFF_CATEGORIES } from '@/types/comparison-input';

/** 카테고리별 최저가 활성 요금제. UI에서 가격 예시로 사용. */
export interface CheapestTariff {
  category: TariffCategory;
  /** 공급사 표시명 */
  providerName: string;
  /** 요금제 표시명 */
  tariffName: string;
  /** 월 정상 가격 (cents) */
  monthlyPriceCents: number;
  /** 출처 URL (헌법 P1 source) */
  sourceUrl: string;
  /** 마지막 확인 시각 ISO 8601 (헌법 P1 fetched_at) */
  lastSeenAt: string;
}

/** 카테고리 → 최저가 요금제 맵. 쿼리 실패 시 해당 카테고리 키 부재. */
export type CheapestTariffByCategory = Partial<Record<TariffCategory, CheapestTariff>>;

/**
 * 3 카테고리 모두의 최저가 활성 요금제를 병렬로 조회.
 * is_active = true + excluded_reason IS NULL (비교 대상 공급사만).
 * 실패 시 partial map (데이터 없는 카테고리는 undefined).
 */
export async function getCheapestTariffByCategory(): Promise<CheapestTariffByCategory> {
  const result: CheapestTariffByCategory = {};

  const queries = TARIFF_CATEGORIES.map(async (category) => {
    try {
      const rows = await db
        .select({
          category: tariff.category,
          providerName: provider.name,
          tariffName: tariff.name,
          monthlyPriceCents: tariff.monthlyPriceCents,
          sourceUrl: tariff.sourceUrl,
          lastSeenAt: tariff.lastSeenAt,
        })
        .from(tariff)
        .innerJoin(provider, eq(tariff.providerId, provider.id))
        .where(
          and(
            eq(tariff.category, category),
            eq(tariff.isActive, true),
            isNull(provider.excludedReason),
          ),
        )
        .orderBy(asc(tariff.monthlyPriceCents))
        .limit(1);

      const row = rows[0];
      if (row && row.lastSeenAt) {
        result[category] = {
          category: row.category,
          providerName: row.providerName,
          tariffName: row.tariffName,
          monthlyPriceCents: row.monthlyPriceCents,
          sourceUrl: row.sourceUrl,
          lastSeenAt: row.lastSeenAt.toISOString(),
        };
      }
    } catch {
      // DB 연결 실패 / 데이터 없음 — 카테고리 부재로 처리 (UI에서 placeholder 표시)
    }
  });

  await Promise.all(queries);
  return result;
}
