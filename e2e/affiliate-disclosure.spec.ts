/**
 * affiliate-disclosure E2E (PLAN 4.3.e — sub-task iii).
 *
 * 시나리오:
 *   (a) /legal/affiliate-disclosure 직접 방문
 *       → 단가 표 헤더 + 행 1+ 존재 + placeholder 알림 배너 확인.
 *   (b) AffiliateDisclosureLine 링크 href 단언은
 *       src/app/r/[shortId]/_components/AffiliateDisclosureLine.test.tsx
 *       (unit 테스트) 에서 이미 검증 — 결과 페이지 seed 가 무거우므로
 *       E2E 레이어는 디스클로저 페이지 직접 방문으로 대체 (fallback 채택).
 *
 * fallback 근거:
 *   /r/[shortId] 진입은 POST /api/compare → DB INSERT → shortId 반환 흐름이 필요.
 *   이 흐름은 result-page.spec.ts 가 이미 커버한다.
 *   AffiliateDisclosureLine 의 href=/legal/affiliate-disclosure 단언은
 *   unit 테스트(AffiliateDisclosureLine.test.tsx, 케이스 2개)에서 강제된다.
 *   따라서 E2E 는 디스클로저 페이지 자체의 렌더 완전성만 검증하면 4.3.e 요건 충족.
 */

import { expect, test } from '@playwright/test';

test.describe('/legal/affiliate-disclosure 단가 표 렌더 (PLAN 4.3.e)', () => {
  test('(a) 페이지 접근 → h1 + 단가 표 헤더 존재', async ({ page }) => {
    await page.goto('/legal/affiliate-disclosure');

    // h1 렌더
    await expect(
      page.getByRole('heading', { level: 1, name: '제휴 수수료 공개' }),
    ).toBeVisible();

    // 단가 표 헤더 컬럼 6종 확인
    await expect(page.getByRole('columnheader', { name: '공급사' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '유형' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '단가' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '통화' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '확인 일자' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '발효 일자' })).toBeVisible();
  });

  test('(a) 단가 표 행 1건 이상 존재 (affiliateRates placeholder 반영)', async ({ page }) => {
    await page.goto('/legal/affiliate-disclosure');

    // 표 body 행 (thead 외 tr)
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('(a) placeholder 알림 배너 존재 (source 가 placeholder 인 동안 표시)', async ({ page }) => {
    await page.goto('/legal/affiliate-disclosure');

    // role="note" 배너 — isPlaceholderOnly() === true 인 동안 렌더
    const banner = page.getByRole('note', { name: '개발용 placeholder 단가 안내' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('개발용 placeholder');
  });

  test('(a) "← 데이터 출처로 돌아가기" 링크 존재 + href=/data-sources', async ({ page }) => {
    await page.goto('/legal/affiliate-disclosure');

    const backLink = page.getByRole('link', { name: '← 데이터 출처로 돌아가기' });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/data-sources');
  });

  test('(a) 단가 표에 EUR 금액 (€ 포함) 렌더', async ({ page }) => {
    await page.goto('/legal/affiliate-disclosure');

    // affiliateRates 의 amountCents=5000 → €50 포맷이 셀에 표시됨
    // nl-BE locale 에 따라 "€ 50" 또는 "€50" spacing 허용 → /€\s*\d+/ 로 검증
    const firstDataRow = page.locator('table tbody tr').first();
    await expect(firstDataRow).toBeVisible();
    const rowText = await firstDataRow.textContent();
    expect(rowText).toMatch(/€\s*\d+/);
  });
});
