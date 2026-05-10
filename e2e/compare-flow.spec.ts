/**
 * Phase 2 5단계 입력 플로우 — mobile 카테고리 + BE 1000 + single (ADR-0016 §검증 2).
 *
 * dev 서버 (reuseExistingServer) 재사용. 5단계 도달 시간 + 콘솔 에러 + 스크린샷
 * 캡처. 운영자 자가 5분 측정 (수동) 의 자동 보조.
 */

import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const SHOT_DIR = 'e2e/screenshots';

test.beforeAll(async () => {
  await mkdir(SHOT_DIR, { recursive: true });
});

test('5단계 입력 → /r/[shortId] 도달 (mobile + 1000 + single + skip + bill skip)', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });

  const start = Date.now();

  // ─── 0. /compare 진입 ────────────────────────────────────────────────
  await page.goto('/compare');
  await expect(
    page.getByRole('heading', { name: '어떤 요금제를 비교하시겠어요?' }),
  ).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/01-compare.png`, fullPage: true });

  // ─── 1. 모바일 카드 클릭 → /compare/mobile/postal ────────────────────
  await page.getByRole('link', { name: '모바일 비교 시작' }).click();
  await expect(page).toHaveURL(/\/compare\/mobile\/postal/);

  // ─── 2. 우편번호 1000 입력 → 다음 ────────────────────────────────────
  await page.getByLabel('우편번호').fill('1000');
  const nextHousehold = page.getByRole('button', { name: /다음 — 가구 형태/ });
  await expect(nextHousehold).toBeEnabled();
  await page.screenshot({ path: `${SHOT_DIR}/02-postal.png`, fullPage: true });
  await nextHousehold.click();
  await expect(page).toHaveURL(/\/compare\/mobile\/household/);

  // ─── 3. 가구 형태 — 혼자 → 다음 ──────────────────────────────────────
  await page.locator('label[for="household-single"]').click();
  const nextProvider = page.getByRole('button', { name: /다음 — 현재 공급사/ });
  await expect(nextProvider).toBeEnabled();
  await page.screenshot({ path: `${SHOT_DIR}/03-household.png`, fullPage: true });
  await nextProvider.click();
  await expect(page).toHaveURL(/\/compare\/mobile\/current-provider/);

  // ─── 4. 현재 공급사 — 스킵 ───────────────────────────────────────────
  await page.screenshot({ path: `${SHOT_DIR}/04-current-provider.png`, fullPage: true });
  await page.getByRole('button', { name: /모르겠어요 \/ 스킵/ }).click();
  await expect(page).toHaveURL(/\/compare\/mobile\/bill/);

  // ─── 5. 청구서 없이 진행 ────────────────────────────────────────────
  await page.screenshot({ path: `${SHOT_DIR}/05-bill.png`, fullPage: true });
  await page.getByRole('button', { name: /청구서 없이 진행/ }).click();
  await expect(page).toHaveURL(/\/compare\/mobile\/preview/);

  // ─── 6. preview 자동 제출 → /r/[shortId] ─────────────────────────────
  await page.waitForURL(/\/r\/[A-Za-z0-9_-]{12}$/, { timeout: 10_000 });
  const elapsed = Date.now() - start;
  await page.screenshot({ path: `${SHOT_DIR}/06-result.png`, fullPage: true });

  // 결과 페이지 placeholder 확인
  await expect(
    page.getByRole('heading', { name: '비교 결과 페이지는 곧 추가됩니다' }),
  ).toBeVisible();
  await expect(page.locator('code').first()).toHaveText(/^[A-Za-z0-9_-]{12}$/);

  console.warn(`\n[검증] 5단계 완주 시간: ${elapsed}ms (P2 5분 = 300_000ms)`);
  console.warn(`[검증] 콘솔 에러 수: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.warn('[검증] 콘솔 에러:');
    consoleErrors.forEach((e) => console.warn(`  - ${e}`));
  }

  // ADR-0016 §검증 2 — 5분 / 콘솔 에러 0
  expect(elapsed).toBeLessThan(300_000);
  expect(consoleErrors).toEqual([]);
});
