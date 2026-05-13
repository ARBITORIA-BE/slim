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

// ─── 규칙 1: 약정 길이 ───────────────────────────────────────────────────

describe('deriveCaveats — 규칙 1: 약정 길이', () => {
  it('commitmentMonths=24 → 약정 caveat 포함', () => {
    const result = deriveCaveats(makeInput({ commitmentMonths: 24 }));
    expect(result.some((c) => c.includes('24개월 약정'))).toBe(true);
  });

  it('commitmentMonths=0 → 약정 caveat 없음', () => {
    const result = deriveCaveats(makeInput({ commitmentMonths: 0 }));
    expect(result.some((c) => c.includes('약정'))).toBe(false);
  });
});

// ─── 규칙 2: 활성화 비용 ─────────────────────────────────────────────────

describe('deriveCaveats — 규칙 2: 활성화 비용', () => {
  it('activationFeeCents=5000 → 활성화 비용 caveat 포함', () => {
    const result = deriveCaveats(makeInput({ activationFeeCents: 5000 }));
    expect(result.some((c) => c.includes('활성화 비용'))).toBe(true);
  });

  it('activationFeeCents=0 → 활성화 비용 caveat 없음', () => {
    const result = deriveCaveats(makeInput({ activationFeeCents: 0 }));
    expect(result.some((c) => c.includes('활성화 비용'))).toBe(false);
  });
});

// ─── 규칙 7: candidate confidence=medium ─────────────────────────────────

describe('deriveCaveats — 규칙 7: candidate confidence=medium', () => {
  it('confidence=medium → 신뢰도 caveat 포함', () => {
    const result = deriveCaveats(makeInput({ confidence: 'medium' }));
    expect(result.some((c) => c.includes('비교 데이터 신뢰도: medium'))).toBe(true);
  });

  it('confidence=high → 신뢰도 caveat 없음', () => {
    const result = deriveCaveats(makeInput({ confidence: 'high' }));
    expect(result.some((c) => c.includes('비교 데이터 신뢰도'))).toBe(false);
  });
});

// ─── 규칙 9: stub 추정값 (ADR-0013 Amendment 1) ──────────────────────────

describe('deriveCaveats — 규칙 9: stub 추정값', () => {
  it('9a. isStub=true → "추정값 — 실 데이터 페이즈 5 이후" caveat 1건 추가', () => {
    const result = deriveCaveats(makeInput({}, { isStub: true }));
    const stubCaveats = result.filter((c) =>
      c.includes('추정값 — 실 데이터 페이즈 5 이후'),
    );
    expect(stubCaveats).toHaveLength(1);
  });

  it('9b. isStub=false → 규칙 9 트리거 X', () => {
    const result = deriveCaveats(makeInput({}, { isStub: false }));
    expect(result.some((c) => c.includes('추정값'))).toBe(false);
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
    expect(result.some((c) => c.includes('추정값'))).toBe(false);
  });

  it('9a-2. isStub=true 시 기존 8 규칙과 독립 — 다른 조건 없는 기본 케이스에서 caveat 개수=1', () => {
    // 순수 base input (약정/활성화비/프로모/한도초과/로밍/속도/신뢰도 caveat 0건)
    const result = deriveCaveats(makeInput({}, { isStub: true }));
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('추정값 — 실 데이터 페이즈 5 이후');
  });
});
