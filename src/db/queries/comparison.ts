/**
 * comparison — `/api/compare` 풀 흐름 + `/r/[shortId]` DB 존재 검증의 단일 출처
 * (Sub-task 5).
 *
 * 패턴 (comparison-stats.ts / providers.ts 동형):
 *   - 본 파일은 *DB 쿼리만*. 순수 변환은 comparison-helpers.ts.
 *   - Drizzle 쿼리는 통합 테스트 영역 — vitest 단위 테스트 X.
 *   - persist.ts 와 동일하게 neon-http (no tx) 순차 실행. 부분 실패 시 다음
 *     cron 또는 운영자 자가 진단 (ADR-0021 §T3 "부분 실패 시 분석 가치").
 *
 * 쿼리:
 *   1. insertComparisonRequest    — INSERT RETURNING id (ADR-0021 §T3 step 2)
 *   2. getCandidateSnapshots      — DISTINCT ON 후보 SELECT (step 3)
 *   3. getCurrentTariffSnapshot   — DISTINCT ON 현재 요금제 (step 4)
 *   4. insertComparisonResult     — INSERT RETURNING id (step 6 result)
 *   5. insertComparisonResultItems — bulk INSERT (step 6 items)
 *   6. getResultByShortId         — /r/[shortId] 진입 검증 (ADR-0021 §T1 + §T8)
 */

import { and, desc, eq, ne } from 'drizzle-orm';

import { db } from '@/db';
import { comparisonRequest } from '@/db/schema/comparison_request';
import {
  comparisonResult,
  comparisonResultItem,
} from '@/db/schema/comparison_result';
import { provider } from '@/db/schema/provider';
import { tariff } from '@/db/schema/tariff';
import { tariffSnapshot } from '@/db/schema/tariff_snapshot';
import type { Confidence } from '@/db/schema/tariff_snapshot';
import type { TariffCategory } from '@/db/schema/tariff';
import type { AffiliateStatus } from '@/db/schema/provider';

import type { SnapshotJoinRow } from './comparison-helpers';

// ─── 1. comparison_request INSERT ────────────────────────────────────────

export interface InsertComparisonRequestArgs {
  readonly category: TariffCategory;
  readonly postalCode: string;
  readonly householdType: 'single' | 'couple' | 'family_3_plus';
  readonly currentProviderId: string | null;
  /** ADR-0021 §T10 country / 사용량 키 모두 흡수 (JSONB). */
  readonly inputAttributes: Record<string, unknown>;
}

export async function insertComparisonRequest(
  args: InsertComparisonRequestArgs,
): Promise<{ id: string }> {
  const rows = await db
    .insert(comparisonRequest)
    .values({
      category: args.category,
      postalCode: args.postalCode,
      householdType: args.householdType,
      currentProviderId: args.currentProviderId,
      inputAttributes: args.inputAttributes,
    })
    .returning({ id: comparisonRequest.id });
  const row = rows[0];
  if (!row) {
    throw new Error('insertComparisonRequest RETURNING empty');
  }
  return row;
}

// ─── 2. 후보 SELECT (DISTINCT ON, ADR-0006 §T7) ──────────────────────────

/**
 * tariff_snapshot 후보 SELECT. 카테고리 + 국가 + 비교 적격 조건으로 좁힌 뒤
 * `(tariff_id, fetched_at DESC)` 인덱스 위에서 DISTINCT ON 으로 tariff 당 최신
 * 스냅샷 1건만.
 *
 * 적격 조건 (ADR-0006 §T5 + ADR-0010 §T5):
 *   - tariff.is_active = true
 *   - provider.country = $country
 *   - NOT tariff_snapshot.is_anomaly
 *   - tariff_snapshot.confidence != 'low'
 *
 * 0건 시 빈 배열 — compare() 가 자연 처리 (ADR-0010 §T7 빈 candidates 케이스).
 */
export async function getCandidateSnapshots(
  category: TariffCategory,
  country: 'BE' | 'NL' | 'LU',
): Promise<SnapshotJoinRow[]> {
  const rows = await db
    .selectDistinctOn([tariffSnapshot.tariffId], {
      snapshotId: tariffSnapshot.id,
      providerSlug: provider.slug,
      tariffSlug: tariff.slug,
      category: tariff.category,
      monthlyPriceCents: tariffSnapshot.monthlyPriceCents,
      activationFeeCents: tariffSnapshot.activationFeeCents,
      modemRentalCents: tariffSnapshot.modemRentalCents,
      promoPriceCents: tariffSnapshot.promoPriceCents,
      promoMonths: tariffSnapshot.promoMonths,
      commitmentMonths: tariff.commitmentMonths,
      earlyTerminationFeeCents: tariff.earlyTerminationFeeCents,
      attributes: tariff.attributes,
      confidence: tariffSnapshot.confidence,
      confidenceReason: tariffSnapshot.confidenceReason,
      isAnomaly: tariffSnapshot.isAnomaly,
    })
    .from(tariffSnapshot)
    .innerJoin(tariff, eq(tariff.id, tariffSnapshot.tariffId))
    .innerJoin(provider, eq(provider.id, tariff.providerId))
    .where(
      and(
        eq(tariff.category, category),
        eq(tariff.isActive, true),
        eq(provider.country, country),
        eq(tariffSnapshot.isAnomaly, false),
        ne(tariffSnapshot.confidence, 'low' as Confidence),
      ),
    )
    .orderBy(tariffSnapshot.tariffId, desc(tariffSnapshot.fetchedAt));
  return rows.map(narrowRow);
}

// ─── 3. 현재 요금제 SELECT (DISTINCT ON, ADR-0021 §T3 step 4) ────────────

/**
 * `tariff.id = $tariffId` 의 최신 스냅샷 1건. is_active/is_anomaly/confidence
 * 필터를 적용하지 않는 이유:
 *   - 사용자의 *현재* 요금제는 비교 후보가 아니라 *baseline* 이다.
 *   - 신뢰도 'low' 라도 baseline 으로 사용 가능 (절댓값 자체 보다 비교 정직성 우선).
 *   - 단종 (`is_active=false`) 도 baseline 으로 사용 가능 — 마이그레이션 안내.
 *
 * 없으면 null — compare() 가 신규 가입자 케이스로 처리 (ADR-0010 §T7 케이스 6).
 */
export async function getCurrentTariffSnapshot(
  tariffId: string,
): Promise<SnapshotJoinRow | null> {
  const rows = await db
    .selectDistinctOn([tariffSnapshot.tariffId], {
      snapshotId: tariffSnapshot.id,
      providerSlug: provider.slug,
      tariffSlug: tariff.slug,
      category: tariff.category,
      monthlyPriceCents: tariffSnapshot.monthlyPriceCents,
      activationFeeCents: tariffSnapshot.activationFeeCents,
      modemRentalCents: tariffSnapshot.modemRentalCents,
      promoPriceCents: tariffSnapshot.promoPriceCents,
      promoMonths: tariffSnapshot.promoMonths,
      commitmentMonths: tariff.commitmentMonths,
      earlyTerminationFeeCents: tariff.earlyTerminationFeeCents,
      attributes: tariff.attributes,
      confidence: tariffSnapshot.confidence,
      confidenceReason: tariffSnapshot.confidenceReason,
      isAnomaly: tariffSnapshot.isAnomaly,
    })
    .from(tariffSnapshot)
    .innerJoin(tariff, eq(tariff.id, tariffSnapshot.tariffId))
    .innerJoin(provider, eq(provider.id, tariff.providerId))
    .where(eq(tariff.id, tariffId))
    .orderBy(tariffSnapshot.tariffId, desc(tariffSnapshot.fetchedAt))
    .limit(1);
  const row = rows[0];
  return row ? narrowRow(row) : null;
}

// ─── 4. comparison_result INSERT ─────────────────────────────────────────

export interface InsertComparisonResultArgs {
  readonly requestId: string;
  readonly shortId: string;
  readonly topMonthlySavingCents: number | null;
  readonly topYearlySavingCents: number | null;
  readonly topTariffSnapshotId: string | null;
  readonly lockedInputs: Record<string, unknown>;
  readonly engineVersion: string;
}

export async function insertComparisonResult(
  args: InsertComparisonResultArgs,
): Promise<{ id: string }> {
  const rows = await db
    .insert(comparisonResult)
    .values({
      requestId: args.requestId,
      shortId: args.shortId,
      topMonthlySavingCents: args.topMonthlySavingCents,
      topYearlySavingCents: args.topYearlySavingCents,
      topTariffSnapshotId: args.topTariffSnapshotId,
      lockedInputs: args.lockedInputs,
      engineVersion: args.engineVersion,
    })
    .returning({ id: comparisonResult.id });
  const row = rows[0];
  if (!row) {
    throw new Error('insertComparisonResult RETURNING empty');
  }
  return row;
}

// ─── 5. comparison_result_item bulk INSERT ───────────────────────────────

export interface InsertResultItemArgs {
  readonly resultId: string;
  readonly rank: number;
  readonly tariffSnapshotId: string;
  /** 12개월 시나리오 월 절약액 (cents, signed). ADR-0010 §T3 1차 단위. */
  readonly monthlySavingCents: number;
  /** monthlySavingCents × 12 (UI 결론 카드 단일 변환 출처). */
  readonly yearlySavingCents: number;
  /** Sub-task 3 (0004 마이그레이션) — breakdown 평탄 컬럼 3종. */
  readonly monthlyAvg12Cents: number;
  readonly monthlyAvg24Cents: number;
  readonly monthlySaving24Cents: number;
  readonly caveats: readonly string[];
}

export async function insertComparisonResultItems(
  items: readonly InsertResultItemArgs[],
): Promise<void> {
  if (items.length === 0) return;
  await db.insert(comparisonResultItem).values(
    items.map((it) => ({
      resultId: it.resultId,
      rank: it.rank,
      tariffSnapshotId: it.tariffSnapshotId,
      monthlySavingCents: it.monthlySavingCents,
      yearlySavingCents: it.yearlySavingCents,
      monthlyAvg12Cents: it.monthlyAvg12Cents,
      monthlyAvg24Cents: it.monthlyAvg24Cents,
      monthlySaving24Cents: it.monthlySaving24Cents,
      caveats: it.caveats as string[],
    })),
  );
}

// ─── 6. getResultByShortId (`/r/[shortId]` 진입 검증) ────────────────────

/**
 * `/r/[shortId]` 페이지가 호출. result + (left-joined) request meta 를 한 번에.
 *
 * 왜 LEFT JOIN 인가?
 *   ADR-0007 §T8 — request 가 GDPR 삭제로 NULL 가능. result 자체는 영구 보존.
 *   request 가 사라져도 페이지는 lockedInputs (90일 미만이면) 로 일부 노출.
 *
 * 미존재 시 null → page 가 notFound() (ADR-0021 §T1 + sub-task 4 정합).
 */
export interface ResultWithRequestRow {
  readonly resultId: string;
  readonly shortId: string;
  readonly requestId: string | null;
  readonly topMonthlySavingCents: number | null;
  readonly topYearlySavingCents: number | null;
  readonly topTariffSnapshotId: string | null;
  readonly lockedInputs: unknown; // JSONB — caller 가 좁힘
  readonly engineVersion: string;
  readonly resultCreatedAt: Date;
  readonly piiAnonymizedAt: Date | null;
  // request side (LEFT JOIN — request 삭제 시 null)
  readonly requestCategory: TariffCategory | null;
  readonly requestHouseholdType:
    | 'single'
    | 'couple'
    | 'family_3_plus'
    | null;
  readonly requestPostalCode: string | null;
  readonly requestInputAttributes: unknown;
}

export async function getResultByShortId(
  shortId: string,
): Promise<ResultWithRequestRow | null> {
  const rows = await db
    .select({
      resultId: comparisonResult.id,
      shortId: comparisonResult.shortId,
      requestId: comparisonResult.requestId,
      topMonthlySavingCents: comparisonResult.topMonthlySavingCents,
      topYearlySavingCents: comparisonResult.topYearlySavingCents,
      topTariffSnapshotId: comparisonResult.topTariffSnapshotId,
      lockedInputs: comparisonResult.lockedInputs,
      engineVersion: comparisonResult.engineVersion,
      resultCreatedAt: comparisonResult.createdAt,
      piiAnonymizedAt: comparisonResult.piiAnonymizedAt,
      requestCategory: comparisonRequest.category,
      requestHouseholdType: comparisonRequest.householdType,
      requestPostalCode: comparisonRequest.postalCode,
      requestInputAttributes: comparisonRequest.inputAttributes,
    })
    .from(comparisonResult)
    .leftJoin(
      comparisonRequest,
      eq(comparisonRequest.id, comparisonResult.requestId),
    )
    .where(eq(comparisonResult.shortId, shortId))
    .limit(1);
  return rows[0] ?? null;
}

// ─── 7. getTopResultItem (Sub-task 3, /r/[shortId] breakdown 출처) ───────

/**
 * rank=1 결과 행 + 해당 tariff_snapshot.activationFeeCents JOIN.
 *
 * 왜 rank=1 만?
 *   /r/[shortId] 페이즈 3 1차 = CalculationDetails 가 1위 결과의 breakdown 만
 *   노출. 페이즈 3 후속 라운드 (3.2 비교 표) 진입 시 상위 N 전체 fetch 별도 helper.
 *
 * 왜 activationFeeCents 가 별도 JOIN?
 *   ADR-0006 §append-only — tariff_snapshot 행은 RESTRICT FK 로 동결.
 *   원본 활성화비를 그대로 가져오면 결과 재현성 보장 (P1).
 *
 * 없으면 null — 후보 0건 (compare 결과 빈 ranked) 케이스.
 */
export interface TopResultItemRow {
  /** comparison_result_item.id — PLAN 4.1.c CTA href 구성에 필요. */
  readonly itemId: string;
  readonly rank: number;
  readonly tariffSnapshotId: string;
  readonly monthlySavingCents: number;
  readonly yearlySavingCents: number;
  readonly monthlyAvg12Cents: number;
  readonly monthlyAvg24Cents: number;
  readonly monthlySaving24Cents: number;
  readonly caveats: string[];
  readonly activationFeeCents: number;
  /** 라운드 (a) — 결론 카드 1위 공급사/요금제명 + 신뢰도 배지 표면화. */
  readonly providerName: string;
  readonly tariffName: string;
  /** AffiliateDisclosureLine (PLAN 4.3.c) — getRateForProvider 인자. */
  readonly providerId: string;
  /** AffiliateDisclosureLine (PLAN 4.3.c) — 분기 키. */
  readonly affiliateStatus: AffiliateStatus;
  readonly confidence: Confidence;
}

// ─── 8. getResultItems (라운드 b, 비교 표 입력 — PLAN 3.2) ───────────────

/**
 * 한 result 의 모든 item 을 rank ASC 로 + tariff/provider/snapshot 컬럼 함께 fetch.
 *
 * 정렬/필터 (ADR-0021 §T4 SC-F)는 호출자 (compare-view.ts 순수 모듈) 가 in-memory
 * 적용. N=5 (또는 ≤ 20) 라서 SQL pushdown 대비 코드 단순성 우선.
 *
 * 빈 배열 = 후보 0건 (compare 결과 빈 ranked) — page 가 ResultConclusionCard 대체
 * 안내로 분기 (라운드 a).
 */
export interface ResultRowData {
  /** comparison_result_item.id — PLAN 4.1.c 비교 표 CTA href 구성에 필요. */
  readonly itemId: string;
  readonly rank: number;
  readonly tariffSnapshotId: string;
  /** provider.id — AffiliateDisclosureLine (PLAN 4.3.c) getRateForProvider 인자. */
  readonly providerId: string;
  readonly providerName: string;
  readonly providerSlug: string;
  /** provider.affiliate_status — AffiliateDisclosureLine (PLAN 4.3.c) 분기 키. */
  readonly affiliateStatus: AffiliateStatus;
  readonly tariffName: string;
  readonly tariffSlug: string;
  readonly category: TariffCategory;
  readonly monthlySavingCents: number;
  readonly yearlySavingCents: number;
  readonly monthlyAvg12Cents: number;
  readonly monthlyAvg24Cents: number;
  readonly monthlySaving24Cents: number;
  readonly monthlyPriceCents: number;
  readonly activationFeeCents: number;
  readonly modemRentalCents: number | null;
  readonly promoPriceCents: number | null;
  readonly promoMonths: number | null;
  readonly commitmentMonths: number;
  readonly attributes: Record<string, unknown>;
  readonly confidence: Confidence;
  readonly caveats: string[];
  readonly sourceUrl: string;
  readonly fetchedAt: Date;
}

// ResultRowRaw: ResultRowData 와 동일하되 attributes 는 unknown (Drizzle jsonb 추론)
type ResultRowRaw = Omit<ResultRowData, 'attributes'> & { attributes: unknown };

export async function getResultItems(
  resultId: string,
): Promise<ResultRowData[]> {
  const rows: ResultRowRaw[] = await db
    .select({
      itemId: comparisonResultItem.id,
      rank: comparisonResultItem.rank,
      tariffSnapshotId: comparisonResultItem.tariffSnapshotId,
      providerId: provider.id,
      providerName: provider.name,
      providerSlug: provider.slug,
      affiliateStatus: provider.affiliateStatus,
      tariffName: tariff.name,
      tariffSlug: tariff.slug,
      category: tariff.category,
      monthlySavingCents: comparisonResultItem.monthlySavingCents,
      yearlySavingCents: comparisonResultItem.yearlySavingCents,
      monthlyAvg12Cents: comparisonResultItem.monthlyAvg12Cents,
      monthlyAvg24Cents: comparisonResultItem.monthlyAvg24Cents,
      monthlySaving24Cents: comparisonResultItem.monthlySaving24Cents,
      monthlyPriceCents: tariffSnapshot.monthlyPriceCents,
      activationFeeCents: tariffSnapshot.activationFeeCents,
      modemRentalCents: tariffSnapshot.modemRentalCents,
      promoPriceCents: tariffSnapshot.promoPriceCents,
      promoMonths: tariffSnapshot.promoMonths,
      commitmentMonths: tariff.commitmentMonths,
      attributes: tariff.attributes,
      confidence: tariffSnapshot.confidence,
      caveats: comparisonResultItem.caveats,
      sourceUrl: tariffSnapshot.sourceUrl,
      fetchedAt: tariffSnapshot.fetchedAt,
    })
    .from(comparisonResultItem)
    .innerJoin(
      tariffSnapshot,
      eq(tariffSnapshot.id, comparisonResultItem.tariffSnapshotId),
    )
    .innerJoin(tariff, eq(tariff.id, tariffSnapshot.tariffId))
    .innerJoin(provider, eq(provider.id, tariff.providerId))
    .where(eq(comparisonResultItem.resultId, resultId))
    .orderBy(comparisonResultItem.rank);
  return rows.map((r) => ({
    ...r,
    attributes:
      r.attributes && typeof r.attributes === 'object' && !Array.isArray(r.attributes)
        ? (r.attributes as Record<string, unknown>)
        : {},
  }));
}

export async function getTopResultItem(
  resultId: string,
): Promise<TopResultItemRow | null> {
  const rows = await db
    .select({
      itemId: comparisonResultItem.id,
      rank: comparisonResultItem.rank,
      tariffSnapshotId: comparisonResultItem.tariffSnapshotId,
      monthlySavingCents: comparisonResultItem.monthlySavingCents,
      yearlySavingCents: comparisonResultItem.yearlySavingCents,
      monthlyAvg12Cents: comparisonResultItem.monthlyAvg12Cents,
      monthlyAvg24Cents: comparisonResultItem.monthlyAvg24Cents,
      monthlySaving24Cents: comparisonResultItem.monthlySaving24Cents,
      caveats: comparisonResultItem.caveats,
      activationFeeCents: tariffSnapshot.activationFeeCents,
      confidence: tariffSnapshot.confidence,
      providerName: provider.name,
      tariffName: tariff.name,
      providerId: provider.id,
      affiliateStatus: provider.affiliateStatus,
    })
    .from(comparisonResultItem)
    .innerJoin(
      tariffSnapshot,
      eq(tariffSnapshot.id, comparisonResultItem.tariffSnapshotId),
    )
    .innerJoin(tariff, eq(tariff.id, tariffSnapshot.tariffId))
    .innerJoin(provider, eq(provider.id, tariff.providerId))
    .where(
      and(
        eq(comparisonResultItem.resultId, resultId),
        eq(comparisonResultItem.rank, 1),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// ─── 내부 헬퍼 — Drizzle row → SnapshotJoinRow ────────────────────────────

/**
 * Drizzle `selectDistinctOn` 결과 row 의 jsonb 컬럼은 `unknown` 으로 추론된다.
 * `tariff.attributes` 는 schema 가 `default({})` notNull 이라 사실상 객체이지만,
 * 타입 시스템 차원에선 `unknown` → 명시 좁힘이 필요.
 */
type RawJoinRow = {
  snapshotId: string;
  providerSlug: string;
  tariffSlug: string;
  category: TariffCategory;
  monthlyPriceCents: number;
  activationFeeCents: number;
  modemRentalCents: number | null;
  promoPriceCents: number | null;
  promoMonths: number | null;
  commitmentMonths: number;
  earlyTerminationFeeCents: number | null;
  attributes: unknown;
  confidence: Confidence;
  confidenceReason: string | null;
  isAnomaly: boolean;
};

function narrowRow(row: RawJoinRow): SnapshotJoinRow {
  // attributes 가 객체가 아닌 경우 (이론상 불가, 방어) → 빈 객체.
  const attrs =
    row.attributes && typeof row.attributes === 'object' && !Array.isArray(row.attributes)
      ? (row.attributes as Record<string, unknown>)
      : {};
  return {
    snapshotId: row.snapshotId,
    providerSlug: row.providerSlug,
    tariffSlug: row.tariffSlug,
    category: row.category,
    monthlyPriceCents: row.monthlyPriceCents,
    activationFeeCents: row.activationFeeCents,
    modemRentalCents: row.modemRentalCents,
    promoPriceCents: row.promoPriceCents,
    promoMonths: row.promoMonths,
    commitmentMonths: row.commitmentMonths,
    earlyTerminationFeeCents: row.earlyTerminationFeeCents,
    attributes: attrs,
    confidence: row.confidence,
    confidenceReason: row.confidenceReason,
    isAnomaly: row.isAnomaly,
  };
}
