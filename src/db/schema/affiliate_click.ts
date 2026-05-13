/**
 * AffiliateClick — 어트리뷰션 클릭 원장 (PLAN 4.1.b)
 *
 * "변경하기" CTA 클릭 → 동의 인터스티셜 → 서버사이드 INSERT → 302 리다이렉트
 * 의 단일 기록 출처. 헌법 §8 #1 (사용자 데이터 외부 0), §8 #4 (광고-비교 분리),
 * 헌법 P3 (수수료 단가 공개) 를 *스키마 레이어*에서 강제.
 *
 * 결정 근거: docs/adr/0026-affiliate-click-and-attribution.md
 *
 * 핵심 설계 원칙 (ADR-0026):
 *   T1. IP/fingerprint/session 컬럼 부재 — 의도적, 절대 추가 금지.
 *       click_token (nanoid) 이 유일 식별자. Recital 26 익명.
 *   T5. enum 값 = active_b2b_intra_eu / active_b2b_domestic_be (active 아님).
 *       bias-audit 참조 시 이 두 값만 어필리에이트로 분류.
 *   T6. result_id / result_item_id FK → 90일 후 SET NULL (pii_anonymized_at 기록).
 *       비교 입력 PII 와의 연결 고리를 끊고, 정산 필드는 회계 목적 장기 보존.
 *   T8. commission_source + commission_fetched_at = P1 (정보 우선) 강제.
 *       harness:data 가 두 컬럼 존재 여부를 검사.
 *
 * 부재 컬럼 (의도적 — ADR-0026 §T1, 헌법 §8 #1/#5):
 *   ip_address, user_agent, device_fingerprint, session_id, referrer
 *   — 이 테이블에 어떠한 사용자 추적 식별자도 들어오지 않는다.
 */

import { relations } from 'drizzle-orm';
import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { comparisonResult, comparisonResultItem } from './comparison_result';
import { provider } from './provider';
import { tariffSnapshot } from './tariff_snapshot';

// ─── Enums ────────────────────────────────────────────────────────────────

/**
 * 어필리에이트 전환 상태.
 *
 * - `pending`  : 클릭 기록됨, 전환 미확인 (기본값)
 * - `converted`: 공급사 postback 또는 정산 리포트로 전환 확인됨
 * - `rejected` : 공급사가 전환 거부 (중복 클릭, 부적격 사용자 등)
 * - `expired`  : 전환 윈도우 초과 (실 payout ADR 에서 기간 확정)
 */
export const affiliateConversionStatusEnum = pgEnum(
  'affiliate_conversion_status',
  ['pending', 'converted', 'rejected', 'expired'],
);

// ─── Table ────────────────────────────────────────────────────────────────

export const affiliateClick = pgTable(
  'affiliate_click',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * nanoid 클릭 식별자 (ADR-0007 §T7 nanoid 패턴 재사용, URL-safe 64-char alphabet).
     * 외부 노출 가능한 유일 식별자. **IP/fingerprint/session 컬럼이 없으므로
     * 이 토큰이 유일한 클릭 식별 수단** (T1).
     */
    clickToken: text('click_token').notNull().unique(),

    /**
     * 어느 비교 결과의 클릭인가 (T6).
     * SET NULL = 영구 링크 깨지지 않음 + 90일 후 익명화 대상.
     * NULL = rank 미상 또는 결과 페이지 외 경로.
     */
    resultId: uuid('result_id').references(() => comparisonResult.id, {
      onDelete: 'set null',
    }),

    /**
     * 어느 rank 행의 "변경하기" 인가 (선택, T6).
     * SET NULL = 90일 후 익명화 대상.
     */
    resultItemId: uuid('result_item_id').references(
      () => comparisonResultItem.id,
      { onDelete: 'set null' },
    ),

    /**
     * 클릭이 향한 공급사. 정산 추적 — 공급사 삭제 차단 (RESTRICT).
     * ADR-0001 §후속작업 "4.1 affiliate_click.provider_id FK" 와 일관.
     */
    providerId: uuid('provider_id')
      .notNull()
      .references(() => provider.id, { onDelete: 'restrict' }),

    /**
     * 클릭 시점에 사용자가 본 정확한 가격 스냅샷 = 단가 정산 근거.
     * RESTRICT (ADR-0006 §append-only + ADR-0007 §T6 RESTRICT 패턴 일관).
     */
    tariffSnapshotId: uuid('tariff_snapshot_id')
      .notNull()
      .references(() => tariffSnapshot.id, { onDelete: 'restrict' }),

    /**
     * 동의 인터스티셜에서 사용자가 "이동"을 누른 시각.
     * **NOT NULL = 동의 없으면 행 미생성** (헌법 §8 #1 스키마 강제 — T1/T7).
     */
    consentGivenAt: timestamp('consent_given_at', {
      withTimezone: true,
    }).notNull(),

    /**
     * 리다이렉트 URL 에 붙인 캠페인 식별자 (예: `slim`, `slim-r-<shortId>`).
     * **사용자 식별 정보 0건** — 무엇을 공급사에게 보냈는지 정직 기록 (P3).
     */
    refParam: text('ref_param').notNull(),

    /**
     * 정산 수수료 (cents). NULL = 미확정/미전환.
     * BIGINT cents 정수 산술 (ADR-0005 §T2 / ADR-0006 BIGINT 패턴).
     */
    commissionAmountCents: bigint('commission_amount_cents', { mode: 'number' }),

    /**
     * 수수료 통화. 기본 EUR.
     */
    commissionCurrency: text('commission_currency').notNull().default('EUR'),

    /**
     * 수수료율 출처 (제휴 계약 PDF / 어드민 입력 / 제휴 네트워크 API).
     * **P1 (정보 우선) — 어트리뷰션 단가도 출처를 가진다** (T8).
     * harness:data 검사 대상.
     */
    commissionSource: text('commission_source'),

    /**
     * 수수료율 확인 시각.
     * **P1** — harness:data 검사 대상 (T8).
     */
    commissionFetchedAt: timestamp('commission_fetched_at', {
      withTimezone: true,
    }),

    /**
     * 전환 상태. pending → converted/rejected/expired.
     * 상태 전환 트리거는 실 payout ADR (페이즈 4 후반) 에서 확정.
     */
    conversionStatus: affiliateConversionStatusEnum('conversion_status')
      .notNull()
      .default('pending'),

    /**
     * 전환 확인 시각. NULL = 미전환.
     * 공급사 postback 또는 정산 리포트 수신 시각.
     */
    convertedAt: timestamp('converted_at', { withTimezone: true }),

    /**
     * Stripe payout 배치 식별자. NULL = 미정산.
     * 의미는 실 Stripe payout ADR (페이즈 4 후반) 에서 확정.
     */
    payoutBatchId: text('payout_batch_id'),

    /**
     * T6 cron 이 result_id / result_item_id 를 NULL화한 시각.
     * NULL = 아직 비교 입력과 연결 중.
     * ADR-0007 §T4 / comparison_result.piiAnonymizedAt 과 동일 패턴.
     */
    piiAnonymizedAt: timestamp('pii_anonymized_at', { withTimezone: true }),

    /**
     * DB insert 시각.
     */
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // click_token UNIQUE — ADR-0007 패턴 (comparison_result_short_id_unique 일관)
    uniqueIndex('affiliate_click_token_unique').on(t.clickToken),
    // 정산 집계 — 공급사별 수익 대시보드 hot path
    index('affiliate_click_provider_idx').on(t.providerId),
    // T6 cron + 결과별 역추적 (result_id IS NOT NULL 필터)
    index('affiliate_click_result_idx').on(t.resultId),
    // 정산 대시보드 — pending/converted 필터
    index('affiliate_click_conversion_status_idx').on(t.conversionStatus),
    // T6 cron 의 pii_anonymized_at IS NULL 필터 가속
    // comparison_result_pii_anonymized_idx 패턴 일관
    index('affiliate_click_pii_anonymized_idx').on(t.piiAnonymizedAt),
  ],
);

// ─── Relations (Drizzle relations API) ───────────────────────────────────

export const affiliateClickRelations = relations(affiliateClick, ({ one }) => ({
  provider: one(provider, {
    fields: [affiliateClick.providerId],
    references: [provider.id],
  }),
  tariffSnapshot: one(tariffSnapshot, {
    fields: [affiliateClick.tariffSnapshotId],
    references: [tariffSnapshot.id],
  }),
  result: one(comparisonResult, {
    fields: [affiliateClick.resultId],
    references: [comparisonResult.id],
  }),
  resultItem: one(comparisonResultItem, {
    fields: [affiliateClick.resultItemId],
    references: [comparisonResultItem.id],
  }),
}));

// ─── Inferred types ───────────────────────────────────────────────────────

export type AffiliateClick = typeof affiliateClick.$inferSelect;
export type NewAffiliateClick = typeof affiliateClick.$inferInsert;

/** 전환 상태 enum 값 (TS 유니온). */
export type AffiliateConversionStatus =
  (typeof affiliateConversionStatusEnum.enumValues)[number];
