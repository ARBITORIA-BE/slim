/**
 * comparison-helpers — `/api/compare` 풀 흐름의 DB-free 순수 변환 (Sub-task 5).
 *
 * 분리 이유 (providers-helpers.ts 동형):
 *   - vitest 가 `@/db` (DATABASE_URL throw) import 없이 단위 테스트 가능
 *   - snapshotRowToTariffLike = Drizzle select row → 비교 엔진 입력 1:1 매핑
 *   - buildLockedInputs = ADR-0007 §T9 봉인 직렬화의 단일 출처
 *
 * 결정 근거:
 *   - docs/adr/0021-phase-3-results-page-design.md §T3 (lockedInputs 모양)
 *   - docs/adr/0007-comparison-request-result-schema.md §T9 (90일 NULL 정책)
 */

import type { TariffCategory } from '@/db/schema/tariff';
import type { Confidence } from '@/db/schema/tariff_snapshot';
import type { TariffSnapshotLike, UsageProfile } from '@/engine/types';
import type {
  HouseholdTypeInput,
  PostalCountry,
} from '@/types/comparison-input';

// ─── DB row 모양 (comparison.ts select shape 의 단일 출처) ─────────────────

/**
 * `/api/compare` 후보 SELECT 의 한 행. tariff_snapshot + tariff + provider 3단
 * JOIN 의 select shape. 컬럼은 비교 엔진 입력에 *최소 충분* 만 — pricePayload /
 * rawPayload 등 비교에 불필요한 JSONB 는 제외 (Neon row 전송량 절감).
 */
export interface SnapshotJoinRow {
  readonly snapshotId: string;
  readonly providerSlug: string;
  readonly tariffSlug: string;
  readonly category: TariffCategory;
  readonly monthlyPriceCents: number;
  readonly activationFeeCents: number;
  readonly modemRentalCents: number | null;
  readonly promoPriceCents: number | null;
  readonly promoMonths: number | null;
  readonly commitmentMonths: number;
  readonly earlyTerminationFeeCents: number | null;
  readonly attributes: Record<string, unknown>;
  readonly confidence: Confidence;
  readonly confidenceReason: string | null;
  readonly isAnomaly: boolean;
}

/**
 * SnapshotJoinRow → TariffSnapshotLike (비교 엔진 입력) 어댑터.
 * compare() 의 readonly 입력 정신 + DB row 의 mutable inferSelect 사이의 단일 변환점.
 */
export function snapshotRowToTariffLike(
  row: SnapshotJoinRow,
): TariffSnapshotLike {
  return {
    id: row.snapshotId,
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
    attributes: row.attributes,
    confidence: row.confidence,
    confidenceReason: row.confidenceReason,
    isAnomaly: row.isAnomaly,
  };
}

// ─── lockedInputs 직렬화 (ADR-0007 §T9) ────────────────────────────────────

export interface BuildLockedInputsArgs {
  readonly postalCountry: PostalCountry;
  readonly postalCode: string;
  readonly householdType: HouseholdTypeInput;
  readonly currentProviderId: string | null;
  readonly currentTariffId: string | null;
  readonly inputAttributes: Readonly<Record<string, unknown>>;
  readonly usageProfile: UsageProfile;
  readonly estimatorVersion: string;
}

/**
 * comparison_result.locked_inputs JSONB 의 단일 직렬화 함수.
 *
 * 키 = ADR-0007 §T9 권장 + sub-task 5 추가 (postal_country / current_tariff_id /
 * assumptions). 90일 후 1.5.2 cron 이 본 객체 통째 NULL 화 — 결과 자체는 영구.
 */
export function buildLockedInputs(
  args: BuildLockedInputsArgs,
): Record<string, unknown> {
  return {
    postal_country: args.postalCountry,
    postal_code: args.postalCode,
    household_type: args.householdType,
    current_provider_id: args.currentProviderId,
    current_tariff_id: args.currentTariffId,
    input_attributes: args.inputAttributes,
    assumptions: {
      usage_profile: args.usageProfile,
      estimator_version: args.estimatorVersion,
    },
  };
}
