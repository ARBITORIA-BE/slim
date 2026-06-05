import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getDailyComparisonCounts30d,
  getFetcherHealth24h,
  getMonthlyConversionRates12m,
  type DailyComparisonRow,
  type DailyComparisonsResult,
  type FetcherHealthResult,
  type ManualBreakdown,
  type MethodBreakdown,
  type MonthlyConversionResult,
} from '@/db/queries/admin-metrics';

// 메트릭 1건이 실패해도 다른 메트릭은 계속 보이게 — 운영자가 부분 장애를 진단
// 할 수 있게 한다. DB 마이그레이션 미적용 / fetcher 다운 등 부분 실패 시 가시성.
type MetricResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

async function safe<T>(fn: () => Promise<T>): Promise<MetricResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// 어드민 대시보드는 매 요청 최신 데이터를 본다 — 캐시 비활성화.
export const dynamic = 'force-dynamic';

// 왜 generateMetadata 로 변환하는가?
//   metadata.admin.title 키 i18n 적용 (B.2). robots: noindex 구조 변경 0.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: t('admin.title'),
    robots: { index: false, follow: false },
  };
}

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatDateTime(iso: string): string {
  // ISO 그대로 노출 — 운영자 자가 진단(헌법 P1) + 타임존 모호함 회피.
  return new Date(iso).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

interface DailyTrendBarsProps {
  readonly rows: readonly DailyComparisonRow[];
}

// PLAN 4.5.1.c — 7일 추세 CSS bar chart. 차트 라이브러리 추가 X, Tailwind 만.
function DailyTrendBars({ rows }: DailyTrendBarsProps) {
  // rows 는 day DESC. 최근 7일을 오름차순으로 정렬.
  const last7 = rows.slice(0, 7).slice().reverse();
  const max = Math.max(1, ...last7.map((r) => r.count));
  if (last7.length === 0) {
    return <p className="text-sm text-fg-soft">최근 7일 데이터 없음.</p>;
  }
  return (
    <div className="flex items-end gap-2 h-32" aria-label="최근 7일 비교 수">
      {last7.map((r) => {
        const heightPct = Math.round((r.count / max) * 100);
        return (
          <div
            key={r.day}
            className="flex flex-col items-center gap-1 flex-1 group"
            title={`${r.day}: ${r.count}건`}
          >
            <div className="text-xs text-fg-soft opacity-0 group-hover:opacity-100 transition-opacity">
              {r.count}
            </div>
            <div
              className="w-full bg-accent/70 rounded-t"
              style={{ height: `${heightPct}%`, minHeight: r.count > 0 ? '2px' : '0' }}
              aria-hidden
            />
            <div className="text-xs text-fg-soft">{r.day.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

interface MetricSourceProps {
  readonly fetchedAt: string;
  readonly definitionSql: string;
}

function MetricSource({ fetchedAt, definitionSql }: MetricSourceProps) {
  // 헌법 P1 — source + fetched_at 명시. SQL 정의를 펼침으로 노출.
  return (
    <details className="mt-3 text-xs text-fg-soft">
      <summary className="cursor-pointer">
        source: Postgres · fetched_at: {formatDateTime(fetchedAt)}
      </summary>
      <pre className="mt-2 whitespace-pre-wrap bg-bg-warm/40 p-2 rounded text-[11px]">
        {definitionSql}
      </pre>
    </details>
  );
}

function ErrorBlock({ label, error }: { readonly label: string; readonly error: string }) {
  return (
    <div className="rounded border border-red-500/40 bg-red-50/10 p-3 text-xs text-red-700">
      <strong>{label} 실패</strong>: {error}
    </div>
  );
}

function DailySection({ result }: { readonly result: MetricResult<DailyComparisonsResult> }) {
  if (!result.ok) return <ErrorBlock label="일별 비교 수" error={result.error} />;
  const daily = result.value;
  return (
    <>
      <div className="mb-6">
        <DailyTrendBars rows={daily.rows} />
        <p className="text-xs text-fg-soft mt-2">
          최근 7일 추세. 막대 위 호버 시 정확한 숫자.
        </p>
      </div>
      <Table>
        <TableCaption>전체 30일 — 일자 내림차순</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>일자 (UTC)</TableHead>
            <TableHead className="text-right">비교 수</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {daily.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-fg-soft">
                데이터 없음
              </TableCell>
            </TableRow>
          ) : (
            daily.rows.map((r) => (
              <TableRow key={r.day}>
                <TableCell>{r.day}</TableCell>
                <TableCell className="text-right tabular-nums">{r.count}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <MetricSource fetchedAt={daily.fetchedAt} definitionSql={daily.definitionSql} />
    </>
  );
}

function MonthlySection({ result }: { readonly result: MetricResult<MonthlyConversionResult> }) {
  if (!result.ok) return <ErrorBlock label="월별 전환율" error={result.error} />;
  const monthly = result.value;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>월 (UTC)</TableHead>
            <TableHead className="text-right">비교 수</TableHead>
            <TableHead className="text-right">전환 수</TableHead>
            <TableHead className="text-right">전환율</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {monthly.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-fg-soft">
                데이터 없음
              </TableCell>
            </TableRow>
          ) : (
            monthly.rows.map((r) => (
              <TableRow key={r.month}>
                <TableCell>{r.month}</TableCell>
                <TableCell className="text-right tabular-nums">{r.comparisons}</TableCell>
                <TableCell className="text-right tabular-nums">{r.conversions}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPercent(r.rate)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <MetricSource fetchedAt={monthly.fetchedAt} definitionSql={monthly.definitionSql} />
    </>
  );
}

interface MethodBreakdownCardProps {
  readonly scraping: MethodBreakdown;
  readonly manual: ManualBreakdown;
  readonly stub: MethodBreakdown;
}

/**
 * method 별 분석 미니 카드 (PLAN 1.5.6 Q6 B 변형).
 *
 * scraping: 11 / 11 (100.0%)  |  manual: 0 (—)  |  stub: 0
 *
 * stub.total > 0 이면 amber 강조 → 운영자가 고아 tariff 인지 즉시 파악.
 * admin 라벨은 영어 리터럴 (기존 admin 페이지 코드 관례 따름).
 */
function MethodBreakdownCard({ scraping, manual, stub }: MethodBreakdownCardProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-4 p-3 rounded border border-border bg-bg-warm/20">
      {/* scraping 열 */}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-fg-soft uppercase tracking-wide">
          scraping
        </span>
        <span className="text-sm tabular-nums">
          {scraping.fresh} / {scraping.total}
          {' '}
          <span className={scraping.ratio === 1 ? 'text-green-600' : 'text-amber-600'}>
            ({formatPercent(scraping.ratio)})
          </span>
        </span>
      </div>

      {/* manual 열 */}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-fg-soft uppercase tracking-wide">
          manual
        </span>
        <span className="text-sm tabular-nums">
          {manual.total}
          {manual.latestLastSeenAt ? (
            <span className="ml-1 text-fg-soft text-xs">
              (last: {formatDateTime(manual.latestLastSeenAt)})
            </span>
          ) : (
            <span className="ml-1 text-fg-soft text-xs">(—)</span>
          )}
        </span>
      </div>

      {/* stub 열 */}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-fg-soft uppercase tracking-wide">
          stub
        </span>
        <span className={`text-sm tabular-nums ${stub.total > 0 ? 'text-amber-600 font-medium' : ''}`}>
          {stub.total}
          {stub.total > 0 && (
            <span className="ml-1 text-xs font-normal text-amber-500">(orphan — run cleanup SQL)</span>
          )}
        </span>
      </div>
    </div>
  );
}

function FetcherSection({ result }: { readonly result: MetricResult<FetcherHealthResult> }) {
  if (!result.ok) return <ErrorBlock label="Fetcher 헬스" error={result.error} />;
  const fetcher = result.value;
  return (
    <>
      {/* method breakdown 미니 카드 (PLAN 1.5.6) */}
      <MethodBreakdownCard
        scraping={fetcher.byMethod.scraping}
        manual={fetcher.byMethod.manual}
        stub={fetcher.byMethod.stub}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>지표</TableHead>
            <TableHead className="text-right">값</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>활성 tariff 총수</TableCell>
            <TableCell className="text-right tabular-nums">
              {fetcher.totalActiveTariffs}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>24h 신선 tariff 수</TableCell>
            <TableCell className="text-right tabular-nums">
              {fetcher.freshTariffs}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>신선도 비율</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatPercent(fetcher.ratio)}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>가장 최근 snapshot</TableCell>
            <TableCell className="text-right tabular-nums">
              {fetcher.latestSnapshotAt
                ? formatDateTime(fetcher.latestSnapshotAt)
                : '—'}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <MetricSource fetchedAt={fetcher.fetchedAt} definitionSql={fetcher.definitionSql} />
    </>
  );
}

export default async function AdminPage() {
  const [daily, monthly, fetcher] = await Promise.all([
    safe(getDailyComparisonCounts30d),
    safe(getMonthlyConversionRates12m),
    safe(getFetcherHealth24h),
  ]);

  return (
    <main className="min-h-screen p-6 lg:p-10 flex flex-col gap-6 max-w-5xl mx-auto">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-medium tracking-tight">
          어드민 대시보드
        </h1>
        <p className="text-sm text-fg-soft">
          운영 메트릭 — 4.5.1 v0. 모든 숫자는 Postgres 직조회.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>일별 비교 수 (최근 30일)</CardTitle>
          <CardDescription>
            `comparison_request` COUNT GROUP BY date_trunc('day', created_at).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DailySection result={daily} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>월별 전환율 (최근 12개월)</CardTitle>
          <CardDescription>
            converted = `affiliate_click.conversion_status='converted'` COUNT.
            rate = converted / comparisons.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlySection result={monthly} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fetcher 헬스 (24시간 신선도)</CardTitle>
          <CardDescription>
            활성 tariff 중 24시간 이내 snapshot 을 가진 비율.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FetcherSection result={fetcher} />
        </CardContent>
      </Card>
    </main>
  );
}
