/**
 * Provider — 공급사 마스터 테이블 (PLAN 1.1)
 *
 * 베네룩스(BE/NL/LU) 한정 공급사. 비교 대상 + "제외된 공급사도 이름 공개" (P3) 의 단일 출처.
 * 결정 근거: docs/adr/0001-provider-schema.md
 *
 * 운영 주체 (Slim) 는 BE 자영업자 (BTW 1037.548.919) 이므로
 * `affiliate_status` 가 BTW 처리(리버스 차지 vs 21%)를 직접 결정한다.
 */

import { sql } from 'drizzle-orm';
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────

/** 베네룩스 3국. 확장 필요 시 ADR 필수 (CLAUDE.md §5). */
export const countryEnum = pgEnum('country', ['BE', 'NL', 'LU']);

/**
 * 어필리에이트 + 세무 상태.
 *
 * - `none`: 어필리에이트 관계 없음. 정보용으로 비교에는 포함될 수 있음.
 * - `pending`: 협상 중. 결과 페이지에 일반 외부 링크로 노출.
 * - `active_b2b_intra_eu`: 계약 체결, 리버스 차지 (BTW 0%). 주로 NL/LU 공급사.
 * - `active_b2b_domestic_be`: BE 내 계약, BTW 21% 청구.
 * - `paused`: 일시 중단 (가격 신뢰도 이슈 등). "변경하기" CTA 비활성.
 * - `terminated`: 종료. `excluded_reason` 동반 권장.
 */
export const affiliateStatusEnum = pgEnum('affiliate_status', [
  'none',
  'pending',
  'active_b2b_intra_eu',
  'active_b2b_domestic_be',
  'paused',
  'terminated',
]);

// ─── Table ────────────────────────────────────────────────────────────────

export const provider = pgTable(
  'provider',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** 운영 국가. 페이즈 5에서 확장 시 ADR. */
    country: countryEnum('country').notNull(),

    /** 표시용 짧은 이름 (예: "Engie"). */
    name: text('name').notNull(),

    /** 법인 정식 명칭 (예: "Engie Electrabel SA"). 청구서·법적 표시용. */
    legalName: text('legal_name').notNull(),

    /** URL 슬러그 (kebab-case). 결과 페이지 / 어드민 라우팅. */
    slug: text('slug').notNull(),

    /**
     * EU VAT ID. 형식:
     * - BE: `BE` + 10자리
     * - NL: `NL` + 9자리 + `B` + 2자리
     * - LU: `LU` + 8자리
     *
     * NULL 허용 — 일부 소규모 공급사는 BTW 미등록일 수 있다.
     * 형식 검증은 애플리케이션 레이어 (Zod) 책임. DB는 UNIQUE만 강제.
     */
    vatId: text('vat_id'),

    /**
     * VIES (https://ec.europa.eu/taxation_customs/vies/) 마지막 검증 시각.
     * 페이즈 1.6 cron 워커가 `affiliate_status IN ('pending', 'active_b2b_*')` 행을 일 1회 갱신.
     * 리버스 차지 적용의 법적 근거 — 감사 대비.
     */
    vatIdVerifiedAt: timestamp('vat_id_verified_at', { withTimezone: true }),

    /** 공식 사이트. 3층(원본 링크) 노출용. */
    website: text('website').notNull(),

    /** 어필리에이트 + 세무 상태. ADR-0001 §2. */
    affiliateStatus: affiliateStatusEnum('affiliate_status')
      .notNull()
      .default('none'),

    /**
     * P3: 비교에서 제외된 공급사 사유.
     *   NULL    → 비교 가능
     *   NOT NULL → 제외 + 사유 (예: "API 미제공", "데이터 미신뢰")
     */
    excludedReason: text('excluded_reason'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('provider_slug_unique').on(t.slug),
    uniqueIndex('provider_vat_id_unique').on(t.vatId),
    uniqueIndex('provider_name_country_unique').on(t.name, t.country),
    index('provider_affiliate_status_idx').on(t.affiliateStatus),
  ],
);

// ─── Inferred types ───────────────────────────────────────────────────────

export type Provider = typeof provider.$inferSelect;
export type NewProvider = typeof provider.$inferInsert;

/** Country enum 값 (TS 유니온). */
export type Country = (typeof countryEnum.enumValues)[number];

/** Affiliate status enum 값 (TS 유니온). */
export type AffiliateStatus = (typeof affiliateStatusEnum.enumValues)[number];

// ─── Helpers (런타임 SQL 표현이 필요한 곳에서 사용) ────────────────────────

/**
 * 비교 가능 공급사 필터 — `excluded_reason IS NULL`.
 *   db.select().from(provider).where(isComparable);
 */
export const isComparable = sql`${provider.excludedReason} is null`;
