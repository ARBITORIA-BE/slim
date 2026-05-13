/**
 * FollowUpEmail — 전환 후 7일 후속 메일 (PLAN 4.5.b)
 *
 * 인터스티셜 동의(4.1.d) 옵션 필드 → INSERT → 7일 후 Inngest function
 * (4.5.d) → Resend 발송 → email NULL 화. ADR-0028 §T2 가 본 스키마의 단일
 * 출처.
 *
 * 핵심 설계 원칙 (ADR-0028):
 *   T2. `affiliate_click` 1:1 FK CASCADE — 어트리뷰션 동의 거부 시 후속 메일도 0.
 *       ADR-0026 §T1 "affiliate_click 에 PII 컬럼 0" 잠금 보존.
 *   T4. consent_given_at NOT NULL — Art. 6(1)(a) 동의 강제.
 *   T5. 발송 직후 email NULL 화 — pii_anonymized_at 트랜잭션 안 갱신.
 *   T6. (scheduled_send_at, sent_at) 인덱스 — Inngest cron hot path.
 *   T7. unsubscribe_token UNIQUE — 1-click 매칭 (nanoid(16)).
 *
 * 부재 컬럼 (의도적 — ADR-0026 §T1, 헌법 §8 #1/#5):
 *   ip_address, user_agent, device_fingerprint, session_id, referrer
 *   — 이 테이블에 어떠한 사용자 추적 식별자도 들어오지 않는다.
 *   메일 추적 (opened_at / clicked_at / delivered_at) 없음 — 이미지 beacon 0 (ADR-0028 §T7).
 */

import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { affiliateClick } from './affiliate_click';

// ─── Table ────────────────────────────────────────────────────────────────

export const followUpEmail = pgTable(
  'follow_up_email',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** 1:1 with affiliate_click — 어트리뷰션 동의 거부 시 후속 메일 0 (T2). */
    affiliateClickId: uuid('affiliate_click_id')
      .notNull()
      .references(() => affiliateClick.id, { onDelete: 'cascade' }),

    /** 사용자 입력 이메일. 발송 직후 NULL 화(T5) — pii_anonymized_at 동기 갱신. */
    email: text('email'),

    /** Art. 6(1)(a) 동의 시각 (T4). NOT NULL = 동의 없으면 INSERT 0. */
    consentGivenAt: timestamp('consent_given_at', { withTimezone: true }).notNull(),

    /** 발송 예정 시각 = createdAt + 7d (T6). Inngest hot path. */
    scheduledSendAt: timestamp('scheduled_send_at', { withTimezone: true }).notNull(),

    /** 발송 성공 시각. NULL = 미발송. Idempotency 필터(T6). */
    sentAt: timestamp('sent_at', { withTimezone: true }),

    /** 사용자 unsubscribe 시각. NULL = 활성. */
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),

    /** 1-click unsubscribe 토큰 (T7). nanoid(16) — 4.5.e route 가 매칭. */
    unsubscribeToken: text('unsubscribe_token').notNull().unique(),

    /** T5 익명화 시각. NULL = 아직 email 있음 (발송 전 또는 발송 직후 트랜잭션). */
    piiAnonymizedAt: timestamp('pii_anonymized_at', { withTimezone: true }),

    /** DB insert 시각. */
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // T7 unsubscribe 1-click 매칭 hot path
    uniqueIndex('follow_up_email_unsubscribe_token_unique').on(t.unsubscribeToken),
    // T6 Inngest cron hot path
    index('follow_up_email_schedule_idx').on(t.scheduledSendAt, t.sentAt),
  ],
);

// ─── Relations (Drizzle relations API) ───────────────────────────────────

export const followUpEmailRelations = relations(followUpEmail, ({ one }) => ({
  affiliateClick: one(affiliateClick, {
    fields: [followUpEmail.affiliateClickId],
    references: [affiliateClick.id],
  }),
}));

// ─── Inferred types ───────────────────────────────────────────────────────

export type FollowUpEmail = typeof followUpEmail.$inferSelect;
export type NewFollowUpEmail = typeof followUpEmail.$inferInsert;
