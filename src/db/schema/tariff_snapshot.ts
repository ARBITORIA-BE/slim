/**
 * TariffSnapshot — 가격 시계열 테이블 (PLAN 1.3)
 *
 * `tariff` 마스터의 가격/속성 변동을 시점별로 보존하는 *시계열* 단독 테이블.
 * 결정 근거: docs/adr/0006-tariff-snapshot-schema.md
 * 마스터/스냅샷 분리 원칙: docs/adr/0005-tariff-schema-telecom.md §결정 5(T5)
 *
 * 핵심 설계 원칙 (ADR-0006):
 *   T1. Append-only insert (라운딩/upsert 없음). 같은 (tariff_id, fetched_at)
 *       중복도 그대로 보존 — P3 사후 분석 가능.
 *   T2. 가격 스냅샷 = 평탄화 5컬럼 (monthly/activation/modem/promo) + JSONB 미러
 *       (price_payload). 비교 엔진 1.11 hot path는 평탄화 컬럼만 사용.
 *   T3. raw_payload = 정규화된 JSON만 (HTML 단편 X). Neon free 0.5 GB 한계 대응.
 *   T4. confidence = 3값 enum + confidence_reason 텍스트. UI 색상 매핑 + 운영자
 *       자가 진단 양립.
 *   T5. is_anomaly boolean + anomaly_reason text. 1.5.2 harness:price 워커가
 *       마킹. 비교 엔진은 NOT is_anomaly AND confidence != 'low' 강제.
 *   T6. 90일 후 raw_payload + price_payload NULL화 (메타 영구 보존). 1.5.2 cron
 *       의 보조 작업.
 *   T7. (tariff_id, fetched_at DESC) 복합 인덱스 + DISTINCT ON 쿼리. 마스터에
 *       current_snapshot_id 추가하지 않음 (ADR-0005 §T5 분리 유지).
 *
 * P1 (정보 우선) 강제 — harness:data Rule 4가 다음 NOT NULL을 검증:
 *   source_url.notNull(), fetched_at.notNull()
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
  uuid,
} from 'drizzle-orm/pg-core';

import { tariff } from './tariff';

// ─── Enums ────────────────────────────────────────────────────────────────

/**
 * 스냅샷 신뢰도. UI 색상 매핑 (3.2 비교 표):
 *   high   → 녹색 (공식 API / 안정 셀렉터 + sanity 통과)
 *   medium → 황색 (스크래핑 / fragile 셀렉터 / 프로모 가격 모호)
 *   low    → 적색 (부분 실패 / fallback 사용 → 비교 엔진 자동 제외)
 *
 * fetcher가 결정 가능한 카디널리티 (3값). 0~100 scoring은 산정 모호함으로 거부
 * (ADR-0006 §T4 거부된 대안).
 */
export const confidenceEnum = pgEnum('confidence', ['high', 'medium', 'low']);

// ─── Table ────────────────────────────────────────────────────────────────

export const tariffSnapshot = pgTable(
  'tariff_snapshot',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // ─── FK + 시간 (P1 강제 NOT NULL) ──────────────────────────────────────

    /**
     * 요금제 마스터 FK. 1.2 `tariff`. ADR-0005 §영향 — onDelete CASCADE
     * (마스터 삭제 시 스냅샷도 삭제. 마스터는 isActive=false로 *보존*하므로
     * 실제 삭제는 드물다).
     */
    tariffId: uuid('tariff_id')
      .notNull()
      .references(() => tariff.id, { onDelete: 'cascade' }),

    /**
     * Fetcher가 이 스냅샷을 수집한 시각. *항상 NOT NULL* — harness:data Rule 4.
     * UI <StaleLabel>의 입력 + 1.5.2 harness:price 일별 diff의 정렬 키.
     */
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),

    /**
     * 이 스냅샷이 추출된 정확한 페이지 URL. *항상 NOT NULL* — harness:data Rule 4.
     * 결과 페이지 3층(원본 링크) + 운영자 자가 진단의 단일 진입점.
     * 마스터(tariff.sourceUrl)와 같거나 더 구체적인 페이지일 수 있음.
     */
    sourceUrl: text('source_url').notNull(),

    // ─── 가격 스냅샷 (T2 평탄화 5컬럼 — 비교 엔진 1.11 hot path) ───────────

    /**
     * 스냅샷 시점의 정상 월정액 (cents, EUR). NOT NULL — 비교 엔진 제1 입력.
     *
     * 마스터가 이후 변경되어도 *이 행*에 영원히 보존됨 → 결과 페이지 3.5
     * 계산 근거 펼치기에서 *어떤 가격으로 비교했는지* 영구 추적 가능 (P1).
     */
    monthlyPriceCents: bigint('monthly_price_cents', {
      mode: 'number',
    }).notNull(),

    /** 활성화 비용 스냅샷 (cents). 무료면 0. NOT NULL (마스터와 동일 정책). */
    activationFeeCents: bigint('activation_fee_cents', { mode: 'number' })
      .notNull()
      .default(0),

    /** 모뎀 임대 스냅샷 (cents/월). NULL = 모뎀 임대 개념 없음 (모바일 등). */
    modemRentalCents: bigint('modem_rental_cents', { mode: 'number' }),

    /** 프로모 가격 스냅샷 (cents). NULL = 프로모 없음. */
    promoPriceCents: bigint('promo_price_cents', { mode: 'number' }),

    /** 프로모 지속 개월 스냅샷. NULL = 프로모 없음. */
    promoMonths: integer('promo_months'),

    /**
     * 가격 페이로드 미러 (T2). 마스터의 가격 관련 컬럼 *전체*를 jsonb로 보존.
     * 미래 추가 필드(early_termination_fee, loyalty_discount 등) fetcher 수정만
     * 으로 흡수.
     *
     * T6 리텐션: 90일 후 NULL화 (1.5.2 cron 보조 작업).
     *
     * 권장 키 (강제 X):
     *   {
     *     monthly_price_cents: number,
     *     activation_fee_cents: number,
     *     modem_rental_cents: number | null,
     *     commitment_months: number,
     *     early_termination_fee_cents: number | null,
     *     promo_price_cents: number | null,
     *     promo_months: number | null,
     *     promo_description: string | null,
     *     attributes: { ...카테고리별 키 }  // ADR-0005 attributes 미러
     *   }
     */
    pricePayload: jsonb('price_payload'),

    // ─── 원본 (T3 정규화 JSON only) ─────────────────────────────────────────

    /**
     * Fetcher가 페이지/API에서 추출 후 *정규화*한 JSON. 원본 HTML은 보존하지
     * 않음 (Neon free 0.5 GB 한계 — ADR-0006 §T3).
     *
     * T6 리텐션: 90일 후 NULL화.
     *
     * 권장 스키마 (강제 X — 디버깅 가능성 우선):
     *   {
     *     fetcher_version: "proximus@2026-05-09",
     *     url: "https://...",
     *     extracted: { ... },
     *     warnings: string[],
     *     http: { status: number, elapsed_ms: number }
     *   }
     */
    rawPayload: jsonb('raw_payload'),

    // ─── 신뢰도 (T4) ────────────────────────────────────────────────────────

    /**
     * 스냅샷 신뢰도. UI 색상 매핑(녹/황/적) + 비교 엔진 자동 제외 임계.
     * fetcher가 추출 시 결정 (sanity 체크 + 셀렉터 안정성).
     */
    confidence: confidenceEnum('confidence').notNull().default('high'),

    /**
     * 신뢰도 근거 — 운영자 자가 진단용 자유 텍스트. UI 기본 노출 X (요청 시 펼침).
     * 예: "selector .price--current matched 1; sanity check passed"
     *      "fallback to previous month price (parser threw on promo banner)"
     */
    confidenceReason: text('confidence_reason'),

    // ─── 이상 감지 (T5) ─────────────────────────────────────────────────────

    /**
     * 이상치 마킹. 1.5.2 harness:price 워커가 직전 스냅샷과 비교해 ±50% 변동
     * 또는 monthlyPriceCents=0 등 sanity 위반 시 true로 갱신.
     *
     * 비교 엔진(1.11)은 `WHERE NOT is_anomaly AND confidence != 'low'` 로
     * 자동 제외 (P1 데이터 무결성).
     */
    isAnomaly: boolean('is_anomaly').notNull().default(false),

    /**
     * 이상치 사유. 1.5.2 워커가 마킹 시 채움.
     * 예: "price_swing_>50%; prev=2500, curr=4500"
     *      "monthly_price_zero; possible parse failure"
     */
    anomalyReason: text('anomaly_reason'),

    // ─── 메타 ───────────────────────────────────────────────────────────────

    /**
     * insert 시각 (DB 입장). `fetched_at`(fetcher 입장)과 일반적으로 가깝지만
     * 일부 backfill/재처리 케이스에서 다를 수 있음. 디버깅용.
     */
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // T7: 비교 엔진 hot path. 최신 스냅샷 1건 per tariff (DISTINCT ON).
    //     인덱스 스캔만으로 처리 가능 (Postgres 16).
    index('tariff_snapshot_tariff_fetched_idx').on(
      t.tariffId,
      t.fetchedAt.desc(),
    ),
    // 1.5.2 harness:price + 어드민(4.5.1) — anomaly 분포 모니터링
    index('tariff_snapshot_anomaly_idx').on(t.isAnomaly),
    // 시계열 글로벌 정렬 (status 페이지 6.6 + 일별 cron 입력)
    index('tariff_snapshot_fetched_at_idx').on(t.fetchedAt.desc()),
  ],
);

// ─── Relations (Drizzle relations API) ───────────────────────────────────

export const tariffSnapshotRelations = relations(tariffSnapshot, ({ one }) => ({
  tariff: one(tariff, {
    fields: [tariffSnapshot.tariffId],
    references: [tariff.id],
  }),
}));

// ─── Inferred types ───────────────────────────────────────────────────────

export type TariffSnapshot = typeof tariffSnapshot.$inferSelect;
export type NewTariffSnapshot = typeof tariffSnapshot.$inferInsert;

/** Confidence enum 값 (TS 유니온). UI 색상 매핑의 단일 출처. */
export type Confidence = (typeof confidenceEnum.enumValues)[number];
