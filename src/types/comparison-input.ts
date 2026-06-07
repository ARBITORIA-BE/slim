/**
 * Comparison input — 3단계 입력 플로우의 Zod schema 단일 출처.
 *
 * ADR-0016 §T4 (household) + §T5 (current-provider) + §T7 (preview) 에서
 * 정의된 모든 입력 모양을 한 파일에 모은다. RHF resolver +
 * 서버 액션 재검증(ADR-0016 §T7 클라이언트 우회 방어) 둘 다 본 schema 사용.
 *
 * ADR-0043 Amendment (2026-06-08): 통신 카테고리에서 ZIP 단계 제거.
 *   postal 입력이 비교 가격에 영향 없음 (BE carrier 전국 동일가) →
 *   postal 단계 삭제, postal 필드는 DB 컬럼 보존을 위해 .optional() 유지.
 *   POSTAL_COUNTRIES / postalCountrySchema / postalCodeSchema = DEPRECATED in 통신,
 *   미래 카테고리 reverse 트리거 시 재활성 (ADR-0043 §D2).
 *
 * 카테고리별 사용량 추정 매핑 (T4) 은 페이즈 2 후반 또는 페이즈 3 진입 시 결정 —
 * 현재는 inputAttributes 빈 객체 default.
 *
 * 결정 근거: docs/adr/0016-phase-2-input-flow-design.md + ADR-0043
 */

import { z } from 'zod';

// ─── 카테고리 (ADR-0042 §D1 enum 5값 — Amendment 2, 2026-06-07) ──────────

export const TARIFF_CATEGORIES = [
  'mobile',
  'internet_fixed',
  'bundle_mobile_internet',       // [신설] Love Duo, Flex+ dual, Telenet KLIK+Internet 등 — mobile+internet 듀얼 (TV 없음, cord-cutter)
  'bundle_internet_tv',           // [의미 명확화] Internet+TV 듀얼 (mobile 없음) — Proximus Flex+ Internet+TV (이중 거주지), Orange Love Trio without mobile
  'bundle_mobile_internet_tv',    // [신설] Triple play — Proximus Flex+ Go/Mega/Giga/Ultra, Telenet ONE up (legacy), Orange Love Trio + Mobile
] as const;

export const tariffCategorySchema = z.enum(TARIFF_CATEGORIES);
export type TariffCategoryInput = z.infer<typeof tariffCategorySchema>;

// ─── 우편번호 (ADR-0016 §T3 + ADR-0021 §T10) ─────────────────────────────
// ADR-0043 §D2 — DEPRECATED in 통신, 미래 카테고리 reverse 트리거.
// 에너지/모기지/보험 등 지역 가격 차이가 있는 카테고리 진입 시 별 ADR로 재활성.
// DB 컬럼 (comparison_request.postal_code nullable) + 이 schema는 그대로 보존.

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
 * NL/LU 확장) + ADR-0043 §D2 (통신 deprecated, DB 보존).
 */
export const POSTAL_COUNTRIES = ['BE', 'NL', 'LU'] as const;
export const postalCountrySchema = z.enum(POSTAL_COUNTRIES);
export type PostalCountry = z.infer<typeof postalCountrySchema>;

// ADR-0036 D1: Zod message = locale-free key token. display component maps via t().
// Schema stays single-source (ADR-0016 §T7); no factory, no errorMap.
export const postalCodeSchema = z.discriminatedUnion('country', [
  z.object({
    country: z.literal('BE'),
    postalCode: z
      .string()
      .regex(
        /^[1-9][0-9]{3}$/,
        'validation.postal.be',
      ),
  }),
  z.object({
    country: z.literal('NL'),
    // PC4 ("1234") or PC6 ("1234 AB" / "1234AB") — UPU Netherlands.
    // PC6 letters must be uppercase (UI auto-uppercases on input).
    postalCode: z
      .string()
      .regex(
        /^[1-9][0-9]{3}( ?[A-Z]{2})?$/,
        'validation.postal.nl',
      ),
  }),
  z.object({
    country: z.literal('LU'),
    postalCode: z
      .string()
      .regex(
        /^[1-9][0-9]{3}$/,
        'validation.postal.lu',
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
// ADR-0036 D1: custom refine message also uses key token.
export const currentProviderSchema = z
  .object({
    currentProviderId: z.string().uuid().nullable(),
    currentTariffId: z.string().uuid().nullable(),
  })
  .refine(
    ({ currentProviderId, currentTariffId }) =>
      !(currentTariffId !== null && currentProviderId === null),
    {
      message: 'validation.currentProvider.tariffWithoutProvider',
      path: ['currentTariffId'],
    },
  );
export type CurrentProviderInput = z.infer<typeof currentProviderSchema>;

// ─── 3단계 누적 입력 (preview 단계 = ADR-0016 §T7) ──────────────────────

/**
 * 3단계 모두 마친 시점의 *전체* 입력. preview 단계가 서버 액션
 * `POST /api/compare` 호출 직전에 한 번 더 safeParse 로 검증 (클라이언트 우회
 * 방어 — ADR-0016 §T7).
 *
 * ADR-0043 §D2: postal 필드 .optional() 격상 — DB 컬럼 nullable 보존.
 *   통신 카테고리는 postal 입력 없이 비교 가능 (BE carrier 전국 동일가).
 *   미래 카테고리(에너지 등) reverse 시 postal 필드 재활성 — schema 변경 minimal.
 *
 * 매핑 → ADR-0007 §T2 `comparison_request` 컬럼:
 *   category            → comparison_request.category
 *   postal?.postalCode  → comparison_request.postal_code (nullable, ADR-0043 §D2)
 *   householdType       → comparison_request.household_type
 *   currentProviderId   → comparison_request.current_provider_id
 *   inputAttributes     → comparison_request.input_attributes (JSONB)
 *                          + currentTariffId 키도 본 객체에 흡수 (ADR-0016 §T5)
 */
export const comparisonInputSchema = z.object({
  category: tariffCategorySchema,
  // ADR-0043 §D2: postal optional — 통신 카테고리 ZIP 단계 제거, DB nullable 보존.
  postal: postalCodeSchema.optional(),
  householdType: householdTypeSchema,
  currentProviderId: z.string().uuid().nullable(),
  currentTariffId: z.string().uuid().nullable(),
  inputAttributes: z.record(z.string(), z.unknown()).default({}),
});
export type ComparisonInput = z.infer<typeof comparisonInputSchema>;

// ─── 단계별 schema 묶음 (RHF resolver 단계별 호출용) ──────────────────────
// ADR-0043: postal 키 제거 — 통신 카테고리 3단계 흐름 (household → current-provider → preview).

export const stepSchemas = {
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
  // ADR-0016 Amendment 3: 'bill' 단계 제거 (ADR-0041 Amendment 2 D9, 2026-06-06).
  // ADR-0043 (2026-06-08): 'postal' 단계 제거 — 통신 카테고리 3단계.
  // 'postal' enum 값 제거. 기존 v1 sessionStorage 에 'postal' step 이 있으면
  // safeParse 실패 → emptyState 복원 (useCompareSession 안전 fallback).
  step: z.enum(['household', 'current-provider', 'preview']),
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
