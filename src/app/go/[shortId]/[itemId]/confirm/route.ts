/**
 * POST /go/[shortId]/[itemId]/confirm — 동의 확인 후 어트리뷰션 기록 + 302 리다이렉트.
 *
 * 흐름 (ADR-0026 §T2):
 *   1. shortId + itemId 로 인터스티셜 데이터 조회 (없으면 404)
 *   2. provider.website NULL/빈 문자열 → 502
 *   3. affiliate_click INSERT (clickToken: nanoid(12), consentGivenAt: now)
 *   4. HTTP 302 → provider.website?ref=slim-r-<shortId>
 *
 * 금지:
 *   - IP / User-Agent / Referer 헤더 읽기 X (ADR-0026 §T1)
 *   - 쿠키 읽기/쓰기 X
 *   - PostHog / Sentry 외 추적기 X (ADR-0026 §T2)
 *   - PII 0 — server log 에도 IP/UA 없음
 */

import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';

import { getInterstitialData, insertAffiliateClick } from '@/db/queries/affiliate-click';
import { appendRefParam } from '@/lib/append-ref';

// nanoid 12자 — ADR-0007 §T7 패턴 재사용 (compare/route.ts:141 동형)
const CLICK_TOKEN_LENGTH = 12;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ shortId: string; itemId: string }> },
): Promise<NextResponse> {
  const { shortId, itemId } = await params;

  // 1. 인터스티셜 데이터 조회 — shortId / itemId 잘못됐으면 404.
  const data = await getInterstitialData(shortId, itemId);
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // 2. provider.website 유효성 검증.
  //    NULL (schema type: string, 하지만 DB 값이 빈 문자열일 수 있음) 체크.
  const website = data.providerWebsite;
  if (!website || website.trim() === '') {
    // 인터스티셜 페이지로 에러 복귀 — PII 0 메시지
    return NextResponse.json(
      { error: 'provider_website_unavailable' },
      { status: 502 },
    );
  }

  // 3. affiliate_click INSERT.
  //    INSERT 실패 시 → server log (Sentry 가 캐치) + 인터스티셜로 일반 에러 반환.
  //    PII 0 — 에러 메시지에 shortId/itemId 포함하지 않음.
  try {
    const clickToken = nanoid(CLICK_TOKEN_LENGTH);
    const refParam = `slim-r-${shortId}`;

    await insertAffiliateClick({
      clickToken,
      resultId: data.resultId,
      resultItemId: data.resultItemId,
      providerId: data.providerId,
      tariffSnapshotId: data.tariffSnapshotId,
      consentGivenAt: new Date(),
      refParam,
    });

    // 4. HTTP 302 → provider.website?ref=slim-r-<shortId>
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
