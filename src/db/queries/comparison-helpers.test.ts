/**
 * comparison-helpers 단위 테스트 — Sub-task 5.
 *
 * 검증:
 *   1. snapshotRowToTariffLike 1:1 매핑 (필드 누락/추가 0)
 *   2. snapshotRowToTariffLike null 가능 컬럼 (modem/promo/earlyTermination) 보존
 *   3. buildLockedInputs ADR-0007 §T9 권장 키 정확 직렬화
 *   4. buildLockedInputs assumptions = { usage_profile, estimator_version }
 *   5. 순수성 — 동일 입력 → 동일 출력 + 입력 객체 변형 X
 */

import { describe, expect, it } from 'vitest';

import type { UsageProfile } from '@/engine/types';

import {
  buildLockedInputs,
  snapshotRowToTariffLike,
  type SnapshotJoinRow,
} from './comparison-helpers';

const baseRow: SnapshotJoinRow = {
  snapshotId: '11111111-1111-1111-1111-111111111111',
  providerSlug: 'proximus',
  tariffSlug: 'mobile-essential',
  category: 'mobile',
  monthlyPriceCents: 1500,
  activationFeeCents: 0,
  modemRentalCents: null,
  promoPriceCents: null,
  promoMonths: null,
  commitmentMonths: 0,
  earlyTerminationFeeCents: null,
  attributes: { data_gb: 10 },
  confidence: 'high',
  confidenceReason: null,
  isAnomaly: false,
};

describe('snapshotRowToTariffLike (Sub-task 5)', () => {
  it('모든 필드 1:1 매핑 (id ← snapshotId)', () => {
    const t = snapshotRowToTariffLike(baseRow);
    expect(t.id).toBe(baseRow.snapshotId);
    expect(t.providerSlug).toBe('proximus');
    expect(t.tariffSlug).toBe('mobile-essential');
    expect(t.category).toBe('mobile');
    expect(t.monthlyPriceCents).toBe(1500);
    expect(t.activationFeeCents).toBe(0);
    expect(t.commitmentMonths).toBe(0);
    expect(t.attributes).toEqual({ data_gb: 10 });
    expect(t.confidence).toBe('high');
    expect(t.isAnomaly).toBe(false);
  });

  it('null 가능 컬럼 보존 (modemRental / promo / earlyTermination / confidenceReason)', () => {
    const t = snapshotRowToTariffLike(baseRow);
    expect(t.modemRentalCents).toBeNull();
    expect(t.promoPriceCents).toBeNull();
    expect(t.promoMonths).toBeNull();
    expect(t.earlyTerminationFeeCents).toBeNull();
    expect(t.confidenceReason).toBeNull();
  });

  it('null 아닌 promo / commitment / earlyTermination 도 보존', () => {
    const t = snapshotRowToTariffLike({
      ...baseRow,
      modemRentalCents: 500,
      promoPriceCents: 1000,
      promoMonths: 6,
      commitmentMonths: 24,
      earlyTerminationFeeCents: 5000,
      confidenceReason: 'fallback to previous',
      confidence: 'medium',
    });
    expect(t.modemRentalCents).toBe(500);
    expect(t.promoPriceCents).toBe(1000);
    expect(t.promoMonths).toBe(6);
    expect(t.commitmentMonths).toBe(24);
    expect(t.earlyTerminationFeeCents).toBe(5000);
    expect(t.confidenceReason).toBe('fallback to previous');
    expect(t.confidence).toBe('medium');
  });

  it('순수성 — 입력 row 변형 X', () => {
    const row = { ...baseRow };
    const before = JSON.stringify(row);
    snapshotRowToTariffLike(row);
    expect(JSON.stringify(row)).toBe(before);
  });
});

describe('buildLockedInputs (ADR-0007 §T9 + Sub-task 5)', () => {
  const usageProfile: UsageProfile = {
    householdType: 'single',
    data_gb_used: 5,
    voice_minutes_used: 100,
    sms_count: 20,
    eu_roaming_needed: false,
  };

  it('ADR-0007 §T9 권장 키 + sub-task 5 추가 키 모두 출력', () => {
    const locked = buildLockedInputs({
      postalCountry: 'BE',
      postalCode: '1000',
      householdType: 'single',
      currentProviderId: null,
      currentTariffId: null,
      inputAttributes: { data_gb_used: 5 },
      usageProfile,
      estimatorVersion: 'usage-estimator@2026-05-10',
    });
    expect(locked).toEqual({
      postal_country: 'BE',
      postal_code: '1000',
      household_type: 'single',
      current_provider_id: null,
      current_tariff_id: null,
      input_attributes: { data_gb_used: 5 },
      assumptions: {
        usage_profile: usageProfile,
        estimator_version: 'usage-estimator@2026-05-10',
      },
    });
  });

  it('current provider/tariff 명시 시 그대로 보존', () => {
    const locked = buildLockedInputs({
      postalCountry: 'NL',
      postalCode: '1011 AB',
      householdType: 'family_3_plus',
      currentProviderId: '22222222-2222-2222-2222-222222222222',
      currentTariffId: '33333333-3333-3333-3333-333333333333',
      inputAttributes: {},
      usageProfile,
      estimatorVersion: 'usage-estimator@2026-05-10',
    });
    expect(locked['current_provider_id']).toBe(
      '22222222-2222-2222-2222-222222222222',
    );
    expect(locked['current_tariff_id']).toBe(
      '33333333-3333-3333-3333-333333333333',
    );
    expect(locked['postal_country']).toBe('NL');
    expect(locked['household_type']).toBe('family_3_plus');
  });

  it('순수성 — 동일 입력 → 동일 출력 (deep equal)', () => {
    const args = {
      postalCountry: 'BE' as const,
      postalCode: '1000',
      householdType: 'couple' as const,
      currentProviderId: null,
      currentTariffId: null,
      inputAttributes: { data_gb_used: 7 },
      usageProfile,
      estimatorVersion: 'usage-estimator@2026-05-10',
    };
    expect(buildLockedInputs(args)).toEqual(buildLockedInputs(args));
  });

  it('inputAttributes 객체 변형 X', () => {
    const attrs = { data_gb_used: 7 };
    const before = { ...attrs };
    buildLockedInputs({
      postalCountry: 'BE',
      postalCode: '1000',
      householdType: 'single',
      currentProviderId: null,
      currentTariffId: null,
      inputAttributes: attrs,
      usageProfile,
      estimatorVersion: 'usage-estimator@2026-05-10',
    });
    expect(attrs).toEqual(before);
  });
});
