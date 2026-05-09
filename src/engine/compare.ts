/**
 * compare — 절약액 비교 엔진 (PLAN 1.11)
 *
 * 결정 근거: docs/adr/0010-comparison-engine.md
 *
 * 핵심 원칙:
 *   T1. 카테고리 동일 후보만 비교 (혼합 X — P1 정보 우선)
 *   T2. 사용량은 추천성/caveat 트리거만, 가격 가공 X (헌법 §8 #2)
 *   T3. 12개월 + 24개월 두 시나리오 동시 계산 (breakdown 보존)
 *   T4. 활성화 비용은 12개월 amortize (1차 표시 단위), 위약금은 caveat
 *   T5. confidence 전파 = min(현재, 후보) 보수적 + low/anomaly 입력 단계 제외
 *   T6. caveats 자동 생성은 deriveCaveats() 순수 함수 (T6 규칙 매트릭스)
 *
 * 타입 안전:
 *   - 모든 가격 산술은 정수 cents (number) — ±0.01€ DoD 수학적 보장
 *   - noUncheckedIndexedAccess / exactOptionalPropertyTypes 친화
 *   - candidates는 readonly array — 입력 변형 X (순수 함수)
 *
 * P1 (정보 우선) — engineVersion 하드코딩으로 영구 링크 재현성 보장.
 */

import type { TariffCategory } from '@/db/schema/tariff';
import type { Confidence } from '@/db/schema/tariff_snapshot';
import { deriveCaveats } from './caveats';
import type { TariffSnapshotLike, UsageProfile } from './types';

// ─── Engine version (ADR-0010) ────────────────────────────────────────────

/**
 * 비교 엔진 버전. ADR-0007 §comparison_result.engineVersion 컬럼이 이 값을 기록.
 *
 * 왜 하드코딩인가?
 *   영구 링크(/r/[shortId]) 의 결과가 어느 버전 엔진이 계산한 것인지 영구
 *   추적 가능해야 함. package.json version 과 분리 — 엔진 자체의 산식이
 *   변경된 시점만 변경 (ADR-0010 §"Engine version 정책" 트리거).
 */
export const ENGINE_VERSION = 'compare@2026-05-09' as const;

// ─── 입출력 타입 ──────────────────────────────────────────────────────────

/**
 * compare() 입력.
 *
 * 왜 currentTariff가 nullable인가?
 *   PLAN 2.4 "현재 공급사/요금제 (선택적, 모르면 스킵)" — 신규 가입자는 비교
 *   대상 현재 요금제가 없다. null 시 monthlySaving = -monthlyAvg12 (signed) 로
 *   absolute monthly cost 자체가 1차 표시. caveat: "신규 가입자".
 */
export interface CompareInput {
  readonly category: TariffCategory;
  readonly currentTariff: TariffSnapshotLike | null;
  readonly usageProfile: UsageProfile;
  readonly candidates: readonly TariffSnapshotLike[];
}

/**
 * compare() 출력. ADR-0007 comparison_result + comparison_result_item 의
 * insert payload 와 1:1 매핑.
 */
export interface CompareResult {
  readonly engineVersion: typeof ENGINE_VERSION;
  /** 정렬된 비교 항목 (rank 1 = 가장 절약). 빈 배열 = 비교 가능 후보 0. */
  readonly ranked: readonly ComparisonItem[];
  /** 1위 항목의 monthlySavingCents (UI 결론 카드 직접 표시 — PLAN 3.1). */
  readonly topMonthlySavingCents: number | null;
  /** 1위 항목의 yearlySavingCents. */
  readonly topYearlySavingCents: number | null;
  /** 결과 생성 시각 (ISO 8601). engineVersion 과 함께 재현성 보존. */
  readonly generatedAt: string;
  /**
   * 결과 메타 — UI 노출 (PLAN 1.10 / 3.4 제외 공급사) 또는 디버깅용.
   * P3 투명성 강제: 입력 후보 중 *왜 N개만 비교됐는지* 사용자에게 노출 가능.
   */
  readonly meta: ComparisonMeta;
}

/**
 * 한 candidate 의 비교 결과. ADR-0007 comparison_result_item 행과 매핑.
 *
 * 왜 breakdown 이 별도 객체인가?
 *   PLAN 3.5 "계산 근거 펼치기" 가 12개월 + 24개월 두 시나리오를 모두 노출
 *   해야 함. monthlySavingCents 는 1차 표시 (12개월 평균), breakdown 은 펼침
 *   영역. 둘을 같은 평탄 스칼라로 두면 UI 가 "어느 게 1차?" 매번 결정.
 */
export interface ComparisonItem {
  readonly tariffSnapshotId: string;
  readonly rank: number; // 1-indexed
  /** 12개월 평균 기준 월 절약액 (cents, signed). 음수 = 더 비쌈. */
  readonly monthlySavingCents: number;
  /** monthlySavingCents × 12 (UI 결론 카드 단일 단위 변환 출처). */
  readonly yearlySavingCents: number;
  readonly confidence: Confidence;
  readonly caveats: readonly string[];
  readonly breakdown: ComparisonBreakdown;
}

/**
 * 계산 근거 — PLAN 3.5 펼침 영역의 입력. ADR-0006 §T2 평탄화 5컬럼 보존
 * 정신과 일관: 평균값 + 12/24 시나리오를 모두 보존.
 */
export interface ComparisonBreakdown {
  /** 12개월 평균 월비용 (cents). currentTariff 와 비교 시 1차 단위. */
  readonly monthlyAvg12Cents: number;
  /** 24개월 평균 월비용 (cents). 약정 후 시나리오. */
  readonly monthlyAvg24Cents: number;
  /** 12개월 시나리오 월 절약액 (= monthlySavingCents). */
  readonly monthlySaving12Cents: number;
  /** 24개월 시나리오 월 절약액. */
  readonly monthlySaving24Cents: number;
  /** 활성화 비용 (cents). 12개월 amortize 의 입력. */
  readonly activationFeeCents: number;
  /** 모뎀 임대 (cents/월). null = 모뎀 임대 개념 없음 (모바일). */
  readonly modemRentalCents: number | null;
  /** 프로모 가격 (cents). null = 프로모 없음. */
  readonly promoPriceCents: number | null;
  /** 프로모 지속 개월. null = 프로모 없음. */
  readonly promoMonths: number | null;
}

/**
 * 비교 메타 — 결과 페이지 / data-sources 에 노출. P3 투명성.
 *
 * 왜 excludedCount 가 여러 카운트로 분리되어 있는가?
 *   사용자가 "왜 후보 5개 중 2개만?" 을 묻을 때 "1개는 카테고리 다름,
 *   1개는 데이터 신뢰도 부족" 처럼 정직하게 답할 수 있어야 한다 (P3).
 */
export interface ComparisonMeta {
  /** 입력 candidates.length. */
  readonly inputCount: number;
  /** 비교에 포함된 후보 수 (= ranked.length). */
  readonly comparedCount: number;
  /** category 미스매치로 제외된 후보 수 (T1). */
  readonly excludedByCategory: number;
  /** confidence='low' 또는 isAnomaly로 제외된 후보 수 (T5 + ADR-0006 §T5). */
  readonly excludedByConfidence: number;
  /** 동일 tariffSlug 자기 비교 제외 (currentTariff 가 candidates 에도 있을 때). */
  readonly excludedBySelfReference: number;
}

// ─── 산술 helper (정수 cents — ±0.01€ DoD 보장) ──────────────────────────

/**
 * 12개월 또는 24개월 평균 월비용 (cents 정수).
 *
 * 왜 Math.round 인가?
 *   total / months 는 일반적으로 정수가 아니다 (예: €25 × 6 + €15 × 6 + €30
 *   activation = 24,030 cents / 12 = 2,002.5 → 2003 cents 표시).
 *   Math.round 가 사용자가 보는 1 cent 단위와 정합. Math.floor 는 €X.99 →
 *   €X.98 처럼 *유리한 쪽으로* 거짓 절약을 만들 수 있음 — 거부.
 *
 * 왜 cents 정수만 반환하는가?
 *   ADR-0005 §T2 — 부동소수 오차 0. 12 케이스 ±0.01€ DoD = ±0 cent.
 */
function avgMonthlyCents(
  candidate: TariffSnapshotLike,
  totalMonths: number,
): number {
  // 왜 promoCents 는 monthlyPriceCents 로 fallback 인가?
  //   promoPriceCents=null 은 "프로모 없음" 을 의미. promoMonths 가 null/0 이면
  //   곱셈 0 으로 자연 무시되지만, 명시적 fallback 이 의도를 코드에 새긴다.
  const promoPriceCents = candidate.promoPriceCents ?? candidate.monthlyPriceCents;
  const promoMonths = candidate.promoMonths ?? 0;

  // 프로모 적용 개월 — totalMonths 안에서만 (24개월 약정 + 6개월 프로모 = 6 + 18)
  // 왜 Math.min 인가?
  //   promoMonths 가 36 인데 totalMonths=12 이면 12개월 동안만 프로모 적용.
  //   12개월 평균 시나리오에서 36개월 프로모를 다 반영하면 거짓 절약.
  const promoAppliedMonths = Math.min(promoMonths, totalMonths);
  const normalAppliedMonths = Math.max(0, totalMonths - promoAppliedMonths);

  // 모뎀 임대는 매월 — null = 0 (모바일 등 모뎀 개념 없음)
  const modemRentalCents = candidate.modemRentalCents ?? 0;

  // 총 비용 (cents) — 모든 곱셈/덧셈은 정수 → 부동소수 오차 0
  const totalCents =
    promoPriceCents * promoAppliedMonths +
    candidate.monthlyPriceCents * normalAppliedMonths +
    candidate.activationFeeCents + // 1회성 — totalMonths 로 amortize
    modemRentalCents * totalMonths;

  // 평균 월비용 (cents 정수) — Math.round 는 €0.005 단위 표시 정합
  return Math.round(totalCents / totalMonths);
}

/**
 * 두 confidence 값 중 더 보수적인 (낮은) 쪽.
 *
 * 왜 null 처리가 따로 있는가?
 *   currentTariff 가 null (신규 가입자) 이면 candidate 의 신뢰도가 결과를
 *   결정. min 이 정의되지 않으므로 null 케이스 분리.
 */
function combineConfidence(
  current: Confidence | null,
  candidate: Confidence,
): Confidence {
  if (!current) return candidate;
  // 왜 정렬에 객체 lookup 인가?
  //   enum 타입은 string union. 직접 비교 (current < candidate) 는 알파벳 순.
  //   high/medium/low 의 의미적 순서 (high > medium > low) 는 매핑 필요.
  const order: Record<Confidence, number> = { high: 2, medium: 1, low: 0 };
  return order[current] <= order[candidate] ? current : candidate;
}

// ─── 메인 함수 (순수) ─────────────────────────────────────────────────────

/**
 * 비교 엔진 진입점. 순수 함수 — 입력 동일하면 출력 동일.
 *
 * 단계:
 *   1. 카테고리 미스매치 후보 제외 (T1)
 *   2. confidence='low' 또는 isAnomaly 후보 제외 (T5 + ADR-0006 §T5)
 *   3. 자기 참조 후보 제외 (currentTariff 슬러그와 동일)
 *   4. 각 candidate 에 대해 monthlyAvg12 / 24 계산 (T3)
 *   5. monthlySaving 계산 (currentTariff null 시 -monthlyAvg12 = signed)
 *   6. caveats 생성 (T6 deriveCaveats)
 *   7. monthlySaving 내림차순 정렬 → rank 부여
 *   8. CompareResult 빌드
 */
export function compare(input: CompareInput): CompareResult {
  const { category, currentTariff, usageProfile, candidates } = input;
  const generatedAt = new Date().toISOString();

  let excludedByCategory = 0;
  let excludedByConfidence = 0;
  let excludedBySelfReference = 0;

  // ─── 단계 1~3: 입력 단계 필터 ────────────────────────────────────────────
  // 왜 한 번의 reduce/filter chain 인가?
  //   각 제외 사유를 카운트해 ComparisonMeta 에 노출 (P3 투명성).
  const eligible: TariffSnapshotLike[] = [];
  for (const c of candidates) {
    // 1. 카테고리 미스매치 (T1)
    if (c.category !== category) {
      excludedByCategory += 1;
      continue;
    }
    // 2. 신뢰도/이상치 (T5 + ADR-0006 §T5)
    //    왜 두 조건을 OR 인가?
    //      ADR-0006 §T5 비교 엔진 차단 SQL: WHERE NOT is_anomaly AND confidence != 'low'
    //      두 조건 중 하나라도 위반하면 제외 — 데이터 무결성 (P1).
    if (c.confidence === 'low' || c.isAnomaly) {
      excludedByConfidence += 1;
      continue;
    }
    // 3. 자기 참조 (currentTariff 가 candidates 에 포함)
    //    왜 tariffSlug + providerSlug 합산으로 비교?
    //      ADR-0005 §T1 unique key = (providerId, slug). slug 만으로는 다른
    //      provider 의 동일 slug 와 충돌 가능 (예: 'mobile-essential').
    if (
      currentTariff &&
      c.providerSlug === currentTariff.providerSlug &&
      c.tariffSlug === currentTariff.tariffSlug
    ) {
      excludedBySelfReference += 1;
      continue;
    }
    eligible.push(c);
  }

  // ─── 단계 4~6: 각 candidate 산술 + caveats ──────────────────────────────
  //
  // 왜 currentTariff 의 monthlyAvg 도 12개월 시나리오로 계산하는가?
  //   currentTariff 가 프로모 / 활성화 비용을 가지면 비교가 *공정* 하려면
  //   동일 amortize 단위로 계산해야 한다. 단순 monthlyPriceCents 비교는
  //   currentTariff 가 첫 6개월 프로모 중일 때 거짓 절약 → 정직성 위반.
  const currentMonthlyAvg12Cents = currentTariff
    ? avgMonthlyCents(currentTariff, 12)
    : null;

  // 왜 미정렬 array 를 먼저 만들고 정렬하는가?
  //   정렬 전 monthlySaving 을 한 번만 계산. 정렬 비교 함수 안에서 재계산하면
  //   O(N log N) × 2 — 비효율.
  type Pre = Omit<ComparisonItem, 'rank'>;
  const preItems: Pre[] = eligible.map((c) => {
    const monthlyAvg12Cents = avgMonthlyCents(c, 12);
    const monthlyAvg24Cents = avgMonthlyCents(c, 24);

    // 왜 currentTariff null 시 saving = -monthlyAvg 인가?
    //   ADR-0010 §T7 케이스 5/6: 신규 가입자는 "절약" 이 정의되지 않음.
    //   대신 absolute monthly cost 자체를 1차 단위로. signed 변환으로 두면
    //   정렬 (내림차순) 이 자동으로 *저렴한 순* 으로 동작.
    //   예: candidate1 €15 → -1500, candidate2 €20 → -2000. -1500 > -2000 →
    //   €15 가 1위 (저렴한 게 위로).
    const monthlySaving12Cents = currentMonthlyAvg12Cents
      ? currentMonthlyAvg12Cents - monthlyAvg12Cents
      : -monthlyAvg12Cents;
    const monthlySaving24Cents = currentMonthlyAvg12Cents
      ? // 24개월 시나리오에서도 currentTariff 12개월 평균 사용 — 사용자의 "현재"
        // 는 변하지 않으므로 동일 기준. 24 시나리오의 다른 점은 candidate side.
        currentMonthlyAvg12Cents - monthlyAvg24Cents
      : -monthlyAvg24Cents;

    // 왜 yearlySaving = monthlySaving × 12 인가?
    //   ADR-0010 §T3: 12개월 시나리오의 연간 합. 단일 변환 출처.
    //   3.1 결론 카드 + 3.5 계산 근거 펼치기 모두 이 값을 그대로 사용.
    const yearlySavingCents = monthlySaving12Cents * 12;

    const confidence = combineConfidence(
      currentTariff?.confidence ?? null,
      c.confidence,
    );

    const caveats = deriveCaveats({
      candidate: c,
      currentTariff,
      usageProfile,
    });

    const breakdown: ComparisonBreakdown = {
      monthlyAvg12Cents,
      monthlyAvg24Cents,
      monthlySaving12Cents,
      monthlySaving24Cents,
      activationFeeCents: c.activationFeeCents,
      modemRentalCents: c.modemRentalCents,
      promoPriceCents: c.promoPriceCents,
      promoMonths: c.promoMonths,
    };

    return {
      tariffSnapshotId: c.id,
      monthlySavingCents: monthlySaving12Cents,
      yearlySavingCents,
      confidence,
      caveats,
      breakdown,
    };
  });

  // ─── 단계 7: 정렬 + rank 부여 ────────────────────────────────────────────
  //
  // 왜 monthlySavingCents 내림차순?
  //   양수 = 절약, 음수 = 더 비쌈. 큰 순서 = 사용자에게 가장 유리한 순.
  //   currentTariff null 시 -monthlyAvg → 음수가 더 큰 (작은 절댓값) 게 1위
  //   = 저렴한 candidate 이 1위. 정렬 의미가 일관.
  //
  // 왜 안정 정렬에 의존하지 않는가?
  //   동률 (절약액 동일) 케이스에 대한 결정적 순서 보장 — 같은 입력이 항상
  //   같은 결과. tariffSnapshotId 보조 키 (오름차순) 로 tie-break.
  const sorted = [...preItems].sort((a, b) => {
    if (b.monthlySavingCents !== a.monthlySavingCents) {
      return b.monthlySavingCents - a.monthlySavingCents;
    }
    return a.tariffSnapshotId.localeCompare(b.tariffSnapshotId);
  });

  const ranked: ComparisonItem[] = sorted.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  // 왜 ranked[0] 안전 접근에 ?? null 인가?
  //   noUncheckedIndexedAccess 하에서 ranked[0] 는 ComparisonItem | undefined.
  //   빈 배열 (모든 후보 제외) 시 undefined → null 명시 변환.
  const top = ranked[0] ?? null;

  return {
    engineVersion: ENGINE_VERSION,
    ranked,
    topMonthlySavingCents: top?.monthlySavingCents ?? null,
    topYearlySavingCents: top?.yearlySavingCents ?? null,
    generatedAt,
    meta: {
      inputCount: candidates.length,
      comparedCount: ranked.length,
      excludedByCategory,
      excludedByConfidence,
      excludedBySelfReference,
    },
  };
}

// 외부에서 helper 를 직접 테스트 가능하도록 export (테스트 + 디버깅용).
// 운영 코드에서는 compare() 만 사용 권장.
export { avgMonthlyCents, combineConfidence };
