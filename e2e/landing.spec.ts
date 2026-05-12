import { test, expect } from '@playwright/test';

test('랜딩 페이지가 헤드라인을 노출한다', async ({ page }) => {
  await page.goto('/');
  // <title> 태그도 "비교는 쉽게" 를 포함하므로 strict mode 에서 2개 매칭 오류 발생.
  // → <p> 태그로 범위를 좁혀 가시 영역의 텍스트만 검증한다.
  await expect(page.locator('p').filter({ hasText: '비교는 쉽게' }).first()).toBeVisible();
});
