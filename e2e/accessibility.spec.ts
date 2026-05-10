/**
 * Phase 2 접근성 검증 (PLAN 2.9, ADR-0016 §검증 2 axe-core 0 violations).
 *
 * 6 페이지를 차례로 진입해 axe.analyze() — WCAG 2.1 AA + best practices 룰셋
 * 기본 (axe-core 4.x default tags). violations === [] 강제.
 *
 * SC-C 정합 — Playwright E2E 자체는 페이즈 4 deploy 직전 일괄 도입 결정이지만,
 * axe-core 단발 스캔은 페이즈 2 1차 종료 게이트 (페이즈 2 9/9 마킹 형식 근거).
 *
 * 학습자 메모: AxeBuilder({ page }).analyze() 는 페이지 전체 DOM 트리에 axe-core
 * 룰셋을 실행. include/exclude 로 영역 한정 가능. 위반 발견 시 violations[] 에
 * { id, impact, description, nodes[] } 반환.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

interface PageCase {
  name: string;
  path: string;
  /** 진입 후 axe 호출 전 추가 셋업 (form 채우기 등). 미지정 시 단순 진입만. */
  setup?: (page: import('@playwright/test').Page) => Promise<void>;
}

const CASES: PageCase[] = [
  { name: 'GET /compare 카테고리 선택 (T2)', path: '/compare' },
  { name: 'GET /compare/mobile/postal (T3)', path: '/compare/mobile/postal' },
  { name: 'GET /compare/mobile/household (T4)', path: '/compare/mobile/household' },
  {
    name: 'GET /compare/mobile/current-provider (T5)',
    path: '/compare/mobile/current-provider',
  },
  { name: 'GET /compare/mobile/bill (T6)', path: '/compare/mobile/bill' },
  // /r/[shortId] placeholder — nanoid 12자 형식 임의 (페이지는 raw param 표시)
  { name: 'GET /r/[shortId] placeholder (T7)', path: '/r/abc123def456' },
];

for (const tc of CASES) {
  test(`axe 0 violations — ${tc.name}`, async ({ page }) => {
    await page.goto(tc.path);
    if (tc.setup) await tc.setup(page);

    // h1 노출까지 기다려 페이지가 hydrate 됐음을 확인
    await expect(page.locator('h1')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();

    if (results.violations.length > 0) {
      // 위반 발견 시 디버깅용 출력 (no-console 회피로 console.warn)
      console.warn(`\n[axe] ${tc.name} violations:`);
      for (const v of results.violations) {
        console.warn(`  - ${v.id} (${v.impact}): ${v.help}`);
        for (const node of v.nodes) {
          console.warn(`      ${node.target.join(' > ')}`);
        }
      }
    }

    expect(results.violations).toEqual([]);
  });
}
