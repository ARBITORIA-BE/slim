#!/usr/bin/env tsx
/**
 * Harness: perf-budget (PLAN 3.5.1.a — ADR-0023 T1/T2/T3)
 *
 * 헌법 P2 (LCP ≤ 2.5s, FID ≤ 100ms) 의 *자동 측정* — 처음으로 숫자를 잡는다.
 *
 * 실행 전제: `next build && next start` 가 이미 가동 중이어야 의미 있는 숫자.
 *   next dev --turbo 대상은 비프로덕션 번들(HMR, 미압축) → 숫자 무의미 (ADR-0023 §Context 6).
 *
 * 실행법:
 *   pnpm harness:perf
 *   E2E_BASE_URL=https://slim.lu pnpm harness:perf
 *
 * exit code:
 *   0 — 정상 측정 완료 (임계값 위반이 있어도 3.5.1.a 는 exit 0 — 게이트는 3.5.1.b)
 *   1 — Lighthouse 던짐 또는 페이지 로드 실패 (측정 자체가 불가능)
 *   2 — 서버 미가동 (BASE_URL 에 도달 불가)
 */

import * as net from 'node:net';
import type { RunnerResult } from 'lighthouse';

// @playwright/test re-exports chromium — 별도 playwright 패키지 X (devDependency)
import { chromium } from '@playwright/test';

// ─── 환경 ─────────────────────────────────────────────────────────────────────

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface PageMetrics {
  route: string;
  lcpMs: number | null;     // Largest Contentful Paint (핵심 — 헌법 P2)
  tbtMs: number | null;     // Total Blocking Time (INP/FID lab proxy — ADR-0023 T4)
  fcpMs: number | null;     // First Contentful Paint (참고)
  perfScore: number | null; // Lighthouse Performance 0~100
  a11yScore: number | null; // Accessibility — soft 게이트 (T4)
  bpScore: number | null;   // Best Practices — 참고 (3.5.2 범위)
  seoScore: number | null;  // SEO — 참고 (3.5.2 범위)
}

// ─── 유틸 — 빈 포트 찾기 ──────────────────────────────────────────────────────

/**
 * OS 가 할당한 ephemeral 포트를 반환한다.
 * 9222 고정 대신 이렇게 하는 이유: 로컬에서 다른 DevTools 세션이 9222 를 점유 중이면
 * Chromium 이 조용히 실패하거나 기존 세션과 CDP 충돌이 발생한다 (CDPㅡflaky 원인 1순위).
 */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close(() => reject(new Error('포트 할당 실패')));
        return;
      }
      const port = addr.port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

// ─── 유틸 — 서버 접근성 확인 ──────────────────────────────────────────────────

async function checkReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

// ─── 유틸 — shortId 획득 (4번 페이지 /r/[shortId]) ──────────────────────────

/**
 * POST /api/compare 를 1회 호출해 shortId 를 획득한다.
 * 실패(서버 오류, API 구현 미완 등) 시 null 반환 → 4번 페이지 skip+warn (게이트 실패 X).
 * e2e/result-page.spec.ts 의 beforeAll 과 동형 바디 구조.
 */
async function fetchShortId(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/compare`, {
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
    // @builder-justification: API 응답 body 는 런타임에만 알 수 있는 외부 JSON — any 불가피
    const body = (await res.json()) as { ok?: boolean; shortId?: string };
    if (body.ok === true && typeof body.shortId === 'string') {
      return body.shortId;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── 측정 페이지 셋 빌드 (ADR-0023 T3) ──────────────────────────────────────

async function buildPageSet(): Promise<Array<{ label: string; url: string; skip?: true }>> {
  const pages: Array<{ label: string; url: string; skip?: true }> = [
    { label: '① 랜딩 (/)',                  url: `${BASE_URL}/` },
    { label: '② 비교 선택 (/compare)',        url: `${BASE_URL}/compare` },
    { label: '③ 우편번호 입력 폼',            url: `${BASE_URL}/compare/mobile/postal` },
  ];

  const shortId = await fetchShortId();
  if (shortId) {
    pages.push({ label: `④ 결과 페이지 (/r/${shortId})`, url: `${BASE_URL}/r/${shortId}` });
  } else {
    console.warn(
      '⚠️  /api/compare 에서 shortId 획득 실패 — 4번 페이지(/r/[shortId]) skip.\n' +
      '   DB 가 가동 중이고 seed 데이터가 있어야 비교 결과가 만들어집니다.\n' +
      '   (게이트 실패 아님 — 환경 의존, ADR-0023 T3)',
    );
    // skip 마커로 표 행을 채운다 — 표 레이아웃 통일용
    pages.push({ label: '④ 결과 페이지 (/r/[shortId])', url: '', skip: true });
  }

  return pages;
}

// ─── Lighthouse 1페이지 측정 ─────────────────────────────────────────────────

async function measurePage(
  url: string,
  port: number,
): Promise<PageMetrics> {
  const route = url.replace(BASE_URL, '') || '/';

  // lighthouse 는 ESM-only 패키지.
  // tsx 가 이 파일을 CJS 로 변환하므로 top-level import 는 사용 불가.
  // 동적 import() 는 CJS 환경에서도 ESM 모듈을 불러올 수 있다 — Node ≥ 12 지원.
  const { default: lighthouse } = await import('lighthouse') as { default: typeof import('lighthouse').default };

  let result: RunnerResult | null = null;
  try {
    // mobile 프리셋이 기본값 (formFactor: 'mobile', Moto G Power 에뮬레이션, 4G throttling).
    // 별도 config 없이 lighthouse 기본값 그대로 사용 (ADR-0023 T1 명세).
    // onlyCategories 로 불필요한 카테고리(pwa 등) 측정 제외 → 속도 개선.
    result = await lighthouse(
      url,
      {
        port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
      undefined,
    ) ?? null;
  } catch (err) {
    // lighthouse 가 throw 한 경우 — 측정 실패
    throw new Error(
      `Lighthouse 측정 실패 (${route}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const lhr = result?.lhr;
  if (!lhr) {
    throw new Error(`Lighthouse 결과 없음 (${route})`);
  }

  // audits 에서 numericValue 추출 — 단위: ms
  const lcpMs  = lhr.audits['largest-contentful-paint']?.numericValue ?? null;
  const tbtMs  = lhr.audits['total-blocking-time']?.numericValue ?? null;
  const fcpMs  = lhr.audits['first-contentful-paint']?.numericValue ?? null;

  // categories 점수: 0~1 float → ×100 하면 Lighthouse 표시 점수 (0~100 정수 표기)
  const toScore = (v: number | null | undefined): number | null =>
    typeof v === 'number' ? Math.round(v * 100) : null;

  return {
    route,
    lcpMs:     lcpMs  !== null ? Math.round(lcpMs)  : null,
    tbtMs:     tbtMs  !== null ? Math.round(tbtMs)  : null,
    fcpMs:     fcpMs  !== null ? Math.round(fcpMs)  : null,
    perfScore: toScore(lhr.categories['performance']?.score),
    a11yScore: toScore(lhr.categories['accessibility']?.score),
    bpScore:   toScore(lhr.categories['best-practices']?.score),
    seoScore:  toScore(lhr.categories['seo']?.score),
  };
}

// ─── 출력 — 표 포맷 ──────────────────────────────────────────────────────────

// 임계값 (ADR-0023 T4) — 표시 전용 (판정/exit 1 은 3.5.1.b 몫)
const HARD_LCP_MS  = 2500;   // 헌법 P2 — hard (3.5.1.b 에서 exit 1)
const HARD_TBT_MS  = 200;    // 헌법 P2 FID lab proxy — hard
const SOFT_PERF    = 90;     // PLAN 페이즈 3 검증 — soft
const SOFT_A11Y    = 95;     // 페이즈 2 목표 — soft

function fmtMs(v: number | null): string {
  if (v === null) return '   —  ';
  return `${v.toString().padStart(5)}ms`;
}

function fmtScore(v: number | null): string {
  if (v === null) return ' — ';
  return v.toString().padStart(3);
}

function fmtLcp(v: number | null): string {
  const s = fmtMs(v);
  if (v === null) return s;
  return v <= HARD_LCP_MS ? `${s} ✅` : `${s} ⚠️ (≤2.5s 목표)`;
}

function fmtTbt(v: number | null): string {
  const s = fmtMs(v);
  if (v === null) return s;
  return v <= HARD_TBT_MS ? `${s} ✅` : `${s} ⚠️ (≤200ms 목표)`;
}

function fmtPerf(v: number | null): string {
  const s = fmtScore(v);
  if (v === null) return s;
  return v >= SOFT_PERF ? `${s} ✅` : `${s} ⚠️ (≥90 목표)`;
}

function fmtA11y(v: number | null): string {
  const s = fmtScore(v);
  if (v === null) return s;
  return v >= SOFT_A11Y ? `${s} ✅` : `${s} ⚠️ (≥95 목표)`;
}

function printTable(rows: Array<{ label: string; metrics: PageMetrics | null; skipped?: true }>): void {
  console.log('\n📊 Perf Budget 측정 결과 (Lighthouse mobile 프리셋, ADR-0023 T3/T4):\n');
  console.log(
    '  페이지'.padEnd(38) +
    'LCP'.padEnd(20) +
    'TBT'.padEnd(20) +
    'FCP'.padEnd(12) +
    'Perf'.padEnd(14) +
    'A11y'.padEnd(14) +
    'BP'.padEnd(8) +
    'SEO',
  );
  console.log('  ' + '─'.repeat(130));

  for (const row of rows) {
    if (row.skipped) {
      console.log(`  ${row.label.padEnd(36)} skip (shortId 미획득 — 4번 페이지 환경 의존)`);
      continue;
    }
    const m = row.metrics;
    if (!m) {
      console.log(`  ${row.label.padEnd(36)} ❌ 측정 실패`);
      continue;
    }
    console.log(
      `  ${row.label.padEnd(36)}` +
      `${fmtLcp(m.lcpMs).padEnd(20)}` +
      `${fmtTbt(m.tbtMs).padEnd(20)}` +
      `${fmtMs(m.fcpMs).padEnd(12)}` +
      `${fmtPerf(m.perfScore).padEnd(14)}` +
      `${fmtA11y(m.a11yScore).padEnd(14)}` +
      `${fmtScore(m.bpScore).padEnd(8)}` +
      `${fmtScore(m.seoScore)}`,
    );
  }

  console.log('\n  임계값 안내 (ADR-0023 T4):');
  console.log('  ✅ = 통과 | ⚠️ = 목표 미달 (게이트 판정은 3.5.1.b)');
  console.log('  LCP ≤ 2.5s / TBT ≤ 200ms (헌법 P2 hard) | Perf ≥ 90 / A11y ≥ 95 (soft)');
  // 3.5.1.b advisory — first-load JS 파싱은 next build 출력 필요, 다음 sub-task 에서 추가
  console.log('  first-load JS ≤ ~130KB gz/페이지: 3.5.1.b advisory (next build 출력 파싱)');
  console.log('');
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // 1. 서버 가동 여부 확인
  const reachable = await checkReachable(BASE_URL);
  if (!reachable) {
    console.error(
      `❌ ${BASE_URL} 에 도달할 수 없습니다.\n` +
      '   next build && next start 를 먼저 실행하세요 (또는 E2E_BASE_URL 설정).\n' +
      '   next dev 는 비프로덕션 번들이라 Lighthouse 숫자가 무의미합니다 (ADR-0023 §Context 6).',
    );
    process.exit(2);
  }

  console.log(`\n🔍 Perf Budget 하네스 시작 — 대상: ${BASE_URL}`);
  console.log('   (next build && next start 가 이미 실행 중인지 확인하세요)\n');

  // 2. 측정 페이지 셋 준비 (shortId 획득 시도 포함)
  const pageSet = await buildPageSet();

  // 3. CDP 포트 확보 — OS 빈 포트 동적 할당 (고정 9222 충돌 회피)
  const cdpPort = await findFreePort();

  // 4. Playwright Chromium 헤드리스 실행 + CDP 포트 바인딩
  //    lighthouse 는 이 포트에 CDP 로 붙어 측정한다 (ADR-0023 T1 — 새 브라우저 바이너리 0건).
  const browser = await chromium.launch({
    headless: true,
    args: [`--remote-debugging-port=${cdpPort}`],
  });

  const tableRows: Array<{ label: string; metrics: PageMetrics | null; skipped?: true }> = [];
  let measureFailed = false;

  try {
    for (const page of pageSet) {
      if (page.skip) {
        tableRows.push({ label: page.label, metrics: null, skipped: true });
        continue;
      }

      console.log(`  측정 중: ${page.label} …`);
      try {
        const metrics = await measurePage(page.url, cdpPort);
        tableRows.push({ label: page.label, metrics });
      } catch (err) {
        // 개별 페이지 측정 실패 — 표에 실패 행으로 기록, 전체 exit 1 마킹
        console.error(`  ❌ ${page.label} 측정 실패: ${err instanceof Error ? err.message : String(err)}`);
        tableRows.push({ label: page.label, metrics: null });
        measureFailed = true;
      }
    }
  } finally {
    // Chromium 반드시 종료 — 포트 점유 해제
    await browser.close();
  }

  // 5. 결과 표 출력
  printTable(tableRows);

  // 6. exit code — 3.5.1.a 는 측정 실패만 exit 1 (임계값 판정은 3.5.1.b)
  if (measureFailed) {
    console.error('❌ 일부 페이지 측정 실패 — 로그를 확인하세요.');
    process.exit(1);
  }

  console.log('✅ perf-budget 측정 완료 (임계값 게이트는 3.5.1.b 에서 추가 예정)');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('perf-budget 하네스 오류:', err instanceof Error ? err.message : err);
  process.exit(1);
});
