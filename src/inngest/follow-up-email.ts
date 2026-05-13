/**
 * followUpEmailFn — 7일 후속 메일 발송 Inngest 함수 (PLAN 4.5.d)
 *
 * 결정 근거: docs/adr/0028-follow-up-email.md §T1 / §T5 / §T6 / §T7
 * ADR-0008 §T6 dailyFetchAll 패턴 일관.
 *
 * cron 주기: 매시간 정각 (TZ=UTC 0 * * * *)
 *   → 7일 트리거의 분 단위 정확도 보장 + Inngest free tier 안전.
 *   → 일 1회 cron(06:00)은 6시간 지연 편차 발생 — 매시간이 UX 상 더 정확.
 *
 * 흐름:
 *   1. select-pending  — scheduled_send_at <= now AND sent_at IS NULL AND
 *                        unsubscribed_at IS NULL AND email IS NOT NULL
 *                        LIMIT 50 (Resend free tier 100/day 안전 마진)
 *   2. send-each       — Resend 호출 (개별 실패 격리, batch 무결성 유지)
 *   3. anonymize-sent  — atomic UPDATE: sent_at + email=NULL + pii_anonymized_at
 *   4. log-summary     — 통계 로그 (PII 0)
 *
 * ADR-0028 §T5 익명화: 발송 직후 email NULL 화 + pii_anonymized_at 갱신.
 * ADR-0028 §T7 다크패턴 0: 이미지 beacon 0, 외부 트래커 0, 긴급성 표현 0.
 *
 * atomic UPDATE 결정: 단일 UPDATE 가 DB 측에서 atomic — neon-http 연결
 * 특성상 별도 트랜잭션 불필요. sent_at + email=NULL + pii_anonymized_at 를
 * 한 UPDATE 안에서 동기 갱신 (4.5.c 메모 neon-http 한계 우회).
 */

// resend 패키지 (ADR-0028 §T1 — @resend/node 는 오기, 정정은 scribe)
import { Resend } from 'resend';
import { and, inArray, isNull, isNotNull, lte, eq } from 'drizzle-orm';
import { db } from '@/db';
import { followUpEmail as followUpEmailTable } from '@/db/schema/follow_up_email';
import { affiliateClick } from '@/db/schema/affiliate_click';
import { comparisonResult } from '@/db/schema/comparison_result';
import { provider } from '@/db/schema/provider';
import { inngest } from '@/lib/inngest';

// ─── 상수 ─────────────────────────────────────────────────────────────────

/** 시간당 최대 발송 수 (Resend free tier 100/day 기준 안전 마진) */
const BATCH_LIMIT = 50;

/** Inngest free tier: 5 concurrent steps 한도 안전 마진 */
const FOLLOW_UP_CONCURRENCY = 5;

// ─── 타입 ─────────────────────────────────────────────────────────────────

/**
 * pending row 데이터 (step 간 전달 직렬화 호환).
 * Inngest는 step 결과를 JSON 직렬화 → Date 는 string 으로 변환되므로
 * 날짜 필드를 ISO 8601 string 으로 선언.
 */
interface PendingRow {
  readonly id: string;
  readonly email: string;
  readonly unsubscribeToken: string;
  /** ISO 8601 string (Inngest step JSON 직렬화 호환) */
  readonly scheduledSendAt: string;
  readonly providerName: string;
  readonly providerWebsite: string | null;
  readonly shortId: string | null;
  /** ISO 8601 string (Inngest step JSON 직렬화 호환) */
  readonly clickedAt: string;
}

// ─── 본문 생성 helper ─────────────────────────────────────────────────────

/**
 * 날짜를 nl-BE 로케일 표시용 짧은 문자열로 변환.
 * 예: "13 mei 2026"
 */
function formatDateNl(isoString: string): string {
  return new Date(isoString).toLocaleDateString('nl-BE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * unsubscribe URL 생성.
 * process.env.NEXT_PUBLIC_SITE_URL > SITE_URL > fallback localhost.
 */
function buildUnsubscribeUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    'http://localhost:3000';
  return `${base}/unsubscribe/${token}`;
}

/**
 * 비교 결과 URL 생성.
 * shortId 가 NULL 이면 undefined 반환 (본문에서 결과 링크 제외).
 */
function buildResultUrl(shortId: string | null): string | undefined {
  if (!shortId) return undefined;
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    'http://localhost:3000';
  return `${base}/r/${shortId}`;
}

/**
 * 이메일 plaintext 본문 생성.
 * ADR-0028 §T7: 긴급성 표현 0 ('지금만'/'마감'/'빨리' 0), 이미지 beacon 0, 외부 트래커 0.
 */
export function buildPlaintext(row: PendingRow): string {
  const clickedAtFormatted = formatDateNl(row.clickedAt);
  const resultUrl = buildResultUrl(row.shortId);
  const unsubscribeUrl = buildUnsubscribeUrl(row.unsubscribeToken);

  const resultLine = resultUrl
    ? `비교 결과는 ${resultUrl} 에서 다시 보실 수 있습니다.`
    : '비교 결과 페이지는 보존 기간이 지나 더 이상 제공되지 않습니다.';

  return [
    '안녕하세요,',
    '',
    `7일 전 Slim 에서 ${row.providerName} 으로 변경을 시도하셨습니다 (${clickedAtFormatted}).`,
    '',
    '잘 되셨나요? ' + resultLine,
    '',
    '변경에 어려움이 있으셨다면, 회신해 주세요 (kim.wonmin91@gmail.com).',
    '',
    '— Slim',
    '',
    `이 메일을 받지 않으려면: ${unsubscribeUrl}`,
  ].join('\n');
}

/**
 * 이메일 HTML 본문 생성 (minimal inline style, 이미지 beacon 0).
 * ADR-0028 §T7: UTM 파라미터 0, 외부 트래커 0, 이미지 beacon 0.
 */
export function buildHtml(row: PendingRow): string {
  const clickedAtFormatted = formatDateNl(row.clickedAt);
  const resultUrl = buildResultUrl(row.shortId);
  const unsubscribeUrl = buildUnsubscribeUrl(row.unsubscribeToken);

  const resultSection = resultUrl
    ? `<p style="margin:0 0 16px 0">비교 결과는 <a href="${resultUrl}" style="color:#3b82f6">${resultUrl}</a> 에서 다시 보실 수 있습니다.</p>`
    : `<p style="margin:0 0 16px 0">비교 결과 페이지는 보존 기간이 지나 더 이상 제공되지 않습니다.</p>`;

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 24px 0">Slim 후속 안내</h1>
  <p style="margin:0 0 16px 0">안녕하세요,</p>
  <p style="margin:0 0 16px 0">7일 전 Slim 에서 <strong>${row.providerName}</strong> 으로 변경을 시도하셨습니다 (${clickedAtFormatted}).</p>
  <p style="margin:0 0 16px 0">잘 되셨나요? ${resultSection}</p>
  <p style="margin:0 0 16px 0">변경에 어려움이 있으셨다면, 회신해 주세요 (<a href="mailto:kim.wonmin91@gmail.com" style="color:#3b82f6">kim.wonmin91@gmail.com</a>).</p>
  <p style="margin:0 0 32px 0">— Slim</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px 0">
  <p style="font-size:12px;color:#6b7280;margin:0">
    이 메일을 받지 않으려면: <a href="${unsubscribeUrl}" style="color:#6b7280">${unsubscribeUrl}</a>
  </p>
</body>
</html>`;
}

// ─── DB 쿼리 helper ────────────────────────────────────────────────────────

/**
 * pending follow_up_email 조회 + affiliate_click / provider / comparison_result JOIN.
 * Drizzle neon-http 호환: 단계별 쿼리 (N+1, LIMIT 50 이하라 허용).
 */
async function selectPendingRows(now: Date): Promise<PendingRow[]> {
  const pendingBase = await db
    .select({
      id: followUpEmailTable.id,
      email: followUpEmailTable.email,
      unsubscribeToken: followUpEmailTable.unsubscribeToken,
      scheduledSendAt: followUpEmailTable.scheduledSendAt,
      affiliateClickId: followUpEmailTable.affiliateClickId,
      createdAt: followUpEmailTable.createdAt,
    })
    .from(followUpEmailTable)
    .where(
      and(
        lte(followUpEmailTable.scheduledSendAt, now),
        isNull(followUpEmailTable.sentAt),
        isNull(followUpEmailTable.unsubscribedAt),
        isNotNull(followUpEmailTable.email),
      ),
    )
    .limit(BATCH_LIMIT);

  const enriched: PendingRow[] = [];

  for (const row of pendingBase) {
    // affiliate_click 조회 (providerId, resultId 추출)
    const clickRows = await db
      .select({
        providerId: affiliateClick.providerId,
        resultId: affiliateClick.resultId,
      })
      .from(affiliateClick)
      .where(eq(affiliateClick.id, row.affiliateClickId))
      .limit(1);

    const click = clickRows[0];
    if (!click) continue;

    // provider 조회
    const providerRows = await db
      .select({ name: provider.name, website: provider.website })
      .from(provider)
      .where(eq(provider.id, click.providerId))
      .limit(1);

    const prov = providerRows[0];
    if (!prov) continue;

    // comparison_result shortId 조회 (nullable — 익명화 후 NULL 가능)
    let shortId: string | null = null;
    if (click.resultId) {
      const crRows = await db
        .select({ shortId: comparisonResult.shortId })
        .from(comparisonResult)
        .where(eq(comparisonResult.id, click.resultId))
        .limit(1);
      shortId = crRows[0]?.shortId ?? null;
    }

    enriched.push({
      id: row.id,
      // email IS NOT NULL 보장됨 (isNotNull 필터 → Drizzle 타입은 string | null)
      // @builder-justification: isNotNull() 필터 적용 후의 행이므로 email 은 반드시
      // string. Drizzle 선택 타입은 스키마 nullable 정의를 그대로 반영해 string|null.
      email: row.email as string,
      unsubscribeToken: row.unsubscribeToken,
      // ISO 8601 string 변환 — Inngest step JSON 직렬화 호환
      scheduledSendAt: row.scheduledSendAt.toISOString(),
      providerName: prov.name,
      providerWebsite: prov.website,
      shortId,
      clickedAt: row.createdAt.toISOString(),
    });
  }

  return enriched;
}

// ─── Inngest 함수 ─────────────────────────────────────────────────────────

/**
 * 매시간 pending 후속 메일 일괄 발송.
 *
 * cron 'TZ=UTC 0 * * * *': 매시간 정각 — 7일 트리거 정확도 + free tier 안전.
 * 'follow-up-email/run.requested' 이벤트: 어드민/dev 수동 트리거 (디버깅).
 */
export const followUpEmailFn = inngest.createFunction(
  {
    id: 'follow-up-email',
    concurrency: FOLLOW_UP_CONCURRENCY,
  },
  [
    { cron: 'TZ=UTC 0 * * * *' }, // 매시간 정각
    { event: 'follow-up-email/run.requested' }, // 수동 트리거 (디버깅)
  ],
  async ({ step, logger }) => {
    // ─── Step 1: pending row 조회 ──────────────────────────────────────────
    const rows = await step.run('select-pending', async () => {
      return selectPendingRows(new Date());
    });

    if (rows.length === 0) {
      logger.info({ msg: '후속 메일 batch — pending 0건', selected: 0 });
      return { selected: 0, sent: 0, failed: 0 };
    }

    // ─── Step 2: Resend 호출 ────────────────────────────────────────────────
    const sentIds = await step.run('send-each', async () => {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        logger.error({
          msg: 'RESEND_API_KEY 환경변수 미설정 — 발송 skip (production 에서는 절대 발생 X)',
        });
        return [] as string[];
      }

      const resend = new Resend(apiKey);
      // TODO(운영자): Resend dashboard 검증 도메인으로 교체 필요
      const from =
        process.env.RESEND_FROM_ADDRESS ?? 'Slim <noreply@example.com>';

      const succeeded: string[] = [];

      for (const row of rows) {
        try {
          const subject = `Slim — 7일 전 ${row.providerName} 변경, 잘 되셨나요?`;
          const text = buildPlaintext(row);
          const html = buildHtml(row);

          const { error } = await resend.emails.send({
            from,
            to: row.email,
            subject,
            html,
            text,
          });

          if (error) {
            logger.warn({
              msg: 'Resend 발송 실패 — 다음 cron 재시도',
              rowId: row.id,
              errorMessage: error.message,
            });
            // 실패 격리: 다른 row 는 계속 처리
            continue;
          }

          succeeded.push(row.id);
        } catch (err) {
          // 네트워크 오류 등 예외 격리
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn({
            msg: 'Resend 예외 — 다음 cron 재시도',
            rowId: row.id,
            errorMessage: msg,
          });
        }
      }

      return succeeded;
    });

    // ─── Step 3: atomic UPDATE — sent_at + email=NULL + pii_anonymized_at ──
    if (sentIds.length > 0) {
      await step.run('anonymize-sent', async () => {
        const now = new Date();
        // 단일 UPDATE = DB 측 atomic. 트랜잭션 불필요 (neon-http 한계 우회).
        // sent_at + email=NULL + pii_anonymized_at 한 UPDATE 에서 동기 갱신 (ADR-0028 §T5).
        await db
          .update(followUpEmailTable)
          .set({
            sentAt: now,
            email: null,
            piiAnonymizedAt: now,
          })
          .where(inArray(followUpEmailTable.id, sentIds));
      });
    }

    // ─── Step 4: 통계 로그 (PII 0) ─────────────────────────────────────────
    await step.run('log-summary', async () => {
      logger.info({
        msg: '후속 메일 batch 완료',
        selected: rows.length,
        sent: sentIds.length,
        failed: rows.length - sentIds.length,
      });
    });

    return {
      selected: rows.length,
      sent: sentIds.length,
      failed: rows.length - sentIds.length,
    };
  },
);
