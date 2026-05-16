/**
 * Comparison input — 5단계 입력 플로우의 Zod schema 단일 출처.
 *
 * ADR-0016 §T3 (postal) + §T4 (household) + §T5 (current-provider) + §T6 (bill SC-A)
 * + §T7 (preview) 에서 정의된 모든 입력 모양을 한 파일에 모은다. RHF resolver +
 * 서버 액션 재검증(ADR-0016 §T7 클라이언트 우회 방어) 둘 다 본 schema 사용.
 *
 * 페이즈 2 1차 (SC-B 적용): BE 우편번호만. NL/LU 는 페이즈 3 진입 직전 추가
 * (ADR-0016 §T3). 추가 시 본 파일의 postalCodeSchema 만 갱신 — UI/서버는 그대로.
 *
 * 카테고리별 사용량 추정 매핑 (T4) 은 페이즈 2 후반 또는 페이즈 3 진입 시 결정 —
 * 현재는 inputAttributes 빈 객체 default.
 *
 * 결정 근거: docs/adr/0016-phase-2-input-flow-design.md
 */

import { z } from 'zod';

// ─── 카테고리 (ADR-0005 §T6 enum 3값 — Amendment 1, 2026-05-16) ──────────

export const TARIFF_CATEGORIES = [
  'mobile',
  'internet_fixed',
  'bundle_internet_tv',
] as const;

export const tariffCategorySchema = z.enum(TARIFF_CATEGORIES);
export type TariffCategoryInput = z.infer<typeof tariffCategorySchema>;

// ─── 우편번호 (ADR-0016 §T3 + ADR-0021 §T10) ─────────────────────────────

/**
 * 베네룩스 3국 우편번호 — country discriminator + 국가별 regex.
 *
 * - **BE**: 4자리 숫자 1000~9999 (Universal Postal Union — Belgium).
 *   첫 자리 0 거부 (벨기에 우편번호는 1xxx~9xxx).
 * - **NL**: PC4 ("1234") 또는 PC6 ("1234 AB" / "1234AB") 둘 다 허용.
 *   첫 자리 0 거부 (네덜란드 우편번호는 1xxx~9xxx, UPU NL).
 * - **LU**: 4자리 숫자 1000~9999 (BE와 형식 동일하지만 country 분기 필수 —
 *   비교 후보 SELECT 의 p.country 필터 때문).
 *
 * NL/LU 비교 후보는 페이즈 5에서 fetcher 추가될 때까지 0 — 결과 페이지가
 * "공급사 추가 예정" 정직 안내 (ADR-0021 §T10 본문).
 *
 * 결정 근거: ADR-0016 §T3 (SC-B BE 1차) + ADR-0021 §T10 (페이즈 3 진입 직전
 * NL/LU 확장).
 */
export const POSTAL_COUNTRIES = ['BE', 'NL', 'LU'] as const;
export const postalCountrySchema = z.enum(POSTAL_COUNTRIES);
export type PostalCountry = z.infer<typeof postalCountrySchema>;

export const postalCodeSchema = z.discriminatedUnion('country', [
  z.object({
    country: z.literal('BE'),
    postalCode: z
      .string()
      .regex(
        /^[1-9][0-9]{3}$/,
        '벨기에(BE) 우편번호는 1000~9999 사이의 4자리 숫자여야 합니다 (예: 1000, 9000)',
      ),
  }),
  z.object({
    country: z.literal('NL'),
    // PC4 ("1234") 또는 PC6 ("1234 AB" / "1234AB") — UPU Netherlands.
    // PC6 알파벳은 반드시 대문자 (소문자 입력 시 UI 단계에서 자동 대문자화).
    postalCode: z
      .string()
      .regex(
        /^[1-9][0-9]{3}( ?[A-Z]{2})?$/,
        '네덜란드(NL) 우편번호는 4자리 숫자 또는 4자리+대문자 2자입니다 (예: 1011, 1011 AB)',
      ),
  }),
  z.object({
    country: z.literal('LU'),
    postalCode: z
      .string()
      .regex(
        /^[1-9][0-9]{3}$/,
        '룩셈부르크(LU) 우편번호는 1000~9999 사이의 4자리 숫자여야 합니다 (예: 1000, 4000)',
      ),
  }),
]);
export type PostalCodeInput = z.infer<typeof postalCodeSchema>;

// ─── 가구 형태 (ADR-0016 §T4, ADR-0007 §T2 enum 그대로) ─────────────────

export const HOUSEHOLD_TYPES = ['single', 'couple', 'family_3_plus'] as const;
export const householdTypeSchema = z.enum(HOUSEHOLD_TYPES);
export type HouseholdTypeInput = z.infer<typeof householdTypeSchema>;

// ─── 현재 공급사 (ADR-0016 §T5, 선택적 + 스킵 동등) ──────────────────────

/**
 * 현재 공급사/요금제. 둘 다 nullable — 신규 가입자 케이스 (ADR-0010 §T7 케이스 6)
 * 자연 처리. currentTariffId 가 명시되어 있으면 currentProviderId 도 명시되어야
 * (sub-step 요금제 선택은 공급사 선택 후에만 노출 — ADR-0016 §T5).
 */
export const currentProviderSchema = z
  .object({
    currentProviderId: z.string().uuid().nullable(),
    currentTariffId: z.string().uuid().nullable(),
  })
  .refine(
    ({ currentProviderId, currentTariffId }) =>
      !(currentTariffId !== null && currentProviderId === null),
    {
      message: '요금제를 선택하려면 먼저 공급사를 선택해야 합니다',
      path: ['currentTariffId'],
    },
  );
export type CurrentProviderInput = z.infer<typeof currentProviderSchema>;

// ─── 5단계 누적 입력 (preview 단계 = ADR-0016 §T7) ──────────────────────

/**
 * 5단계 모두 마친 시점의 *전체* 입력. preview 단계가 서버 액션
 * `POST /api/compare` 호출 직전에 한 번 더 safeParse 로 검증 (클라이언트 우회
 * 방어 — ADR-0016 §T7).
 *
 * 매핑 → ADR-0007 §T2 `comparison_request` 컬럼:
 *   category            → comparison_request.category
 *   postal.postalCode   → comparison_request.postal_code
 *   householdType       → comparison_request.household_type
 *   currentProviderId   → comparison_request.current_provider_id
 *   inputAttributes     → comparison_request.input_attributes (JSONB)
 *                          + currentTariffId 키도 본 객체에 흡수 (ADR-0016 §T5)
 */
export const comparisonInputSchema = z.object({
  category: tariffCategorySchema,
  postal: postalCodeSchema,
  householdType: householdTypeSchema,
  currentProviderId: z.string().uuid().nullable(),
  currentTariffId: z.string().uuid().nullable(),
  inputAttributes: z.record(z.string(), z.unknown()).default({}),
});
export type ComparisonInput = z.infer<typeof comparisonInputSchema>;

// ─── 단계별 schema 묶음 (RHF resolver 단계별 호출용) ──────────────────────

export const stepSchemas = {
  postal: postalCodeSchema,
  household: z.object({ householdType: householdTypeSchema }),
  'current-provider': currentProviderSchema,
} as const;

export type StepName = keyof typeof stepSchemas;

// ─── sessionStorage 직렬화 모양 (ADR-0016 §T8) ────────────────────────────

/**
 * `slim:compare:[category]:state` v1 — sessionStorage 키.
 * 매 입력 즉시 저장, 페이지 새로고침 시 복원 (T8).
 */
export const SESSION_STATE_VERSION = 1;

export const sessionStateSchema = z.object({
  version: z.literal(SESSION_STATE_VERSION),
  category: tariffCategorySchema,
  step: z.enum(['postal', 'household', 'current-provider', 'bill', 'preview']),
  data: z.object({
    // postalCountry: ADR-0021 §T10 NL/LU 추가로 신설. 기존 v1 sessionStorage
    // 는 postalCountry 부재 → optional, 복원 시 default 'BE' (UI 단계에서 처리).
    postalCountry: postalCountrySchema.optional(),
    postalCode: z.string().optional(),
    householdType: householdTypeSchema.optional(),
    currentProviderId: z.string().uuid().nullable().optional(),
    currentTariffId: z.string().uuid().nullable().optional(),
    inputAttributes: z.record(z.string(), z.unknown()).optional(),
  }),
  updatedAt: z.string().datetime(),
});
export type SessionState = z.infer<typeof sessionStateSchema>;
