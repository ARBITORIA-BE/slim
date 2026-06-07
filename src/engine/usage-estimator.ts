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
 *   - bundle_mobile_internet: internet_fixed + 모바일 (TV 없음, cord-cutter) — ADR-0042 §D1
 *   - bundle_internet_tv: internet_fixed + TV 시청 (모바일 없음 — 의미 명확화)
 *   - bundle_mobile_internet_tv: internet_fixed + TV + 모바일 (triple play) — ADR-0042 §D1
 *
 * `landline` 제거 (ADR-0005 §Amendment 1, 2026-05-16): 베타 미시작, 데이터 0건.
 * exhaustive switch + `never` 체크로 격상 (P4 타입 안전 강화 — ADR-0010 §Amendment 1).
 * ADR-0042 §D1 (2026-06-07): enum 3→5 — bundle_mobile_internet / bundle_mobile_internet_tv 분기 추가.
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

  // exhaustive switch — 카테고리 추가 시 컴파일러가 누락 분기를 잡는다 (P4, ADR-0010 §Amendment 1).
  // 명시값 우선 — 사용자가 직접 입력한 정보를 최우선 (P1).
  switch (category) {
    case 'mobile': {
      const base = MOBILE_DEFAULTS[ht];
      return {
        householdType: ht,
        data_gb_used: pickNumber(inputAttributes, 'data_gb_used', base.data_gb_used),
        voice_minutes_used: pickNumber(inputAttributes, 'voice_minutes_used', base.voice_minutes_used),
        sms_count: pickNumber(inputAttributes, 'sms_count', base.sms_count),
        eu_roaming_needed: pickBoolean(inputAttributes, 'eu_roaming_needed', base.eu_roaming_needed),
      };
    }
    case 'internet_fixed': {
      const base = INTERNET_DEFAULTS[ht];
      return {
        householdType: ht,
        download_mbps_needed: pickNumber(inputAttributes, 'download_mbps_needed', base.download_mbps_needed),
        household_devices: pickNumber(inputAttributes, 'household_devices', base.household_devices),
        streaming_4k: pickBoolean(inputAttributes, 'streaming_4k', base.streaming_4k),
      };
    }
    case 'bundle_mobile_internet': {
      // ADR-0042 §D1: mobile+internet 듀얼 (TV 없음, cord-cutter).
      // internet_fixed 기본 프로파일 재사용 — TV 필드 없음 (tv_channels_needed / tv_4k_needed X).
      const base = INTERNET_DEFAULTS[ht];
      return {
        householdType: ht,
        download_mbps_needed: pickNumber(inputAttributes, 'download_mbps_needed', base.download_mbps_needed),
        household_devices: pickNumber(inputAttributes, 'household_devices', base.household_devices),
        streaming_4k: pickBoolean(inputAttributes, 'streaming_4k', base.streaming_4k),
        // 모바일 사용량도 추정 (cord-cutter는 모바일 사용 패턴)
        data_gb_used: pickNumber(inputAttributes, 'data_gb_used', MOBILE_DEFAULTS[ht].data_gb_used),
        eu_roaming_needed: pickBoolean(inputAttributes, 'eu_roaming_needed', MOBILE_DEFAULTS[ht].eu_roaming_needed),
      };
    }
    case 'bundle_internet_tv': {
      // ADR-0042 §D1 의미 명확화: TV-only 듀얼 (모바일 없음).
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
    case 'bundle_mobile_internet_tv': {
      // ADR-0042 §D1: 트리플 플레이 (모바일 + 인터넷 + TV).
      // BUNDLE_DEFAULTS 기본값 재사용 + 모바일 사용량 추가.
      const base = BUNDLE_DEFAULTS[ht];
      return {
        householdType: ht,
        download_mbps_needed: pickNumber(inputAttributes, 'download_mbps_needed', base.download_mbps_needed),
        household_devices: pickNumber(inputAttributes, 'household_devices', base.household_devices),
        streaming_4k: pickBoolean(inputAttributes, 'streaming_4k', base.streaming_4k),
        tv_channels_needed: pickNumber(inputAttributes, 'tv_channels_needed', base.tv_channels_needed),
        tv_4k_needed: pickBoolean(inputAttributes, 'tv_4k_needed', base.tv_4k_needed),
        data_gb_used: pickNumber(inputAttributes, 'data_gb_used', MOBILE_DEFAULTS[ht].data_gb_used),
        eu_roaming_needed: pickBoolean(inputAttributes, 'eu_roaming_needed', MOBILE_DEFAULTS[ht].eu_roaming_needed),
      };
    }
    default: {
      // never 체크 — 이 분기에 도달하면 컴파일 에러 (카테고리 추가 시 위에 case 추가 필수).
      const _exhaustive: never = category;
      throw new Error(`deriveUsageProfile: 알 수 없는 카테고리 "${String(_exhaustive)}"`);
    }
  }
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
