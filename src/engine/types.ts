/**
 * Compare engine 입력 타입 정의 (PLAN 1.11)
 *
 * 결정 근거: docs/adr/0010-comparison-engine.md
 *
 * 왜 별도 파일인가?
 *   compare.ts 가 비대해지지 않게 입출력 데이터 모양만 분리. 테스트 (compare.test.ts)
 *   가 이 파일만 import 하면 mocks 작성이 단순.
 *
 * 왜 TariffSnapshotInput (ADR-0008) 을 그대로 쓰지 않는가?
 *   TariffSnapshotInput 은 *fetcher 입력* — DB insert 전 모양. compare() 는
 *   *DB 행* (TariffSnapshot) 을 받는다. 두 모양은 비슷하지만 id/fetchedAt 등이
 *   추가됨. 또한 테스트에서는 cents 컬럼만 있으면 충분하므로 TariffSnapshotLike
 *   (= 부분집합) 로 정의해 mocks 작성이 가벼움.
 */

import type { TariffCategory } from '@/db/schema/tariff';
import type { Confidence } from '@/db/schema/tariff_snapshot';

// ─── TariffSnapshot 의 비교 엔진 입력 부분집합 ────────────────────────────

/**
 * compare() 가 사용하는 tariff_snapshot 컬럼들. 실제 DB 행 (TariffSnapshot)
 * 또는 fetcher 출력 (TariffSnapshotInput) 을 어댑터 없이 직접 받을 수 있도록
 * 두 모양의 *공통 부분집합* 으로 정의.
 *
 * 왜 readonly 인가?
 *   compare() 는 순수 함수 — 입력을 변형하지 않는다. readonly 강제로
 *   실수 방지.
 */
export interface TariffSnapshotLike {
  /** ADR-0007 comparison_result_item.tariffSnapshotId FK 의 source. */
  readonly id: string;
  /** ADR-0008 §T1 — provider 매칭 + 자기 참조 제외 (compare T1). */
  readonly providerSlug: string;
  /** ADR-0008 §T1 — tariff 식별 + 자기 참조 제외. */
  readonly tariffSlug: string;
  /** ADR-0005 §T6 — 카테고리 동일 후보만 비교 (compare T1). */
  readonly category: TariffCategory;

  // 가격 (정수 cents — ADR-0005 §T2)
  readonly monthlyPriceCents: number;
  readonly activationFeeCents: number;
  readonly modemRentalCents: number | null;
  readonly promoPriceCents: number | null;
  readonly promoMonths: number | null;

  // 약정 — caveat 트리거
  readonly commitmentMonths: number;
  readonly earlyTerminationFeeCents: number | null;

  // attributes — caveat 룰의 입력 (T6)
  readonly attributes: Readonly<Record<string, unknown>>;

  // 신뢰도 — T5 입력
  readonly confidence: Confidence;
  readonly confidenceReason: string | null;
  readonly isAnomaly: boolean;
}

// ─── 사용량 프로파일 — comparison_request.input_attributes 와 매핑 ─────

/**
 * 사용자 사용량 프로파일. ADR-0007 §T2 inputAttributes JSONB 의 *비교 엔진
 * 친화 표현*. comparison_request 의 input_attributes 가 이 모양으로 normalize
 * 되어 compare() 에 전달됨.
 *
 * 왜 모든 필드가 optional 인가?
 *   PLAN 2.4/2.5 — 사용자가 모르거나 스킵하면 undefined. 입력 부재 시 caveat
 *   생성 X (T6). 운영자 강제 X.
 *
 * 카테고리별 사용 의도:
 *   mobile          → data_gb_used / voice_minutes_used / sms_count
 *   internet_fixed  → download_mbps_needed / streaming_4k
 *   bundle_internet_tv → ..internet_fixed + tv_4k_needed
 *   landline        → calls_be_minutes_needed
 */
export interface UsageProfile {
  /** PLAN 2.3 가구 형태 — caveat 1건은 안 만들지만 향후 추정 fallback 입력. */
  readonly householdType?: 'single' | 'couple' | 'family_3_plus';

  // mobile
  readonly data_gb_used?: number;
  readonly voice_minutes_used?: number;
  readonly sms_count?: number;
  readonly eu_roaming_needed?: boolean;

  // internet_fixed / bundle_internet_tv
  readonly download_mbps_needed?: number;
  readonly household_devices?: number;
  readonly streaming_4k?: boolean;

  // bundle_internet_tv
  readonly tv_channels_needed?: number;
  readonly tv_4k_needed?: boolean;

  // landline
  readonly calls_be_minutes_needed?: number;
  readonly international_zones?: readonly string[];
}
