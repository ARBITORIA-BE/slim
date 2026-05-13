/**
 * follow-up-email — 후속 메일 INSERT (PLAN 4.5.c).
 *
 * 4.3.b affiliate-click.ts 패턴 일관.
 *
 * 금지 (ADR-0028 §T7, 헌법 §8 #1):
 *   - IP / User-Agent / Referer 읽기 X
 *   - 쿠키 X
 *   - 메일 추적 (opened_at / clicked_at) X
 */

import { db } from '@/db';
import { followUpEmail, type NewFollowUpEmail } from '@/db/schema/follow_up_email';

// ─── INSERT args ──────────────────────────────────────────────────────────

export interface InsertFollowUpEmailArgs {
  /** affiliate_click.id — 1:1 FK (ADR-0028 §T2). */
  readonly affiliateClickId: string;
  /** 사용자 입력 이메일 (Zod 검증 후). */
  readonly email: string;
  /** consentGivenAt = now() — 호출 시점이 동의 시각. */
  readonly scheduledSendAt: Date;
  /** nanoid(16) — 1-click unsubscribe (ADR-0028 §T7). */
  readonly unsubscribeToken: string;
}

/**
 * follow_up_email 행 INSERT.
 *
 * consentGivenAt 은 이 함수 내부에서 new Date() 로 처리 — 호출자가 별도로 전달하지 않음.
 * 나머지 NULL 컬럼 (sentAt / unsubscribedAt / piiAnonymizedAt) 은 DB 기본값(NULL).
 *
 * 반환값: 생성된 행의 id.
 */
export async function insertFollowUpEmail(
  args: InsertFollowUpEmailArgs,
): Promise<{ id: string }> {
  const values: NewFollowUpEmail = {
    affiliateClickId: args.affiliateClickId,
    email: args.email,
    consentGivenAt: new Date(),
    scheduledSendAt: args.scheduledSendAt,
    unsubscribeToken: args.unsubscribeToken,
    // sentAt / unsubscribedAt / piiAnonymizedAt: DB NULL 기본값 — 명시 생략
  };

  const rows = await db
    .insert(followUpEmail)
    .values(values)
    .returning({ id: followUpEmail.id });

  const row = rows[0];
  if (!row) {
    throw new Error('insertFollowUpEmail RETURNING empty');
  }
  return row;
}
