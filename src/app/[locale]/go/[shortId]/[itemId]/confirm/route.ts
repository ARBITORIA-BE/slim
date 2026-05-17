/**
 * POST /go/[shortId]/[itemId]/confirm — 동의 확인 후 어트리뷰션 기록 + 302 리다이렉트.
 *
 * 흐름 (ADR-0026 §T2 + ADR-0028 §T3):
 *   1. shortId + itemId 로 인터스티셜 데이터 조회 (없으면 404)
 *   2. provider.website NULL/빈 문자열 → 502
 *   3. form data 파싱: email (선택) + followUp ('yes' | undefined)
 *   4. affiliate_click INSERT (clickToken: nanoid(12), consentGivenAt: now)
 *   5. 조건부 follow_up_email INSERT (followUp='yes' + email 유효 시만)
 *      — neon-http 드라이버가 트랜잭션 미지원이므로 순차 실행.
 *        affiliate_click 실패 → catch → 500 (follow_up_email 미실행).
 *        follow_up_email 실패 → catch → 500 (이미 affiliate_click 완료됨).
 *        두 번째 실패는 운영 이슈이므로 Sentry 캐치 후 수동 재처리.
 *   6. HTTP 302 → provider.website?ref=slim-r-<shortId>
 *
 * follow_up_email INSERT 조건 (ADR-0028 §T3):
 *   - followUp === 'yes' AND email non-empty AND email 유효 (z.string().email())
 *   - 이메일 유효성 실패 시 silent skip — 에러 페이지 0, 사용자 재제출 부담 0
 *   - affiliate_click INSERT 는 어트리뷰션 동의와 별개로 항상 진행
 *
 * 금지:
 *   - IP / User-Agent / Referer 헤더 읽기 X (ADR-0026 §T1)
 *   - 쿠키 읽기/쓰기 X
 *   - PostHog / Sentry 외 추적기 X (ADR-0026 §T2)
 *   - PII 0 — server log 에도 IP/UA 없음
 *   - Resend SDK X — 메일 발송은 4.5.d (ADR-0028)
 */

import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getInterstitialData, insertAffiliateClick } from '@/db/queries/affiliate-click';
import { insertFollowUpEmail } from '@/db/queries/follow-up-email';
import { appendRefParam } from '@/lib/append-ref';

// nanoid 12자 — ADR-0007 §T7 패턴 재사용 (compare/route.ts:141 동형)
const CLICK_TOKEN_LENGTH = 12;

// nanoid 16자 — unsubscribe_token (ADR-0028 §T7)
const UNSUBSCRIBE_TOKEN_LENGTH = 16;

// 7일 후 발송 예정 (milliseconds)
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// 이메일 유효성 스키마 (Zod — ADR-0028 §T3)
const emailSchema = z.string().email();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ shortId: string; itemId: string }> },
): Promise<NextResponse> {
  const { shortId, itemId } = await params;

  // 1. 인터스티셜 데이터 조회 — shortId / itemId 잘못됐으면 404.
  const data = await getInterstitialData(shortId, itemId);
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // 2. provider.website 유효성 검증.
  const website = data.providerWebsite;
  if (!website || website.trim() === '') {
    return NextResponse.json(
      { error: 'provider_website_unavailable' },
      { status: 502 },
    );
  }

  // 3. form data 파싱 — email + followUp.
  //    Content-Type: application/x-www-form-urlencoded (native HTML form POST).
  let rawEmail: string | null = null;
  let followUp: string | undefined;

  try {
    const formData = await req.formData();
    const emailVal = formData.get('email');
    const followUpVal = formData.get('followUp');

    rawEmail = typeof emailVal === 'string' ? emailVal.trim() : null;
    followUp = typeof followUpVal === 'string' ? followUpVal : undefined;
  } catch {
    // form data 파싱 실패 — affiliate_click INSERT 는 계속 진행 (email/followUp 없이)
    rawEmail = null;
    followUp = undefined;
  }

  // 이메일 유효성 검증 (ADR-0028 §T3)
  const isFollowUpRequested = followUp === 'yes';
  const emailResult = rawEmail ? emailSchema.safeParse(rawEmail) : { success: false as const };
  const shouldInsertFollowUp = isFollowUpRequested && emailResult.success;
  const validEmail = emailResult.success ? emailResult.data : null;

  // 4. affiliate_click INSERT.
  //    INSERT 실패 시 → 500 (follow_up_email 도 미실행).
  try {
    const clickToken = nanoid(CLICK_TOKEN_LENGTH);
    const refParam = `slim-r-${shortId}`;

    const clickResult = await insertAffiliateClick({
      clickToken,
      resultId: data.resultId,
      resultItemId: data.resultItemId,
      providerId: data.providerId,
      tariffSnapshotId: data.tariffSnapshotId,
      consentGivenAt: new Date(),
      refParam,
    });

    // 5. 조건부 follow_up_email INSERT (ADR-0028 §T3).
    //    조건 불충족 (email 빈값 / 유효성 실패 / followUp 미체크) 시 silent skip.
    //    neon-http 트랜잭션 미지원 → 순차 실행. affiliate_click 은 이미 커밋됨.
    if (shouldInsertFollowUp && validEmail !== null) {
      const unsubscribeToken = nanoid(UNSUBSCRIBE_TOKEN_LENGTH);
      const scheduledSendAt = new Date(Date.now() + SEVEN_DAYS_MS);

      await insertFollowUpEmail({
        affiliateClickId: clickResult.id,
        email: validEmail,
        scheduledSendAt,
        unsubscribeToken,
      });
    }

    // 6. HTTP 302 → provider.website?ref=slim-r-<shortId>
    const redirectUrl = appendRefParam(website, refParam);
    return NextResponse.redirect(redirectUrl, { status: 302 });
  } catch {
    // INSERT 실패 — server log 는 Sentry 가 처리. 응답에 PII 0.
    return NextResponse.json(
      { error: 'internal_error' },
      { status: 500 },
    );
  }
}
