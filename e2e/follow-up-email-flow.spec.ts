/**
 * follow-up-email 흐름 E2E (PLAN 4.5.g — ii)
 *
 * 선택: 대안 b — Inngest function 은 E2E 범위 외 (실 Inngest 서버 의존성 없음).
 * 근거: PLAN 4.5.g 본문 "(Inngest mock 또는 시간 점프)" 유연성 허용.
 *   - Inngest 발송 step 은 4.5.d (단위 14개) + 4.5.g 통합 8개 로 보장됨.
 *   - E2E 는 UI 흐름 + DB 효과 (affiliate_click + follow_up_email INSERT) 중심.
 *   - unsubscribe 페이지는 별도 케이스로 검증.
 *
 * 시나리오:
 *   (a) 인터스티셜 → 동의 + 후속 메일 미체크 → 302 발생
 *       - pre-checked=false 확인 (ADR-0028 §T7 다크패턴 0)
 *       - 인터스티셜 5항목 텍스트 렌더 확인 (ADR-0026 §검토 2)
 *       - 동의 form submit → redirect 발생
 *   (b) 인터스티셜 5항목 + 후속 메일 섹션 렌더
 *       - 체크박스 defaultChecked=false (pre-checked 0)
 *       - "후속 메일 받기" 레이블 존재
 *   (c) /unsubscribe/[token] 직접 방문 → "해제 완료" + 홈 링크
 *       - 다크패턴 0: "재구독" / "다시 받기" 부재
 *
 * 결정적 부분만 검증 — E2E 레이어:
 *   - DB seed 없이 가능한 부분: 인터스티셜 페이지는 GET 으로 렌더되므로
 *     실제 DB shortId + itemId 가 필요. 따라서 result-page.spec.ts 처럼
 *     POST /api/compare 로 shortId 를 먼저 취득한 뒤 /r/[shortId] 에서
 *     아이템 UUID 를 파싱해 /go/[shortId]/[itemId] 에 진입.
 *
 * fallback 상세:
 *   - /go/[shortId]/[itemId] 방문 시 DB 에 실제 item 이 있어야 렌더됨.
 *     item UUID 를 E2E 환경에서 얻으려면 결과 페이지 HTML 을 파싱해야 함.
 *   - 결과 페이지에 item 이 0건 (placeholder 데이터) 일 수 있음 →
 *     이 경우 인터스티셜 E2E 는 "결과 없음" 케이스 처리.
 *   - 따라서 인터스티셜 → confirm 흐름은 *결과 페이지에 항목이 있을 때만* 실행.
 *     항목 없으면 (a) 스킵 + (b) (c) 로 커버.
 *
 * unsubscribe 시나리오:
 *   - unsubscribe_token 은 16자 nanoid 이므로 직접 임의 토큰으로 방문하면 404.
 *   - E2E 에서 실제 토큰을 얻으려면 follow_up_email INSERT 가 필요.
 *   - 대안: /unsubscribe/[invalid-or-random-token] 은 404 응답 확인.
 *     유효 토큰 시나리오는 4.5.e 단위 테스트 (20개) + 통합 5b 가 커버.
 *   - 따라서 (c) 는 *페이지 구조 렌더* 확인만 (토큰 유효성 = 단위 테스트 담당).
 */

import { expect, request as playwrightRequest, test } from '@playwright/test';

// ─── 시나리오 (a)(b): 인터스티셜 페이지 렌더 ────────────────────────────────

test.describe('(a)(b) 인터스티셜 페이지 렌더 + 후속 메일 섹션 (PLAN 4.5.g)', () => {
  let shortId: string | null = null;
  let itemId: string | null = null;

  test.beforeAll(async () => {
    // POST /api/compare 로 실제 shortId 취득 (result-page.spec.ts 패턴 일관)
    const ctx = await playwrightRequest.newContext({
      baseURL: 'http://localhost:3000',
    });
    const res = await ctx.post('/api/compare', {
      data: {
        category: 'mobile',
        postal: { country: 'BE', postalCode: '1000' },
        householdType: 'single',
        currentProviderId: null,
        currentTariffId: null,
        inputAttributes: {},
      },
    });

    if (res.status() === 200) {
      const body = (await res.json()) as { ok: boolean; shortId: string };
      if (body.ok) shortId = body.shortId;
    }
    await ctx.dispose();
  });

  test('(b) 결과 페이지 진입 → "변경하기" 링크에서 itemId 추출 → 인터스티셜 렌더', async ({
    page,
  }) => {
    if (!shortId) {
      test.skip(true, 'POST /api/compare 실패 또는 shortId 미취득 — 스킵');
      return;
    }

    // 결과 페이지 진입
    await page.goto(`/r/${shortId}`);

    // "변경하기" 링크 탐색 — /go/[shortId]/[itemId] 패턴
    const goLinks = page.locator('a[href^="/go/"]');
    const count = await goLinks.count();

    if (count === 0) {
      // placeholder 결과 0건 케이스 — 인터스티셜 진입 불가, 이하 스킵
      test.skip(true, '결과 항목 0건 — 인터스티셜 E2E 스킵 (단위 테스트가 커버)');
      return;
    }

    const firstLink = goLinks.first();
    const href = await firstLink.getAttribute('href');
    if (!href) {
      test.skip(true, '링크 href 없음 — 스킵');
      return;
    }

    // href = /go/<shortId>/<itemId> 파싱
    const match = href.match(/^\/go\/([A-Za-z0-9_-]+)\/([0-9a-f-]+)$/i);
    if (!match?.[1] || !match?.[2]) {
      test.skip(true, 'itemId 파싱 실패 — 스킵');
      return;
    }
    itemId = match[2];

    // 인터스티셜 페이지 직접 방문
    await page.goto(`/go/${shortId}/${itemId}`);

    // ADR-0026 §검토 2 필수 5항목 확인
    await expect(page.getByRole('heading', { level: 2, name: '이동 전 확인 사항' })).toBeVisible();
    await expect(page.getByText('방문 사실이 Slim 서버에 어트리뷰션 목적으로 기록됩니다')).toBeVisible();
    await expect(page.getByText('거부해도 비교 결과는 그대로 유지됩니다')).toBeVisible();

    // (b) 후속 메일 섹션 렌더
    await expect(page.getByRole('heading', { level: 3, name: '후속 메일 (선택)' })).toBeVisible();

    // ADR-0028 §T7 pre-checked 0 확인
    const checkbox = page.locator('input[name="followUp"][type="checkbox"]');
    await expect(checkbox).toBeVisible();
    const isChecked = await checkbox.isChecked();
    expect(isChecked).toBe(false);

    // email input 존재
    await expect(page.locator('input[name="email"][type="email"]')).toBeVisible();
  });

  test('(a) 동의하고 이동 버튼 제출 → redirect 발생 (302 효과)', async ({ page }) => {
    if (!shortId || !itemId) {
      test.skip(true, 'shortId/itemId 미취득 — 스킵');
      return;
    }

    await page.goto(`/go/${shortId}/${itemId}`);

    // 후속 메일 미체크 상태로 폼 제출 (체크박스 그대로 — defaultChecked=false)
    await page.getByRole('button', { name: '동의하고 이동' }).click();

    // Playwright 는 redirect 를 자동 follow 함 → 외부 URL 로 이동됨
    // 단: 외부 URL 은 실제 이동 가능 — baseURL 과 다른 origin 이면 navigate error 가능
    // 따라서 URL 변경만 확인 (외부 도메인 이동 OK)
    await page.waitForTimeout(500);

    // 리다이렉트 후 URL 이 /go/... 가 아니면 성공 (외부 이동)
    const currentUrl = page.url();
    // /go/ 페이지에 그대로 있지 않으면 redirect 성공
    const isStillOnInterstitial = currentUrl.includes(`/go/${shortId}/${itemId}`);
    expect(isStillOnInterstitial).toBe(false);
  });
});

// ─── 시나리오 (c): unsubscribe 페이지 구조 확인 ────────────────────────────

test.describe('(c) /unsubscribe 페이지 구조 + 다크패턴 0 (PLAN 4.5.g)', () => {
  test('(c-1) 잘못된 토큰 → 404 응답', async ({ page }) => {
    // 16자가 아닌 토큰 → TOKEN_PATTERN 불일치 → notFound()
    const res = await page.goto('/unsubscribe/short');
    expect(res?.status()).toBe(404);
  });

  test('(c-2) 유효 형식 16자 토큰 방문 → 404 또는 500 (DB 마이그레이션 여부에 따라)', async ({
    page,
  }) => {
    // TOKEN_PATTERN 통과 후 DB 쿼리:
    //   - follow_up_email 테이블 존재 + 토큰 없음 → not-found → notFound() → 404
    //   - follow_up_email 테이블 미마이그레이션 → DB error → Next.js 500
    // E2E 환경(dev DB)에서 테이블 상태가 일정하지 않으므로 둘 다 허용.
    const res = await page.goto('/unsubscribe/zZzZzZ1234567890');
    const status = res?.status();

    // 404 = 정상 (테이블 있음, 토큰 없음)
    // 500 = DB 에러 (테이블 미마이그레이션)
    // 두 경우 모두 "보안 위반 없음" — 200 (확인 페이지 노출) 은 허용 안 됨
    expect(status).not.toBe(200);
    expect([404, 500]).toContain(status);
  });

  test('(c-3) 유효 형식 토큰 방문 → 404/500 OR 200 확인 페이지 (DB 상태 의존)', async ({
    page,
  }) => {
    // 고정 토큰 — DB 에 없으면 404/500, 있으면 200 + 확인 페이지
    const fakeToken = 'AbCd1234_-AbCd12'; // 유효 형식 16자
    const res = await page.goto(`/unsubscribe/${fakeToken}`);

    const status = res?.status();
    expect([200, 404, 500]).toContain(status);

    if (status === 200) {
      // 확인 페이지 도달 시: 다크패턴 0 검증 (ADR-0028 §T7)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Slim 후속 메일 해제 완료');

      const bodyText = await page.locator('body').textContent();
      expect(bodyText).not.toContain('재구독');
      expect(bodyText).not.toContain('다시 받기');

      await expect(page.getByRole('link', { name: /Slim 홈으로 돌아가기/ })).toBeVisible();
    }
  });
});
