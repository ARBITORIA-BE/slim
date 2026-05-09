/**
 * Tariff — 요금제 마스터 테이블 (PLAN 1.2)
 *
 * 통신 BE (모바일 + 인터넷, 추후 fixed-line + bundle 확장) 한정. 페이즈 5에서
 * 에너지/모기지/보험 카테고리 도입 시 enum 확장 + 마이그레이션 (ADR-XXXX 별도).
 *
 * 결정 근거: docs/adr/0005-tariff-schema-telecom.md
 *
 * 핵심 설계 원칙 (ADR-0005):
 *   T1. 단일 테이블 + JSONB `attributes` (디버깅 용이성 우선; 솔로 운영자 컨텍스트)
 *   T2. 가격은 정수 cents (BIGINT). 부동소수 오차 = 0 (1.12 ±0.01€ DoD 보장)
 *   T3. `commitment_months` INT (0 = 약정없음) + `early_termination_fee_cents` NULL
 *   T4. 프로모는 평탄화 (`promo_price_cents`, `promo_months`) — 별도 테이블 YAGNI
 *   T5. `tariff` = 마스터 (현재 판매 중 여부). 시계열은 1.3 `tariff_snapshot`이 담당
 *   T6. `tariff_category` enum — `mobile`, `internet_fixed`, `bundle_internet_tv`, `landline`
 */

import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { provider } from './provider';

// ─── Enums ────────────────────────────────────────────────────────────────

/**
 * 요금제 카테고리. 페이즈 1은 통신 BE만.
 *
 * - `mobile`: 모바일 요금제 (음성/SMS/데이터). Proximus, Orange BE, Telenet 등.
 * - `internet_fixed`: 가정용 고정 인터넷 (속도/데이터). Telenet, VOO, Proximus.
 * - `bundle_internet_tv`: 인터넷+TV 묶음. Telenet ONE, Proximus Flex 등.
 * - `landline`: 유선 전화 단일 (드물지만 시니어 대상으로 존재).
 *
 * 페이즈 5에서 `energy_electricity`, `energy_gas`, `mortgage`, `insurance_*`
 * 추가 예정. 추가는 항상 ADR + `ALTER TYPE ADD VALUE` 마이그레이션으로.
 */
export const tariffCategoryEnum = pgEnum('tariff_category', [
  'mobile',
  'internet_fixed',
  'bundle_internet_tv',
  'landline',
]);

/**
 * 요금제 단위 통화. 베네룩스는 EUR 단일이지만 enum으로 강제해 fetcher에서
 * 다른 통화 raw payload가 흘러들어오는 것을 차단.
 *
 * 페이즈 5에서 다국 확장 시 enum 확장 + 마이그레이션 (ADR-XXXX).
 */
export const currencyEnum = pgEnum('currency', ['EUR']);

// ─── Table ────────────────────────────────────────────────────────────────

export const tariff = pgTable(
  'tariff',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** 공급사 FK. 1.1 `provider`. ADR-0001 §후속 작업: `onDelete: restrict`. */
    providerId: uuid('provider_id')
      .notNull()
      .references(() => provider.id, { onDelete: 'restrict' }),

    /** 요금제 카테고리. 페이즈 1은 4값(통신). */
    category: tariffCategoryEnum('category').notNull(),

    /** 표시용 요금제 이름 (예: "Mobile Smart", "ONE up"). */
    name: text('name').notNull(),

    /** URL 슬러그 (kebab-case). 결과 페이지 / 어드민 라우팅 / 영구 링크. */
    slug: text('slug').notNull(),

    /**
     * 통화. 베네룩스는 EUR 단일. enum으로 fetcher 무결성 강제.
     */
    currency: currencyEnum('currency').notNull().default('EUR'),

    // ─── 가격 (정수 cents — T2) ────────────────────────────────────────────

    /**
     * 정상 월정액 (cents, EUR). 예: €25.00 → 2500.
     *
     * BIGINT 사용 이유: 부동소수 오차 0. 비교 엔진(1.11)의 ±0.01€ DoD(1.12)는
     * decimal로는 라운딩 누적 위험. cents 정수는 +/-/* 모두 무손실.
     *
     * 표시 시점에 ÷100 으로 변환 (`Intl.NumberFormat` 사용; 페이즈 3.1 결과 카드).
     */
    monthlyPriceCents: bigint('monthly_price_cents', { mode: 'number' }).notNull(),

    /**
     * 1회성 활성화 비용 (cents). 무료면 0. NULL 아님 (명시 0과 미상은 다름 →
     * 미상은 fetcher가 `attributes.activation_fee_unknown = true` 로 표시).
     */
    activationFeeCents: bigint('activation_fee_cents', { mode: 'number' })
      .notNull()
      .default(0),

    /**
     * 모뎀/장비 임대비 월 (cents). NULL = 모뎀 임대 개념 없음 (예: 모바일 요금제).
     * 0 = 무료 임대 (예: Telenet ONE 무료 Wi-Fi booster).
     */
    modemRentalCents: bigint('modem_rental_cents', { mode: 'number' }),

    // ─── 약정 (T3) ──────────────────────────────────────────────────────────

    /**
     * 약정 기간 (월). 0 = 약정없음(non-binding) — Proximus가 명시적으로
     * 광고하는 카테고리. 12, 24가 일반적.
     */
    commitmentMonths: integer('commitment_months').notNull().default(0),

    /**
     * 조기 해지 위약금 (cents). NULL = 약정없음 또는 미상. 약정 + 위약금이
     * 모두 명시된 요금제만 NOT NULL이 의미를 가짐.
     */
    earlyTerminationFeeCents: bigint('early_termination_fee_cents', {
      mode: 'number',
    }),

    // ─── 프로모 평탄화 (T4) ─────────────────────────────────────────────────

    /**
     * 프로모 적용 가격 (cents). NULL = 프로모 없음.
     * 예: Proximus "6 months discount" → 정상 €25, 프로모 €15 / 6개월.
     */
    promoPriceCents: bigint('promo_price_cents', { mode: 'number' }),

    /**
     * 프로모 지속 개월. NULL = 프로모 없음 (또는 영구 할인은 아예 정상가에 반영).
     * 일반적으로 3, 6, 12.
     */
    promoMonths: integer('promo_months'),

    /**
     * 프로모 사람 친화 설명 (예: "처음 6개월 €10 할인"). i18n은 1.10 이후 재논의.
     * NULL = 프로모 없음.
     */
    promoDescription: text('promo_description'),

    // ─── 카테고리별 변동 속성 (T1 JSONB) ────────────────────────────────────

    /**
     * 카테고리별 변동 속성. P4 (타입 안전) 과의 트레이드오프:
     * 컬럼화하면 카테고리 추가마다 마이그레이션, JSONB는 런타임 검증.
     *
     * 필드 스키마는 src/types/tariff-attributes.ts (Zod) 가 단일 출처가 된다 (1.7).
     *
     * 카테고리별 권장 키 (절대 강제 아님 — fetcher가 점진 추가):
     *   mobile: { data_gb: number | 'unlimited', voice_minutes: number | 'unlimited',
     *             sms: number | 'unlimited', eu_roaming_included: boolean,
     *             throttle_after_gb_speed_kbps: number | null }
     *   internet_fixed: { download_mbps: number, upload_mbps: number,
     *                     unlimited_data: boolean, fair_use_gb: number | null,
     *                     wifi_booster_included: boolean }
     *   bundle_internet_tv: { ...internet_fixed 키 } + { tv_channels: number,
     *                     tv_4k_included: boolean, dvr_hours: number | null,
     *                     mobile_lines_included: number }
     *   landline: { calls_be_included_minutes: number | 'unlimited',
     *               international_zones: string[] }
     *
     * 모든 카테고리 공통 (선택):
     *   { lang_pages_supported: ('nl-BE'|'fr-BE'|'en')[], target_segments: string[],
     *     activation_fee_unknown: boolean }
     */
    attributes: jsonb('attributes').notNull().default({}),

    // ─── 마스터 / 신선도 (T5) ──────────────────────────────────────────────

    /**
     * 공급사가 *현재* 이 요금제를 판매 중인가.
     *   true  → 비교에 포함 가능
     *   false → 단종/내부 전환됨 (fetcher가 페이지에서 사라짐을 감지하면 false로)
     *
     * 시계열 보존은 1.3 `tariff_snapshot`이 담당하므로 `tariff` 자체는 불필요한
     * `valid_to` 컬럼을 두지 않는다. PLAN 1.2 원안의 `valid_from/valid_to`는
     * 에너지 카테고리 가정 (요금기간 명시 계약) — 통신은 마스터/스냅샷 분리가 더 자연.
     */
    isActive: boolean('is_active').notNull().default(true),

    /**
     * Fetcher가 이 마스터 레코드를 마지막으로 *재확인*한 시각.
     * - 1.3 `tariff_snapshot.fetched_at` 의 최신값과 동기화됨.
     * - 24h 이상 stale이면 결과 페이지에서 `<StaleLabel>` 노출 (P1).
     */
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),

    /**
     * 공급사 공식 페이지 URL (마스터). 1.3 snapshot의 source_url과 같거나 더
     * 일반적인 메인 페이지 URL. 결과 페이지 3층(원본 링크) — P1.
     */
    sourceUrl: text('source_url').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // 동일 공급사 + 동일 슬러그 중복 방지
    uniqueIndex('tariff_provider_slug_unique').on(t.providerId, t.slug),
    // 비교 엔진(1.11)의 hot path: "active 요금제 of category X"
    index('tariff_category_active_idx').on(t.category, t.isActive),
    // FK 조회 가속 (provider별 요금제 리스트 — 어드민 + /data-sources 1.10)
    index('tariff_provider_idx').on(t.providerId),
    // 신선도 모니터링 (1.5.2 harness:price + status 페이지 6.6)
    index('tariff_last_seen_idx').on(t.lastSeenAt),
  ],
);

// ─── Relations (Drizzle relations API) ───────────────────────────────────

export const tariffRelations = relations(tariff, ({ one }) => ({
  provider: one(provider, {
    fields: [tariff.providerId],
    references: [provider.id],
  }),
}));

// ─── Inferred types ───────────────────────────────────────────────────────

export type Tariff = typeof tariff.$inferSelect;
export type NewTariff = typeof tariff.$inferInsert;

/** Tariff category enum 값 (TS 유니온). */
export type TariffCategory = (typeof tariffCategoryEnum.enumValues)[number];

/** Currency enum 값 (TS 유니온). */
export type Currency = (typeof currencyEnum.enumValues)[number];
