/**
 * /admin 인증 가드 E2E — PLAN 4.5.1.d + D.8 (ADR-0038)
 *
 * 검증:
 *   [기존 4건]
 *   1. 토큰 없이 GET /admin → 404
 *   2. ?token=<유효> 첫 진입 → 쿠키 발급 + 본문 "어드민 대시보드"
 *   3. 쿠키만 가지고 재진입 → 200 + 본문 "어드민 대시보드"
 *   4. ?token=<잘못된> → 404
 *
 *   [ADR-0038 추가 — locale prefix 우회 봉합]
 *   5~8. 토큰 없이 /en|/nl-NL|/fr-BE|/fr-LU + /admin → 각 404 (음성)
 *   9.   /en/admin?token=<유효> → 200 + 대시보드 + 쿠키 발급 (양성)
 *  10.   쿠키 보유 후 /en/admin 재진입 → 200, 재인증 루프 없음 (재진입)
 */
import { test, expect } from '@playwright/test';

import { E2E_ADMIN_TOKEN } from '../playwright.config';

test.describe('/admin 가드', () => {
  // ── 기존 4건 (불변) ──────────────────────────────────────────────────────

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

  // ── ADR-0038 추가: locale prefix 음성 — 토큰 없이 404 ────────────────────
  // 왜 음성 먼저인가: 취약점 핵심이 "가드 우회" 이므로
  // 404 확인이 양성(200)보다 중요한 시큐리티 검증임.

  test('[ADR-0038] 토큰 없이 /en/admin → 404', async ({ request }) => {
    const res = await request.get('/en/admin');
    expect(res.status()).toBe(404);
  });

  test('[ADR-0038] 토큰 없이 /nl-NL/admin → 404', async ({ request }) => {
    const res = await request.get('/nl-NL/admin');
    expect(res.status()).toBe(404);
  });

  test('[ADR-0038] 토큰 없이 /fr-BE/admin → 404', async ({ request }) => {
    const res = await request.get('/fr-BE/admin');
    expect(res.status()).toBe(404);
  });

  test('[ADR-0038] 토큰 없이 /fr-LU/admin → 404', async ({ request }) => {
    const res = await request.get('/fr-LU/admin');
    expect(res.status()).toBe(404);
  });

  // ── ADR-0038 추가: 양성 — prefixed 경로에서 토큰으로 진입 ─────────────────

  test('[ADR-0038] /en/admin?token=유효 → 200 + 대시보드 + 쿠키', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(`/en/admin?token=${E2E_ADMIN_TOKEN}`);
    // ?token= 제거 redirect 후 /en/admin 에서 대시보드 렌더
    await expect(page.getByRole('heading', { name: '어드민 대시보드', level: 1 })).toBeVisible();
    // 쿠키 path='/' 로 발급됐는지 확인 — prefixed 경로에서도 전송 가능해야 함
    const cookies = await context.cookies();
    const admin = cookies.find((c) => c.name === 'admin_token');
    expect(admin?.value).toBe(E2E_ADMIN_TOKEN);
  });

  // ── ADR-0038 추가: 재진입 — 쿠키 보유 후 prefixed 경로 → 재인증 루프 없음 ──

  test('[ADR-0038] 쿠키 보유 후 /en/admin 재진입 → 200, 루프 없음', async ({ page, context }) => {
    await context.clearCookies();
    // 토큰으로 쿠키 발급 (무프리픽스 경로로 발급해도 path='/' 라 /en/admin 에도 전송됨)
    await page.goto(`/admin?token=${E2E_ADMIN_TOKEN}`);
    await expect(page.getByRole('heading', { name: '어드민 대시보드', level: 1 })).toBeVisible();

    // 쿠키만 가지고 prefixed 경로로 접근 — 재인증 없이 200 기대
    await page.goto('/en/admin');
    await expect(page.getByRole('heading', { name: '어드민 대시보드', level: 1 })).toBeVisible();
  });
});
