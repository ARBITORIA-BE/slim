/**
 * computeConfidence — 표준 신뢰도 휴리스틱 (PLAN 1.8, ADR-0008 §T3)
 *
 * 왜 이 함수가 필요한가?
 *   각 fetcher가 confidence를 자체 판단하면 3개 fetcher의 기준이 달라진다.
 *   사용자가 보는 "신뢰도" 색상(녹/황/적)의 의미가 fetcher마다 달라지면 P3 위반.
 *   표준 휴리스틱이 *floor* 역할 — fetcher는 down-grade만 할 수 있다 (up-grade 금지).
 *
 * 결정 근거: docs/adr/0008-fetcher-interface-and-cron.md §T3
 *
 * harness:data Rule 1: 본 파일은 fetcher가 올바른 FetchResult를 반환하도록 돕는
 * 도우미다. FetchResult 타입 출처: src/fetchers/types.ts
 *
 * down-grade only 원칙:
 *   computeConfidence가 'high'를 반환해도 fetcher가 'low'로 override 가능.
 *   그 반대(computeConfidence가 'low' → fetcher가 'high'로 override)는 금지.
 *   → 스텁 fetcher는 항상 confidence='low' 반환이 정직하다.
 */

import type { Confidence } from '@/db/schema/tariff_snapshot';

// ─── Input / Output 타입 ──────────────────────────────────────────────────

/**
 * computeConfidence 입력.
 *
 * selectorMatched: 셀렉터가 예상대로 정확히 1건 매칭됐는가.
 *   false면 즉시 'low' — 값 자체를 신뢰할 수 없다는 신호.
 *
 * sanityChecks: { passed: boolean; reason?: string }[].
 *   각 sanity check 결과. 하나라도 false면 최소 'low'.
 *   (가격 0/음수, €1,000/월 초과 = 통신 BE에서 비현실 등)
 *
 * parseWarnings: string[].
 *   파싱 과정에서 발생한 경고 메시지. 0건이면 최고 신뢰, 1건 이상이면 'medium'.
 */
export interface ConfidenceInput {
  /** CSS 셀렉터 또는 API 파싱이 예상한 요소를 정확히 찾았는가. */
  selectorMatched: boolean;
  /** Sanity check 결과 목록. 하나라도 실패하면 'low'. */
  sanityChecks: ReadonlyArray<{ passed: boolean; reason?: string }>;
  /** 파싱 경고 목록. 1건 이상이면 최대 'medium'. */
  parseWarnings: ReadonlyArray<string>;
}

export interface ConfidenceResult {
  /** 계산된 신뢰도. */
  confidence: Confidence;
  /**
   * 신뢰도 결정 근거 — 운영자 자가 진단용.
   * ADR-0001의 excluded_reason + ADR-0006의 confidence_reason 패턴과 일관.
   */
  reason: string;
}

// ─── 휴리스틱 상수 (ADR-0008 §T3 기반) ──────────────────────────────────

/**
 * 통신 BE에서 월 €1,000(=100,000 cents)은 비현실적인 상한.
 * Proximus / Telenet 최고가 요금제도 €100/월 미만. 이 값 초과 = parse 오류 의심.
 *
 * 왜 100,000인가?
 *   ADR-0008 §T3: "monthlyPriceCents > 100,000 (€1,000/월 초과 — 통신 BE에서 비현실)"
 *   → sanity check에서 fetcher가 이 값을 확인하도록 가이드.
 */
export const SANITY_MAX_MONTHLY_CENTS = 100_000;

/**
 * 월 가격 sanity check helper.
 *
 * 왜 helper로 추출했는가?
 *   각 fetcher가 중복으로 구현하면 임계값 변경 시 3곳 수정 필요.
 *   단일 함수가 단일 출처.
 */
export function checkMonthlySanity(monthlyPriceCents: number): {
  passed: boolean;
  reason?: string;
} {
  if (monthlyPriceCents <= 0) {
    return {
      passed: false,
      reason: `non-positive price: ${monthlyPriceCents} cents`,
    };
  }
  if (monthlyPriceCents > SANITY_MAX_MONTHLY_CENTS) {
    return {
      passed: false,
      reason: `unrealistic price: ${monthlyPriceCents} cents > max ${SANITY_MAX_MONTHLY_CENTS}`,
    };
  }
  return { passed: true };
}

// ─── 핵심 함수 ────────────────────────────────────────────────────────────

/**
 * 표준 신뢰도 휴리스틱.
 *
 * 결정 로직 (ADR-0008 §T3):
 *   1. selectorMatched=false → 즉시 'low' (셀렉터가 깨진 상태)
 *   2. sanityChecks에서 하나라도 passed=false → 즉시 'low'
 *   3. parseWarnings.length > 0 → 'medium' (파싱은 됐지만 경고 있음)
 *   4. 위 조건 모두 통과 → 'high'
 *
 * fetcher 사용 패턴 (down-grade only):
 *   const base = computeConfidence({ selectorMatched, sanityChecks, parseWarnings });
 *   // fetcher가 추가 down-grade 이유가 있으면:
 *   const confidence = fetcherKnowsMoreProblems ? 'low' : base.confidence;
 *   // up-grade는 금지 — base.confidence='low'를 'medium'으로 올릴 수 없음
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const { selectorMatched, sanityChecks, parseWarnings } = input;

  // 1. 셀렉터 불일치 → 즉시 low
  if (!selectorMatched) {
    return {
      confidence: 'low',
      reason: 'selector did not match; price value unreliable',
    };
  }

  // 2. Sanity check 실패 → 즉시 low
  const failedChecks = sanityChecks.filter((c) => !c.passed);
  if (failedChecks.length > 0) {
    const reasons = failedChecks
      .map((c) => c.reason ?? 'unknown sanity failure')
      .join('; ');
    return {
      confidence: 'low',
      reason: `sanity check failed: ${reasons}`,
    };
  }

  // 3. 경고 있음 → medium
  if (parseWarnings.length > 0) {
    return {
      confidence: 'medium',
      reason: `parse warnings: ${parseWarnings.join('; ')}`,
    };
  }

  // 4. 모두 통과 → high
  return {
    confidence: 'high',
    reason: 'selector matched; all sanity checks passed; no parse warnings',
  };
}
