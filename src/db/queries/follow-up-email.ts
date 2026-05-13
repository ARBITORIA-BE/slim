/**
 * follow-up-email — 후속 메일 INSERT + unsubscribe (PLAN 4.5.c / 4.5.e).
 *
 * 4.3.b affiliate-click.ts 패턴 일관.
 *
 * 금지 (ADR-0028 §T7, 헌법 §8 #1):
 *   - IP / User-Agent / Referer 읽기 X
 *   - 쿠키 X
 *   - 메일 추적 (opened_at / clicked_at) X
 */

import { eq, sql } from 'drizzle-orm';

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

// ─── UNSUBSCRIBE ──────────────────────────────────────────────────────────

/**
 * unsubscribeByToken — 1-click unsubscribe (PLAN 4.5.e, ADR-0028 §T4/§T5/§T7).
 *
 * 반환 discriminated union:
 *   - not-found       : 토큰 매칭 행 없음 → 404
 *   - already-unsubscribed : 이미 해제됨 → idempotent 200
 *   - just-unsubscribed    : 방금 해제됨 (atomic UPDATE) → 200
 *
 * 금지 (헌법 §8 #1): 이 함수 안에서 headers() / cookies() 0건.
 * ADR-0028 §T5 — email NULL + pii_anonymized_at COALESCE(기존, now()) atomic UPDATE.
 */
export type UnsubscribeResult =
  | { kind: 'not-found' }
  | { kind: 'already-unsubscribed'; unsubscribedAt: Date }
  | { kind: 'just-unsubscribed' };

export async function unsubscribeByToken(token: string): Promise<UnsubscribeResult> {
  // 1. SELECT — 행 존재 + 해제 여부 확인
  const rows = await db
    .select({
      id: followUpEmail.id,
      unsubscribedAt: followUpEmail.unsubscribedAt,
      email: followUpEmail.email,
    })
    .from(followUpEmail)
    .where(eq(followUpEmail.unsubscribeToken, token))
    .limit(1);

  const row = rows[0];

  // 2. 행 없음
  if (!row) {
    return { kind: 'not-found' };
  }

  // 3. 이미 해제됨 — idempotency (UPDATE 없이 반환)
  if (row.unsubscribedAt !== null) {
    return { kind: 'already-unsubscribed', unsubscribedAt: row.unsubscribedAt };
  }

  // 4. atomic UPDATE — ADR-0028 §T5
  //    email = NULL : PII 즉시 제거 (발송 전이라면 여기서 익명화)
  //    pii_anonymized_at = COALESCE(기존값, now()) : 이미 익명화됐으면 덮지 않음 (4.5.d 가 먼저 했을 수도)
  //    unsubscribed_at = now()
  await db
    .update(followUpEmail)
    .set({
      unsubscribedAt: sql`now()`,
      // email 컬럼은 nullable text — null 할당으로 PII 제거
      email: sql`NULL`,
      // COALESCE: 4.5.d 발송 후 이미 pii_anonymized_at 이 채워졌을 수 있음
      piiAnonymizedAt: sql`COALESCE(pii_anonymized_at, now())`,
    })
    .where(eq(followUpEmail.unsubscribeToken, token));

  return { kind: 'just-unsubscribed' };
}
