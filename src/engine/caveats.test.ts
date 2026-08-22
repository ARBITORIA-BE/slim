/**
 * deriveCaveats 단위 테스트 (PLAN 1.5.6.1).
 *
 * 검증 범위:
 *   규칙 1~8: 기존 8규칙 대표 케이스 (회귀 방지)
 *   규칙 9  : ADR-0013 Amendment 1 — isStub 트리거 케이스 2건
 *     9a. isStub === true  → caveat 1건 추가 ("추정값 — 실 데이터 페이즈 5 이후")
 *     9b. isStub === false → 규칙 9 트리거 X
 *     9c. isStub 미전달 (기본) → 규칙 9 트리거 X
 */

import { describe, expect, it } from 'vitest';

import { parseCaveat } from './caveat-codes';
import { deriveCaveats } from './caveats';
import type { DeriveCaveatsInput } from './caveats';
import type { TariffSnapshotLike, UsageProfile } from './types';

// ─── 픽스처 ──────────────────────────────────────────────────────────────

function makeSnapshot(
  override: Partial<TariffSnapshotLike> & {
    id: string;
    providerSlug: string;
    tariffSlug: string;
  },
): TariffSnapshotLike {
  return {
    category: 'mobile',
    monthlyPriceCents: 2500,
    activationFeeCents: 0,
    modemRentalCents: null,
    promoPriceCents: null,
    promoMonths: null,
    commitmentMonths: 0,
    earlyTerminationFeeCents: null,
    attributes: {},
    confidence: 'high',
    confidenceReason: null,
    isAnomaly: false,
    ...override,
  };
}

const BASE_USAGE: UsageProfile = {
  data_gb_used: 5,
  streaming_4k: false,
  voice_minutes_used: 200,
};

function makeInput(
  candidateOverride: Partial<TariffSnapshotLike> = {},
  extra: Partial<DeriveCaveatsInput> = {},
): DeriveCaveatsInput {
  return {
    candidate: makeSnapshot({
      id: 'cand-1',
      providerSlug: 'test-provider',
      tariffSlug: 'test-tariff',
      ...candidateOverride,
    }),
    currentTariff: null,
    usageProfile: BASE_USAGE,
    ...extra,
  };
}

// ─── helper: 직렬화된 caveat → 코드/파라미터 (PLAN 4.28) ─────────────────
//
// 엔진은 더 이상 문장을 만들지 않는다. 테스트도 문장이 아니라 *코드* 를 단언한다 —
// 이전 방식(한국어 substring)은 "엔진이 한국어를 만든다"는 잘못된 전제를 고정시켰다.

function codes(result: readonly string[]): string[] {
  return result.map((raw) => parseCaveat(raw)?.code ?? 'UNPARSEABLE');
}

function paramsOf(result: readonly string[], code: string) {
  for (const raw of result) {
    const c = parseCaveat(raw);
    if (c?.code === code) return c.params;
  }
  return undefined;
}

// ─── 규칙 1: 약정 길이 ───────────────────────────────────────────────────

describe('deriveCaveats — 규칙 1: 약정 길이', () => {
  it('commitmentMonths=24 → 약정 caveat 포함', () => {
    const result = deriveCaveats(makeInput({ commitmentMonths: 24 }));
    expect(codes(result)).toContain('commitment');
    expect(paramsOf(result, 'commitment')).toEqual({ months: 24 });
  });

  it('commitmentMonths=0 → 약정 caveat 없음', () => {
    const result = deriveCaveats(makeInput({ commitmentMonths: 0 }));
    expect(codes(result)).not.toContain('commitment');
  });
});

// ─── 규칙 2: 활성화 비용 ─────────────────────────────────────────────────

describe('deriveCaveats — 규칙 2: 활성화 비용', () => {
  it('activationFeeCents=5000 → 활성화 비용 caveat 포함', () => {
    const result = deriveCaveats(makeInput({ activationFeeCents: 5000 }));
    expect(codes(result)).toContain('activationFee');
  });

  it('activationFeeCents=0 → 활성화 비용 caveat 없음', () => {
    const result = deriveCaveats(makeInput({ activationFeeCents: 0 }));
    expect(codes(result)).not.toContain('activationFee');
  });
});

// ─── 규칙 7: candidate confidence=medium ─────────────────────────────────

describe('deriveCaveats — 규칙 7: candidate confidence=medium', () => {
  it('confidence=medium → 신뢰도 caveat 포함', () => {
    const result = deriveCaveats(makeInput({ confidence: 'medium' }));
    expect(codes(result)).toContain('confidenceMedium');
  });

  it('confidence=high → 신뢰도 caveat 없음', () => {
    const result = deriveCaveats(makeInput({ confidence: 'high' }));
    expect(codes(result)).not.toContain('confidenceMedium');
  });
});

// ─── 규칙 9: stub 추정값 (ADR-0013 Amendment 1) ──────────────────────────

describe('deriveCaveats — 규칙 9: stub 추정값', () => {
  it('9a. isStub=true → "추정값 — 실 데이터 페이즈 5 이후" caveat 1건 추가', () => {
    const result = deriveCaveats(makeInput({}, { isStub: true }));
    expect(codes(result).filter((c) => c === 'stubEstimate')).toHaveLength(1);
  });

  it('9b. isStub=false → 규칙 9 트리거 X', () => {
    const result = deriveCaveats(makeInput({}, { isStub: false }));
    expect(codes(result)).not.toContain('stubEstimate');
  });

  it('9c. isStub 미전달 (기본) → 규칙 9 트리거 X', () => {
    const input: DeriveCaveatsInput = {
      candidate: makeSnapshot({
        id: 'cand-default',
        providerSlug: 'p',
        tariffSlug: 't',
      }),
      currentTariff: null,
      usageProfile: BASE_USAGE,
      // isStub 필드 없음 → 기본 false
    };
    const result = deriveCaveats(input);
    expect(codes(result)).not.toContain('stubEstimate');
  });

  it('9a-2. isStub=true 시 기존 8 규칙과 독립 — 다른 조건 없는 기본 케이스에서 caveat 개수=1', () => {
    // 순수 base input (약정/활성화비/프로모/한도초과/로밍/속도/신뢰도 caveat 0건)
    const result = deriveCaveats(makeInput({}, { isStub: true }));
    expect(result).toHaveLength(1);
    expect(codes(result)).toEqual(['stubEstimate']);
  });
});
