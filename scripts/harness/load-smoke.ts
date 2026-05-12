#!/usr/bin/env tsx
/**
 * Harness: load-smoke (PLAN 3.5.3.b/c/d — 자작 순수 Node fetch, ADR 없음)
 *
 * 목적:
 *   베타 직전 1회 부하 베이스라인 측정 — 5개 대표 라우트에 동시 N(=LOAD_VUS, 기본 10)개
 *   HTTP 요청을 발사, 라우트별 p50/p95/max/에러율/평균 bytes 를 표로 출력.
 *   /api/compare 동일 입력 반복으로 캐시 히트 여부도 점검(3.5.3.c).
 *   무료 한도 외삽 한 단락도 출력(3.5.3.d).
 *
 * 실행법:
 *   pnpm build && pnpm start   ← 먼저 실행 (next start 가 없으면 가드로 거부됨)
 *   pnpm harness:load
 *   LOAD_VUS=50 pnpm harness:load         ← VUS 를 50 으로 올려서 실행
 *   LOAD_BASE_URL=http://localhost:3000 pnpm harness:load  ← 명시적 지정
 *
 * 안전 가드:
 *   - LOAD_BASE_URL 의 hostname 이 localhost/127.0.0.1/[::1] 이 아니면 즉시 exit 2.
 *     이유: production Vercel/Neon/Upstash 무료 한도 소진·비용 방지.
 *   - 서버 미가동 시 exit 2 + 안내 메시지.
 *
 * CI 게이트:
 *   이 스크립트는 CI 머지 게이트 아님 (flaky + 시간 + 한도 소진 위험 — ADR-0023 §T5).
 *   /ship 체크리스트 advisory 항목으로만 추가 (3.5.3.e).
 *
 * exit code:
 *   0 — 측정 완료 (임계값 판정 없음 — "첫 베이스라인" 이라 수치만 출력)
 *   1 — 측정 자체 실패 (모든 라우트가 전부 에러)
 *   2 — 안전 가드 거부 (production host) 또는 서버 미가동
 */

// 한도 수치는 2026-05 기준 추정 — 실제는 Vercel/Neon/Upstash 대시보드 확인

// ─── 환경 변수 ────────────────────────────────────────────────────────────────

// 기본값: localhost:3000 (production 도메인은 가드에서 차단)
const BASE_URL = process.env['LOAD_BASE_URL'] ?? 'http://localhost:3000';

// 기본 동작은 보수적(VUS=10) 인 이유 = 로컬 머신/dev서버 보호 — 운영자가 단계적으로 올림
const VUS = Number(process.env['LOAD_VUS'] ?? '10');

// LOAD_ROUNDS: 라우트당 라운드 수 (기본 3회 — 첫 라운드 워밍업 포함)
const ROUNDS = Number(process.env['LOAD_ROUNDS'] ?? '3');

// ─── 안전 가드 — 다른 어떤 요청보다 먼저 ────────────────────────────────────
//
// hostname 가드를 다른 모든 요청보다 먼저 두는 이유 = production 한도 소진 사고 방지.
// PLAN 3.5.3 §안전 가드 — ADR 없음 (순수 Node 자작, 운영자 결정).

const ALLOWED_HOSTNAMES: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
]);

/**
 * hostname 이 localhost 계열인지 판정하는 순수 함수.
 * export 해서 단위 테스트에서 직접 import.
 *
 * 이 판정을 별도 함수로 분리하는 이유:
 *   1. 순수 함수 → 단위 테스트 가능 (process.exit 를 일으키지 않음)
 *   2. 로직이 한 곳에 집중 → 실수로 가드를 우회할 여지를 줄임
 */
export function isLocalhostHostname(hostname: string): boolean {
  return ALLOWED_HOSTNAMES.has(hostname.toLowerCase());
}

let parsedHostname: string;
try {
  parsedHostname = new URL(BASE_URL).hostname;
} catch {
  console.error(`❌ LOAD_BASE_URL 파싱 실패: "${BASE_URL}"`);
  process.exit(2);
}

if (!isLocalhostHostname(parsedHostname)) {
  console.error(
    `❌ [load-smoke] 부하 테스트는 로컬 대상만 허용됩니다.\n` +
    `   감지된 hostname: ${parsedHostname}\n` +
    `   production Vercel/Neon/Upstash 한도 소진·비용 방지.\n` +
    `   LOAD_BASE_URL 을 localhost 로 설정하거나 비워두세요.\n` +
    `   ADR 없음 — PLAN 3.5.3 §안전 가드`,
  );
  process.exit(2);
}

// ─── 서버 reachability 가드 ───────────────────────────────────────────────────

async function checkReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/`, { signal: AbortSignal.timeout(8000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

/** 단일 요청 측정 결과 */
interface RequestSample {
  latencyMs: number;
  status: number;
  byteLength: number; // 응답 body bytes (content-length 또는 실제 본문 길이)
  vercelFunctionMs: number | null; // x-vercel-execution-time (로컬 next start 엔 없음)
}

/** 라우트별 집계 결과 */
export interface RouteResult {
  label: string;
  path: string;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  errorRate: number; // 0.0 ~ 1.0
  avgBytes: number;
  sampleCount: number;
  errorCount: number;
}

// ─── 순수 함수: percentile 계산 ──────────────────────────────────────────────
//
// 이 함수들을 순수 함수로 분리하는 이유: side-effect 없음 → 단위 테스트 가능.
// export 해서 load-smoke.test.ts 에서 import.

/**
 * 정렬된 숫자 배열에서 p 백분위수를 선형 보간으로 계산한다.
 * p = 0~100.
 *
 * 빈 배열: 0 반환 (에러 처리보다 안전한 기본값 — 측정 실패 시 에러율로 표현).
 * 단일 원소: 그 값 반환.
 *
 * "nearest rank" 대신 선형 보간을 쓰는 이유:
 *   샘플 수가 10~100 으로 작을 때 nearest rank 는 계단형 결과를 낸다.
 *   선형 보간이 부드럽고 p50/p95 모두 의미 있는 값을 준다.
 */
export function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0] ?? 0;

  // p=0 → index 0, p=100 → index n-1
  const idx = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;

  const loVal = sortedAsc[lo] ?? 0;
  const hiVal = sortedAsc[hi] ?? 0;
  return loVal + (hiVal - loVal) * frac;
}

// ─── HTTP 요청 헬퍼 ───────────────────────────────────────────────────────────

/**
 * 단일 HTTP 요청을 보내고 RequestSample 을 반환한다.
 * 에러 시 latencyMs = 실패 시점까지의 시간, status = 0.
 */
async function fetchSample(
  url: string,
  options: RequestInit,
): Promise<RequestSample> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(30_000), // 30초 초과 시 에러 처리
    });
    const latencyMs = Date.now() - t0;

    // 응답 body 소비 (bytes 측정 + 서버 flush 완료 대기)
    const bodyBuf = await res.arrayBuffer();
    const byteLength =
      Number(res.headers.get('content-length')) ||
      bodyBuf.byteLength;

    // Vercel 함수 실행 시간 헤더 (로컬 next start 엔 보통 없음 — walltime 으로 갈음)
    const vercelHeader = res.headers.get('x-vercel-execution-time');
    const vercelFunctionMs = vercelHeader ? Number(vercelHeader) : null;

    return { latencyMs, status: res.status, byteLength, vercelFunctionMs };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    console.warn(
      `  ⚠️  요청 실패 (${url}): ${err instanceof Error ? err.message : String(err)}`,
    );
    return { latencyMs, status: 0, byteLength: 0, vercelFunctionMs: null };
  }
}

/**
 * N(=VUS) 개 동시 요청 1회 라운드를 발사한다.
 * Promise.all 로 동시 발사: 부하 특성을 흉내 냄.
 */
async function fireRound(
  url: string,
  options: RequestInit,
  vus: number,
): Promise<RequestSample[]> {
  return Promise.all(
    Array.from({ length: vus }, () => fetchSample(url, options)),
  );
}

// ─── /api/compare POST body — 유효 비교 입력 (고정값) ────────────────────────
//
// perf-budget.ts 의 fetchShortId() 와 동형 — e2e/result-page.spec.ts 원형.
// 이 body 를 고정하는 이유: 부하 테스트의 핵심 측정 대상(캐시 히트 포함)이므로
// 매 요청마다 동일 입력을 써야 캐시 히트를 관찰할 수 있다.

const COMPARE_BODY = JSON.stringify({
  category: 'mobile',
  postal: { country: 'BE', postalCode: '1000' },
  householdType: 'single',
  currentProviderId: null,
  currentTariffId: null,
  inputAttributes: {},
});

const COMPARE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
};

// ─── 라우트 정의 ──────────────────────────────────────────────────────────────

interface RouteSpec {
  label: string;
  path: string;
  method: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  /** shortId 가 필요하지만 획득 실패 시 skip 가능한 라우트 */
  requiresShortId?: true;
}

/**
 * POST /api/compare 를 1회 호출해 shortId 를 획득한다.
 * 실패 시 null → /r/[shortId] 라우트 skip + warn.
 * perf-budget.ts 의 fetchShortId() 와 동형.
 */
async function fetchShortId(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/compare`, {
      method: 'POST',
      headers: COMPARE_HEADERS,
      body: COMPARE_BODY,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    // @builder-justification: 외부 API 응답 body — 런타임에만 알 수 있는 구조, Zod 없이 간단 체크
    const body = (await res.json()) as { ok?: boolean; shortId?: string };
    if (body.ok === true && typeof body.shortId === 'string') {
      return body.shortId;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── 라우트별 집계 ────────────────────────────────────────────────────────────

/**
 * samples → RouteResult 로 집계.
 * 순수 함수: 입력만 보고 결과를 계산 (I/O 없음).
 */
export function aggregateSamples(
  label: string,
  path: string,
  samples: readonly RequestSample[],
): RouteResult {
  const latencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
  const errors = samples.filter((s) => s.status === 0 || s.status >= 400);
  const totalBytes = samples.reduce((sum, s) => sum + s.byteLength, 0);

  return {
    label,
    path,
    p50Ms: Math.round(percentile(latencies, 50)),
    p95Ms: Math.round(percentile(latencies, 95)),
    maxMs: Math.max(...latencies),
    errorRate: samples.length > 0 ? errors.length / samples.length : 1,
    avgBytes: samples.length > 0 ? Math.round(totalBytes / samples.length) : 0,
    sampleCount: samples.length,
    errorCount: errors.length,
  };
}

// ─── 출력 — 표 포맷 ──────────────────────────────────────────────────────────

function fmtMs(v: number): string {
  return `${v}ms`.padStart(7);
}

function fmtRate(r: number): string {
  return `${(r * 100).toFixed(1)}%`.padStart(6);
}

function fmtBytes(b: number): string {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)}MB`.padStart(8);
  if (b >= 1024) return `${(b / 1024).toFixed(1)}KB`.padStart(8);
  return `${b}B`.padStart(8);
}

function printResultTable(results: RouteResult[]): void {
  console.log(
    '\n📊 부하 베이스라인 측정 결과 (PLAN 3.5.3.b — 자작 순수 Node fetch):\n',
  );
  console.log(
    `  ${'라우트'.padEnd(42)}` +
    `${'p50'.padStart(8)}` +
    `${'p95'.padStart(8)}` +
    `${'max'.padStart(8)}` +
    `${'에러율'.padStart(8)}` +
    `${'평균bytes'.padStart(10)}` +
    `${'샘플'.padStart(6)}`,
  );
  console.log('  ' + '─'.repeat(90));

  for (const r of results) {
    const errIcon = r.errorRate > 0.05 ? ' ⚠️' : r.errorRate > 0 ? ' ⚠' : '';
    console.log(
      `  ${r.label.padEnd(42)}` +
      `${fmtMs(r.p50Ms)}` +
      `${fmtMs(r.p95Ms)}` +
      `${fmtMs(r.maxMs)}` +
      `${fmtRate(r.errorRate)}${errIcon}`.padStart(8 + errIcon.length) +
      `${fmtBytes(r.avgBytes)}` +
      `${String(r.sampleCount).padStart(6)}`,
    );
  }
  console.log('');
}

// ─── 3.5.3.c: 캐시 히트 점검 ─────────────────────────────────────────────────

interface CacheCheckResult {
  round1P50Ms: number;
  round2P50Ms: number;
  ratioPercent: number;
}

/**
 * 캐시 히트 판정 한 줄을 출력한다.
 * 2회차 p50 / 1회차 p50 비율 기반으로 Upstash 캐시 여부를 추정한다.
 *
 * "캐시를 여기서 구현 안 하는 이유 = 본 항목은 측정·발견까지" (PLAN 3.5.3.c).
 */
function printCacheCheck(result: CacheCheckResult): void {
  const { round1P50Ms, round2P50Ms, ratioPercent } = result;
  const significant = ratioPercent < 60; // 40% 이상 빨라지면 캐시 히트로 추정

  const verdictStr = significant
    ? `Upstash 5분 TTL 히트로 추정 (2회차 p50 이 1회차의 ${ratioPercent}%)`
    : `차이 미미 → 캐시 레이어 미구현 가능`;

  console.log(
    `캐시 히트 추정: 2회차 p50(${round2P50Ms}ms) 가 1회차 p50(${round1P50Ms}ms)의 ` +
    `${ratioPercent}% — ${verdictStr}`,
  );

  // @upstash/redis 사용처 부재 finding (빌드 시 정적으로 알 수 있음)
  // load-smoke.ts 실행 전에 이미 확인 완료 (캐시 레이어 구현 상태 finding)
  console.log(
    `⚠️  finding: /api/compare 캐시 레이어 미구현 ` +
    `(src/ 에 @upstash/redis 사용처 부재) — ` +
    `캐시 미스 시 매번 비교 엔진 + DB write 풀 실행. ` +
    `캐시 도입 여부는 별도 항목/ADR.`,
  );
}

// ─── 3.5.3.d: 한도 외삽 ──────────────────────────────────────────────────────
//
// 베타 트래픽 가정 및 무료 한도 수치:
//   - Vercel Hobby: bandwidth 100GB/월, function invocations ≈ 100,000/월(추정),
//     function duration ≈ 100GB-hrs/월(추정)
//   - Neon free: compute hours ≈ 191.9 hrs/월(추정, 0.25 vCPU 기준)
//   - Upstash free: 10,000 commands/일 = 300,000 commands/월
//
// 한도 수치는 2026-05 기준 추정 — 실제는 Vercel/Neon/Upstash 대시보드 확인

interface LimitExtrapolation {
  /** 베타 MAU */
  betaMau: number;
  /** 인당 월 비교 세션 수 */
  sessionsPerUser: number;
  /** 세션당 /api/compare 호출 수 */
  comparePerSession: number;
  /** 세션당 페이지뷰 수 */
  pageviewsPerSession: number;
  /** /api/compare 평균 응답 bytes */
  avgCompareBytes: number;
  /** /api/compare 평균 walltime ms */
  avgCompareMs: number;
}

/**
 * 무료 한도 외삽 출력.
 * "가정값을 출력에 명시" — PLAN 3.5.3.d 요구사항.
 */
function printLimitExtrapolation(params: LimitExtrapolation): void {
  const {
    betaMau,
    sessionsPerUser,
    comparePerSession,
    pageviewsPerSession,
    avgCompareBytes,
    avgCompareMs,
  } = params;

  // 월 총계 계산
  const monthlyCompare = betaMau * sessionsPerUser * comparePerSession;
  const monthlyPageviews = betaMau * sessionsPerUser * pageviewsPerSession;
  const monthlyTotalRequests = monthlyCompare + monthlyPageviews;

  // Vercel bandwidth: /api/compare bytes + 페이지뷰 추정 (페이지당 ≈ 50KB HTML)
  const PAGE_BYTES = 50 * 1024; // 50KB
  const monthlyBandwidthBytes =
    monthlyCompare * avgCompareBytes + monthlyPageviews * PAGE_BYTES;
  const vercelBandwidthGB = monthlyBandwidthBytes / (1024 * 1024 * 1024);
  const vercelBandwidthLimitGB = 100;
  const vercelBandwidthPct = (vercelBandwidthGB / vercelBandwidthLimitGB) * 100;

  // Vercel function invocations: /api/compare 만 function 호출 (페이지뷰는 static/ISR)
  const vercelFuncInvLimit = 100_000; // 추정
  const vercelFuncInvPct = (monthlyCompare / vercelFuncInvLimit) * 100;

  // Vercel function duration: compare 평균 walltime × invocations → GB-seconds
  // GB-hours 기준: avg_ms / 1000 (초) / 3600 (시) × invocations
  const vercelFuncDurationHours =
    (avgCompareMs / 1000 / 3600) * monthlyCompare;
  const vercelFuncDurationLimit = 100; // GB-hrs 추정 (Vercel Hobby)
  const vercelFuncDurationPct =
    (vercelFuncDurationHours / vercelFuncDurationLimit) * 100;

  // Neon compute hours: /api/compare 마다 DB 쿼리 약 5회 (INSERT×2, SELECT×2, SELECT 병렬)
  // Neon compute = 쿼리 실행 시간 기준; 추정: 쿼리당 5ms, 5 queries/compare
  const DB_QUERIES_PER_COMPARE = 5;
  const DB_MS_PER_QUERY = 5; // ms, 추정
  const neonComputeMs =
    monthlyCompare * DB_QUERIES_PER_COMPARE * DB_MS_PER_QUERY;
  const neonComputeHours = neonComputeMs / 1000 / 3600;
  const neonComputeLimit = 191.9; // hours (Neon free tier 0.25 vCPU 추정)
  const neonComputePct = (neonComputeHours / neonComputeLimit) * 100;

  // Upstash commands: 캐시 레이어 미구현이므로 현재 0.
  // 향후 캐시 도입 시 compare 마다 GET(1) + SET(1) = 2 commands.
  const upstashCommandsPerCompare = 0; // 현재 캐시 레이어 없음
  const monthlyUpstashCommands = monthlyCompare * upstashCommandsPerCompare;
  const upstashLimit = 300_000; // 10,000/일 × 30일 (Upstash free 추정)
  const upstashPct =
    upstashLimit > 0 ? (monthlyUpstashCommands / upstashLimit) * 100 : 0;

  console.log('\n──────────────────────────────────────────────');
  console.log('한도 외삽 (PLAN 3.5.3.d):');
  console.log(
    `  가정: 베타 ${betaMau} MAU × 1인 월 ${sessionsPerUser} 비교 세션 ` +
    `× 세션당 ${comparePerSession} /api/compare + ${pageviewsPerSession} 페이지뷰`,
  );
  console.log(
    `  월 총 요청: ${monthlyTotalRequests.toLocaleString()}건 ` +
    `(compare ${monthlyCompare.toLocaleString()} + 페이지뷰 ${monthlyPageviews.toLocaleString()})`,
  );
  console.log('');
  console.log(
    `  Vercel bandwidth    : ~${vercelBandwidthGB.toFixed(3)}GB / ${vercelBandwidthLimitGB}GB ` +
    `(≈ ${vercelBandwidthPct.toFixed(2)}%)`,
  );
  console.log(
    `  Vercel func 호출    : ~${monthlyCompare.toLocaleString()} / ${vercelFuncInvLimit.toLocaleString()}건 ` +
    `(≈ ${vercelFuncInvPct.toFixed(2)}%)  [Hobby 한도 추정]`,
  );
  console.log(
    `  Vercel func 실행시간: ~${vercelFuncDurationHours.toFixed(4)}hrs / ${vercelFuncDurationLimit}GB-hrs ` +
    `(≈ ${vercelFuncDurationPct.toFixed(4)}%)  [추정]`,
  );
  console.log(
    `  Neon compute        : ~${neonComputeHours.toFixed(4)}hrs / ${neonComputeLimit}hrs ` +
    `(≈ ${neonComputePct.toFixed(4)}%)  [0.25 vCPU 추정]`,
  );
  console.log(
    `  Upstash commands    : ~${monthlyUpstashCommands.toLocaleString()} / ${upstashLimit.toLocaleString()} ` +
    `(≈ ${upstashPct.toFixed(2)}%)  [캐시 미구현 → 0; 도입 시 ≈ ${(monthlyCompare * 2).toLocaleString()}건]`,
  );
  console.log('');

  // 종합 코멘트
  const maxPct = Math.max(vercelBandwidthPct, vercelFuncInvPct, neonComputePct);
  if (maxPct < 10) {
    console.log(
      `  ✅ 베타 ${betaMau}명 규모에서 무료 한도 여유 충분 (최대 ≈ ${maxPct.toFixed(1)}%).`,
    );
  } else if (maxPct < 50) {
    console.log(
      `  ⚠️  베타 ${betaMau}명 규모에서 일부 한도 주의 (최대 ≈ ${maxPct.toFixed(1)}%) — ` +
      `트래픽 증가 전 캐시/DB 최적화 권고.`,
    );
  } else {
    console.log(
      `  ❌ 베타 ${betaMau}명 규모에서 한도 초과 위험 (최대 ≈ ${maxPct.toFixed(1)}%) — ` +
      `캐시 도입 + DB 최적화 필수.`,
    );
  }
  console.log(
    '  ℹ️  한도 수치는 2026-05 기준 추정 — 실제는 Vercel/Neon/Upstash 대시보드 확인.',
  );
  console.log('──────────────────────────────────────────────\n');
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // 1. 서버 가동 여부 확인
  const reachable = await checkReachable(BASE_URL);
  if (!reachable) {
    console.error(
      `❌ ${BASE_URL} 에 도달할 수 없습니다.\n` +
      '   next build && pnpm start 를 먼저 실행하세요.\n' +
      '   (next dev --turbo 는 비프로덕션 번들 — 부하 측정 무의미)',
    );
    process.exit(2);
  }

  const measuredAt = new Date().toISOString();
  console.log('\n🔫 load-smoke 하네스 시작');
  console.log(`   BASE_URL : ${BASE_URL}`);
  console.log(`   VUS      : ${VUS} (동시 요청 수 — 기본 10)`);
  console.log(`   ROUNDS   : ${ROUNDS} (라우트당 라운드 수)`);
  console.log(`   측정 시각: ${measuredAt}\n`);

  // 2. shortId 획득 시도 (라우트 3번 /r/[shortId] 용)
  console.log('  /r/[shortId] 용 shortId 획득 시도 중 …');
  const shortId = await fetchShortId();
  if (shortId) {
    console.log(`  → shortId 획득: ${shortId}`);
  } else {
    console.warn(
      '  ⚠️  shortId 획득 실패 — /r/[shortId] 라우트 skip.\n' +
      '     DB 가 가동 중이고 seed 데이터가 있어야 비교 결과가 만들어집니다.',
    );
  }

  // 3. 라우트 셋 정의 (PLAN 3.5.3.b — 5개 라우트)
  const routes: RouteSpec[] = [
    {
      label: '① GET /            (static + ISR)',
      path: '/',
      method: 'GET',
    },
    {
      label: '② GET /compare     (static)',
      path: '/compare',
      method: 'GET',
    },
    {
      label: '③ GET /r/[shortId] (ISR revalidate=3600)',
      path: shortId ? `/r/${shortId}` : '',
      method: 'GET',
      requiresShortId: true,
    },
    {
      label: '④ POST /api/compare (DB+엔진 — 핵심)',
      path: '/api/compare',
      method: 'POST',
      body: COMPARE_BODY,
      headers: COMPARE_HEADERS,
    },
    {
      label: '⑤ GET /compare/mobile/postal (client)',
      path: '/compare/mobile/postal',
      method: 'GET',
    },
  ];

  const results: RouteResult[] = [];

  // 4. 라우트별 측정 (ROUNDS 라운드 × VUS 동시 요청)
  for (const spec of routes) {
    // shortId 가 필요한데 없으면 skip
    if (spec.requiresShortId && !shortId) {
      console.log(`  ⏭️  skip: ${spec.label}`);
      results.push({
        label: `${spec.label} [SKIP]`,
        path: spec.path,
        p50Ms: 0,
        p95Ms: 0,
        maxMs: 0,
        errorRate: 0,
        avgBytes: 0,
        sampleCount: 0,
        errorCount: 0,
      });
      continue;
    }

    console.log(`  측정 중: ${spec.label} (${ROUNDS}라운드 × VUS ${VUS}) …`);
    const allSamples: RequestSample[] = [];

    const url = `${BASE_URL}${spec.path}`;
    const fetchOptions: RequestInit = {
      method: spec.method,
      ...(spec.body ? { body: spec.body } : {}),
      ...(spec.headers ? { headers: spec.headers } : {}),
    };

    for (let round = 0; round < ROUNDS; round++) {
      const roundSamples = await fireRound(url, fetchOptions, VUS);
      allSamples.push(...roundSamples);
    }

    results.push(aggregateSamples(spec.label, spec.path, allSamples));
  }

  // 5. 표 출력
  printResultTable(results);

  // 6. 3.5.3.c: /api/compare 캐시 히트 점검
  //    동일 입력 2회 라운드 비교 — 1회차 vs 2회차 p50
  console.log('──────────────────────────────────────────────');
  console.log('캐시 동작 점검 (PLAN 3.5.3.c — /api/compare 동일 입력 반복):');

  const compareUrl = `${BASE_URL}/api/compare`;
  const compareOpts: RequestInit = {
    method: 'POST',
    body: COMPARE_BODY,
    headers: COMPARE_HEADERS,
  };

  console.log(`  1회차: ${VUS}개 동시 요청 …`);
  const cacheRound1 = await fireRound(compareUrl, compareOpts, VUS);
  const round1Latencies = cacheRound1.map((s) => s.latencyMs).sort((a, b) => a - b);
  const round1P50 = Math.round(percentile(round1Latencies, 50));

  // 잠깐 대기 (서버가 응답을 완전히 flush 할 시간)
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log(`  2회차: ${VUS}개 동시 요청 …`);
  const cacheRound2 = await fireRound(compareUrl, compareOpts, VUS);
  const round2Latencies = cacheRound2.map((s) => s.latencyMs).sort((a, b) => a - b);
  const round2P50 = Math.round(percentile(round2Latencies, 50));

  const ratioPercent =
    round1P50 > 0 ? Math.round((round2P50 / round1P50) * 100) : 100;

  printCacheCheck({ round1P50Ms: round1P50, round2P50Ms: round2P50, ratioPercent });

  // 7. 3.5.3.d: 한도 외삽
  // /api/compare 평균 bytes + walltime 을 측정 결과에서 추출
  const compareResult = results.find((r) => r.path === '/api/compare');
  const avgCompareBytes = compareResult?.avgBytes ?? 200;
  const avgCompareMs = compareResult?.p50Ms ?? 500;

  printLimitExtrapolation({
    betaMau: 100,
    sessionsPerUser: 3,
    comparePerSession: 1,
    pageviewsPerSession: 5,
    avgCompareBytes,
    avgCompareMs,
  });

  // 8. exit code 판정 (임계값 없음 — "첫 베이스라인")
  //    전부 에러면 exit 1, 정상 측정이면 exit 0
  const totalSamples = results.reduce((sum, r) => sum + r.sampleCount, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);

  if (totalSamples > 0 && totalErrors === totalSamples) {
    console.error('❌ 모든 요청 실패 — 서버 로그를 확인하세요.');
    process.exit(1);
  }

  console.log('✅ load-smoke 측정 완료 (임계값 판정 없음 — 베이스라인 기록용)\n');
  process.exit(0);
}

// require.main === module: CJS 환경(tsx 변환)에서 직접 실행 감지.
// vitest 가 import 할 때는 false → main() 미호출 → process.exit 가 테스트를 오염하지 않음.
// 이 패턴이 필요한 이유: export 로 순수 함수를 노출하면서도 스크립트로 직접 실행 가능해야 함.
if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(
      'load-smoke 하네스 오류:',
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  });
}
