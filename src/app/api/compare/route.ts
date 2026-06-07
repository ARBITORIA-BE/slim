/**
 * POST /api/compare — 풀 흐름 (Sub-task 5, ADR-0021 §T3).
 *
 * 흐름 (전체를 5초 race 안에서):
 *   1. JSON parse + Zod safeParse (클라이언트 우회 방어 — ADR-0016 §T7)
 *   2. comparison_request INSERT — postalCountry 는 inputAttributes 안에 봉인
 *   3. tariff_snapshot 후보 SELECT (DISTINCT ON, p.country = postal.country)
 *   4. currentTariffId 명시 시 baseline SELECT (병렬)
 *   5. deriveUsageProfile + compare() 호출
 *   6. shortId = nanoid(12) + comparison_result + items INSERT
 *   7. { ok: true, shortId } 반환 (클라이언트는 redirect 만)
 *
 * 5초 timeout 초과 → 504 (orphan request row 가능성, ADR-0021 §T3 "부분 실패 시
 * 분석 가치" 정합).
 *
 * 결정 근거:
 *   - docs/adr/0021-phase-3-results-page-design.md §T3 (풀 흐름 7단계)
 *   - docs/adr/0007-comparison-request-result-schema.md §T9/§T10 (lockedInputs / timeout)
 *   - docs/adr/0010-comparison-engine.md (compare() 시그니처)
 */

import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';

import {
  getCandidateSnapshots,
  getCurrentTariffSnapshot,
  insertComparisonRequest,
  insertComparisonResult,
  insertComparisonResultItems,
} from '@/db/queries/comparison';
import {
  buildLockedInputs,
  snapshotRowToTariffLike,
} from '@/db/queries/comparison-helpers';
import { compare, ENGINE_VERSION } from '@/engine/compare';
import {
  USAGE_ESTIMATOR_VERSION,
  deriveUsageProfile,
} from '@/engine/usage-estimator';
import { TimeoutError, withTimeout } from '@/lib/with-timeout';
import {
  comparisonInputSchema,
  type ComparisonInput,
} from '@/types/comparison-input';

const TIMEOUT_MS = 5000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const parsed = comparisonInputSchema.safeParse(body);
  if (!parsed.success) {
    // ADR-0036 D1: expose only { message (= key token), path } — no Korean text.
    // message is now a locale-free key (e.g. "validation.postal.be").
    // Client can call t(message) to render in the user's locale.
    const issues = parsed.error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path,
    }));
    return NextResponse.json(
      { ok: false, error: 'Validation failed', issues },
      { status: 400 },
    );
  }

  try {
    const shortId = await withTimeout(
      runCompareFlow(parsed.data),
      TIMEOUT_MS,
      'POST /api/compare',
    );
    return NextResponse.json({ ok: true, shortId });
  } catch (e) {
    if (e instanceof TimeoutError) {
      return NextResponse.json(
        { ok: false, error: e.message },
        { status: 504 },
      );
    }
    const message = e instanceof Error ? e.message : 'unknown error';
    // 운영자 자가 진단 — Sentry 알림 통합은 페이즈 4.5.2 진입 시.
    console.error('[/api/compare] internal error:', message);
    return NextResponse.json(
      { ok: false, error: 'Internal error' },
      { status: 500 },
    );
  }
}

async function runCompareFlow(input: ComparisonInput): Promise<string> {
  const {
    category,
    postal,
    householdType,
    currentProviderId,
    currentTariffId,
    inputAttributes,
  } = input;

  // ADR-0043: postal optional — 통신 카테고리는 postal 없이 비교 가능.
  // postalCode = null (DB 컬럼 nullable 보존), country = postal?.country ?? 'BE'.
  // 'BE' fallback: 현 단계 통신 fetcher 는 BE 전용 (ADR-0034 D2, 페이즈 5 이전).
  // 페이즈 5 NL/LU 진입 시 country fallback 제거 + postal 필드 재활성 → 별 ADR.
  const postalCountry = postal?.country ?? 'BE';
  const postalCode = postal?.postalCode ?? null;

  // 2. comparison_request INSERT — postalCountry 는 input_attributes 안에 봉인
  //    (스키마 컬럼 신설 회피, ADR-0021 §T10 호환).
  const storedInputAttributes: Record<string, unknown> = {
    ...inputAttributes,
    postalCountry,
  };
  const { id: requestId } = await insertComparisonRequest({
    category,
    postalCode,
    householdType,
    currentProviderId,
    inputAttributes: storedInputAttributes,
  });

  // 3 + 4. 후보 + 현재 요금제 병렬 SELECT
  const [candidateRows, currentRow] = await Promise.all([
    getCandidateSnapshots(category, postalCountry),
    currentTariffId
      ? getCurrentTariffSnapshot(currentTariffId)
      : Promise.resolve(null),
  ]);

  const candidates = candidateRows.map(snapshotRowToTariffLike);
  const currentTariff = currentRow ? snapshotRowToTariffLike(currentRow) : null;

  // 5. usage profile + compare()
  const usageProfile = deriveUsageProfile(
    category,
    householdType,
    inputAttributes,
  );
  const result = compare({
    category,
    currentTariff,
    usageProfile,
    candidates,
  });

  // 6. shortId + result + items INSERT
  const shortId = nanoid(12);
  const lockedInputs = buildLockedInputs({
    postalCountry,
    postalCode,
    householdType,
    currentProviderId,
    currentTariffId,
    inputAttributes,
    usageProfile,
    estimatorVersion: USAGE_ESTIMATOR_VERSION,
  });
  const topTariffSnapshotId = result.ranked[0]?.tariffSnapshotId ?? null;

  const { id: resultId } = await insertComparisonResult({
    requestId,
    shortId,
    topMonthlySavingCents: result.topMonthlySavingCents,
    topYearlySavingCents: result.topYearlySavingCents,
    topTariffSnapshotId,
    lockedInputs,
    engineVersion: ENGINE_VERSION,
  });

  await insertComparisonResultItems(
    result.ranked.map((item) => ({
      resultId,
      rank: item.rank,
      tariffSnapshotId: item.tariffSnapshotId,
      monthlySavingCents: item.monthlySavingCents,
      yearlySavingCents: item.yearlySavingCents,
      monthlyAvg12Cents: item.breakdown.monthlyAvg12Cents,
      monthlyAvg24Cents: item.breakdown.monthlyAvg24Cents,
      monthlySaving24Cents: item.breakdown.monthlySaving24Cents,
      caveats: item.caveats,
    })),
  );

  return shortId;
}
