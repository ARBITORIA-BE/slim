import { test, expect } from '@playwright/test';

test('랜딩 페이지가 헤드라인을 노출한다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('비교는 쉽게')).toBeVisible();
});
