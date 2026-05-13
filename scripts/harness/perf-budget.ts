#!/usr/bin/env tsx
/**
 * Harness: perf-budget (PLAN 3.5.1.a+b — ADR-0023 T1/T2/T3/T4
 *                       + Amendment 1 (first-load JS budget per-route 2-tier, 2026-05-12))
 *
 * 헌법 P2 (LCP ≤ 2.5s, FID ≤ 100ms) 의 *자동 측정 + 게이트* — 처음으로 숫자를 잡는다.
 *
 * 실행 전제: `next build && next start` 가 이미 가동 중이어야 의미 있는 숫자.
 *   next dev --turbo 대상은 비프로덕션 번들(HMR, 미압축) → 숫자 무의미 (ADR-0023 §Context 6).
 *
 * 실행법:
 *   pnpm harness:perf
 *   E2E_BASE_URL=https://slim.lu pnpm harness:perf
 *
 * exit code:
 *   0 — 정상 측정 완료, hard 위반 없음 (soft 경고는 exit 0 — ADR-0002 flaky→noise 교훈)
 *   1 — Lighthouse 던짐/페이지 로드 실패(측정 불가) 또는 hard 게이트(LCP/TBT/first-load JS) 위반
 *   2 — 서버 미가동 (BASE_URL 에 도달 불가)
 *
 * exit 1 의 두 원인을 구분:
 *   "측정 실패" → "❌ MEASURE-FAIL" 접두 메시지
 *   "hard 위반" → "❌ HARD" 접두 메시지
 */

import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import type { RunnerResult } from 'lighthouse';

// @playwright/test re-exports chromium — 별도 playwright 패키지 X (devDependency)
import { chromium } from '@playwright/test';
// @axe-core/playwright 는 이미 devDependency — 새 패키지 추가 없음 (ADR-0023 §T2).
// perf 하네스의 axe 가 비-게이트인 이유: 진짜 게이트는 e2e/accessibility.spec.ts.
// 여기선 perf 측정하는 김에 같이 본다 — advisory only, computeExitCode 에 영향 X.
import AxeBuilder from '@axe-core/playwright';

// ─── 환경 ─────────────────────────────────────────────────────────────────────

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';

// .next/ 디렉토리 위치: 스크립트 위치 기준으로 프로젝트 루트 탐색
// __dirname 대신 import.meta.url 는 tsx CJS 모드에서 미지원 → process.cwd() 사용
const NEXT_DIR = path.resolve(process.cwd(), '.next');

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface PageMetrics {
  route: string;
  lcpMs: number | null;         // Largest Contentful Paint (핵심 — 헌법 P2)
  tbtMs: number | null;         // Total Blocking Time (INP/FID lab proxy — ADR-0023 T4)
  fcpMs: number | null;         // First Contentful Paint (참고)
  perfScore: number | null;     // Lighthouse Performance 0~100
  a11yScore: number | null;     // Accessibility — soft 게이트 (T4)
  bpScore: number | null;       // Best Practices — 참고 (3.5.2 범위)
  seoScore: number | null;      // SEO — 참고 (3.5.2 범위)
  firstLoadKb: number | null;   // First Load JS KB (raw, advisory — 3.5.1.b)
  // 3.5.1.c: axe advisory (ADR-0023 §T2) — 비-게이트, 표 컬럼 추가만
  axeViolations: number | null; // null = 실행 실패/스킵
}

// ─── 3.5.1.b + Amendment 1: 임계값 판정 순수 함수 ───────────────────────────
// 이 함수들은 side-effect 없는 순수 함수 → 단위 테스트 가능 (perf-budget.test.ts)
// export 해야 test 파일에서 import 가능

/** 메트릭별 판정 결과 */
export type Verdict = 'pass' | 'soft-fail' | 'hard-fail' | 'info' | 'exempt';

export interface MetricEvaluation {
  verdict: Verdict;
  message: string;
}

// ADR-0023 T4 임계값 상수 — export 해서 test 파일이 직접 import (복사 X)
export const HARD_LCP_MS = 2500;  // 헌법 P2 "LCP ≤ 2.5s" — ≤ 이므로 경계 포함
export const HARD_TBT_MS = 200;   // 헌법 P2 FID lab proxy — ≤ 경계 포함
export const SOFT_PERF   = 90;    // PLAN 페이즈 3 검증 — ≥ 경계 포함
export const SOFT_A11Y   = 95;    // 페이즈 2 목표 — ≥ 경계 포함
// ADVISORY_JS_KB: Amendment 1 이전에 사용하던 단일 advisory 상수 — 하위 호환 유지
export const ADVISORY_JS_KB = 130;

// ─── Amendment 1: per-route 2-tier first-load JS 예산 ────────────────────────
//
// 라운딩 규칙: 배수 곱한 뒤 10KB 단위 올림(ceil). 반올림 금지.
// 이유: 측정 노이즈 ±10KB 를 흡수하기 위해 넉넉한 방향(올림)으로 라운딩한다.
// "ceil 이고 round 가 아닌 이유" — 실측치 102.1KB 에 1.10 곱하면 112.3KB 인데
// round 하면 110KB (너무 빡빡), ceil 하면 120KB (노이즈 흡수 여유 있음).
//
// light tier 계산 근거 (실측 2026-05-12):
//   측정값: 99.9KB (/), 103.2KB (/compare), 103.2KB (/r/[shortId])
//   평균 = (99.9 + 103.2 + 103.2) / 3 ≈ 102.1KB
//   advisory = ceilToTen(102.1 × 1.10) = ceilToTen(112.3) = 120KB
//   hard     = ceilToTen(102.1 × 1.30) = ceilToTen(132.7) = 140KB
//
// form tier 계산 근거 (실측 2026-05-12):
//   최대값: 161.5KB (/compare/mobile/postal)
//   advisory = ceilToTen(161.5 × 1.05) = ceilToTen(169.6) = 170KB
//   hard     = ceilToTen(161.5 × 1.20) = ceilToTen(193.8) = 200KB
//
// "tier 가 기능 의미론(landing/form)이 아니라 무게 기준인 이유":
//   form 라우트는 postal-code 입력 UI + validation 라이브러리를 추가로 포함하므로
//   구조적으로 번들이 더 크다. 단일 임계값은 form 라우트가 항상 경고를 발생시키거나,
//   light 라우트의 과대 번들을 감지 못하는 두 문제를 동시에 낳는다.

/** 10KB 단위 올림 (ceil). 라운딩 규칙: 노이즈 ±10KB 흡수 목적 — 반올림 금지. */
export function ceilToTen(n: number): number {
  if (n === 0) return 0;
  return Math.ceil(n / 10) * 10;
}

/** first-load JS 예산 tier 타입 */
export type JsTier = 'light' | 'form';

/** tier별 예산 */
export interface JsBudget {
  advisory: number; // KB — 이 값 초과 시 soft 경고
  hard: number;     // KB — 이 값 초과 시 hard-fail (exit 1)
}

// 회귀 잠금 상수 — 테스트에서 직접 import 해 Amendment 표와 일치 확인
export const JS_BUDGET: Record<JsTier, JsBudget> = {
  // light: adv=120, hard=140 (계산 근거: light 평균 102.1KB × 배수 → ceilToTen)
  light: { advisory: 120, hard: 140 },
  // form: adv=170, hard=200 (계산 근거: form 최대 161.5KB × 배수 → ceilToTen)
  form:  { advisory: 170, hard: 200 },
};

// form 라우트 패턴 — 명시적 리스트 + 기본값 light.
// /compare/[category]/* 형태의 5-step 입력 폼 라우트.
// 동적 세그먼트 [category] 를 와일드카드로 처리한다.
const FORM_ROUTE_PATTERNS: readonly RegExp[] = [
  /^\/compare\/[^/]+\/postal$/,
  /^\/compare\/[^/]+\/household$/,
  /^\/compare\/[^/]+\/current-provider$/,
  /^\/compare\/[^/]+\/bill$/,
  /^\/compare\/[^/]+\/preview$/,
];

/**
 * 라우트 키 또는 경로 → JS tier 매핑.
 * "form" 패턴 리스트에 매칭되면 'form', 그 외 전부 'light' (기본값).
 *
 * 왜 기본값이 light 인가: 미래에 추가될 라우트가 form 번들을 포함한다면
 * FORM_ROUTE_PATTERNS 에 추가하면 되고, 누락 시 light 기준이 더 엄격하므로
 * 번들 과대를 조기에 감지할 수 있다 (fail-safe 방향).
 */
export function routeTier(routeKeyOrPath: string): JsTier {
  for (const pattern of FORM_ROUTE_PATTERNS) {
    if (pattern.test(routeKeyOrPath)) return 'form';
  }
  return 'light';
}

// SEO 게이트 제외 라우트 — ADR-0021 §T9 noindex 정책의 의도된 부수효과.
// /r/[shortId] 는 noindex 이므로 Lighthouse SEO 점수가 낮게 나오는 것이 정상.
// 이 라우트의 SEO 판정을 게이트/경고 대상에서 제외하여 오탐을 방지한다.
// 출력 표에서는 점수는 표시하되 "(noindex 의도)" 주석 + 판정 제외.
export const SEO_GATE_EXEMPT_ROUTES: ReadonlySet<string> = new Set([
  '/r/[shortId]', // normalizeRouteToManifestKey 결과 형태 (실 shortId 도 매칭 — isSeoExempt 참조)
]);

/**
 * 라우트가 SEO 게이트 제외 대상인지 확인한다.
 * 실제 shortId (/r/abc123) 도 포함하기 위해 정규화 포함.
 */
export function isSeoExempt(route: string): boolean {
  if (SEO_GATE_EXEMPT_ROUTES.has(route)) return true;
  // 실 shortId 형태 /r/xxx 도 제외 대상
  if (/^\/r\/[^/]+$/.test(route)) return true;
  return false;
}

/**
 * first-load JS tier 기반 판정 함수.
 * - null (dev 빌드 / .next 부재): 'info' (스킵)
 * - value ≤ advisory: 'pass'
 * - advisory < value ≤ hard: 'soft-fail'
 * - value > hard: 'hard-fail'
 */
export function evaluateJsBudget(
  route: string,
  kb: number | null,
): MetricEvaluation {
  if (kb === null) {
    return {
      verdict: 'info',
      message: `${route} — first-load JS 판정 스킵 (build 필요)`,
    };
  }
  const tier = routeTier(route);
  const budget = JS_BUDGET[tier];

  if (kb <= budget.advisory) {
    return {
      verdict: 'pass',
      message: `${route} — first-load JS ${kb}KB ≤ ${budget.advisory}KB advisory (${tier})`,
    };
  }
  if (kb <= budget.hard) {
    return {
      verdict: 'soft-fail',
      message: `${route} — first-load JS ${kb}KB > ${budget.advisory}KB advisory (${tier})`,
    };
  }
  return {
    verdict: 'hard-fail',
    message: `${route} — first-load JS ${kb}KB > ${budget.hard}KB hard (${tier})`,
  };
}

/**
 * 단일 메트릭 판정 함수.
 * soft 가 exit 0 인 이유: ADR-0002 flaky→noise 교훈 — 환경 변동 민감 메트릭을
 * hard 게이트로 두면 CI noise 화 → 보호 대상이 오히려 무방비.
 *
 * 'js' 케이스는 Amendment 1 이후 evaluateJsBudget 으로 위임 (tier 기반 판정).
 * evaluateMetric('route', 'js', value) 는 하위 호환을 위해 유지되나,
 * 내부적으로 evaluateJsBudget 을 호출한다.
 */
export function evaluateMetric(
  route: string,
  metric: 'lcp' | 'tbt' | 'perf' | 'a11y' | 'js',
  value: number | null,
): MetricEvaluation {
  if (value === null) {
    return { verdict: 'info', message: `${route} — ${metric} 측정값 없음` };
  }

  switch (metric) {
    case 'lcp': {
      // LCP 경계가 ≤ 인 이유: 헌법 P2 가 "이하"를 명시 — 2500ms 자체는 통과
      if (value <= HARD_LCP_MS) {
        return { verdict: 'pass', message: `${route} — LCP ${value}ms ≤ ${HARD_LCP_MS}ms` };
      }
      return {
        verdict: 'hard-fail',
        message: `${route} — LCP ${value}ms > ${HARD_LCP_MS}ms`,
      };
    }
    case 'tbt': {
      if (value <= HARD_TBT_MS) {
        return { verdict: 'pass', message: `${route} — TBT ${value}ms ≤ ${HARD_TBT_MS}ms` };
      }
      return {
        verdict: 'hard-fail',
        message: `${route} — TBT ${value}ms > ${HARD_TBT_MS}ms`,
      };
    }
    case 'perf': {
      if (value >= SOFT_PERF) {
        return { verdict: 'pass', message: `${route} — Perf ${value} ≥ ${SOFT_PERF}` };
      }
      return {
        verdict: 'soft-fail',
        message: `${route} — Perf ${value} < ${SOFT_PERF}`,
      };
    }
    case 'a11y': {
      if (value >= SOFT_A11Y) {
        return { verdict: 'pass', message: `${route} — A11y ${value} ≥ ${SOFT_A11Y}` };
      }
      return {
        verdict: 'soft-fail',
        message: `${route} — A11y ${value} < ${SOFT_A11Y}`,
      };
    }
    case 'js': {
      // Amendment 1: tier 기반 판정으로 위임
      // null 은 위에서 이미 처리했으므로 여기선 number 확정
      return evaluateJsBudget(route, value);
    }
  }
}

/**
 * 여러 페이지 결과 배열 → 전체 exit code 계산 함수.
 * - hard-fail 1건이라도 있으면 1 반환 (LCP·TBT·first-load JS 모두 포함)
 * - skip 된 페이지(metrics=null, skipped=true)는 무시
 * - soft-fail 만 있으면 0 (경고만, exit 0)
 * - 측정 실패(metrics=null, skipped=undefined)가 있으면 1
 * - first-load JS null (dev 빌드) 는 판정 스킵 — 게이트 실패 아님
 *
 * exit code 우선순위: 측정 실패=1 / 서버 미가동=2 / hard 위반(LCP·TBT·JS 중 하나)=1 / 정상=0
 */
export function computeExitCode(
  rows: Array<{ metrics: PageMetrics | null; skipped?: true; measureFailed?: true }>,
): number {
  for (const row of rows) {
    if (row.skipped) continue; // seed 부재로 skip — 게이트 실패 아님
    if (row.measureFailed ?? (!row.skipped && row.metrics === null)) {
      return 1; // 측정 자체 실패 → exit 1
    }
  }
  // 측정 성공 행에서 hard-fail 탐색
  for (const row of rows) {
    if (row.skipped || row.metrics === null) continue;
    const m = row.metrics;
    if (m.lcpMs !== null && evaluateMetric(m.route, 'lcp', m.lcpMs).verdict === 'hard-fail') return 1;
    if (m.tbtMs !== null && evaluateMetric(m.route, 'tbt', m.tbtMs).verdict === 'hard-fail') return 1;
    // Amendment 1: first-load JS hard-fail 도 exit 1 대상
    // null (dev 빌드 / .next 부재) 은 스킵 — 게이트 실패 아님
    if (m.firstLoadKb !== null && evaluateJsBudget(m.route, m.firstLoadKb).verdict === 'hard-fail') return 1;
  }
  return 0;
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
    // PLAN 3.5.1.e — 4 form 페이지 측정 셋 편입 (ADR-0023 Amendment 1 §4).
    // sessionStorage redirect 없음 (정찰 확인): household/bill/preview 는 'use client' 빈 폼 렌더,
    // current-provider 는 RSC + getActiveProviders('BE') — DB 부재 시 ZeroProvidersFallback 렌더.
    // 어느 경우든 LCP/TBT/first-load JS 측정 가능 (redirect 발생 조건: 잘못된 category 뿐).
    { label: '③.b household',               url: `${BASE_URL}/compare/mobile/household` },
    { label: '③.c current-provider',        url: `${BASE_URL}/compare/mobile/current-provider` },
    { label: '③.d bill',                    url: `${BASE_URL}/compare/mobile/bill` },
    { label: '③.e preview',                 url: `${BASE_URL}/compare/mobile/preview` },
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
    lcpMs:          lcpMs  !== null ? Math.round(lcpMs)  : null,
    tbtMs:          tbtMs  !== null ? Math.round(tbtMs)  : null,
    fcpMs:          fcpMs  !== null ? Math.round(fcpMs)  : null,
    perfScore:      toScore(lhr.categories['performance']?.score),
    a11yScore:      toScore(lhr.categories['accessibility']?.score),
    bpScore:        toScore(lhr.categories['best-practices']?.score),
    seoScore:       toScore(lhr.categories['seo']?.score),
    // first-load JS 는 Lighthouse 결과가 아닌 .next/ 매니페스트에서 계산 (3.5.1.b advisory)
    firstLoadKb:    computeFirstLoadJs(route),
    // 3.5.1.c: axeViolations 는 main 루프에서 axe 실행 후 주입 — measurePage 에서는 null 초기화
    axeViolations:  null,
  };
}

// ─── First Load JS advisory — .next/app-build-manifest.json 기반 ─────────────

/**
 * app-build-manifest.json 의 페이지 키를 라우트로 매핑한다.
 * Next.js app router 는 "/page" 접미사로 저장 (예: "/page" → "/", "/compare/page" → "/compare").
 *
 * 매핑 대상 라우트 (ADR-0023 T3):
 *   "/"          → app-build-manifest 키: "/page"
 *   "/compare"   → "/compare/page"
 *   "/compare/[category]/postal" → "/compare/[category]/postal/page"
 *   "/r/[shortId]" → "/r/[shortId]/page"
 */
const ROUTE_TO_MANIFEST_KEY: Record<string, string> = {
  '/':                                         '/page',
  '/compare':                                  '/compare/page',
  '/compare/[category]/postal':                '/compare/[category]/postal/page',
  // PLAN 3.5.1.e — 4 form 페이지 first-load JS 매핑 추가 (ADR-0023 Amendment 1 §4)
  '/compare/[category]/household':             '/compare/[category]/household/page',
  '/compare/[category]/current-provider':      '/compare/[category]/current-provider/page',
  '/compare/[category]/bill':                  '/compare/[category]/bill/page',
  '/compare/[category]/preview':               '/compare/[category]/preview/page',
  '/r/[shortId]':                              '/r/[shortId]/page',
};

// app-build-manifest.json 구조 (value = 청크 파일 경로 배열)
interface AppBuildManifest {
  pages: Record<string, string[]>;
}

/**
 * 지정 라우트의 First Load JS raw 크기(KB)를 계산한다.
 * 방식: app-build-manifest.json → 페이지 청크 목록 → 각 파일 stat → 합산.
 * gzip 크기 계산: 각 파일을 gzip 하여 압축 후 크기 합산.
 * .next/ 부재 또는 매니페스트 파싱 실패 시 null 반환 → advisory 컬럼에 "—" 표시.
 *
 * "raw" 가 아닌 gzip 크기를 쓰는 이유: ADR-0023 T4 임계값 "≤ 130KB gz/페이지" 와 단위 일치.
 * gzip 압축은 동기 zlib.gzipSync 사용 (스크립트 환경, 대용량 아님 — 수백 KB 이하).
 */
function computeFirstLoadJs(route: string): number | null {
  const manifestPath = path.join(NEXT_DIR, 'app-build-manifest.json');
  if (!fs.existsSync(manifestPath)) return null;

  let manifest: AppBuildManifest;
  try {
    // @builder-justification: JSON.parse 결과는 unknown — 구조 검증 후 캐스트
    const raw = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(raw) as AppBuildManifest;
  } catch {
    return null;
  }

  // 실제 라우트 경로를 매니페스트 키로 변환
  // 예: "/compare/mobile/postal" 같은 실 URL → "/compare/[category]/postal/page"
  // (shortId 가 실제 값이면 "[shortId]" 패턴으로 치환)
  const normalizedRoute = normalizeRouteToManifestKey(route);
  const manifestKey = ROUTE_TO_MANIFEST_KEY[normalizedRoute];
  if (!manifestKey) return null;

  const chunks = manifest.pages[manifestKey];
  if (!Array.isArray(chunks) || chunks.length === 0) return null;

  // 청크 파일이 turbopack dev 빌드 패턴이면 advisory 불가 — gzip 크기 무의미
  // turbopack 청크는 "[turbopack]_" 또는 "9b18e_next_dist" 등 dev 전용 패턴
  const hasDevChunks = chunks.some(
    (c) => c.includes('[turbopack]') || c.includes('hmr-client'),
  );
  if (hasDevChunks) return null; // dev 빌드 → advisory 불가

  let totalGzipBytes = 0;
  for (const chunk of chunks) {
    // chunk 는 "static/chunks/..." 형태 (앞에 / 없음)
    const filePath = path.join(NEXT_DIR, chunk);
    if (!fs.existsSync(filePath)) continue;
    try {
      const content = fs.readFileSync(filePath);
      const gzipped = zlib.gzipSync(content, { level: zlib.constants.Z_DEFAULT_COMPRESSION });
      totalGzipBytes += gzipped.length;
    } catch {
      // 개별 파일 실패 시 skip (advisory 이므로 부정확해도 판정 없음)
    }
  }

  if (totalGzipBytes === 0) return null;
  // bytes → KB (소수점 1자리)
  return Math.round(totalGzipBytes / 1024 * 10) / 10;
}

/**
 * 실제 측정 URL 경로를 매니페스트 키용 라우트로 정규화한다.
 * 예: "/r/abc12345" → "/r/[shortId]"
 *     "/compare/mobile/postal" → "/compare/[category]/postal"
 *     "/" → "/"  (그대로)
 */
function normalizeRouteToManifestKey(route: string): string {
  // /r/[실제shortId] → /r/[shortId]
  if (/^\/r\/[^/]+$/.test(route)) return '/r/[shortId]';
  // /compare/[category]/postal 같은 동적 카테고리 세그먼트
  if (/^\/compare\/[^/]+\/postal$/.test(route)) return '/compare/[category]/postal';
  if (/^\/compare\/[^/]+\/household$/.test(route)) return '/compare/[category]/household';
  if (/^\/compare\/[^/]+\/bill$/.test(route)) return '/compare/[category]/bill';
  if (/^\/compare\/[^/]+\/preview$/.test(route)) return '/compare/[category]/preview';
  if (/^\/compare\/[^/]+\/current-provider$/.test(route)) return '/compare/[category]/current-provider';
  // /compare → 그대로
  if (route === '/compare') return '/compare';
  // / → 그대로
  if (route === '/') return '/';
  return route;
}

// ─── 출력 — 표 포맷 ──────────────────────────────────────────────────────────

function fmtMs(v: number | null): string {
  if (v === null) return '   —  ';
  return `${v.toString().padStart(5)}ms`;
}

function fmtScore(v: number | null): string {
  if (v === null) return ' — ';
  return v.toString().padStart(3);
}

// 3.5.1.b: 판정 아이콘을 evaluateMetric 결과에서 결정 — 표 표시용
function fmtLcp(v: number | null, route: string): string {
  const s = fmtMs(v);
  if (v === null) return s;
  const ev = evaluateMetric(route, 'lcp', v);
  return ev.verdict === 'hard-fail' ? `${s} ❌ HARD` : `${s} ✅`;
}

function fmtTbt(v: number | null, route: string): string {
  const s = fmtMs(v);
  if (v === null) return s;
  const ev = evaluateMetric(route, 'tbt', v);
  return ev.verdict === 'hard-fail' ? `${s} ❌ HARD` : `${s} ✅`;
}

function fmtPerf(v: number | null, route: string): string {
  const s = fmtScore(v);
  if (v === null) return s;
  const ev = evaluateMetric(route, 'perf', v);
  return ev.verdict === 'soft-fail' ? `${s} ⚠️` : `${s} ✅`;
}

function fmtA11y(v: number | null, route: string): string {
  const s = fmtScore(v);
  if (v === null) return s;
  const ev = evaluateMetric(route, 'a11y', v);
  return ev.verdict === 'soft-fail' ? `${s} ⚠️` : `${s} ✅`;
}

/**
 * axe advisory 컬럼 포맷 — 3.5.1.c (ADR-0023 §T2).
 * violations: 0 → "0 ✅", N > 0 → "N ⚠️", null(실행 실패) → "—".
 *
 * 이 함수는 side-effect 없는 순수 함수 → 단위 테스트 가능.
 * export 해서 perf-budget.test.ts 에서 직접 import.
 *
 * "비-게이트인 이유": 진짜 axe 게이트는 e2e/accessibility.spec.ts.
 * perf 하네스에서는 4페이지 측정하는 김에 같이 보는 advisory 수준.
 * computeExitCode 에 영향 없음.
 */
export function formatAxeCell(violations: number | null): string {
  if (violations === null) return '—';
  if (violations === 0) return '0 ✅';
  return `${violations} ⚠️`;
}

/**
 * first-load JS 컬럼 포맷 (Amendment 1 — 2-tier 판정 아이콘 포함).
 * 형식: "XXX.X KB (light, ≤120/140) ✅" 또는 "— (build 필요)"
 */
function fmtJs(v: number | null, route: string): string {
  if (v === null) return '— (build 필요)';
  const tier = routeTier(route);
  const budget = JS_BUDGET[tier];
  const ev = evaluateJsBudget(route, v);
  const icon =
    ev.verdict === 'hard-fail' ? '❌' :
    ev.verdict === 'soft-fail' ? '⚠️' :
    '✅';
  return `${v.toFixed(1).padStart(6)} KB (${tier}, ≤${budget.advisory}/${budget.hard}) ${icon}`;
}

// TableRow 타입: measureFailed 플래그 + axe advisory details 포함
interface TableRow {
  label: string;
  metrics: PageMetrics | null;
  skipped?: true;
  measureFailed?: true;
  // axe violations rule 목록 — violations > 0 일 때 1줄 출력용 (advisory)
  axeViolationDetails?: Array<{ id: string; impact: string | null; help: string }>;
}

function printTable(rows: TableRow[]): void {
  console.log('\n📊 Perf Budget 측정 결과 (Lighthouse mobile 프리셋, ADR-0023 T3/T4 + Amendment 1 + §T2 axe advisory):\n');
  console.log(
    '  페이지'.padEnd(38) +
    'LCP'.padEnd(22) +
    'TBT'.padEnd(20) +
    'FCP'.padEnd(12) +
    'Perf'.padEnd(10) +
    'A11y'.padEnd(10) +
    'BP'.padEnd(6) +
    'SEO'.padEnd(22) +
    'JS gz (tier, ≤adv/hard)'.padEnd(34) +
    'axe (advisory)',
  );
  console.log('  ' + '─'.repeat(202));

  for (const row of rows) {
    if (row.skipped) {
      console.log(`  ${row.label.padEnd(36)} skip (shortId 미획득 — 4번 페이지 환경 의존)`);
      continue;
    }
    const m = row.metrics;
    if (!m) {
      console.log(`  ${row.label.padEnd(36)} ❌ MEASURE-FAIL — 측정 실패`);
      continue;
    }
    // SEO: /r/[shortId] 는 noindex 의도 → 점수 표시하되 "(noindex 의도)" 주석
    const seoCol = isSeoExempt(m.route)
      ? `${fmtScore(m.seoScore)} (noindex 의도)`
      : fmtScore(m.seoScore);
    // axe advisory 컬럼 (3.5.1.c) — 비-게이트, exit code 영향 X
    const axeCol = formatAxeCell(m.axeViolations);
    console.log(
      `  ${row.label.padEnd(36)}` +
      `${fmtLcp(m.lcpMs, m.route).padEnd(22)}` +
      `${fmtTbt(m.tbtMs, m.route).padEnd(20)}` +
      `${fmtMs(m.fcpMs).padEnd(12)}` +
      `${fmtPerf(m.perfScore, m.route).padEnd(10)}` +
      `${fmtA11y(m.a11yScore, m.route).padEnd(10)}` +
      `${fmtScore(m.bpScore).padEnd(6)}` +
      `${seoCol.padEnd(22)}` +
      `${fmtJs(m.firstLoadKb, m.route).padEnd(34)}` +
      `${axeCol}`,
    );
    // axe advisory: violations > 0 이면 rule ID 1줄 출력 (3.5.1.c 명세)
    if (m.axeViolations !== null && m.axeViolations > 0 && row.axeViolationDetails) {
      for (const v of row.axeViolationDetails) {
        console.warn(`      [axe] ${v.id} (${v.impact ?? 'unknown'}): ${v.help}`);
      }
    }
  }

  // .next/ 없는 경우 안내 (모든 행이 null 인 경우)
  const allJsNull = rows.every((r) => r.skipped || r.metrics === null || r.metrics.firstLoadKb === null);
  if (allJsNull) {
    console.log('  ⚠️  first-load JS 판정 스킵 — `pnpm build` 후 `pnpm harness:perf` 재실행 시 활성');
  }

  console.log('');
}

/**
 * 게이트 위반 라인을 출력하고 요약을 반환한다.
 * 출력 형식:
 *   ❌ HARD /route — LCP 3120ms > 2500ms
 *   ❌ HARD /route — first-load JS 145KB > 140KB hard (light)
 *   ⚠️ SOFT /route — Perf 85 < 90
 *   ⚠️ SOFT /route — first-load JS 125KB > 120KB advisory (light)
 *
 * SEO 는 /r/[shortId] 에 대해 판정 제외 (noindex 의도 — ADR-0021 §T9).
 * first-load JS null (dev 빌드) 는 판정 스킵.
 */
function printGateLines(rows: TableRow[]): { hardCount: number; softCount: number; measuredCount: number; jsHardCount: number } {
  let hardCount = 0;
  let softCount = 0;
  let measuredCount = 0;
  let jsHardCount = 0;

  for (const row of rows) {
    if (row.skipped || row.metrics === null) continue;
    measuredCount++;
    const m = row.metrics;

    const lcpEv = evaluateMetric(m.route, 'lcp', m.lcpMs);
    const tbtEv = evaluateMetric(m.route, 'tbt', m.tbtMs);
    const perfEv = evaluateMetric(m.route, 'perf', m.perfScore);
    const a11yEv = evaluateMetric(m.route, 'a11y', m.a11yScore);
    // Amendment 1: first-load JS tier 기반 판정
    const jsEv = evaluateJsBudget(m.route, m.firstLoadKb);

    if (lcpEv.verdict === 'hard-fail') {
      console.error(`❌ HARD ${lcpEv.message}`);
      hardCount++;
    }
    if (tbtEv.verdict === 'hard-fail') {
      console.error(`❌ HARD ${tbtEv.message}`);
      hardCount++;
    }
    if (perfEv.verdict === 'soft-fail') {
      console.warn(`⚠️  SOFT ${perfEv.message}`);
      softCount++;
    }
    if (a11yEv.verdict === 'soft-fail') {
      console.warn(`⚠️  SOFT ${a11yEv.message}`);
      softCount++;
    }
    // first-load JS: hard → exit 1, soft → 경고만
    if (jsEv.verdict === 'hard-fail') {
      console.error(`❌ HARD ${jsEv.message}`);
      hardCount++;
      jsHardCount++;
    } else if (jsEv.verdict === 'soft-fail') {
      console.warn(`⚠️  SOFT ${jsEv.message}`);
      softCount++;
    }
    // jsEv.verdict === 'info' (null 입력) 는 스킵 — 판정 없음
  }

  return { hardCount, softCount, measuredCount, jsHardCount };
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

  const tableRows: TableRow[] = [];
  let anyMeasureFailed = false;

  try {
    for (const page of pageSet) {
      if (page.skip) {
        tableRows.push({ label: page.label, metrics: null, skipped: true });
        continue;
      }

      console.log(`  측정 중: ${page.label} …`);
      try {
        const metrics = await measurePage(page.url, cdpPort);

        // 3.5.1.c: axe advisory — Lighthouse 측정 후 동일 페이지에 axe 실행 (ADR-0023 §T2).
        // "perf 하네스의 axe 가 비-게이트인 이유": 진짜 axe 게이트는 accessibility.spec.ts.
        // 여기선 4페이지 perf 측정하는 김에 axe 를 같이 돌려 표 컬럼으로 보여준다 — advisory only.
        // computeExitCode 에 영향 없음 (axeViolations 는 판정 로직에서 무시됨).
        let axeViolations: number | null = null;
        let axeViolationDetails: Array<{ id: string; impact: string | null; help: string }> | undefined;
        try {
          // 새 browser context + page 를 열어 axe 실행.
          // CDP 포트를 이미 가진 browser 에 context 추가 — 새 바이너리 X.
          const axeCtx = await browser.newContext({ locale: 'ko-KR' });
          const axePage = await axeCtx.newPage();
          await axePage.goto(page.url, { waitUntil: 'domcontentloaded' });
          // h1 노출까지 대기 — hydration 신호 (accessibility.spec.ts 와 동일 패턴).
          await axePage.locator('h1').waitFor({ state: 'visible', timeout: 10000 });
          const axeResult = await new AxeBuilder({ page: axePage }).analyze();
          axeViolations = axeResult.violations.length;
          if (axeViolations > 0) {
            axeViolationDetails = axeResult.violations.map((v) => ({
              id: v.id,
              // @builder-justification: axe-core ImpactValue 는 string literal union — null 허용
              impact: (v.impact as string | null | undefined) ?? null,
              help: v.help,
            }));
          }
          await axeCtx.close();
        } catch (axeErr) {
          // axe 실패는 advisory 이므로 측정 실패 취급 X — null 표시만
          console.warn(
            `  ⚠️  [axe advisory] ${page.label} axe 실행 실패 — 무시 (비-게이트): ` +
            `${axeErr instanceof Error ? axeErr.message : String(axeErr)}`,
          );
        }
        metrics.axeViolations = axeViolations;

        // exactOptionalPropertyTypes 대응: axeViolationDetails 가 undefined 이면 키 제외
        const rowExtra = axeViolationDetails !== undefined
          ? { axeViolationDetails }
          : {};
        tableRows.push({ label: page.label, metrics, ...rowExtra });
      } catch (err) {
        // 개별 페이지 측정 실패 — "❌ MEASURE-FAIL" 접두로 측정 실패임을 명시
        // hard 위반(❌ HARD)과 구분: 측정 자체가 불가능한 경우
        console.error(`  ❌ MEASURE-FAIL ${page.label}: ${err instanceof Error ? err.message : String(err)}`);
        tableRows.push({ label: page.label, metrics: null, measureFailed: true });
        anyMeasureFailed = true;
      }
    }
  } finally {
    // Chromium 반드시 종료 — 포트 점유 해제
    await browser.close();
  }

  // 5. 결과 표 출력
  printTable(tableRows);

  // 6. 게이트 판정 라인 출력 (3.5.1.b — ADR-0023 T4 + Amendment 1)
  console.log('  게이트 판정 (ADR-0023 T4 + Amendment 1 per-route 2-tier):');
  console.log('  hard(exit 1): LCP > 2500ms, TBT > 200ms, first-load JS > hard tier');
  console.log('  soft(warn, exit 0): Perf < 90, A11y < 95, first-load JS > advisory tier');
  console.log('  first-load JS 게이트: light(≤120/140 KB), form(≤170/200 KB) — .next/ 없으면 스킵\n');

  const { hardCount, softCount, measuredCount, jsHardCount } = printGateLines(tableRows);

  // 7. 요약 라인 (first-load JS 위반 건수 + axe advisory 포함)
  const totalAxeViolations = tableRows.reduce((sum, r) => {
    return sum + (r.metrics?.axeViolations ?? 0);
  }, 0);
  console.log(`\n  하드 게이트: ${measuredCount} 페이지 측정 / ${hardCount} 위반 (JS hard: ${jsHardCount}건)`);
  console.log(`  소프트 경고: ${softCount}건`);
  // axe advisory — 비-게이트임을 명시 (exit code 영향 X)
  console.log(`  axe advisory (비-게이트): 총 ${totalAxeViolations}건 위반 — 진짜 게이트는 pnpm test:e2e (accessibility.spec.ts)\n`);

  // 8. exit code 우선순위:
  //    측정 실패(MEASURE-FAIL) = exit 1 → hard 위반과 동일 코드지만 메시지로 구분
  //    hard 위반 = exit 1
  //    그 외(soft 경고 포함) = exit 0
  if (anyMeasureFailed) {
    console.error('❌ MEASURE-FAIL: 일부 페이지 측정 실패 — 서버 로그를 확인하세요.');
    process.exit(1);
  }

  if (hardCount > 0) {
    console.error(`❌ HARD 게이트 위반 ${hardCount}건 — 위 ❌ HARD 라인을 수정 후 재측정하세요.`);
    process.exit(1);
  }

  if (softCount > 0) {
    console.warn(`⚠️  소프트 경고 ${softCount}건 — 위 ⚠️ SOFT 라인 확인 (exit 0, 배포 차단 X).`);
  } else {
    console.log('✅ 모든 게이트 통과 (hard + soft)');
  }
  process.exit(0);
}

// require.main === module: CJS 환경(tsx가 변환)에서 직접 실행 감지.
// vitest 가 import 할 때는 false → main() 호출 X → process.exit 가 테스트를 오염하지 않음.
// 이 패턴이 필요한 이유: export 로 순수 함수를 노출하면서도 스크립트로 직접 실행 가능해야 함.
if (require.main === module) {
  main().catch((err: unknown) => {
    console.error('perf-budget 하네스 오류:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
