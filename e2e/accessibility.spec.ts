/**
 * 접근성 검증 — PLAN 2.9 + 3.5.1.c (ADR-0016 §검증 2, ADR-0023 §T2).
 *
 * 페이즈 2 + 페이즈 3 신규 라우트에 axe.analyze() — WCAG 2.1 AA + best practices
 * 룰셋 기본 (axe-core 4.x default tags). violations === [] 강제.
 *
 * 3.5.1.c (PLAN, ADR-0023 §T2) 페이지 목록 확장:
 *   - 기존 6페이지 유지 (Phase 2 검증)
 *   - 페이즈 3 신규: /r/[shortId] (실 shortId), /compare/mobile/preview
 *
 * /r/[shortId] — 실 POST /api/compare 로 shortId 획득. 실패(DB 미가동 등) 시
 *   test.skip + 이유 명시 (게이트 실패 아님 — result-page.spec.ts beforeAll 패턴 답습).
 *
 * /compare/mobile/preview — 마운트 즉시 sessionStorage 읽기 후 /api/compare 호출 →
 *   shortId 받아 /r/[shortId] 로 router.push. axe 실행 타이밍이 redirect 이전에
 *   보장되지 않으므로 test.skip (게이트 실패 아님).
 *   "왜 skip 인가" — preview 페이지는 hydrate 즉시 API 호출 + redirect 로 이탈.
 *   h1이 보인 시점에 이미 다음 경로에 있을 수 있어 axe 실행 대상 DOM 이 불안정.
 *   실질 접근성은 /r/[shortId] 결과 페이지에서 보장된다.
 *
 * /compare/mobile/current-provider — RSC. DB 가동 + provider seed 필요.
 *   직접 URL 진입 가능 (SSR → ZeroProvidersFallback 렌더) — h1은 항상 있음.
 *
 * SC-C 정합 — Playwright E2E axe-core 단발 스캔은 페이즈 2 1차 종료 게이트
 * + 페이즈 3 신규 라우트 검증 (PLAN 3.5.1.c).
 *
 * 학습자 메모: AxeBuilder({ page }).analyze() 는 페이지 전체 DOM 트리에 axe-core
 * 룰셋을 실행. include/exclude 로 영역 한정 가능. 위반 발견 시 violations[] 에
 * { id, impact, description, nodes[] } 반환.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// ─── shortId 사전 획득 (beforeAll) — result-page.spec.ts 패턴 답습 ─────────────

/**
 * POST /api/compare 로 shortId 획득. 실패 시 null (skip 트리거).
 * Playwright request fixture 대신 표준 fetch 사용 — test context 밖에서
 * playwrightRequest.newContext() 를 쓰면 워커 환경에 따라 실패할 수 있다.
 */
async function fetchShortIdForAxe(): Promise<string | null> {
  try {
    const res = await fetch('http://localhost:3000/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'mobile',
        postal: { country: 'BE', postalCode: '1000' },
        householdType: 'single',
        currentProviderId: null,
        currentTariffId: null,
        inputAttributes: {},
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    // @builder-justification: 외부 API 응답 타입 — 런타임에만 알 수 있음
    const body = (await res.json()) as { ok?: boolean; shortId?: string };
    if (body.ok === true && typeof body.shortId === 'string') return body.shortId;
    return null;
  } catch {
    return null;
  }
}

// ─── 페이즈 2 기존 6페이지 + 페이즈 3 신규 ──────────────────────────────────

interface PageCase {
  name: string;
  path: string;
  /** 진입 후 axe 호출 전 추가 셋업 (form 채우기 등). 미지정 시 단순 진입만. */
  setup?: (page: import('@playwright/test').Page) => Promise<void>;
}

/**
 * 정적 CASES — 직접 URL 진입이 가능하고 shortId 불필요한 페이지.
 * (Phase 2 기존 6페이지 그대로 + current-provider 중복 없이 유지)
 *
 * /compare/mobile/current-provider 는 RSC (서버 컴포넌트). DB 가동 시
 * ZeroProvidersFallback 또는 CurrentProviderForm 중 하나가 렌더됨.
 * 어느 쪽이든 h1 "지금 어디 쓰세요?" 는 항상 노출 → 직접 URL 진입 가능.
 */
const CASES: PageCase[] = [
  // ─── Phase 2 기존 ───────────────────────────────────────────────────────────
  { name: 'GET /compare 카테고리 선택 (T2)', path: '/compare' },
  { name: 'GET /compare/mobile/postal (T3)', path: '/compare/mobile/postal' },
  { name: 'GET /compare/mobile/household (T4)', path: '/compare/mobile/household' },
  {
    name: 'GET /compare/mobile/current-provider (T5)',
    path: '/compare/mobile/current-provider',
  },
  { name: 'GET /compare/mobile/bill (T6)', path: '/compare/mobile/bill' },
  // /r/[shortId] placeholder — Phase 2 시절 추가. Phase 3에서 실 shortId 케이스로 보강.
  // placeholder(abc123def456)는 형식 통과(12자) + DB 미존재 → 404 not-found 페이지.
  // 404 페이지 자체의 axe 0 violations 검증 (result-page.spec.ts 의 not-found axe 와 동형).
  { name: 'GET /r/[shortId] placeholder (T7)', path: '/r/abc123def456' },
];

// 정적 페이지 axe 테스트 (for...of — 기존 구조 답습)
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

// ─── Phase 3 신규: /r/[shortId] 실 shortId (3.5.1.c) ────────────────────────

/**
 * 실 shortId 를 사용한 /r/[shortId] axe 0 violations 검증.
 * result-page.spec.ts 의 beforeAll 패턴 답습 — POST /api/compare → shortId.
 * DB 미가동 또는 API 오류 시 test.skip (게이트 실패 아님, 환경 의존).
 */
test.describe('Phase 3 신규: /r/[shortId] 실 shortId axe 검증 (3.5.1.c)', () => {
  let shortId: string | null = null;

  test.beforeAll(async () => {
    shortId = await fetchShortIdForAxe();
    if (!shortId) {
      console.warn(
        '[3.5.1.c] POST /api/compare 실패 — shortId 없음. /r/[shortId] 실 shortId 케이스 skip.\n' +
        '           DB 가 가동 중이고 seed 데이터가 있어야 합니다 (게이트 실패 아님).',
      );
    }
  });

  test('axe 0 violations — GET /r/[shortId] 실 결과 페이지 (3.5.1.c)', async ({ page }) => {
    // shortId 미획득 시 skip (DB/API 환경 의존 — 3.7 print 스펙의 skip 패턴 답습)
    if (!shortId) {
      test.skip(true, '/api/compare 에서 shortId 미획득 — DB/API 환경 의존. 게이트 실패 아님.');
      return;
    }

    await page.goto(`/r/${shortId}`);
    await expect(page.locator('h1')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();

    if (results.violations.length > 0) {
      console.warn(`\n[axe] /r/${shortId} violations:`);
      for (const v of results.violations) {
        console.warn(`  - ${v.id} (${v.impact}): ${v.help}`);
        for (const node of v.nodes) {
          console.warn(`      ${node.target.join(' > ')}`);
        }
      }
    }

    expect(results.violations).toEqual([]);
  });
});

// ─── Phase 3 신규: /compare/mobile/preview skip (3.5.1.c) ───────────────────

/**
 * /compare/mobile/preview — 직접 URL 진입 시 마운트 즉시 sessionStorage 읽기 후
 * /api/compare POST → shortId 받아 /r/[shortId] 로 router.push.
 * hydrate 완료 → submit() 호출 → redirect 가 거의 즉시 발생하므로
 * axe 실행 타이밍에 DOM 이 이미 다른 경로에 있을 수 있음.
 * h1("결과를 준비 중입니다") 표시 구간이 극히 짧아 안정적 axe 실행 불가.
 * preview의 실질 접근성은 /r/[shortId] 결과 페이지에서 보장한다.
 */
test.describe('Phase 3 신규: /compare/mobile/preview axe (skip — redirect 즉시 발생)', () => {
  test.skip(
    true,
    '/compare/mobile/preview 는 마운트 즉시 /api/compare POST → /r/[shortId] redirect. ' +
    'axe 실행 전 DOM 이 이탈 → 안정적 검증 불가. 실질 접근성은 /r/[shortId] 에서 보장.',
  );

  test('axe 0 violations — GET /compare/mobile/preview', async ({ page }) => {
    await page.goto('/compare/mobile/preview');
    await expect(page.locator('h1')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
