/**
 * admin-metrics — 어드민 대시보드 v0 (`/admin`) 데이터 소스. PLAN 4.5.1.b
 *
 * 측정 3종 (PLAN 본문):
 *   1. getDailyComparisonCounts30d  — 일별 비교 수, 최근 30일.
 *      `comparison_request` COUNT GROUP BY date_trunc('day', created_at).
 *   2. getMonthlyConversionRates12m — 월별 전환율, 최근 12개월.
 *      converted = affiliate_click.conversion_status='converted' COUNT.
 *      rate = converted / comparisons (정규화).
 *   3. getFetcherHealth24h          — 현재 24시간 신선도 비율.
 *      신선 tariff_id = tariff_snapshot WHERE fetched_at > NOW() - 24h DISTINCT.
 *      활성 tariff = tariff WHERE is_active = true.
 *      ratio = freshTariffs / totalActiveTariffs.
 *
 * 출처 (헌법 P1):
 *   - DB 자체가 source (Neon production/preview/development 브랜치).
 *   - 각 메트릭의 SQL 정의가 곧 출처 — `definitionSql` 로 UI 에 노출.
 *   - `fetchedAt` = 쿼리 실행 시각 (now()).
 */

import { sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  computeConversionRate,
  computeFreshnessRatio,
} from './admin-metrics-helpers';

// ─── 공통 ────────────────────────────────────────────────────────────────

export interface MetricMeta {
  /** 쿼리 실행 시각 (ISO 8601, UTC). */
  readonly fetchedAt: string;
  /** 운영자/사용자 노출용 SQL 정의 — 헌법 P1. */
  readonly definitionSql: string;
}

function nowIso(): string {
  return new Date().toISOString();
}


// ─── 1. 일별 비교 수 (최근 30일) ─────────────────────────────────────────

export interface DailyComparisonRow {
  /** YYYY-MM-DD (UTC). */
  readonly day: string;
  readonly count: number;
}

export interface DailyComparisonsResult extends MetricMeta {
  readonly rows: readonly DailyComparisonRow[];
}

const DAILY_COMPARISONS_SQL = `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
       COUNT(*)::int AS count
FROM comparison_request
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC`;

export async function getDailyComparisonCounts30d(): Promise<DailyComparisonsResult> {
  const result = await db.execute<{ day: string; count: number }>(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS count
    FROM comparison_request
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY 1
    ORDER BY 1 DESC
  `);
  const raw = extractRows(result);
  return {
    rows: raw.map((r) => ({ day: String(r.day), count: Number(r.count) })),
    fetchedAt: nowIso(),
    definitionSql: DAILY_COMPARISONS_SQL,
  };
}

// ─── 2. 월별 전환율 (최근 12개월) ────────────────────────────────────────

export interface MonthlyConversionRow {
  /** YYYY-MM (UTC). */
  readonly month: string;
  readonly comparisons: number;
  readonly conversions: number;
  /** comparisons === 0 → null (정의 불가). 그 외 0..1. */
  readonly rate: number | null;
}

export interface MonthlyConversionResult extends MetricMeta {
  readonly rows: readonly MonthlyConversionRow[];
}

const MONTHLY_CONVERSION_SQL = `WITH cmp AS (
  SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
         COUNT(*)::int AS comparisons
  FROM comparison_request
  WHERE created_at >= NOW() - INTERVAL '12 months'
  GROUP BY 1
),
conv AS (
  SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
         COUNT(*)::int AS conversions
  FROM affiliate_click
  WHERE conversion_status = 'converted'
    AND created_at >= NOW() - INTERVAL '12 months'
  GROUP BY 1
)
SELECT COALESCE(cmp.month, conv.month) AS month,
       COALESCE(cmp.comparisons, 0)::int AS comparisons,
       COALESCE(conv.conversions, 0)::int AS conversions
FROM cmp
FULL OUTER JOIN conv ON cmp.month = conv.month
ORDER BY 1 DESC`;

export async function getMonthlyConversionRates12m(): Promise<MonthlyConversionResult> {
  const result = await db.execute<{
    month: string;
    comparisons: number;
    conversions: number;
  }>(sql`
    WITH cmp AS (
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
             COUNT(*)::int AS comparisons
      FROM comparison_request
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY 1
    ),
    conv AS (
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
             COUNT(*)::int AS conversions
      FROM affiliate_click
      WHERE conversion_status = 'converted'
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY 1
    )
    SELECT COALESCE(cmp.month, conv.month) AS month,
           COALESCE(cmp.comparisons, 0)::int AS comparisons,
           COALESCE(conv.conversions, 0)::int AS conversions
    FROM cmp
    FULL OUTER JOIN conv ON cmp.month = conv.month
    ORDER BY 1 DESC
  `);
  const raw = extractRows(result);
  const rows: MonthlyConversionRow[] = raw.map((r) => {
    const comparisons = Number(r.comparisons);
    const conversions = Number(r.conversions);
    const rate = computeConversionRate(comparisons, conversions);
    return { month: String(r.month), comparisons, conversions, rate };
  });
  return {
    rows,
    fetchedAt: nowIso(),
    definitionSql: MONTHLY_CONVERSION_SQL,
  };
}

// ─── 3. Fetcher 헬스 (24시간 신선도) ─────────────────────────────────────

export interface FetcherHealthResult extends MetricMeta {
  readonly totalActiveTariffs: number;
  /** distinct tariff_id whose latest snapshot is within 24h. */
  readonly freshTariffs: number;
  /** totalActiveTariffs === 0 → null. 그 외 0..1. */
  readonly ratio: number | null;
  /** 가장 최근 snapshot 의 fetched_at (ISO). NULL 가능. */
  readonly latestSnapshotAt: string | null;
}

const FETCHER_HEALTH_SQL = `SELECT
  (SELECT COUNT(*)::int FROM tariff WHERE is_active = true) AS total_active,
  (SELECT COUNT(DISTINCT tariff_id)::int FROM tariff_snapshot
    WHERE fetched_at > NOW() - INTERVAL '24 hours') AS fresh,
  (SELECT MAX(fetched_at) FROM tariff_snapshot) AS latest`;

export async function getFetcherHealth24h(): Promise<FetcherHealthResult> {
  const result = await db.execute<{
    total_active: number;
    fresh: number;
    latest: string | null;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM tariff WHERE is_active = true) AS total_active,
      (SELECT COUNT(DISTINCT tariff_id)::int FROM tariff_snapshot
        WHERE fetched_at > NOW() - INTERVAL '24 hours') AS fresh,
      (SELECT MAX(fetched_at) FROM tariff_snapshot) AS latest
  `);
  const raw = extractRows(result);
  const row = raw[0] ?? { total_active: 0, fresh: 0, latest: null };
  const totalActiveTariffs = Number(row.total_active);
  const freshTariffs = Number(row.fresh);
  const ratio = computeFreshnessRatio(totalActiveTariffs, freshTariffs);
  const latest = row.latest;
  return {
    totalActiveTariffs,
    freshTariffs,
    ratio,
    latestSnapshotAt: latest ? new Date(latest).toISOString() : null,
    fetchedAt: nowIso(),
    definitionSql: FETCHER_HEALTH_SQL,
  };
}

// ─── 내부: drizzle-orm/neon-http 결과 형태 정규화 ────────────────────────
//
// neon-http 드라이버는 결과를 `{ rows: [...] }` 형태로 반환하지만, 일부 환경에서는
// 배열 자체를 반환할 수 있어 두 케이스 모두 흡수한다.

type ExecuteResult<T> = readonly T[] | { readonly rows: readonly T[] };

function extractRows<T>(result: ExecuteResult<T>): readonly T[] {
  if (Array.isArray(result)) return result;
  if (typeof result === 'object' && result !== null && 'rows' in result) {
    return (result as { rows: readonly T[] }).rows;
  }
  return [];
}
