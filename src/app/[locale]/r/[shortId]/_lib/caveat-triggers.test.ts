/**
 * caveat-triggers 단위 테스트 — 라운드 d (PLAN 3.5) + 키 전환 (PLAN 4.28).
 *
 * 검증: deriveCaveats 규칙 1~7 거울 평가의 각 경계 (triggered/미triggered) +
 * 카테고리별 행 포함/제외 + 순수성 (입력 변형 X).
 *
 * 4.28 이후 단언 대상은 **i18n 키 + 파라미터** 다. 이전에는 한국어 문장을
 * substring 으로 확인했는데, 그 방식은 (a) 로케일이 바뀌면 깨지고 (b) 애초에
 * 엔진이 한국어를 만든다는 잘못된 전제를 테스트가 고정시켰다.
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

/** conditionKey 로 행을 찾는다 (로케일 무관). */
function byKey(
  rows: ReturnType<typeof deriveCaveatTriggers>,
  ...keys: readonly string[]
) {
  return rows.find((r) => keys.includes(r.conditionKey));
}

describe('deriveCaveatTriggers — 약정 (규칙 1)', () => {
  it('약정 0 → commitmentNone, 미발동', () => {
    const r = byKey(deriveCaveatTriggers(base({ commitmentMonths: 0 })), 'commitmentNone');
    expect(r?.triggered).toBe(false);
    expect(r?.noteKey).toBe('noPenaltyRisk');
  });

  it('약정 12개월 → 발동 + months 파라미터', () => {
    const r = byKey(
      deriveCaveatTriggers(base({ commitmentMonths: 12 })),
      'commitmentMonths',
    );
    expect(r?.triggered).toBe(true);
    expect(r?.conditionParams).toEqual({ months: 12 });
    expect(r?.noteKey).toBe('penaltyRisk');
  });

  it('약정 24개월 → 발동', () => {
    const r = byKey(
      deriveCaveatTriggers(base({ commitmentMonths: 24 })),
      'commitmentMonths',
    );
    expect(r?.triggered).toBe(true);
    expect(r?.conditionParams).toEqual({ months: 24 });
  });
});

describe('deriveCaveatTriggers — 활성화 비용 (규칙 2)', () => {
  it('€0 → 미발동', () => {
    const r = byKey(deriveCaveatTriggers(base()), 'activationFeeNone');
    expect(r?.triggered).toBe(false);
    expect(r?.noteKey).toBe('freeActivation');
  });

  it('€50 → 발동, € 포맷', () => {
    const r = byKey(
      deriveCaveatTriggers(base({ activationFeeCents: 5000 })),
      'activationFee',
    );
    expect(r?.triggered).toBe(true);
    expect(r?.conditionParams).toEqual({ amount: '€50' });
  });

  it('€49.99 → 소수 2자리 포맷', () => {
    const r = byKey(
      deriveCaveatTriggers(base({ activationFeeCents: 4999 })),
      'activationFee',
    );
    expect(r?.conditionParams).toEqual({ amount: '€49.99' });
  });
});

describe('deriveCaveatTriggers — 프로모 (규칙 3)', () => {
  it('프로모 없음 → 행 생성 X', () => {
    const rows = deriveCaveatTriggers(base({ promoMonths: null }));
    expect(byKey(rows, 'promoShort', 'promoLong')).toBeUndefined();
  });

  it('프로모 6개월 (< 12) + promoPrice 있음 → 발동, 정상가 명시', () => {
    const r = byKey(
      deriveCaveatTriggers(
        base({ promoMonths: 6, promoPriceCents: 1500, monthlyPriceCents: 3000 }),
      ),
      'promoShort',
    );
    expect(r?.triggered).toBe(true);
    expect(r?.conditionParams).toEqual({ months: 6 });
    expect(r?.noteKey).toBe('revertsTo');
    expect(r?.noteParams).toEqual({ price: '€30' });
  });

  it('프로모 12개월 → 미발동 (12개월 평균 시나리오 내)', () => {
    const r = byKey(
      deriveCaveatTriggers(base({ promoMonths: 12, promoPriceCents: 1500 })),
      'promoLong',
    );
    expect(r?.triggered).toBe(false);
    expect(r?.noteKey).toBe('lowValueWithin12');
  });

  it('프로모 6개월이지만 promoPrice null → 미발동', () => {
    const r = byKey(
      deriveCaveatTriggers(base({ promoMonths: 6, promoPriceCents: null })),
      'promoLong',
    );
    expect(r?.triggered).toBe(false);
  });
});

describe('deriveCaveatTriggers — 데이터 한도 (규칙 4, mobile)', () => {
  it('unlimited → 미발동', () => {
    const r = byKey(
      deriveCaveatTriggers(base({ attributes: { data_gb: 'unlimited' } })),
      'dataUnlimited',
    );
    expect(r?.triggered).toBe(false);
    expect(r?.noteKey).toBe('noOverage');
  });

  it('사용 20GB > 한도 10GB → 발동', () => {
    const r = byKey(
      deriveCaveatTriggers(
        base({ attributes: { data_gb: 10 }, usageProfile: { data_gb_used: 20 } }),
      ),
      'dataUsage',
    );
    expect(r?.triggered).toBe(true);
    expect(r?.conditionParams).toEqual({ usedGb: 20, planGb: 10 });
    expect(r?.noteKey).toBe('overageHidden');
  });

  it('사용 5GB <= 한도 10GB → 미발동', () => {
    const r = byKey(
      deriveCaveatTriggers(
        base({ attributes: { data_gb: 10 }, usageProfile: { data_gb_used: 5 } }),
      ),
      'dataUsage',
    );
    expect(r?.triggered).toBe(false);
    expect(r?.noteKey).toBe('withinLimit');
  });

  it('한도 정보 없음 → 행 생성 X', () => {
    const rows = deriveCaveatTriggers(base({ usageProfile: { data_gb_used: 5 } }));
    expect(byKey(rows, 'dataUsage', 'dataUnlimited')).toBeUndefined();
  });

  it('internet 카테고리 → 데이터 한도 행 없음', () => {
    const rows = deriveCaveatTriggers(
      base({
        category: 'internet_fixed',
        attributes: { data_gb: 10 },
        usageProfile: { data_gb_used: 20 },
      }),
    );
    expect(byKey(rows, 'dataUsage', 'dataUnlimited')).toBeUndefined();
  });
});

describe('deriveCaveatTriggers — EU 로밍 (규칙 5, mobile)', () => {
  it('미포함 → 발동', () => {
    const r = byKey(
      deriveCaveatTriggers(base({ attributes: { eu_roaming_included: false } })),
      'roamingExcluded',
    );
    expect(r?.triggered).toBe(true);
    expect(r?.noteKey).toBe('roamingMissing');
  });

  it('포함 → 미발동', () => {
    const r = byKey(
      deriveCaveatTriggers(base({ attributes: { eu_roaming_included: true } })),
      'roamingIncluded',
    );
    expect(r?.triggered).toBe(false);
  });

  it('키 누락 → 행 생성 X (정보 부재 ≠ 거짓)', () => {
    const rows = deriveCaveatTriggers(base({ attributes: {} }));
    expect(byKey(rows, 'roamingIncluded', 'roamingExcluded')).toBeUndefined();
  });
});

describe('deriveCaveatTriggers — 4K 속도 (규칙 6, internet)', () => {
  it('4K 요청 + 50 Mbps (< 100) → 발동', () => {
    const r = byKey(
      deriveCaveatTriggers(
        base({
          category: 'internet_fixed',
          attributes: { download_mbps: 50 },
          usageProfile: { streaming_4k: true },
        }),
      ),
      'streaming4kOn',
    );
    expect(r?.triggered).toBe(true);
    expect(r?.conditionParams).toEqual({ mbps: 50 });
    expect(r?.noteKey).toBe('below100');
  });

  it('4K 요청 + 200 Mbps → 미발동', () => {
    const r = byKey(
      deriveCaveatTriggers(
        base({
          category: 'internet_fixed',
          attributes: { download_mbps: 200 },
          usageProfile: { streaming_4k: true },
        }),
      ),
      'streaming4kOn',
    );
    expect(r?.triggered).toBe(false);
    expect(r?.noteKey).toBe('meets100');
  });

  it('4K 미요청 → 해당 없음 행', () => {
    const r = byKey(
      deriveCaveatTriggers(base({ category: 'internet_fixed' })),
      'streaming4kOff',
    );
    expect(r?.triggered).toBe(false);
    expect(r?.noteKey).toBe('notApplicable');
  });

  it('mobile → 4K 행 없음', () => {
    const rows = deriveCaveatTriggers(base({ usageProfile: { streaming_4k: true } }));
    expect(byKey(rows, 'streaming4kOn', 'streaming4kOff')).toBeUndefined();
  });
});

describe('deriveCaveatTriggers — 신뢰도 (규칙 7) + 순수성', () => {
  it('medium → 발동', () => {
    const r = byKey(
      deriveCaveatTriggers(base({ candidateConfidence: 'medium' })),
      'confidence',
    );
    expect(r?.triggered).toBe(true);
    expect(r?.noteKey).toBe('selectorWarning');
  });

  it('high → 미발동 + confidence 파라미터', () => {
    const r = byKey(
      deriveCaveatTriggers(base({ candidateConfidence: 'high' })),
      'confidence',
    );
    expect(r?.triggered).toBe(false);
    expect(r?.conditionParams).toEqual({ confidence: 'high' });
  });

  it('행에 한국어가 남아 있지 않다 (4.28 회귀 가드)', () => {
    const rows = deriveCaveatTriggers(
      base({
        commitmentMonths: 24,
        activationFeeCents: 5000,
        promoMonths: 6,
        promoPriceCents: 1500,
        attributes: { data_gb: 10, eu_roaming_included: false },
        usageProfile: { data_gb_used: 20 },
        candidateConfidence: 'medium',
      }),
    );
    const hangul = /[가-힣]/;
    for (const r of rows) {
      expect(hangul.test(JSON.stringify(r))).toBe(false);
    }
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
