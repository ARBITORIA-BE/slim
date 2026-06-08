/**
 * Phase 2 3단계 입력 플로우 — mobile 카테고리 + single (ADR-0016 §T1 Amendment 4).
 *
 * ADR-0043 (2026-06-08): postal 단계 제거 → 3단계.
 * 변경 후 흐름: current-provider → household → preview → /r/{shortId}
 * (구 흐름: postal → household → current-provider → preview → /r/{shortId})
 *
 * ADR-0043 §D5: /compare/{category} 진입 시 current-provider 직진 (postal 단계 0).
 * ADR-0016 Amendment 4 cross-ref.
 *
 * dev 서버 (reuseExistingServer) 재사용. 3단계 도달 시간 + 콘솔 에러 + 스크린샷
 * 캡처. 운영자 자가 5분 측정 (수동) 의 자동 보조.
 */

import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const SHOT_DIR = 'e2e/screenshots';

test.beforeAll(async () => {
  await mkdir(SHOT_DIR, { recursive: true });
});

test('3단계 입력 → /r/[shortId] 도달 (mobile + single + skip, ADR-0043 §D5)', async ({
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
  await page.screenshot({ path: `${SHOT_DIR}/01-compare.png`, fullPage: true });

  // ─── 1. 모바일 카드 클릭 → /compare/mobile → /compare/mobile/current-provider ─
  // ADR-0043 §D5: /compare/{category} 진입 시 postal 단계 없이 current-provider 직진.
  await page.getByRole('link', { name: '모바일 비교 시작' }).click();
  // redirect: /compare/mobile → /compare/mobile/current-provider (postal 단계 0).
  await expect(page).toHaveURL(/\/compare\/mobile\/current-provider/);
  await page.screenshot({ path: `${SHOT_DIR}/02-current-provider.png`, fullPage: true });

  // ─── 2. 현재 공급사 — 스킵 → household ────────────────────────────────
  await page.getByRole('button', { name: /모르겠어요 \/ 스킵/ }).click();
  await expect(page).toHaveURL(/\/compare\/mobile\/household/);

  // ─── 3. 가구 형태 — 혼자 → preview 직진 ──────────────────────────────
  await page.locator('label[for="household-single"]').click();
  const nextProvider = page.getByRole('button', { name: /다음 — 결과 미리보기/ });
  await expect(nextProvider).toBeEnabled();
  await page.screenshot({ path: `${SHOT_DIR}/03-household.png`, fullPage: true });
  await nextProvider.click();

  // ADR-0016 Amendment 4: preview 자동 제출 → /r/[shortId]
  await page.waitForURL(/\/r\/[A-Za-z0-9_-]{12}$/, { timeout: 10_000 });
  const elapsed = Date.now() - start;
  await page.screenshot({ path: `${SHOT_DIR}/04-result.png`, fullPage: true });

  // 결과 페이지 — '비교 결과' h1 + shortId code element.
  await expect(
    page.getByRole('heading', { level: 1, name: '비교 결과' }),
  ).toBeVisible();
  await expect(page.locator('code').first()).toHaveText(/^[A-Za-z0-9_-]{12}$/);

  console.warn(`\n[검증] 3단계 완주 시간: ${elapsed}ms (P2 5분 = 300_000ms)`);
  console.warn(`[검증] 콘솔 에러 수: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.warn('[검증] 콘솔 에러:');
    consoleErrors.forEach((e) => console.warn(`  - ${e}`));
  }

  // ADR-0016 §검증 2 — 5분 / 콘솔 에러 0
  expect(elapsed).toBeLessThan(300_000);
  expect(consoleErrors).toEqual([]);
});

// ADR-0033 §A2.8.4 옵션 (c) — locale 단언 보완.
// /en 진입 시 핵심 텍스트가 한국어가 아님을 검증.
// why: t() 소비가 실제로 번역된 텍스트를 렌더하는지 런타임 확인.
test('/en 진입 → compare 페이지 핵심 텍스트가 ko 아님 (locale i18n 소비 검증)', async ({
  page,
}) => {
  await page.goto('/en/compare');
  // 영어 heading 은 "What plan do you want to compare?" 계열.
  // 한국어 "지금 비교할 요금이 뭔가요?" 가 없어야 함.
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toBeVisible();
  const headingText = await heading.textContent();
  // 한글 유니코드 블록 [가-힣] 이 없어야 함 — i18n 소비 정합 확인.
  expect(headingText).not.toMatch(/[가-힣]/);
});

test('3단계 + provider 선택 path (Proximus) + tariff 모르겠어요 → /r/[shortId] (ADR-0043)', async ({
  page,
}) => {
  // ADR-0043 §D5: /compare/mobile → current-provider 직진 (postal 단계 없음).
  await page.goto('/compare');
  await page.getByRole('link', { name: '모바일 비교 시작' }).click();
  await expect(page).toHaveURL(/\/compare\/mobile\/current-provider/);

  // current-provider — Proximus 선택 → tariff 모르겠어요 → household
  await page.getByLabel('현재 공급사 선택').click();
  await page.getByRole('option', { name: 'Proximus' }).click();
  // sub-step tariff Select 노출 — "이 공급사 요금제는 모르겠어요" 클릭
  await page.getByRole('button', { name: /이 공급사 요금제는 모르겠어요/ }).click();

  // ADR-0043 §D5 3단계: current-provider 완료 → household
  const nextHousehold = page.getByRole('button', { name: /다음 — 가구 형태/ });
  await expect(nextHousehold).toBeEnabled();
  await nextHousehold.click();
  await expect(page).toHaveURL(/\/compare\/mobile\/household/);

  // household 선택 → preview
  await page.locator('label[for="household-single"]').click();
  const nextPreview = page.getByRole('button', { name: /다음 — 결과 미리보기/ });
  await expect(nextPreview).toBeEnabled();
  await nextPreview.click();

  // preview → /r/[shortId]
  await page.waitForURL(/\/r\/[A-Za-z0-9_-]{12}$/, { timeout: 10_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: '비교 결과' }),
  ).toBeVisible();
});
