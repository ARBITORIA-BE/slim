/**
 * fetcher-yield — 직전 성공 실행의 (provider, category)별 산출 건수 조회 (PLAN 4.27).
 *
 * 왜 필요한가? (ADR-0054 §Context)
 *   공급사 페이지 개편으로 파서가 깨지면 **에러 없이 숫자만 줄어든다**. 2026-08 라운드
 *   한 번에 3건이 이 형태로 발견됐다 (Orange internet 전멸 / Proximus internet 4→1 /
 *   Telenet mobile 결합가 혼입). 전부 사람이 우연히 발견했다.
 *   "이번에 몇 건 나왔나" 는 fetcher 가 알지만 "저번엔 몇 건이었나" 는 DB 만 안다.
 *
 * 왜 신규 테이블이 없는가? (ADR-0054 §D4)
 *   `tariff_snapshot` 은 append-only 시계열이고, 한 fetcher 실행은 **하나의
 *   `fetched_at` 값**을 모든 행에 공유한다 (FetchResult.fetchedAt). 따라서
 *   "직전 실행" = 이번 fetched_at 보다 앞선 최대 fetched_at. 집계만으로 충분하다.
 *
 * 결정 근거: docs/adr/0054-fetcher-yield-drop-alerting.md
 */

import { and, count, eq, lt, max } from 'drizzle-orm';

import { db } from '@/db';
import { provider } from '@/db/schema/provider';
import { tariff } from '@/db/schema/tariff';
import type { TariffCategory } from '@/db/schema/tariff';
import { tariffSnapshot } from '@/db/schema/tariff_snapshot';

/** 카테고리 → 직전 실행에서 수집된 스냅샷 건수. 키 부재 = 직전 실행에 그 카테고리 없음. */
export type YieldByCategory = Partial<Record<TariffCategory, number>>;

/**
 * `providerSlug` 의 **직전 실행** 산출 건수를 카테고리별로 센다.
 *
 * @param beforeIso 이번 실행의 fetchedAt (ISO). 이 시각 *미만* 중 가장 최근 실행이 기준.
 * @returns 카테고리별 건수. 직전 실행 자체가 없으면 빈 객체 (첫 실행 → 비교 생략).
 *
 * 실패 시 throw 하지 않고 빈 객체를 돌려준다 — 알림 보조 기능이 cron 본체를
 * 깨뜨리면 안 된다 (1.9 격리 정신).
 */
export async function getPreviousYieldByCategory(
  providerSlug: string,
  beforeIso: string,
): Promise<YieldByCategory> {
  try {
    const before = new Date(beforeIso);

    const providerRows = await db
      .select({ id: provider.id })
      .from(provider)
      .where(eq(provider.slug, providerSlug))
      .limit(1);
    const providerId = providerRows[0]?.id;
    if (!providerId) return {};

    // 1) 직전 실행 시각 — 이번 fetchedAt 미만의 최대값
    const prevRows = await db
      .select({ prev: max(tariffSnapshot.fetchedAt) })
      .from(tariffSnapshot)
      .innerJoin(tariff, eq(tariffSnapshot.tariffId, tariff.id))
      .where(and(eq(tariff.providerId, providerId), lt(tariffSnapshot.fetchedAt, before)));

    const prevFetchedAt = prevRows[0]?.prev;
    if (!prevFetchedAt) return {};

    // 2) 그 시각의 카테고리별 건수
    const counts = await db
      .select({ category: tariff.category, n: count() })
      .from(tariffSnapshot)
      .innerJoin(tariff, eq(tariffSnapshot.tariffId, tariff.id))
      .where(
        and(
          eq(tariff.providerId, providerId),
          eq(tariffSnapshot.fetchedAt, prevFetchedAt),
        ),
      )
      .groupBy(tariff.category);

    const result: YieldByCategory = {};
    for (const row of counts) {
      result[row.category] = Number(row.n);
    }
    return result;
  } catch {
    // 조회 실패 = 비교 불가. 알림을 못 낼지언정 cron 은 계속 돈다.
    return {};
  }
}
