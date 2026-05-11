/**
 * ComparisonResult + ComparisonResultItem — 비교 결과 + 결과 행 (PLAN 1.5)
 *
 * 비교 엔진(1.11)이 계산한 결과를 영구 보존하는 두 테이블 (1:N).
 * 영구 링크(/r/[shortId], PLAN 3.6)의 단일 출처.
 *
 * 결정 근거: docs/adr/0007-comparison-request-result-schema.md
 *
 * 핵심 설계 원칙 (ADR-0007):
 *   T6. comparison_result (1) ↔ comparison_result_item (N). PLAN 3.2 비교 표
 *       의 상위 5행 반복 렌더링이 자식 테이블 1:N에 자연스럽게 매핑.
 *   T7. shortId = nanoid 12자 (alphabet 36chars × 12 = 36^12 ≈ 4.7e18 공간 →
 *       추측 충돌 사실상 0). URL 친화 + 보안 양립.
 *   T8. requestId nullable + ON DELETE SET NULL — GDPR 삭제 요청 시 request 행
 *       삭제되어도 결과 페이지(영구 링크) 익명 보존.
 *   T9. lockedInputs JSONB = 결과 계산에 사용된 입력 *사본* (PII 파생물).
 *       90일 후 1.5.2 cron이 NULL화. 결과 자체는 영구.
 *
 * onDelete 정책 (ADR-0007 §결정 6/8):
 *   - result.requestId → comparison_request(id) ON DELETE SET NULL
 *   - result.topTariffSnapshotId → tariff_snapshot(id) ON DELETE RESTRICT
 *     (결과 페이지 보존 — 스냅샷 삭제 차단)
 *   - result_item.resultId → comparison_result(id) ON DELETE CASCADE
 *   - result_item.tariffSnapshotId → tariff_snapshot(id) ON DELETE RESTRICT
 */

import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { comparisonRequest } from './comparison_request';
import { tariffSnapshot } from './tariff_snapshot';

// ─── ComparisonResult (부모) ──────────────────────────────────────────────

export const comparisonResult = pgTable(
  'comparison_result',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * 비교 요청 FK (T8). NULL 허용 — GDPR 삭제 후 결과는 익명 보존.
     * provider/tariff_snapshot 과 달리 SET NULL 정책: 영구 링크는 깨지지 않아야 함.
     */
    requestId: uuid('request_id').references(() => comparisonRequest.id, {
      onDelete: 'set null',
    }),

    /**
     * 영구 링크용 short ID (T7). nanoid 12자, alphabet 36chars (0-9 a-z).
     * URL: /r/[shortId]. 추측 공격 방어 + 공유 친화.
     *
     * 생성 위치: src/lib/short-id.ts (1.11 비교 엔진과 함께 신설). DB 측은
     * UNIQUE만 강제.
     */
    shortId: text('short_id').notNull(),

    // ─── 1위 추천 요약 (B2B 집계 입력 — MONETIZATION D, M24+) ───────────────

    /**
     * 1위 추천의 월 절약액 (cents). PLAN 3.1 결론 카드의 핵심 숫자.
     * NULL = 절약 없음 (현재 요금제가 이미 최선) 또는 비교 불가 (caveat 대신
     * 빈 결과).
     */
    topMonthlySavingCents: bigint('top_monthly_saving_cents', {
      mode: 'number',
    }),

    /**
     * 1위 추천의 연간 절약액 (cents). 일관성을 위해 month × 12 미러.
     * 표시는 결과 카드(<PriceWithSource>)가 단일 변환 지점.
     */
    topYearlySavingCents: bigint('top_yearly_saving_cents', { mode: 'number' }),

    /**
     * 1위 추천의 tariff_snapshot. RESTRICT — 영구 링크 동안 스냅샷 삭제 차단
     * (ADR-0006 T1 append-only + 본 ADR T6 결과 보존 일관성).
     * NULL = 추천 결과 없음.
     */
    topTariffSnapshotId: uuid('top_tariff_snapshot_id').references(
      () => tariffSnapshot.id,
      { onDelete: 'restrict' },
    ),

    // ─── PII 파생물 봉인 (T9) ───────────────────────────────────────────────

    /**
     * 결과 계산에 사용한 입력 *사본*. PLAN 3.5 "계산 근거 펼치기"의 입력.
     *
     * 권장 키 (강제 X):
     *   {
     *     postal_code: string,           // 결과 시점 PC4 (90일 후 NULL)
     *     household_type: string,
     *     current_provider_id: string | null,
     *     input_attributes: { ...카테고리별 사용량 },
     *     assumptions: { ...추정 fallback 값 }
     *   }
     *
     * **GDPR 정책 (T4/T9)**: 90일 후 1.5.2 cron이 NULL로 갱신. 결과 페이지는
     * "이 비교의 입력 가정은 90일 보관 정책으로 일반화되었습니다 — 비교 결과는
     * 그대로 보존됩니다" 안내로 대체.
     */
    lockedInputs: jsonb('locked_inputs'),

    // ─── 엔진 버전 (P1 — 결과 재현성) ───────────────────────────────────────

    /**
     * 비교 엔진 버전. 1.11이 결정 (예: "compare@2026-05-09").
     * 영구 링크의 결과가 *어느 버전 엔진이 계산한 것인지* 추적.
     * 미래 엔진 회귀 디버깅에 필수 (P1 정보 무결성).
     */
    engineVersion: text('engine_version').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    /**
     * T9 cron이 lockedInputs를 NULL화한 시각. NULL = 아직 원본 보존 중.
     * comparison_request.piiAnonymizedAt 와 같은 패턴.
     */
    piiAnonymizedAt: timestamp('pii_anonymized_at', { withTimezone: true }),
  },
  (t) => [
    // T7: 영구 링크 lookup의 단일 인덱스
    uniqueIndex('comparison_result_short_id_unique').on(t.shortId),
    // 페이즈 6.4 GDPR 다운로드 / B2B Insights ETL
    index('comparison_result_request_idx').on(t.requestId),
    // MONETIZATION D B2B 집계 — 시간 범위 필터
    index('comparison_result_created_at_idx').on(t.createdAt),
    // T9 cron의 piiAnonymizedAt IS NULL 필터 가속
    index('comparison_result_pii_anonymized_idx').on(t.piiAnonymizedAt),
  ],
);

// ─── ComparisonResultItem (자식) ──────────────────────────────────────────

export const comparisonResultItem = pgTable(
  'comparison_result_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * 부모 비교 결과 FK. CASCADE — 결과 삭제 시 행도 삭제 (정합성). 단,
     * 본 ADR의 T4/T8 정책상 result 자체는 영구 보존되므로 CASCADE 발동은 드묾.
     */
    resultId: uuid('result_id')
      .notNull()
      .references(() => comparisonResult.id, { onDelete: 'cascade' }),

    /**
     * 정렬 순위. 1 = 가장 절약액 큼. PLAN 3.2 비교 표의 정렬 키 (영구 보존 →
     * 사용자가 영구 링크 다시 봐도 동일 순서).
     */
    rank: integer('rank').notNull(),

    /**
     * 이 행이 가리키는 tariff_snapshot. RESTRICT — 결과 행 보존 동안 스냅샷
     * 삭제 차단. ADR-0006 §append-only 정책과 일관.
     */
    tariffSnapshotId: uuid('tariff_snapshot_id')
      .notNull()
      .references(() => tariffSnapshot.id, { onDelete: 'restrict' }),

    /**
     * 이 행의 월 절약액 (cents). 음수 가능 (현재 요금제보다 비싼 후보가
     * 비교에 포함되는 경우 — 사용자 비교 표시는 보통 양수만, 그러나 데이터
     * 무결성 위해 음수 허용).
     */
    monthlySavingCents: bigint('monthly_saving_cents', {
      mode: 'number',
    }).notNull(),

    /**
     * 이 행의 연간 절약액 (cents). 24개월 약정 + 프로모 차감 후 일관 계산
     * (ADR-0005 T2/T4 정수 cents 산술).
     */
    yearlySavingCents: bigint('yearly_saving_cents', {
      mode: 'number',
    }).notNull(),

    /**
     * 비교 엔진 breakdown (ADR-0010 §T3). PLAN 3.5 계산 근거 펼치기 의 입력.
     *
     * 왜 이 3 컬럼을 *추가* 저장하는가 (compare() 재실행 회피)?
     *   - engineVersion 가 시간에 따라 변경 → 재실행 시 결과 비결정성
     *   - tariff_snapshot 도 새로 append 됨 → DISTINCT ON 최신값이 *원래* 계산
     *     시점과 다를 수 있음
     *   - 영구 링크 SLA = "본 결과를 *이 버전의 엔진이* 계산했음" (P1 정합)
     *
     * 왜 activation/modem/promo 는 별도 컬럼이 아닌가?
     *   - tariff_snapshot 행이 RESTRICT FK 로 동결됨 (T6) — JOIN 으로 원본 값 보존
     *   - 중복 저장 = 일관성 위험 + Neon row 비용 (페이즈 4.5 비용 모니터링 정합)
     *
     * default(0) 사유: 본 마이그레이션(0004) 적용 시 기존 행 (있다면) 안전.
     * Sub-task 5 이전 행은 0 으로 표기 (breakdown 미저장 의도된 fallback).
     */
    monthlyAvg12Cents: bigint('monthly_avg_12_cents', { mode: 'number' })
      .notNull()
      .default(0),
    monthlyAvg24Cents: bigint('monthly_avg_24_cents', { mode: 'number' })
      .notNull()
      .default(0),
    /**
     * 24개월 시나리오 월 절약액 (cents, signed). monthlySavingCents 는 12개월
     * 시나리오 (ADR-0010 §T3 "1차 표시 단위 = 12개월").
     */
    monthlySaving24Cents: bigint('monthly_saving_24_cents', { mode: 'number' })
      .notNull()
      .default(0),

    /**
     * 주의사항 배열 (PLAN 1.13 caveats 메커니즘). 예:
     *   ["24개월 약정", "활성화 비용 €50 별도", "EU 로밍 미포함"]
     *
     * UI는 결과 카드 하단에 항목별 표시. P3 (투명성) 강제.
     *
     * Drizzle PG text array의 빈 배열 default는 raw SQL 필요
     * (https://orm.drizzle.team/docs/guides/empty-array-default-value).
     */
    caveats: text('caveats')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // 영구 링크 페이지의 hot path: 한 result의 모든 item을 rank 순으로
    index('comparison_result_item_result_rank_idx').on(t.resultId, t.rank),
    // 어드민 대시보드 (4.5.1) — 특정 스냅샷이 어느 비교에서 사용됐는지 역추적
    index('comparison_result_item_snapshot_idx').on(t.tariffSnapshotId),
  ],
);

// ─── Relations (Drizzle relations API) ───────────────────────────────────

export const comparisonResultRelations = relations(
  comparisonResult,
  ({ one, many }) => ({
    request: one(comparisonRequest, {
      fields: [comparisonResult.requestId],
      references: [comparisonRequest.id],
    }),
    topTariffSnapshot: one(tariffSnapshot, {
      fields: [comparisonResult.topTariffSnapshotId],
      references: [tariffSnapshot.id],
    }),
    items: many(comparisonResultItem),
  }),
);

export const comparisonResultItemRelations = relations(
  comparisonResultItem,
  ({ one }) => ({
    result: one(comparisonResult, {
      fields: [comparisonResultItem.resultId],
      references: [comparisonResult.id],
    }),
    tariffSnapshot: one(tariffSnapshot, {
      fields: [comparisonResultItem.tariffSnapshotId],
      references: [tariffSnapshot.id],
    }),
  }),
);

// ─── Inferred types ───────────────────────────────────────────────────────

export type ComparisonResult = typeof comparisonResult.$inferSelect;
export type NewComparisonResult = typeof comparisonResult.$inferInsert;

export type ComparisonResultItem = typeof comparisonResultItem.$inferSelect;
export type NewComparisonResultItem = typeof comparisonResultItem.$inferInsert;
