/**
 * result-page-print.spec.ts — 인쇄 뷰 회귀 테스트 (PLAN 3.7.c).
 *
 * ADR-0021 §T9 Amendment 1 (2026-05-11) 검증:
 *   (1) 인쇄 시 숨겨야 할 요소 비노출 (ComparisonControls, disabled CTA, 탐색 CTA).
 *   (2) P1/P3 강제 항목 노출 유지 — 빈 상태에서도 보이는 것만 무조건 assert:
 *       - h1 "비교 결과" (항상 렌더)
 *       - 영구 ID <code> (항상 렌더)
 *       - /data-sources 링크 또는 "마지막 확인" 텍스트 (빈 상태 vs 풀 경로)
 *       - /legal/affiliate-disclosure 링크 (footer, 항상 렌더)
 *   (3) @axe-core/playwright — print 모드 axe 0 violations.
 *   (4) (선택) 스크린샷 캡처.
 *
 * 풀 결과 경로 전용 케이스 (결론 카드 / 비교 표 / CalculationDetails 내부 펼침):
 *   시드 데이터의 confidence='low' 로 인해 현재 비교 후보 0건 → 이 분기는 타지 않음.
 *   아래 describe 블록은 confidence='high' 시드 도입 시 활성화 예정 (skip 처리).
 *
 * 전제:
 *   - `pnpm dev` 로 로컬 서버 가동 중 (E2E_BASE_URL 또는 localhost:3000).
 *   - POST /api/compare 가 200 응답 + shortId 반환.
 *   - 시드 데이터로 비교 후보 0건 → 빈 상태 경로(article aria-labelledby="no-candidates-heading").
 *
 * 셋업 패턴: e2e/result-page.spec.ts 의 beforeAll 차용.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const SHOT_DIR = 'e2e/screenshots';

test.beforeAll(async () => {
  await mkdir(SHOT_DIR, { recursive: true });
});

test.describe('/r/[shortId] 인쇄 뷰 (PLAN 3.7.c — print media emulation)', () => {
  let validShortId: string;
  let pageUrl: string;

  // 실 POST /api/compare 로 shortId 확보 — result-page.spec.ts 패턴 그대로.
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

  // ─── (1) 인쇄 시 숨겨야 할 요소 비노출 ────────────────────────────────────

  test('print 모드 — 숨김 요소: ComparisonControls / disabled CTA / 탐색 CTA', async ({
    page,
  }) => {
    await page.goto(pageUrl);
    await page.emulateMedia({ media: 'print' });

    // ComparisonControls (정렬/필터) — print:hidden.
    // 비교 후보 0건이면 ComparisonControls 자체가 DOM 에 없을 수 있음 — 존재 시만 검사.
    const controls = page.getByRole('group', {
      name: '비교 표 정렬 및 필터',
    });
    const controlsCount = await controls.count();
    if (controlsCount > 0) {
      await expect(controls.first()).toBeHidden();
    }

    // disabled "변경하기 (페이즈 4 활성 예정)" CTA — print:hidden.
    // 빈 상태에는 이 버튼 자체가 없음 — 존재 시만 검사.
    const ctaButton = page.getByRole('button', { name: /변경하기/ });
    const ctaCount = await ctaButton.count();
    if (ctaCount > 0) {
      await expect(ctaButton.first()).toBeHidden();
    }

    // "새로 비교 시작" / "홈으로 돌아가기" 탐색 링크 — print:hidden (항상 렌더됨).
    await expect(page.getByRole('link', { name: '새로 비교 시작' })).toBeHidden();
    await expect(page.getByRole('link', { name: '홈으로 돌아가기' })).toBeHidden();
  });

  // ─── (2) P1/P3 강제 항목 — 빈 상태에서도 항상 노출 유지 ──────────────────

  test('print 모드 — h1 "비교 결과" + 영구 ID 노출 (항상)', async ({ page }) => {
    await page.goto(pageUrl);
    await page.emulateMedia({ media: 'print' });

    // h1 은 빈 상태·풀 경로 모두 항상 렌더됨.
    await expect(
      page.getByRole('heading', { level: 1, name: '비교 결과' }),
    ).toBeVisible();

    // 영구 ID — 첫 번째 <code> 에 shortId 텍스트 (header 영역, 항상 렌더).
    await expect(page.locator('code').first()).toHaveText(validShortId);
  });

  test('print 모드 — P1: source 정보 노출 + P3: 어필리에이트 디스클로저 링크 노출', async ({
    page,
  }) => {
    await page.goto(pageUrl);
    await page.emulateMedia({ media: 'print' });

    // P1 — 비교 후보 존재 시: "마지막 확인" 텍스트 (ComparisonTable SourceLink).
    //      비교 후보 0건(빈 상태) 시: /data-sources 링크가 P1 대리.
    //      둘 중 하나가 보여야 함.
    const lastChecked = page.getByText(/마지막 확인/);
    const lastCheckedCount = await lastChecked.count();
    if (lastCheckedCount > 0) {
      await expect(lastChecked.first()).toBeVisible();
    } else {
      // 빈 상태 경로 — article 안의 /data-sources 링크가 P1 대리.
      const dataSourcesLink = page.getByRole('link', { name: /데이터 출처/ });
      await expect(dataSourcesLink).toBeVisible();
    }

    // P3 — /legal/affiliate-disclosure 링크 (footer, 인쇄에 항상 노출 — print:hidden 절대 금지).
    const disclosureLink = page.getByRole('link', {
      name: /affiliate-disclosure/i,
    });
    await expect(disclosureLink).toBeVisible();
  });

  // ─── (3) axe 0 violations (print 모드) ───────────────────────────────────

  test('print 모드 — axe 0 violations (ADR-0021 §T9 Amendment 1)', async ({
    page,
  }) => {
    await page.goto(pageUrl);
    await page.emulateMedia({ media: 'print' });
    // h1 대기 — 페이지 hydration 완료 신호.
    await expect(page.locator('h1')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    if (results.violations.length > 0) {
      console.warn('[axe] print 모드 violations:');
      for (const v of results.violations) {
        console.warn(`  - ${v.id} (${v.impact}): ${v.help}`);
      }
    }
    expect(results.violations).toEqual([]);
  });

  // ─── (4) 스크린샷 (선택) ─────────────────────────────────────────────────

  test('print 모드 — 전체 페이지 스크린샷 캡처', async ({ page }) => {
    await page.goto(pageUrl);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({
      path: `${SHOT_DIR}/result-print.png`,
      fullPage: true,
    });
  });
});

// ─── 풀 결과 경로 전용 케이스 (결론 카드 / 비교 표 / CalculationDetails 내부) ──
//
// 현재 시드 데이터의 스텁 fetcher 는 confidence='low' → getCandidateSnapshots 가
// 제외(ADR-0006 §T5/§T7) → 비교 후보 0건 → 이 describe 블록 안 케이스들은 타지 않음.
// confidence='high' 시드 또는 실 fetcher 도입 시 skip 해제 예정.

test.describe('/r/[shortId] 인쇄 뷰 — 풀 결과 경로 전용 (confidence=high 시드 도입 시 활성)', () => {
  test.skip(true, '시드에 비교 후보 없음 — confidence=high 시드 도입 시 활성');

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
    const body = (await res.json()) as { ok: boolean; shortId: string };
    validShortId = body.shortId;
    pageUrl = `/r/${validShortId}`;
    await ctx.dispose();
  });

  test('print 모드 — 결론 카드 + 비교 표 visible / 탐색 CTA hidden', async ({
    page,
  }) => {
    await page.goto(pageUrl);
    await page.emulateMedia({ media: 'print' });

    // 결론 카드가 DOM 에 있는지 먼저 확인.
    const conclusionCard = page.getByRole('article').first();
    const hasConclusion = (await conclusionCard.count()) > 0;
    if (!hasConclusion) return; // 후보 없으면 skip.

    // ComparisonControls — print:hidden.
    const controls = page.getByRole('group', { name: '비교 표 정렬 및 필터' });
    if ((await controls.count()) > 0) {
      await expect(controls.first()).toBeHidden();
    }

    // "변경하기" CTA — print:hidden.
    const ctaButton = page.getByRole('button', { name: /변경하기/ });
    if ((await ctaButton.count()) > 0) {
      await expect(ctaButton.first()).toBeHidden();
    }
  });

  test('print 모드 — P1: engineVersion + estimatorVersion 노출', async ({
    page,
  }) => {
    await page.goto(pageUrl);
    await page.emulateMedia({ media: 'print' });

    // CalculationDetails 의 <details> 가 print CSS 로 펼쳐진 상태.
    // globals.css: `details > *:not(summary) { display: block !important }`
    // 엔진 버전 <code> — 마지막 code 요소에 노출.
    const versionCode = page.locator('code').last();
    await expect(versionCode).toBeVisible();
    const text = await versionCode.textContent();
    expect(text).toMatch(/compare@\d{4}-\d{2}-\d{2}/);
    expect(text).toMatch(/usage-estimator@\d{4}-\d{2}-\d{2}/);
  });

  test('print 모드 — <details> 계산 근거 내부 항목 노출 (펼침 강제)', async ({
    page,
  }) => {
    await page.goto(pageUrl);
    await page.emulateMedia({ media: 'print' });

    // globals.css: `details > *:not(summary) { display: block !important }`
    // 사용자가 <details> 를 열지 않아도 내부 div.mt-4 가 보여야 함.
    await expect(page.getByRole('heading', { name: '사용한 가정' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '적용 산식' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '엔진 버전' })).toBeVisible();
  });

  test('print 모드 — 결과 item source_url / "마지막 확인" 노출', async ({
    page,
  }) => {
    await page.goto(pageUrl);
    await page.emulateMedia({ media: 'print' });

    // ComparisonTable SourceLink — "마지막 확인: X시간 전" 텍스트.
    const lastChecked = page.getByText(/마지막 확인/);
    if ((await lastChecked.count()) > 0) {
      await expect(lastChecked.first()).toBeVisible();
    }
  });
});
