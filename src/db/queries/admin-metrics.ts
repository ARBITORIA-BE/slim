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
import { registry } from '@/fetchers/index';
import {
  buildMethodCaseExpression,
  computeConversionRate,
  computeFreshnessRatio,
  type MethodMapping,
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

/**
 * scraping/stub 그룹용 신선도 분석 결과.
 * ratio = fresh / total (total === 0 → null).
 */
export interface MethodBreakdown {
  readonly total: number;
  readonly fresh: number;
  /** total === 0 → null. 그 외 0..1. */
  readonly ratio: number | null;
}

/**
 * manual 그룹용 분석 결과.
 * freshness 게이트 완전 제외 — lastSeenAt 최대값만 표시 (PLAN 1.5.6 Q3).
 */
export interface ManualBreakdown {
  readonly total: number;
  /** 그룹 내 tariff.last_seen_at 최대값 (ISO 8601). 없으면 null. */
  readonly latestLastSeenAt: string | null;
}

export interface FetcherHealthResult extends MetricMeta {
  /** 전체 활성 tariff 합계 (scraping + manual + stub 합산). */
  readonly totalActiveTariffs: number;
  /** scraping 그룹의 24h 신선 tariff 수 (= overall 신선 타겟). */
  readonly freshTariffs: number;
  /**
   * overall ratio = byMethod.scraping.ratio (PLAN 1.5.6 Q4).
   * scraping.total === 0 → null.
   */
  readonly ratio: number | null;
  /** 가장 최근 snapshot 의 fetched_at (ISO). NULL 가능. */
  readonly latestSnapshotAt: string | null;
  /** method 별 분석 (PLAN 1.5.6 architect 잠금 명세). */
  readonly byMethod: {
    readonly scraping: MethodBreakdown;
    readonly manual: ManualBreakdown;
    readonly stub: MethodBreakdown;
  };
}

/**
 * registry 에서 scraping fetcher 의 (providerSlug, category) 쌍 추출.
 *
 * FetcherMetadata.categories 가 해당 fetcher 의 실제 커버 카테고리를 선언하므로
 * cartesian product (providerSlug × categories[i]) 로 매핑 생성.
 * method='scraping' 인 fetcher 만 추출 (manual/stub 은 별도 인자).
 *
 * 왜 runtime 빌드인가:
 *   fetcher 추가/카테고리 변경 시 registry 만 수정하면 SQL 매핑 자동 추종.
 *   ADR-0008 §T5 — registry = 단일 출처.
 */
function buildScrapingMappingsFromRegistry(): readonly MethodMapping[] {
  const mappings: MethodMapping[] = [];
  for (const fetcher of registry) {
    if (fetcher.metadata.method === 'scraping') {
      for (const category of fetcher.metadata.categories) {
        mappings.push({ slug: fetcher.metadata.providerSlug, category });
      }
    }
  }
  return mappings;
}

/**
 * FETCHER_HEALTH_SQL 은 런타임에 registry 에서 빌드된 CASE WHEN 을 포함하므로
 * 상수로 고정 불가 — 함수로 생성한다.
 *
 * 이 SQL 이 정의 출처 (헌법 P1) 이므로 `definitionSql` 필드에 그대로 삽입.
 */
function buildFetcherHealthSql(methodCaseExpr: string): string {
  return `SELECT
  ${methodCaseExpr} AS method,
  COUNT(DISTINCT t.id)::int        AS total_active,
  COUNT(DISTINCT CASE
    WHEN s.fetched_at > NOW() - INTERVAL '24 hours'
    THEN t.id END)::int            AS fresh_count,
  MAX(t.last_seen_at)              AS latest_last_seen_at
FROM tariff t
JOIN provider p ON p.id = t.provider_id
LEFT JOIN LATERAL (
  SELECT fetched_at
  FROM tariff_snapshot
  WHERE tariff_id = t.id
  ORDER BY fetched_at DESC
  LIMIT 1
) s ON true
WHERE t.is_active = true
GROUP BY method`;
}

export async function getFetcherHealth24h(): Promise<FetcherHealthResult> {
  // registry 기반으로 scraping 매핑 추출 — 런타임 빌드 (ADR-0008 §T5).
  const scrapingMappings = buildScrapingMappingsFromRegistry();
  // manual 매핑: 1.5.6 기준 0개. 1.5.7+ Telenet internet manual 시드 시 추가.
  const manualMappings: readonly MethodMapping[] = [];

  const methodCaseExpr = buildMethodCaseExpression(scrapingMappings, manualMappings);
  const definitionSql = buildFetcherHealthSql(methodCaseExpr);

  // sql 템플릿 태그에 동적 SQL fragment 를 직접 삽입.
  // 왜 sql.raw() 대신 sql`` + ${} 인가:
  //   buildMethodCaseExpression 의 assertSafe() 가 slug/category 를 검증하므로
  //   인젝션 위험 없음. Drizzle 의 sql`` 은 리터럴 부분만 바인딩 — fragment
  //   삽입은 sql.raw() 또는 sql`` 으로 감싸야 한다.
  const result = await db.execute<{
    method: string;
    total_active: number;
    fresh_count: number;
    latest_last_seen_at: string | null;
  }>(sql.raw(definitionSql));

  const rows = extractRows(result);

  // 그룹별 집계 초기화
  let scrapingTotal = 0;
  let scrapingFresh = 0;
  let manualTotal = 0;
  let manualLatestLastSeenAt: string | null = null;
  let stubTotal = 0;
  let stubFresh = 0;

  for (const row of rows) {
    const total = Number(row.total_active);
    const fresh = Number(row.fresh_count);
    const lastSeen = row.latest_last_seen_at;

    switch (row.method) {
      case 'scraping':
        scrapingTotal += total;
        scrapingFresh += fresh;
        break;
      case 'manual':
        manualTotal += total;
        if (lastSeen) {
          const iso = new Date(lastSeen).toISOString();
          if (!manualLatestLastSeenAt || iso > manualLatestLastSeenAt) {
            manualLatestLastSeenAt = iso;
          }
        }
        break;
      case 'stub':
        stubTotal += total;
        stubFresh += fresh;
        break;
      default:
        // 예상 외 method 값 — stub 으로 흡수 (방어적 처리)
        stubTotal += total;
        stubFresh += fresh;
        break;
    }
  }

  // overall ratio = scraping only (PLAN 1.5.6 Q4)
  const ratio = computeFreshnessRatio(scrapingTotal, scrapingFresh);
  const totalActiveTariffs = scrapingTotal + manualTotal + stubTotal;

  // latestSnapshotAt: scraping 그룹의 last_seen_at 최대값 사용
  // (snapshot 기준 대신 tariff.last_seen_at — scraping 신선도의 운영자 체감값)
  let latestSnapshotAt: string | null = null;
  for (const row of rows) {
    if (row.method === 'scraping' && row.latest_last_seen_at) {
      const iso = new Date(row.latest_last_seen_at).toISOString();
      if (!latestSnapshotAt || iso > latestSnapshotAt) {
        latestSnapshotAt = iso;
      }
    }
  }

  return {
    totalActiveTariffs,
    freshTariffs: scrapingFresh,
    ratio,
    latestSnapshotAt,
    fetchedAt: nowIso(),
    definitionSql,
    byMethod: {
      scraping: {
        total: scrapingTotal,
        fresh: scrapingFresh,
        ratio: computeFreshnessRatio(scrapingTotal, scrapingFresh),
      },
      manual: {
        total: manualTotal,
        latestLastSeenAt: manualLatestLastSeenAt,
      },
      stub: {
        total: stubTotal,
        fresh: stubFresh,
        ratio: computeFreshnessRatio(stubTotal, stubFresh),
      },
    },
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
