/**
 * deriveUsageProfile — 가구 형태 + 입력 속성 → 사용량 프로파일 (ADR-0021 §T3 §5).
 *
 * 책임: comparison_request.input_attributes (JSONB) 를 비교 엔진 친화 모양
 * (UsageProfile, src/engine/types.ts) 으로 normalize. 입력 부재 시 *기본 프로파일*
 * (householdType 기준) 로 fallback — ADR-0010 §T2 정합 ("사용량은 추천성/caveat
 * 트리거만, 가격 가공 X").
 *
 * 우선순위:
 *   1. inputAttributes 에 명시된 값 (사용자 직접 입력)
 *   2. householdType 기본 프로파일 (없으면 single 으로 fallback)
 *
 * 카테고리별 기본 프로파일:
 *   - mobile: 회선당 평균 (가구 형태와 회선 수는 직교)
 *   - internet_fixed: 가구 동시 디바이스 + 스트리밍 강도
 *   - bundle_internet_tv: internet_fixed + TV 시청
 *   - landline: 통화 시간만 (베네룩스는 모바일 우선이라 보수적 추정)
 *
 * **검증 4 (ADR-0021)**: 베타 사용자 청구서 5건 수집 후 본 매핑 정확도 ≤ 60%
 * 시 Amendment 1 트리거. 페이즈 5 OCR (별도 ADR-OCR) 진입 시 inputAttributes
 * 명시값 비율 ↑ → 기본 프로파일 의존도 ↓.
 *
 * 학습자 메모: 본 함수는 *순수* — 입력 동일하면 출력 동일. compare() 가 캐시
 * 가능하도록 (페이즈 4 어트리뷰션 ADR 트리거 시 점검).
 */

import type { TariffCategoryInput, HouseholdTypeInput } from '@/types/comparison-input';
import type { UsageProfile } from './types';

// ─── 카테고리별 기본 프로파일 매트릭스 ─────────────────────────────────────

interface MobileProfile {
  data_gb_used: number;
  voice_minutes_used: number;
  sms_count: number;
  eu_roaming_needed: boolean;
}

interface InternetProfile {
  download_mbps_needed: number;
  household_devices: number;
  streaming_4k: boolean;
}

interface BundleProfile extends InternetProfile {
  tv_channels_needed: number;
  tv_4k_needed: boolean;
}

interface LandlineProfile {
  calls_be_minutes_needed: number;
}

// **수치 근거**: BIPT 2024 평균 사용량 보고서 + 베네룩스 시장 관찰값 (2026-05-10).
// 정확한 값은 ADR-0021 §검증 4 후 Amendment.

const MOBILE_DEFAULTS: Record<HouseholdTypeInput, MobileProfile> = {
  single: { data_gb_used: 5, voice_minutes_used: 100, sms_count: 20, eu_roaming_needed: false },
  couple: { data_gb_used: 5, voice_minutes_used: 100, sms_count: 20, eu_roaming_needed: false },
  family_3_plus: { data_gb_used: 10, voice_minutes_used: 200, sms_count: 40, eu_roaming_needed: false },
};

const INTERNET_DEFAULTS: Record<HouseholdTypeInput, InternetProfile> = {
  single: { download_mbps_needed: 50, household_devices: 3, streaming_4k: false },
  couple: { download_mbps_needed: 100, household_devices: 5, streaming_4k: true },
  family_3_plus: { download_mbps_needed: 200, household_devices: 8, streaming_4k: true },
};

const BUNDLE_DEFAULTS: Record<HouseholdTypeInput, BundleProfile> = {
  single: { ...INTERNET_DEFAULTS.single, tv_channels_needed: 50, tv_4k_needed: false },
  couple: { ...INTERNET_DEFAULTS.couple, tv_channels_needed: 80, tv_4k_needed: true },
  family_3_plus: { ...INTERNET_DEFAULTS.family_3_plus, tv_channels_needed: 100, tv_4k_needed: true },
};

const LANDLINE_DEFAULTS: Record<HouseholdTypeInput, LandlineProfile> = {
  single: { calls_be_minutes_needed: 30 },
  couple: { calls_be_minutes_needed: 60 },
  family_3_plus: { calls_be_minutes_needed: 120 },
};

// ─── 핵심 함수 ────────────────────────────────────────────────────────────

/**
 * 사용자 입력 (가구 형태 + 명시 inputAttributes) → 비교 엔진 UsageProfile.
 *
 * @param category    PLAN 2.1 카테고리
 * @param householdType  PLAN 2.3 가구 형태 (undefined = single fallback)
 * @param inputAttributes  명시 입력 (페이즈 3 결과 페이지 직후 OCR 도입 시 자동 채움)
 *
 * **버전 식별자**: `usage-estimator@2026-05-10` — ADR-0021 §검증 4 매핑 정확도
 * 평가의 출처. PLAN 3.5 계산 근거 펼치기에 노출 (T7).
 */
export const USAGE_ESTIMATOR_VERSION = 'usage-estimator@2026-05-10';

export function deriveUsageProfile(
  category: TariffCategoryInput,
  householdType: HouseholdTypeInput | undefined,
  inputAttributes: Readonly<Record<string, unknown>>,
): UsageProfile {
  // householdType 부재 시 single 로 fallback (가장 보수적 — 작은 가구).
  const ht: HouseholdTypeInput = householdType ?? 'single';

  // 카테고리별 기본 프로파일을 base 로, inputAttributes 명시값으로 덮어쓰기.
  // 명시값 우선 — 사용자가 직접 입력한 정보를 최우선 (P1).
  if (category === 'mobile') {
    const base = MOBILE_DEFAULTS[ht];
    return {
      householdType: ht,
      data_gb_used: pickNumber(inputAttributes, 'data_gb_used', base.data_gb_used),
      voice_minutes_used: pickNumber(inputAttributes, 'voice_minutes_used', base.voice_minutes_used),
      sms_count: pickNumber(inputAttributes, 'sms_count', base.sms_count),
      eu_roaming_needed: pickBoolean(inputAttributes, 'eu_roaming_needed', base.eu_roaming_needed),
    };
  }

  if (category === 'internet_fixed') {
    const base = INTERNET_DEFAULTS[ht];
    return {
      householdType: ht,
      download_mbps_needed: pickNumber(inputAttributes, 'download_mbps_needed', base.download_mbps_needed),
      household_devices: pickNumber(inputAttributes, 'household_devices', base.household_devices),
      streaming_4k: pickBoolean(inputAttributes, 'streaming_4k', base.streaming_4k),
    };
  }

  if (category === 'bundle_internet_tv') {
    const base = BUNDLE_DEFAULTS[ht];
    return {
      householdType: ht,
      download_mbps_needed: pickNumber(inputAttributes, 'download_mbps_needed', base.download_mbps_needed),
      household_devices: pickNumber(inputAttributes, 'household_devices', base.household_devices),
      streaming_4k: pickBoolean(inputAttributes, 'streaming_4k', base.streaming_4k),
      tv_channels_needed: pickNumber(inputAttributes, 'tv_channels_needed', base.tv_channels_needed),
      tv_4k_needed: pickBoolean(inputAttributes, 'tv_4k_needed', base.tv_4k_needed),
    };
  }

  // landline
  const base = LANDLINE_DEFAULTS[ht];
  return {
    householdType: ht,
    calls_be_minutes_needed: pickNumber(inputAttributes, 'calls_be_minutes_needed', base.calls_be_minutes_needed),
  };
}

// ─── 내부 helper — 타입 안전 picker ────────────────────────────────────────

function pickNumber(
  attrs: Readonly<Record<string, unknown>>,
  key: string,
  fallback: number,
): number {
  const v = attrs[key];
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
}

function pickBoolean(
  attrs: Readonly<Record<string, unknown>>,
  key: string,
  fallback: boolean,
): boolean {
  const v = attrs[key];
  return typeof v === 'boolean' ? v : fallback;
}
