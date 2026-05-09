/**
 * TariffAttributes — 카테고리별 JSONB attributes Zod 스키마 (PLAN 1.8)
 *
 * 왜 이 파일이 필요한가?
 *   ADR-0005 §결정 1(T1)에서 tariff.attributes는 JSONB로 저장된다. 컬럼화하면
 *   카테고리 추가마다 마이그레이션이 필요하지만, JSONB는 런타임 Zod 검증으로
 *   타입 안전성을 보장한다. 이 파일이 그 *단일 출처*다.
 *
 * 왜 discriminated union인가?
 *   fetcher가 category를 명시하면 런타임에 올바른 schema로 safeParse 가능.
 *   cron persist step이 "잘못된 attributes면 confidence='low' + Sentry 알림"을
 *   구현할 때 이 함수 하나만 호출하면 된다.
 *
 * 결정 근거: docs/adr/0005-tariff-schema-telecom.md §T1 + ADR-0008 §T1
 */

import { z } from 'zod';

// ─── 카테고리별 Zod 스키마 ────────────────────────────────────────────────

/**
 * 모바일 요금제 attributes.
 *
 * 왜 data_gb가 number | 'unlimited'인가?
 *   Proximus Unlimited 요금제처럼 숫자가 없는 경우가 베네룩스 표준.
 *   number로만 강제하면 fetcher가 99999로 hack → 비교 엔진 혼란.
 */
export const mobileAttributesSchema = z.object({
  category: z.literal('mobile'),
  /** 데이터 한도 (GB). 'unlimited' = 무제한 (throttle 적용 가능). */
  data_gb: z.union([z.number().nonnegative(), z.literal('unlimited')]),
  /** 음성 통화 포함 분. 'unlimited' = 무제한. */
  voice_minutes: z.union([z.number().nonnegative(), z.literal('unlimited')]),
  /** SMS 포함 건수. 'unlimited' = 무제한. */
  sms: z.union([z.number().nonnegative(), z.literal('unlimited')]),
  /** EU 로밍 기본 포함 여부. BE 규제 로밍 (2023+ EU Roam-like-at-home). */
  eu_roaming_included: z.boolean(),
  /**
   * 데이터 소진 후 throttle 속도 (kbps). null = 완전 차단 또는 추가 구매 필요.
   * Proximus Unlimited는 512 Kbps throttle — 정확한 UX 비교에 필요.
   */
  throttle_after_gb_speed_kbps: z.number().nonnegative().nullable().optional(),
});

/**
 * 가정용 고정 인터넷 요금제 attributes.
 *
 * 왜 unlimited_data가 별도 boolean인가?
 *   Telenet은 "무제한"이라 표기하지만 fair_use_gb가 있는 경우가 있다.
 *   둘 다 명시해야 비교 표(3.2)에서 "무제한 (공정 이용 1TB)" 같이 표시 가능.
 */
export const internetFixedAttributesSchema = z.object({
  category: z.literal('internet_fixed'),
  /** 다운로드 속도 (Mbps). */
  download_mbps: z.number().positive(),
  /** 업로드 속도 (Mbps). */
  upload_mbps: z.number().positive(),
  /** 데이터 완전 무제한 여부 (fair_use 없음). */
  unlimited_data: z.boolean(),
  /**
   * 공정이용정책 한도 (GB). null = 완전 무제한.
   * unlimited_data=true여도 fair_use_gb가 있을 수 있음 (Telenet 피크 throttle).
   */
  fair_use_gb: z.number().positive().nullable().optional(),
  /** Wi-Fi booster 기본 포함 여부. Telenet ONE은 기본 포함 + €2/월 추가 옵션. */
  wifi_booster_included: z.boolean(),
});

/**
 * 인터넷 + TV 번들 요금제 attributes.
 *
 * 왜 internet_fixed 키를 상속하는가?
 *   번들 요금제도 인터넷 속도가 비교 엔진 입력이다. 중복 정의하면 두 스키마의
 *   일관성을 유지하기 어려워진다. z.object로 extend하면 단일 출처 유지됨.
 */
export const bundleInternetTvAttributesSchema = internetFixedAttributesSchema
  .omit({ category: true })
  .extend({
    category: z.literal('bundle_internet_tv'),
    /** 포함된 TV 채널 수. */
    tv_channels: z.number().nonnegative(),
    /** 4K 화질 TV 포함 여부. */
    tv_4k_included: z.boolean(),
    /** DVR 녹화 용량 (시간). null = DVR 없음 또는 미상. */
    dvr_hours: z.number().nonnegative().nullable().optional(),
    /**
     * 번들에 포함된 모바일 회선 수. 0 = 모바일 없음 (인터넷+TV만).
     * Telenet ONE up 등은 모바일 회선이 번들에 포함됨.
     */
    mobile_lines_included: z.number().nonnegative(),
  });

/**
 * 유선 전화 요금제 attributes.
 *
 * 왜 international_zones가 string[]인가?
 *   공급사마다 "EU 6개국", "Zone 1 (BE/NL/LU/FR/DE/UK)" 같이 다르게 표기한다.
 *   enum화하면 포함 여부가 공급사 마케팅 문구에 의존 → 거짓 안전감.
 *   텍스트 배열로 두고 결과 페이지에서 그대로 노출하는 것이 P3 정직.
 */
export const landlineAttributesSchema = z.object({
  category: z.literal('landline'),
  /** BE 국내 통화 포함 분. 'unlimited' = 무제한. */
  calls_be_included_minutes: z.union([
    z.number().nonnegative(),
    z.literal('unlimited'),
  ]),
  /** 국제 통화 포함 구역 목록. 빈 배열 = 국제 없음. */
  international_zones: z.array(z.string()),
});

// ─── Discriminated union ───────────────────────────────────────────────────

/**
 * 모든 카테고리 attributes의 discriminated union.
 * category 필드가 discriminant — cron persist step에서 safeParse 분기에 사용.
 *
 * 왜 discriminated union인가?
 *   parseTariffAttributes가 category 하나만으로 올바른 스키마를 선택하도록.
 *   switch문이 exhaustive 체크를 컴파일러가 보장 → 새 카테고리 추가 시 자동 에러.
 */
export const tariffAttributesSchema = z.discriminatedUnion('category', [
  mobileAttributesSchema,
  internetFixedAttributesSchema,
  bundleInternetTvAttributesSchema,
  landlineAttributesSchema,
]);

export type TariffAttributes = z.infer<typeof tariffAttributesSchema>;
export type MobileAttributes = z.infer<typeof mobileAttributesSchema>;
export type InternetFixedAttributes = z.infer<typeof internetFixedAttributesSchema>;
export type BundleInternetTvAttributes = z.infer<typeof bundleInternetTvAttributesSchema>;
export type LandlineAttributes = z.infer<typeof landlineAttributesSchema>;

// ─── Parse helper (cron persist step에서 사용) ────────────────────────────

/**
 * category + raw unknown 값을 받아 해당 스키마로 safeParse.
 *
 * 왜 Result<T, E> 패턴인가?
 *   헌법 §코드 컨벤션 — "비동기는 Result<T, E> 패턴". 동기여도 throw 대신
 *   Result를 반환해 cron step에서 try-catch 없이 분기 가능.
 *
 * 사용 예:
 *   const result = parseTariffAttributes('mobile', input.attributes);
 *   if (!result.ok) {
 *     // confidence='low' 마킹 + Sentry
 *   }
 */
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: z.ZodError };

export function parseTariffAttributes(
  category: string,
  raw: unknown,
): ParseResult<TariffAttributes> {
  // category 필드를 raw에 병합해 discriminated union safeParse에 전달.
  // raw가 object가 아닌 경우도 zod가 처리한다.
  const withCategory =
    raw && typeof raw === 'object' ? { ...raw, category } : { category };

  const result = tariffAttributesSchema.safeParse(withCategory);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return { ok: false, error: result.error };
}
