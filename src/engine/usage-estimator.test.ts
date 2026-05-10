/**
 * deriveUsageProfile 단위 테스트 — ADR-0021 §T3 §5 매핑 정합.
 *
 * 검증:
 *   1. householdType 부재 시 single fallback
 *   2. 카테고리별 기본 프로파일 정확도 (4 카테고리 × 3 householdType)
 *   3. inputAttributes 명시값이 기본 프로파일을 덮어쓰는지
 *   4. 잘못된 inputAttributes (음수 / 문자열) 시 기본값 fallback
 *   5. UsageProfile.householdType 필드 정확 전달
 */

import { describe, expect, it } from 'vitest';

import { USAGE_ESTIMATOR_VERSION, deriveUsageProfile } from './usage-estimator';

describe('deriveUsageProfile (ADR-0021 §T3 §5)', () => {
  describe('mobile 카테고리', () => {
    it('single 기본 프로파일', () => {
      const profile = deriveUsageProfile('mobile', 'single', {});
      expect(profile.householdType).toBe('single');
      expect(profile.data_gb_used).toBe(5);
      expect(profile.voice_minutes_used).toBe(100);
      expect(profile.sms_count).toBe(20);
      expect(profile.eu_roaming_needed).toBe(false);
    });

    it('couple — 회선당 평균 single 과 동일 (가구 형태와 회선 수는 직교)', () => {
      const profile = deriveUsageProfile('mobile', 'couple', {});
      expect(profile.data_gb_used).toBe(5);
      expect(profile.voice_minutes_used).toBe(100);
    });

    it('family_3_plus — 데이터/통화 ↑', () => {
      const profile = deriveUsageProfile('mobile', 'family_3_plus', {});
      expect(profile.data_gb_used).toBe(10);
      expect(profile.voice_minutes_used).toBe(200);
      expect(profile.sms_count).toBe(40);
    });

    it('inputAttributes 명시값이 기본 프로파일 덮어씀', () => {
      const profile = deriveUsageProfile('mobile', 'single', {
        data_gb_used: 50,
        eu_roaming_needed: true,
      });
      expect(profile.data_gb_used).toBe(50);
      expect(profile.eu_roaming_needed).toBe(true);
      // 명시 안 된 키는 기본값 유지
      expect(profile.voice_minutes_used).toBe(100);
    });
  });

  describe('internet_fixed 카테고리', () => {
    it('single — 50 Mbps + 4K X', () => {
      const profile = deriveUsageProfile('internet_fixed', 'single', {});
      expect(profile.download_mbps_needed).toBe(50);
      expect(profile.household_devices).toBe(3);
      expect(profile.streaming_4k).toBe(false);
    });

    it('couple — 100 Mbps + 4K O', () => {
      const profile = deriveUsageProfile('internet_fixed', 'couple', {});
      expect(profile.download_mbps_needed).toBe(100);
      expect(profile.streaming_4k).toBe(true);
    });

    it('family_3_plus — 200 Mbps + 8 디바이스', () => {
      const profile = deriveUsageProfile('internet_fixed', 'family_3_plus', {});
      expect(profile.download_mbps_needed).toBe(200);
      expect(profile.household_devices).toBe(8);
    });
  });

  describe('bundle_internet_tv 카테고리', () => {
    it('couple — TV 80 채널 + 4K', () => {
      const profile = deriveUsageProfile('bundle_internet_tv', 'couple', {});
      expect(profile.tv_channels_needed).toBe(80);
      expect(profile.tv_4k_needed).toBe(true);
      // internet_fixed 필드도 함께
      expect(profile.download_mbps_needed).toBe(100);
    });

    it('single — TV 50 채널 + 4K X', () => {
      const profile = deriveUsageProfile('bundle_internet_tv', 'single', {});
      expect(profile.tv_channels_needed).toBe(50);
      expect(profile.tv_4k_needed).toBe(false);
    });
  });

  describe('landline 카테고리', () => {
    it('가구 형태별 통화 시간 차등', () => {
      expect(deriveUsageProfile('landline', 'single', {}).calls_be_minutes_needed).toBe(30);
      expect(deriveUsageProfile('landline', 'couple', {}).calls_be_minutes_needed).toBe(60);
      expect(deriveUsageProfile('landline', 'family_3_plus', {}).calls_be_minutes_needed).toBe(120);
    });
  });

  describe('householdType 부재 처리', () => {
    it('undefined → single fallback (가장 보수적)', () => {
      const profile = deriveUsageProfile('mobile', undefined, {});
      expect(profile.householdType).toBe('single');
      expect(profile.data_gb_used).toBe(5);
    });
  });

  describe('잘못된 inputAttributes 안전 fallback', () => {
    it('음수 거부 → 기본값', () => {
      const profile = deriveUsageProfile('mobile', 'single', { data_gb_used: -5 });
      expect(profile.data_gb_used).toBe(5);
    });

    it('문자열 거부 → 기본값', () => {
      const profile = deriveUsageProfile('mobile', 'single', { data_gb_used: '50' });
      expect(profile.data_gb_used).toBe(5);
    });

    it('NaN/Infinity 거부 → 기본값', () => {
      const profile = deriveUsageProfile('mobile', 'single', { data_gb_used: NaN });
      expect(profile.data_gb_used).toBe(5);
      const profile2 = deriveUsageProfile('mobile', 'single', { data_gb_used: Infinity });
      expect(profile2.data_gb_used).toBe(5);
    });

    it('boolean 키에 number 들어와도 거부 → 기본값', () => {
      const profile = deriveUsageProfile('mobile', 'single', { eu_roaming_needed: 1 });
      expect(profile.eu_roaming_needed).toBe(false);
    });

    it('명시 0 (의미 있는 값) 통과 — pickNumber 가 0 ≥ 허용', () => {
      const profile = deriveUsageProfile('mobile', 'single', { data_gb_used: 0 });
      expect(profile.data_gb_used).toBe(0);
    });
  });

  describe('순수성 + 버전 식별자', () => {
    it('USAGE_ESTIMATOR_VERSION 노출 (PLAN 3.5 계산 근거 인용)', () => {
      expect(USAGE_ESTIMATOR_VERSION).toMatch(/^usage-estimator@\d{4}-\d{2}-\d{2}$/);
    });

    it('동일 입력 → 동일 출력 (순수성)', () => {
      const a = deriveUsageProfile('mobile', 'single', { data_gb_used: 7 });
      const b = deriveUsageProfile('mobile', 'single', { data_gb_used: 7 });
      expect(a).toEqual(b);
    });

    it('입력 객체 변형 X (readonly 강제는 컴파일 타임 — 런타임은 spread/pick)', () => {
      const attrs = { data_gb_used: 7 };
      const before = { ...attrs };
      deriveUsageProfile('mobile', 'single', attrs);
      expect(attrs).toEqual(before);
    });
  });
});
