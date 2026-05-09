#!/usr/bin/env tsx
/**
 * Harness: e2e-smoke
 *
 * P2 (쉽고 빠르게) 강제 — 메인 비교 플로우가 5분 안에 완주 가능한지 측정.
 * Playwright로 헤드리스 시뮬레이션, 입력→결과까지 walltime 측정.
 *
 * 실행: pnpm harness:e2e
 * CI: PR 머지 전 필수
 */

// @playwright/test re-exports browser bindings — 별도 'playwright' 패키지 X
// (devDependency: @playwright/test ^1.48 — package.json)
import { chromium } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const MAX_DURATION_MS = 5 * 60 * 1000; // 5분

interface Result {
  step: string;
  durationMs: number;
  success: boolean;
  note?: string;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();
  const results: Result[] = [];
  const start = Date.now();

  async function step(name: string, fn: () => Promise<void>) {
    const t0 = Date.now();
    try {
      await fn();
      results.push({ step: name, durationMs: Date.now() - t0, success: true });
    } catch (err) {
      results.push({
        step: name,
        durationMs: Date.now() - t0,
        success: false,
        note: (err as Error).message,
      });
      throw err;
    }
  }

  try {
    await step('랜딩 페이지 로드', async () => {
      await page.goto(BASE_URL);
      await page.waitForSelector('text=비교는 쉽게', { timeout: 5000 });
    });

    await step('카테고리 선택 — 에너지', async () => {
      await page.getByRole('link', { name: /에너지/ }).click();
      await page.waitForURL('**/compare/energy');
    });

    await step('단계 1 — 우편번호 입력', async () => {
      await page.getByLabel('우편번호').fill('2000');
      await page.getByRole('button', { name: '다음' }).click();
    });

    await step('단계 2 — 가구 형태', async () => {
      await page.getByRole('radio', { name: /커플/ }).click();
      await page.getByRole('button', { name: '다음' }).click();
    });

    await step('단계 3 — 현재 공급사 (스킵)', async () => {
      await page.getByRole('button', { name: /모르겠어요|스킵/ }).click();
    });

    await step('단계 4 — 청구서 (스킵)', async () => {
      await page.getByRole('button', { name: /건너뛰기/ }).click();
    });

    await step('단계 5 — 결과 표시', async () => {
      await page.waitForSelector('[data-testid="comparison-result"]', { timeout: 10000 });
    });

    await step('투명성 — 출처 노출 확인', async () => {
      // 첫 결과 카드에 source link가 있어야 함
      const sourceLink = await page.locator('[data-testid="comparison-result"]').first()
        .getByRole('link', { name: /원본|공식|마지막 확인/ });
      if (!(await sourceLink.count())) {
        throw new Error('첫 결과에 출처 링크 없음 — P1 위반');
      }
    });

    await step('투명성 — 신선도 라벨', async () => {
      const stale = await page.locator('text=/\\d+시간 전|방금 전/').first();
      if (!(await stale.count())) {
        throw new Error('신선도 라벨 없음 — StaleLabel 컴포넌트 누락');
      }
    });
  } catch {
    // step 안에서 이미 results에 기록됨
  }

  await browser.close();

  const totalMs = Date.now() - start;
  const allOk = results.every((r) => r.success);
  const withinTime = totalMs <= MAX_DURATION_MS;

  console.log('\n📊 E2E 스모크 결과:\n');
  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} ${r.step.padEnd(40)} ${r.durationMs}ms ${r.note ?? ''}`);
  }
  console.log(`\n총 소요: ${(totalMs / 1000).toFixed(1)}s (5분 예산 ${withinTime ? '안에 들어옴 ✅' : '초과 ❌'})\n`);

  if (!allOk || !withinTime) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('E2E 하네스 실패:', err);
  process.exit(2);
});
