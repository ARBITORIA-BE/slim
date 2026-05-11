/**
 * /r/[shortId] 결과 페이지 e2e — Sub-task 4 + Sub-task 5.
 *
 * 검증:
 *   1. 실 POST /api/compare → 실 shortId → /r/{shortId} 도달 (Sub-task 5 happy path)
 *   2. placeholder 헤더 + 영구 ID + CalculationDetails 펼치기 (Sub-task 4)
 *   3. SC-G 메타: noindex robots + canonical (T8)
 *   4. axe 0 violations (정상 페이지 + not-found 페이지)
 *   5. 형식 미달 shortId → 404 (ADR-0021 §T1)
 *   6. DB 미존재 shortId → 404 (Sub-task 5 새 검증)
 *
 * Sub-task 5 전제: dev 서버가 DATABASE_URL 가진 채 가동 — POST 가 200 으로 응답.
 * 후보 0건도 OK (shortId 는 반환, /r/{shortId} 진입 가능).
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const SHOT_DIR = 'e2e/screenshots';

test.beforeAll(async () => {
  await mkdir(SHOT_DIR, { recursive: true });
});

test.describe('/r/[shortId] 정상 진입 (실 POST 로 받은 shortId — Sub-task 5)', () => {
  let validShortId: string;
  let pageUrl: string;

  test.beforeAll(async () => {
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
    expect(res.status(), 'POST /api/compare 200').toBe(200);
    const body = (await res.json()) as { ok: boolean; shortId: string };
    expect(body.ok).toBe(true);
    expect(body.shortId).toMatch(/^[A-Za-z0-9_-]{12}$/);
    validShortId = body.shortId;
    pageUrl = `/r/${validShortId}`;
    await ctx.dispose();
  });

  test('비교 결과 헤더 + 영구 ID + 결론 카드 노출 (라운드 a)', async ({ page }) => {
    await page.goto(pageUrl);
    await expect(
      page.getByRole('heading', { level: 1, name: '비교 결과' }),
    ).toBeVisible();
    // 영구 ID 는 첫 <code> 안에 노출 (header 영역 우선)
    await expect(page.locator('code').first()).toHaveText(validShortId);
    // 결론 카드 = 1위 추천 라벨 + "{provider} — {tariff}" h2.
    // 후보 0건 시 "비교 후보가 없습니다" h2 가 대신 노출.
    const hasConclusion = await page
      .getByRole('article', { name: /\S+/ })
      .first()
      .isVisible();
    expect(hasConclusion).toBe(true);
  });

  test('CalculationDetails 펼치기 (HTML <details> native)', async ({ page }) => {
    await page.goto(pageUrl);
    const summary = page.getByRole('group').getByText(/계산 근거 보기/);
    await expect(summary).toBeVisible();
    await summary.click();
    await expect(page.getByRole('heading', { name: '사용한 가정' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '적용 산식' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '엔진 버전' })).toBeVisible();
    // engineVersion + estimatorVersion 둘 다 한 <code> 안에 노출 (실 DB 값)
    const versionCode = page.locator('code').last();
    await expect(versionCode).toBeVisible();
    const text = await versionCode.textContent();
    expect(text).toMatch(/compare@\d{4}-\d{2}-\d{2}/);
    expect(text).toMatch(/usage-estimator@\d{4}-\d{2}-\d{2}/);
  });

  test('SC-G 메타: noindex robots + canonical (T8)', async ({ page }) => {
    const response = await page.goto(pageUrl);
    expect(response?.status()).toBe(200);
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toContain('noindex');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe(`https://slim.lu${pageUrl}`);
  });

  test('axe 0 violations (정상 페이지)', async ({ page }) => {
    await page.goto(pageUrl);
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

test.describe('/r/[shortId] DB 미존재 shortId 404 (Sub-task 5)', () => {
  test('형식 통과 + DB 행 없음 → 404', async ({ page }) => {
    // 형식은 통과 (12자 URL-safe), 그러나 nanoid 가 64^12 공간이라 사실상 충돌 0
    const fakeButValid = 'zzzzzzzzzzzz';
    const response = await page.goto(`/r/${fakeButValid}`);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { name: '이 결과는 더 이상 존재하지 않습니다' }),
    ).toBeVisible();
  });
});
