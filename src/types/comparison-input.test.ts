/**
 * comparison-input 단위 테스트 — ADR-0016 §T3/T4/T5 schema 정합 검증.
 */

import { describe, expect, it } from 'vitest';

import {
  comparisonInputSchema,
  currentProviderSchema,
  householdTypeSchema,
  postalCodeSchema,
  sessionStateSchema,
  SESSION_STATE_VERSION,
  stepSchemas,
  tariffCategorySchema,
} from './comparison-input';

describe('postalCodeSchema (ADR-0016 §T3, SC-B BE 1차)', () => {
  it('1000~9999 BE 우편번호 4자리 통과', () => {
    expect(postalCodeSchema.safeParse({ country: 'BE', postalCode: '1000' }).success).toBe(true);
    expect(postalCodeSchema.safeParse({ country: 'BE', postalCode: '9000' }).success).toBe(true);
    expect(postalCodeSchema.safeParse({ country: 'BE', postalCode: '5500' }).success).toBe(true);
  });

  it('첫 자리 0 거부 (BE 우편번호는 1xxx~9xxx)', () => {
    expect(postalCodeSchema.safeParse({ country: 'BE', postalCode: '0001' }).success).toBe(false);
    expect(postalCodeSchema.safeParse({ country: 'BE', postalCode: '0999' }).success).toBe(false);
  });

  it('비-4자리 / 비-숫자 거부', () => {
    expect(postalCodeSchema.safeParse({ country: 'BE', postalCode: '100' }).success).toBe(false);
    expect(postalCodeSchema.safeParse({ country: 'BE', postalCode: '10000' }).success).toBe(false);
    expect(postalCodeSchema.safeParse({ country: 'BE', postalCode: 'ABCD' }).success).toBe(false);
    expect(postalCodeSchema.safeParse({ country: 'BE', postalCode: '12 34' }).success).toBe(false);
  });

  it('한국어 에러 메시지 노출 (P3 정직성)', () => {
    const result = postalCodeSchema.safeParse({ country: 'BE', postalCode: '0001' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? '';
      expect(message).toContain('벨기에');
      expect(message).toContain('1000');
    }
  });
});

describe('postalCodeSchema NL (ADR-0021 §T10, 페이즈 3 진입 직전 추가)', () => {
  it('NL PC4 4자리 통과', () => {
    expect(postalCodeSchema.safeParse({ country: 'NL', postalCode: '1011' }).success).toBe(true);
    expect(postalCodeSchema.safeParse({ country: 'NL', postalCode: '9999' }).success).toBe(true);
  });

  it('NL PC6 4자리+공백+대문자 2자 통과 ("1011 AB")', () => {
    expect(postalCodeSchema.safeParse({ country: 'NL', postalCode: '1011 AB' }).success).toBe(true);
    expect(postalCodeSchema.safeParse({ country: 'NL', postalCode: '5500 ZZ' }).success).toBe(true);
  });

  it('NL PC6 공백 없이도 통과 ("1011AB")', () => {
    expect(postalCodeSchema.safeParse({ country: 'NL', postalCode: '1011AB' }).success).toBe(true);
  });

  it('NL PC6 소문자 거부 (UI에서 자동 대문자화 필수)', () => {
    expect(postalCodeSchema.safeParse({ country: 'NL', postalCode: '1011 ab' }).success).toBe(false);
  });

  it('NL 첫 자리 0 거부', () => {
    expect(postalCodeSchema.safeParse({ country: 'NL', postalCode: '0011' }).success).toBe(false);
    expect(postalCodeSchema.safeParse({ country: 'NL', postalCode: '0011 AB' }).success).toBe(false);
  });

  it('NL 비-4자리 거부', () => {
    expect(postalCodeSchema.safeParse({ country: 'NL', postalCode: '101' }).success).toBe(false);
    expect(postalCodeSchema.safeParse({ country: 'NL', postalCode: '10110' }).success).toBe(false);
  });

  it('NL 한국어 에러 메시지 노출', () => {
    const result = postalCodeSchema.safeParse({ country: 'NL', postalCode: '0001' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? '';
      expect(message).toContain('네덜란드');
    }
  });
});

describe('postalCodeSchema LU (ADR-0021 §T10, 페이즈 3 진입 직전 추가)', () => {
  it('LU 4자리 통과', () => {
    expect(postalCodeSchema.safeParse({ country: 'LU', postalCode: '1000' }).success).toBe(true);
    expect(postalCodeSchema.safeParse({ country: 'LU', postalCode: '4000' }).success).toBe(true);
    expect(postalCodeSchema.safeParse({ country: 'LU', postalCode: '9999' }).success).toBe(true);
  });

  it('LU 첫 자리 0 거부', () => {
    expect(postalCodeSchema.safeParse({ country: 'LU', postalCode: '0001' }).success).toBe(false);
  });

  it('LU PC6 형식 거부 (NL 형식 BE/LU에 적용 안 됨)', () => {
    expect(postalCodeSchema.safeParse({ country: 'LU', postalCode: '1000 AB' }).success).toBe(false);
  });

  it('LU 한국어 에러 메시지 노출', () => {
    const result = postalCodeSchema.safeParse({ country: 'LU', postalCode: '0001' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? '';
      expect(message).toContain('룩셈부르크');
    }
  });
});

describe('postalCodeSchema discriminatedUnion country 검증', () => {
  it('country 누락 거부', () => {
    expect(postalCodeSchema.safeParse({ postalCode: '1000' }).success).toBe(false);
  });

  it('알 수 없는 country 거부 (예: DE)', () => {
    expect(postalCodeSchema.safeParse({ country: 'DE', postalCode: '10115' }).success).toBe(false);
  });

  it('BE postalCode 형식을 NL country로 검증 시 분기 정확 (regex 분리)', () => {
    // BE 형식 "1000" 은 country: 'NL' 일 때도 PC4 형식으로 통과 (둘 다 4자리)
    // — 이는 의도된 동작. country 분기 자체가 비교 후보 SELECT 의 p.country 필터 구분.
    expect(postalCodeSchema.safeParse({ country: 'NL', postalCode: '1000' }).success).toBe(true);
  });
});

describe('householdTypeSchema (ADR-0016 §T4)', () => {
  it('3값 enum 정합', () => {
    expect(householdTypeSchema.safeParse('single').success).toBe(true);
    expect(householdTypeSchema.safeParse('couple').success).toBe(true);
    expect(householdTypeSchema.safeParse('family_3_plus').success).toBe(true);
  });

  it('범주 외 거부', () => {
    expect(householdTypeSchema.safeParse('family').success).toBe(false);
    expect(householdTypeSchema.safeParse('single_parent').success).toBe(false);
    expect(householdTypeSchema.safeParse('').success).toBe(false);
  });
});

describe('currentProviderSchema (ADR-0016 §T5, 선택적 + 스킵 동등)', () => {
  it('둘 다 null = 신규 가입자 (ADR-0010 §T7 케이스 6) 통과', () => {
    expect(
      currentProviderSchema.safeParse({ currentProviderId: null, currentTariffId: null }).success,
    ).toBe(true);
  });

  it('공급사만 선택 + 요금제 미상 = 스킵 sub-step 통과', () => {
    expect(
      currentProviderSchema.safeParse({
        currentProviderId: '11111111-1111-1111-1111-111111111111',
        currentTariffId: null,
      }).success,
    ).toBe(true);
  });

  it('공급사 + 요금제 모두 선택 = 정확 비교 통과', () => {
    expect(
      currentProviderSchema.safeParse({
        currentProviderId: '11111111-1111-1111-1111-111111111111',
        currentTariffId: '22222222-2222-2222-2222-222222222222',
      }).success,
    ).toBe(true);
  });

  it('요금제만 선택 + 공급사 null 거부 (sub-step UX 위반 방어)', () => {
    const result = currentProviderSchema.safeParse({
      currentProviderId: null,
      currentTariffId: '22222222-2222-2222-2222-222222222222',
    });
    expect(result.success).toBe(false);
  });

  it('비-UUID 거부', () => {
    expect(
      currentProviderSchema.safeParse({
        currentProviderId: 'proximus-be',
        currentTariffId: null,
      }).success,
    ).toBe(false);
  });
});

describe('tariffCategorySchema (ADR-0005 §T6 정합)', () => {
  it('4 카테고리 enum 통과', () => {
    expect(tariffCategorySchema.safeParse('mobile').success).toBe(true);
    expect(tariffCategorySchema.safeParse('internet_fixed').success).toBe(true);
    expect(tariffCategorySchema.safeParse('bundle_internet_tv').success).toBe(true);
    expect(tariffCategorySchema.safeParse('landline').success).toBe(true);
  });

  it('범주 외 거부', () => {
    expect(tariffCategorySchema.safeParse('energy').success).toBe(false);
    expect(tariffCategorySchema.safeParse('').success).toBe(false);
  });
});

describe('comparisonInputSchema (ADR-0016 §T7 preview 진입 검증)', () => {
  it('5단계 마친 정상 입력 통과', () => {
    const input = {
      category: 'mobile',
      postal: { country: 'BE', postalCode: '1000' },
      householdType: 'single',
      currentProviderId: null,
      currentTariffId: null,
      inputAttributes: {},
    };
    expect(comparisonInputSchema.safeParse(input).success).toBe(true);
  });

  it('inputAttributes default = 빈 객체 (ADR-0016 §T4 매핑 부재 대응)', () => {
    const input = {
      category: 'internet_fixed',
      postal: { country: 'BE', postalCode: '9000' },
      householdType: 'couple',
      currentProviderId: null,
      currentTariffId: null,
    };
    const result = comparisonInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inputAttributes).toEqual({});
    }
  });

  it('우편번호 검증이 누적 schema에서도 작동', () => {
    const input = {
      category: 'mobile',
      postal: { country: 'BE', postalCode: '0001' },
      householdType: 'single',
      currentProviderId: null,
      currentTariffId: null,
      inputAttributes: {},
    };
    expect(comparisonInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('stepSchemas (RHF resolver 단계별 호출)', () => {
  it('각 단계 키 노출', () => {
    expect(Object.keys(stepSchemas)).toEqual(['postal', 'household', 'current-provider']);
  });

  it('household step schema 단독 검증', () => {
    expect(stepSchemas.household.safeParse({ householdType: 'family_3_plus' }).success).toBe(true);
    expect(stepSchemas.household.safeParse({ householdType: 'invalid' }).success).toBe(false);
  });
});

describe('sessionStateSchema (ADR-0016 §T8 sessionStorage 직렬화)', () => {
  it('version 1 + 정상 모양 통과', () => {
    const state = {
      version: SESSION_STATE_VERSION,
      category: 'mobile' as const,
      step: 'household' as const,
      data: {
        postalCode: '1000',
        householdType: 'single' as const,
      },
      updatedAt: '2026-05-10T12:34:56.000Z',
    };
    expect(sessionStateSchema.safeParse(state).success).toBe(true);
  });

  it('version 미스매치 거부 (마이그레이션 트리거)', () => {
    const state = {
      version: 999,
      category: 'mobile',
      step: 'postal',
      data: {},
      updatedAt: '2026-05-10T12:34:56.000Z',
    };
    expect(sessionStateSchema.safeParse(state).success).toBe(false);
  });

  it('updatedAt = 비-ISO 거부', () => {
    const state = {
      version: SESSION_STATE_VERSION,
      category: 'mobile',
      step: 'postal',
      data: {},
      updatedAt: '2026-05-10',
    };
    expect(sessionStateSchema.safeParse(state).success).toBe(false);
  });
});
