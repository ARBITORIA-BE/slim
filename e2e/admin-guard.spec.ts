/**
 * /admin 인증 가드 E2E — PLAN 4.5.1.d
 *
 * 검증:
 *   1. 토큰 없이 GET /admin → 404
 *   2. ?token=<유효> 첫 진입 → 쿠키 발급 + 본문 "어드민 대시보드"
 *   3. 쿠키만 가지고 재진입 → 200 + 본문 "어드민 대시보드"
 *   4. ?token=<잘못된> → 404
 */
import { test, expect } from '@playwright/test';

import { E2E_ADMIN_TOKEN } from '../playwright.config';

test.describe('/admin 가드', () => {
  test('토큰 없이 진입 시 404', async ({ request }) => {
    const res = await request.get('/admin');
    expect(res.status()).toBe(404);
  });

  test('잘못된 토큰 쿼리는 404', async ({ request }) => {
    const res = await request.get('/admin?token=wrong-value');
    expect(res.status()).toBe(404);
  });

  test('유효 토큰 → 쿠키 발급 + 대시보드 렌더', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(`/admin?token=${E2E_ADMIN_TOKEN}`);
    // 리다이렉트 후 본문 노출
    await expect(page.getByRole('heading', { name: '어드민 대시보드', level: 1 })).toBeVisible();
    const cookies = await context.cookies();
    const admin = cookies.find((c) => c.name === 'admin_token');
    expect(admin?.value).toBe(E2E_ADMIN_TOKEN);
  });

  test('쿠키만으로 재진입 → 200', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(`/admin?token=${E2E_ADMIN_TOKEN}`);
    await expect(page.getByRole('heading', { name: '어드민 대시보드', level: 1 })).toBeVisible();
    // 쿠키만 남기고 새 페이지로 접근
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: '어드민 대시보드', level: 1 })).toBeVisible();
  });
});
