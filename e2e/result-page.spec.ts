/**
 * /r/[shortId] 결과 페이지 e2e (Sub-task 4 — ADR-0021 §T1 + §T7 + §T8).
 *
 * 검증:
 *   1. 정상 shortId (12자 nanoid) → placeholder 페이지 + CalculationDetails 펼치기
 *   2. 형식 미달 shortId → 404 (not-found.tsx 렌더)
 *   3. axe 0 violations (정상 페이지 + not-found 페이지)
 *
 * SC-G 정합 (T8): 정상 페이지 metadata 가 noindex 인지 confirm.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const SHOT_DIR = 'e2e/screenshots';

test.beforeAll(async () => {
  await mkdir(SHOT_DIR, { recursive: true });
});

test.describe('/r/[shortId] 정상 진입 (12자 nanoid)', () => {
  // 12 chars in URL-safe alphabet [A-Za-z0-9_-]
  const VALID_SHORT_ID = 'aB3dE_fG-hIj';
  const URL = `/r/${VALID_SHORT_ID}`;

  test('placeholder 헤더 + 영구 ID 노출', async ({ page }) => {
    await page.goto(URL);
    await expect(
      page.getByRole('heading', { name: '비교 결과 페이지는 곧 추가됩니다' }),
    ).toBeVisible();
    await expect(page.locator('code').first()).toHaveText(VALID_SHORT_ID);
  });

  test('CalculationDetails 펼치기 (HTML <details> native)', async ({ page }) => {
    await page.goto(URL);
    const summary = page.getByRole('group').getByText(/계산 근거 보기/);
    await expect(summary).toBeVisible();
    // <details> 기본 접힘 → 펼치기 클릭 후 가정/산식 노출
    await summary.click();
    await expect(page.getByRole('heading', { name: '사용한 가정' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '적용 산식' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '엔진 버전' })).toBeVisible();
    // engineVersion + estimatorVersion 둘 다 한 <code> 안에 노출
    const versionCode = page.locator('code').last();
    await expect(versionCode).toBeVisible();
    const text = await versionCode.textContent();
    expect(text).toMatch(/compare@\d{4}-\d{2}-\d{2}/);
    expect(text).toMatch(/usage-estimator@\d{4}-\d{2}-\d{2}/);
  });

  test('SC-G 메타: noindex robots + canonical (T8)', async ({ page }) => {
    const response = await page.goto(URL);
    expect(response?.status()).toBe(200);
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toContain('noindex');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe(`https://slim.lu${URL}`);
  });

  test('axe 0 violations (정상 페이지)', async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('h1')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    if (results.violations.length > 0) {
      console.warn('[axe] /r/[shortId] 정상 페이지 violations:');
      for (const v of results.violations) console.warn(`  - ${v.id} (${v.impact}): ${v.help}`);
    }
    expect(results.violations).toEqual([]);
  });
});

test.describe('/r/[shortId] 잘못된 shortId 404 (ADR-0021 §T1)', () => {
  const INVALID_CASES = [
    { name: '너무 짧음 (11자)', value: 'abc123def45' },
    { name: '너무 김 (13자)', value: 'abc123def4567' },
    { name: '허용 안 된 문자 (.)', value: 'abc.123def45' },
    { name: '빈 문자열은 라우트 매칭 X — 단순 공백 시뮬', value: '            ' },
  ];

  for (const tc of INVALID_CASES) {
    test(`형식 미달 → 404: ${tc.name}`, async ({ page }) => {
      const response = await page.goto(`/r/${encodeURIComponent(tc.value)}`);
      expect(response?.status()).toBe(404);
      await expect(
        page.getByRole('heading', { name: '이 결과는 더 이상 존재하지 않습니다' }),
      ).toBeVisible();
      // CTA 두 개 (새로 비교 + 홈)
      await expect(page.getByRole('link', { name: '새로 비교 시작' })).toBeVisible();
      await expect(page.getByRole('link', { name: '홈으로' })).toBeVisible();
    });
  }

  test('not-found 페이지 axe 0 violations', async ({ page }) => {
    await page.goto('/r/short');
    await expect(page.locator('h1')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    if (results.violations.length > 0) {
      console.warn('[axe] not-found 페이지 violations:');
      for (const v of results.violations) console.warn(`  - ${v.id} (${v.impact}): ${v.help}`);
    }
    expect(results.violations).toEqual([]);
  });
});
