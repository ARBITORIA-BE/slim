/**
 * affiliate-click — 어트리뷰션 클릭 INSERT + 인터스티셜 데이터 조회 (PLAN 4.1.c).
 *
 * 쿼리:
 *   1. getInterstitialData  — shortId + itemId 로 인터스티셜 페이지 표시 데이터 조회
 *   2. insertAffiliateClick — 동의 후 클릭 INSERT + provider.website 반환
 *
 * 금지 (ADR-0026 §T1):
 *   - IP / User-Agent / Referer 헤더 읽기 X
 *   - 쿠키 읽기/쓰기 X
 *   - 어떤 사용자 추적 식별자도 이 쿼리에 전달하지 않는다.
 */

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { affiliateClick } from '@/db/schema/affiliate_click';
import { comparisonResult, comparisonResultItem } from '@/db/schema/comparison_result';
import { provider } from '@/db/schema/provider';
import { tariffSnapshot } from '@/db/schema/tariff_snapshot';
import { tariff } from '@/db/schema/tariff';

// ─── 1. 인터스티셜 페이지 데이터 조회 ──────────────────────────────────────

export interface InterstitialData {
  /** 공급사 표시 이름 (인터스티셜 "받는 회사명" 노출). */
  readonly providerName: string;
  /** 공급사 공식 사이트. 거부 경로의 직접 링크. NULL 이면 조회 후 처리. */
  readonly providerWebsite: string;
  /** INSERT 에 필요한 FK 값들 — 인터스티셜 페이지가 confirm 액션에 hidden 으로 전달. */
  readonly resultId: string;
  readonly resultItemId: string;
  readonly providerId: string;
  readonly tariffSnapshotId: string;
}

/**
 * shortId + itemId 로 인터스티셜 표시에 필요한 데이터를 한 번에 조회.
 *
 * - shortId → comparison_result.id (없으면 null — 404 처리)
 * - itemId + resultId → comparison_result_item (없으면 null — 404 처리)
 * - FK JOIN: tariff_snapshot → tariff → provider
 *
 * provider.website 가 NULL/빈 문자열이면 502 — 호출자가 판단.
 * IP/UA/Cookie 는 이 함수에 닿지 않는다.
 */
export async function getInterstitialData(
  shortId: string,
  itemId: string,
): Promise<InterstitialData | null> {
  const rows = await db
    .select({
      providerName: provider.name,
      providerWebsite: provider.website,
      resultId: comparisonResult.id,
      resultItemId: comparisonResultItem.id,
      providerId: provider.id,
      tariffSnapshotId: comparisonResultItem.tariffSnapshotId,
    })
    .from(comparisonResultItem)
    .innerJoin(
      comparisonResult,
      eq(comparisonResult.id, comparisonResultItem.resultId),
    )
    .innerJoin(
      tariffSnapshot,
      eq(tariffSnapshot.id, comparisonResultItem.tariffSnapshotId),
    )
    .innerJoin(tariff, eq(tariff.id, tariffSnapshot.tariffId))
    .innerJoin(provider, eq(provider.id, tariff.providerId))
    .where(
      and(
        eq(comparisonResult.shortId, shortId),
        eq(comparisonResultItem.id, itemId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    providerName: row.providerName,
    providerWebsite: row.providerWebsite,
    resultId: row.resultId,
    resultItemId: row.resultItemId,
    providerId: row.providerId,
    tariffSnapshotId: row.tariffSnapshotId,
  };
}

// ─── 2. affiliate_click INSERT ────────────────────────────────────────────

export interface InsertAffiliateClickArgs {
  readonly clickToken: string;
  readonly resultId: string;
  readonly resultItemId: string;
  readonly providerId: string;
  readonly tariffSnapshotId: string;
  readonly consentGivenAt: Date;
  /** ADR-0026 §T2 예시: 'slim-r-<shortId>' */
  readonly refParam: string;
}

/**
 * 동의 후 affiliate_click 행 INSERT.
 *
 * 정산 컬럼 (commissionAmountCents / commissionSource / commissionFetchedAt) 은
 * 페이즈 4 후반 payout ADR 에서 채워진다 — 여기선 NULL 유지.
 * commissionCurrency default EUR, conversionStatus default 'pending'.
 *
 * 이 함수는 쿠키/헤더를 읽지 않는다. ADR-0026 §T1.
 */
export async function insertAffiliateClick(
  args: InsertAffiliateClickArgs,
): Promise<{ id: string }> {
  const rows = await db
    .insert(affiliateClick)
    .values({
      clickToken: args.clickToken,
      resultId: args.resultId,
      resultItemId: args.resultItemId,
      providerId: args.providerId,
      tariffSnapshotId: args.tariffSnapshotId,
      consentGivenAt: args.consentGivenAt,
      refParam: args.refParam,
      // 정산 컬럼은 NULL — 페이즈 4 후반 payout ADR 에서 채워짐
      commissionCurrency: 'EUR',
      conversionStatus: 'pending',
    })
    .returning({ id: affiliateClick.id });

  const row = rows[0];
  if (!row) {
    throw new Error('insertAffiliateClick RETURNING empty');
  }
  return row;
}
