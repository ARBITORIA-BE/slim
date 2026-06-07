/**
 * ComparisonRequest — 사용자 비교 요청 입력 (PLAN 1.4)
 *
 * 사용자가 비교를 요청할 때 입력한 *원본*을 보존하는 테이블. 헌법 §8 #1
 * "사용자 데이터를 외부로 보내지 않는다 — GDPR Art. 6(1)(a)" 의 스키마 레이어
 * 강제 위치.
 *
 * 결정 근거: docs/adr/0007-comparison-request-result-schema.md
 *
 * 핵심 설계 원칙 (ADR-0007):
 *   T1. 익명 UUID PK + `userAccountId` 미리 두기 (페이즈 6 회원가입 결합 대비).
 *       세션 fingerprint 컬럼 0 (Recital 26 가명화 회피, 헌법 §8 #5).
 *   T2. 평탄화 핵심 4 컬럼 (category / postalCode / householdType / currentProviderId)
 *       + JSONB inputAttributes (카테고리별 변동 — Zod 단일 출처는
 *       src/types/comparison-input.ts, 1.7과 함께 신설).
 *   T3. 합법근거 = GDPR Art. 6(1)(b) Contract performance (1차) + (a) Consent
 *       (어필리에이트 리다이렉트, 페이즈 4.1).
 *   T4. 리텐션 = 90일 후 PII 컬럼(postalCode → PC2 일반화, inputAttributes →
 *       NULL) 갱신. 행 자체는 영구. 1.5.2 cron 보조 작업에서 수행.
 *   T5. IP / device fingerprint 컬럼 0 (헌법 §8).
 *
 * onDelete 정책:
 *   - currentProviderId → provider(id) ON DELETE SET NULL — provider 행 삭제는
 *     매우 드물지만(ADR-0001 onDelete: restrict 정책) 발생 시 비교 요청은 익명
 *     보존.
 *
 * harness:data Rule 4 영향 없음 — source_url/fetched_at은 tariff_snapshot 단독.
 */

import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { provider } from './provider';
import { tariffCategoryEnum } from './tariff';

// ─── Enums ────────────────────────────────────────────────────────────────

/**
 * 가구 형태. 사용량 추정 fallback 입력 (PLAN 2.3).
 *
 * - `single`: 혼자 거주
 * - `couple`: 2인
 * - `family_3_plus`: 3인 이상
 *
 * 페이즈 5 카테고리 확장 시(에너지/모기지) 더 세분화 가능 — ADR + ALTER TYPE.
 */
export const householdTypeEnum = pgEnum('household_type', [
  'single',
  'couple',
  'family_3_plus',
]);

// ─── Table ────────────────────────────────────────────────────────────────

export const comparisonRequest = pgTable(
  'comparison_request',
  {
    /**
     * 익명 UUID (T1). 사용자 추적 불가 — 진짜 익명. Recital 26의 *익명 데이터*
     * 를 의도. 페이즈 6 회원 시스템 도입 시 명시 동의 후에만 userAccountId와
     * 결합.
     */
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * 회원 계정 결합 (페이즈 6.4 GDPR 다운로드/삭제용). 페이즈 1~5 시점에는
     * 항상 NULL — 그래도 컬럼은 미리 둠 → 회원 시스템 도입 시 마이그레이션
     * 0건으로 결합.
     *
     * 페이즈 6에서 별도 `user_account` 테이블 신설 + FK 추가 (그 시점 ADR).
     */
    userAccountId: uuid('user_account_id'),

    // ─── 평탄화 핵심 입력 (T2) ─────────────────────────────────────────────

    /**
     * 카테고리 — ADR-0005 §T6 enum 재사용. 페이즈 1은 통신 4값.
     * 비교 엔진(1.11) hot path 의 1차 필터 키.
     */
    category: tariffCategoryEnum('category').notNull(),

    /**
     * 우편번호 (PLAN 2.2). 형식:
     *   BE: 4자리 숫자 (예: "1000")
     *   NL: 4자리 숫자 또는 PC6 "1234 AB" (페이즈 1은 PC4 권장)
     *   LU: 4자리 숫자
     * 형식 검증은 Zod 책임 (src/types/comparison-input.ts).
     *
     * **GDPR 정책 (T4)**: 90일 후 1.5.2 cron이 PC2 (앞 2자리, 지역 단위) 로
     * 일반화. quasi-identifier 위험 완화 (ADR-0007 §외부 사실 — Koot 2010).
     */
    // ADR-0043 §D2: nullable 격상 — 통신 카테고리 ZIP 단계 제거.
    // 미래 카테고리(에너지 등) 진입 시 postal 제출 재개 가능 (nullable 보존).
    postalCode: text('postal_code'),

    /** 가구 형태 (PLAN 2.3) — 사용량 추정 fallback 의 핵심 변수. */
    householdType: householdTypeEnum('household_type').notNull(),

    /**
     * 현재 공급사 (PLAN 2.4 — 선택적, 모르면 스킵). NULL = 모르거나 없음.
     * provider 행 삭제 시 SET NULL — 비교 요청은 익명 보존 (T1 정신).
     */
    currentProviderId: uuid('current_provider_id').references(
      () => provider.id,
      { onDelete: 'set null' },
    ),

    // ─── JSONB 입력 (T2) ───────────────────────────────────────────────────

    /**
     * 카테고리별 변동 입력. Zod 단일 출처 = src/types/comparison-input.ts (1.7).
     *
     * 권장 키 (강제 X — fetcher / 1.11 비교 엔진 가이드):
     *   mobile: {
     *     data_gb_used: number,           // 월 평균 사용량
     *     voice_minutes_used: number,
     *     sms_count: number,
     *     eu_roaming_needed: boolean
     *   }
     *   internet_fixed: {
     *     download_mbps_needed: number,
     *     household_devices: number,      // 동시 연결 기기 수
     *     streaming_4k: boolean
     *   }
     *   bundle_internet_tv: {
     *     ...internet_fixed 키,
     *     tv_channels_needed: number,
     *     tv_4k_needed: boolean
     *   }
     *
     * **GDPR 정책 (T4)**: 90일 후 1.5.2 cron이 NULL로 갱신 (사용량 = quasi-
     * identifier 의 일부).
     */
    inputAttributes: jsonb('input_attributes').notNull().default({}),

    // ─── 메타 ───────────────────────────────────────────────────────────────

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    /**
     * 90일 리텐션 cron이 PII 컬럼을 일반화한 시각. NULL = 아직 원본 보존 중.
     * NOT NULL = postalCode 가 PC2로 일반화됨 + inputAttributes NULL.
     *
     * 1.5.2 cron 의 보조 작업 — 매일 실행 시 createdAt < NOW() - INTERVAL '90 days'
     * AND piiAnonymizedAt IS NULL 인 행을 갱신.
     */
    piiAnonymizedAt: timestamp('pii_anonymized_at', { withTimezone: true }),
  },
  (t) => [
    // 비교 엔진(1.11) hot path: 카테고리 + 우편번호 prefix 필터
    index('comparison_request_category_postal_idx').on(t.category, t.postalCode),
    // T4 리텐션 cron 의 stale row 검색
    index('comparison_request_created_at_idx').on(t.createdAt),
    // 페이즈 6.4 GDPR 다운로드 — 회원 결합 후 본인 요청 조회
    index('comparison_request_user_account_idx').on(t.userAccountId),
    // T4 cron 의 piiAnonymizedAt IS NULL 필터 가속
    index('comparison_request_pii_anonymized_idx').on(t.piiAnonymizedAt),
  ],
);

// ─── Relations (Drizzle relations API) ───────────────────────────────────

export const comparisonRequestRelations = relations(
  comparisonRequest,
  ({ one }) => ({
    currentProvider: one(provider, {
      fields: [comparisonRequest.currentProviderId],
      references: [provider.id],
    }),
  }),
);

// ─── Inferred types ───────────────────────────────────────────────────────

export type ComparisonRequest = typeof comparisonRequest.$inferSelect;
export type NewComparisonRequest = typeof comparisonRequest.$inferInsert;

/** Household type enum 값 (TS 유니온). */
export type HouseholdType = (typeof householdTypeEnum.enumValues)[number];
