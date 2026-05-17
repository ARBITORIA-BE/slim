/**
 * caveat-triggers 단위 테스트 — 라운드 d (PLAN 3.5).
 *
 * 검증: deriveCaveats 규칙 1~7 거울 평가의 각 경계 (triggered/미triggered) +
 * 카테고리별 행 포함/제외 + 순수성 (입력 변형 X).
 */

import { describe, expect, it } from 'vitest';

import type { UsageProfile } from '@/engine/types';

import { deriveCaveatTriggers, type CaveatTriggerInput } from './caveat-triggers';

function base(overrides: Partial<CaveatTriggerInput> = {}): CaveatTriggerInput {
  return {
    category: 'mobile',
    commitmentMonths: 0,
    activationFeeCents: 0,
    promoMonths: null,
    promoPriceCents: null,
    monthlyPriceCents: 2000,
    attributes: {},
    usageProfile: {},
    candidateConfidence: 'high',
    ...overrides,
  };
}

function find(rows: ReturnType<typeof deriveCaveatTriggers>, needle: string) {
  return rows.find((r) => r.condition.includes(needle));
}

describe('deriveCaveatTriggers — 약정 (규칙 1)', () => {
  it('약정 0 → 비구속, 미발동', () => {
    const r = find(deriveCaveatTriggers(base({ commitmentMonths: 0 })), '약정');
    expect(r?.triggered).toBe(false);
    expect(r?.condition).toContain('비구속');
  });

  it('약정 12개월 → 발동', () => {
    const r = find(
      deriveCaveatTriggers(base({ commitmentMonths: 12 })),
      '약정 12',
    );
    expect(r?.triggered).toBe(true);
    expect(r?.note).toContain('위약금');
  });

  it('약정 24개월 → 발동', () => {
    const r = find(
      deriveCaveatTriggers(base({ commitmentMonths: 24 })),
      '약정 24',
    );
    expect(r?.triggered).toBe(true);
  });
});

describe('deriveCaveatTriggers — 활성화 비용 (규칙 2)', () => {
  it('€0 → 미발동', () => {
    const r = find(deriveCaveatTriggers(base({ activationFeeCents: 0 })), '활성화');
    expect(r?.triggered).toBe(false);
    expect(r?.condition).toBe('활성화 비용 €0');
  });

  it('€50 → 발동, € 포맷', () => {
    const r = find(
      deriveCaveatTriggers(base({ activationFeeCents: 5000 })),
      '활성화',
    );
    expect(r?.triggered).toBe(true);
    expect(r?.condition).toBe('활성화 비용 €50');
  });

  it('€49.99 → 소수 2자리 포맷', () => {
    const r = find(
      deriveCaveatTriggers(base({ activationFeeCents: 4999 })),
      '활성화',
    );
    expect(r?.condition).toBe('활성화 비용 €49.99');
  });
});

describe('deriveCaveatTriggers — 프로모 (규칙 3)', () => {
  it('프로모 없음 → 행 생성 X', () => {
    const rows = deriveCaveatTriggers(base({ promoMonths: null }));
    expect(find(rows, '프로모')).toBeUndefined();
  });

  it('프로모 6개월 (< 12) + promoPrice 있음 → 발동, 정상가 명시', () => {
    const r = find(
      deriveCaveatTriggers(
        base({ promoMonths: 6, promoPriceCents: 1000, monthlyPriceCents: 3000 }),
      ),
      '프로모',
    );
    expect(r?.triggered).toBe(true);
    expect(r?.note).toContain('€30');
  });

  it('프로모 12개월 → 미발동 (12개월 평균 시나리오 내)', () => {
    const r = find(
      deriveCaveatTriggers(base({ promoMonths: 12, promoPriceCents: 1000 })),
      '프로모',
    );
    expect(r?.triggered).toBe(false);
  });

  it('프로모 6개월이지만 promoPrice null → 미발동', () => {
    const r = find(
      deriveCaveatTriggers(base({ promoMonths: 6, promoPriceCents: null })),
      '프로모',
    );
    expect(r?.triggered).toBe(false);
  });
});

describe('deriveCaveatTriggers — 데이터 한도 (규칙 4, mobile)', () => {
  it('unlimited → 미발동', () => {
    const r = find(
      deriveCaveatTriggers(base({ attributes: { data_gb: 'unlimited' } })),
      '무제한',
    );
    expect(r?.triggered).toBe(false);
  });

  it('사용 20GB > 한도 10GB → 발동', () => {
    const profile: UsageProfile = { data_gb_used: 20 };
    const r = find(
      deriveCaveatTriggers(
        base({ attributes: { data_gb: 10 }, usageProfile: profile }),
      ),
      'GB 사용',
    );
    expect(r?.triggered).toBe(true);
    expect(r?.note).toContain('초과');
  });

  it('사용 5GB <= 한도 10GB → 미발동', () => {
    const r = find(
      deriveCaveatTriggers(
        base({ attributes: { data_gb: 10 }, usageProfile: { data_gb_used: 5 } }),
      ),
      'GB 사용',
    );
    expect(r?.triggered).toBe(false);
  });

  it('한도 정보 없음 → 행 생성 X', () => {
    const rows = deriveCaveatTriggers(base({ attributes: {}, usageProfile: {} }));
    expect(find(rows, 'GB')).toBeUndefined();
  });

  it('internet 카테고리 → 데이터 한도 행 없음', () => {
    const rows = deriveCaveatTriggers(
      base({ category: 'internet_fixed', attributes: { data_gb: 10 } }),
    );
    expect(find(rows, 'GB')).toBeUndefined();
  });
});

describe('deriveCaveatTriggers — EU 로밍 (규칙 5, mobile)', () => {
  it('미포함 → 발동', () => {
    const r = find(
      deriveCaveatTriggers(base({ attributes: { eu_roaming_included: false } })),
      'EU 로밍',
    );
    expect(r?.triggered).toBe(true);
  });

  it('포함 → 미발동', () => {
    const r = find(
      deriveCaveatTriggers(base({ attributes: { eu_roaming_included: true } })),
      'EU 로밍',
    );
    expect(r?.triggered).toBe(false);
  });

  it('키 누락 → 행 생성 X (정보 부재 ≠ 거짓)', () => {
    const rows = deriveCaveatTriggers(base({ attributes: {} }));
    expect(find(rows, 'EU 로밍')).toBeUndefined();
  });
});

describe('deriveCaveatTriggers — 4K 속도 (규칙 6, internet)', () => {
  it('4K 요청 + 50 Mbps (< 100) → 발동', () => {
    const r = find(
      deriveCaveatTriggers(
        base({
          category: 'internet_fixed',
          attributes: { download_mbps: 50 },
          usageProfile: { streaming_4k: true },
        }),
      ),
      '4K 스트리밍 요청',
    );
    expect(r?.triggered).toBe(true);
  });

  it('4K 요청 + 200 Mbps → 미발동', () => {
    const r = find(
      deriveCaveatTriggers(
        base({
          category: 'bundle_internet_tv',
          attributes: { download_mbps: 200 },
          usageProfile: { streaming_4k: true },
        }),
      ),
      '4K 스트리밍 요청',
    );
    expect(r?.triggered).toBe(false);
  });

  it('4K 미요청 → 해당 없음 행', () => {
    const r = find(
      deriveCaveatTriggers(base({ category: 'internet_fixed', usageProfile: {} })),
      '4K 스트리밍 미요청',
    );
    expect(r?.triggered).toBe(false);
  });

  it('mobile → 4K 행 없음', () => {
    const rows = deriveCaveatTriggers(
      base({ category: 'mobile', usageProfile: { streaming_4k: true } }),
    );
    expect(find(rows, '4K')).toBeUndefined();
  });
});

describe('deriveCaveatTriggers — 신뢰도 (규칙 7) + 순수성', () => {
  it('medium → 발동', () => {
    const r = find(
      deriveCaveatTriggers(base({ candidateConfidence: 'medium' })),
      '신뢰도',
    );
    expect(r?.triggered).toBe(true);
  });

  it('high → 미발동', () => {
    const r = find(
      deriveCaveatTriggers(base({ candidateConfidence: 'high' })),
      '신뢰도',
    );
    expect(r?.triggered).toBe(false);
    expect(r?.condition).toContain('high');
  });

  it('입력 변형 X (attributes/usageProfile 동결)', () => {
    const attributes = Object.freeze({ data_gb: 10 });
    const usageProfile = Object.freeze<UsageProfile>({ data_gb_used: 20 });
    expect(() =>
      deriveCaveatTriggers(base({ attributes, usageProfile })),
    ).not.toThrow();
  });

  it('동일 입력 → 동일 출력 (결정성)', () => {
    const input = base({ commitmentMonths: 24, activationFeeCents: 5000 });
    expect(deriveCaveatTriggers(input)).toEqual(deriveCaveatTriggers(input));
  });
});
