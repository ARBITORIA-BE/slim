/**
 * Phase 2 3단계 입력 플로우 — mobile 카테고리 + single (ADR-0016 §검증 2).
 *
 * ADR-0016 Amendment 3 + ADR-0041 Amendment 2 (2026-06-06): bill 단계 제거.
 * ADR-0043 (2026-06-08): postal 단계 제거 → 3단계.
 * 변경 후 흐름: household → current-provider → preview → /r/{shortId}
 *
 * dev 서버 (reuseExistingServer) 재사용. 3단계 도달 시간 + 콘솔 에러 + 스크린샷
 * 캡처. 운영자 자가 5분 측정 (수동) 의 자동 보조.
 *
 * ADR-0041 D2 + ADR-0043: 홈 카테고리 카드 직접 클릭 → /compare/{category}/household 직진.
 * 단, e2e는 /compare 직접 진입 패턴도 유지 (URL 라우팅 회귀 방지).
 */

import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const SHOT_DIR = 'e2e/screenshots';

test.beforeAll(async () => {
  await mkdir(SHOT_DIR, { recursive: true });
});

test('3단계 입력 → /r/[shortId] 도달 (mobile + single + skip)', async ({
  page,
}) => {
  // ADR-0043: postal 단계 제거. 흐름: household → current-provider → preview → /r/{shortId}
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

  // ─── 1. 모바일 카드 클릭 → /compare/mobile/household 직진 (ADR-0043) ──
  await page.getByRole('link', { name: '모바일 비교 시작' }).click();
  // postal 단계 없음 — household 직진 확인 (ZIP 단계 0 실측)
  await expect(page).toHaveURL(/\/compare\/mobile\/household/);

  // ─── 2. 가구 형태 — 혼자 → 다음 ──────────────────────────────────────
  await page.locator('label[for="household-single"]').click();
  const nextProvider = page.getByRole('button', { name: /다음 — 현재 공급사/ });
  await expect(nextProvider).toBeEnabled();
  await page.screenshot({ path: `${SHOT_DIR}/02-household.png`, fullPage: true });
  await nextProvider.click();
  await expect(page).toHaveURL(/\/compare\/mobile\/current-provider/);

  // ─── 3. 현재 공급사 — 스킵 → preview 직진 (bill 단계 없음) ───────────
  await page.screenshot({ path: `${SHOT_DIR}/03-current-provider.png`, fullPage: true });
  await page.getByRole('button', { name: /모르겠어요 \/ 스킵/ }).click();

  // preview 단계는 자동 제출로 인해 매우 짧게 존재하다 /r/[shortId] 로 이동한다.
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

test('3단계 + provider 선택 path (Proximus) + tariff 모르겠어요 → /r/[shortId]', async ({
  page,
}) => {
  // ADR-0043: postal 단계 없음 — household 직진.
  await page.goto('/compare');
  await page.getByRole('link', { name: '모바일 비교 시작' }).click();
  await expect(page).toHaveURL(/\/compare\/mobile\/household/);
  await page.locator('label[for="household-single"]').click();
  await page.getByRole('button', { name: /다음 — 현재 공급사/ }).click();

  // current-provider — Proximus 선택 → tariff 모르겠어요 → 다음
  await expect(page).toHaveURL(/\/compare\/mobile\/current-provider/);
  await page.getByLabel('현재 공급사 선택').click();
  await page.getByRole('option', { name: 'Proximus' }).click();
  // sub-step tariff Select 노출 — "이 공급사 요금제는 모르겠어요" 클릭
  await page.getByRole('button', { name: /이 공급사 요금제는 모르겠어요/ }).click();

  // ADR-0016 Amendment 3: "다음 — 결과 미리보기"로 직진
  const nextPreview = page.getByRole('button', { name: /다음 — 결과 미리보기/ });
  await expect(nextPreview).toBeEnabled();
  await nextPreview.click();

  // bill 단계 없음 → preview → /r/[shortId]
  await page.waitForURL(/\/r\/[A-Za-z0-9_-]{12}$/, { timeout: 10_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: '비교 결과' }),
  ).toBeVisible();
});
