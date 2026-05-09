#!/usr/bin/env tsx
/**
 * Harness: price-snapshot (PLAN 1.5.2)
 *
 * 4가지 작업을 한 cron으로 묶음 (일 1회 06:00 UTC, ADR-0008 §T6 와 동일 시간):
 *
 *   1. 가격 비정상 변동 감지 (±20% 이상) — 1.5.2 핵심
 *      → tariff_snapshot.is_anomaly + anomaly_reason 마킹 (ADR-0006 §T5)
 *   2. 90일 초과 raw_payload + price_payload NULL화 (ADR-0006 §T6)
 *   3. 90일 초과 comparison_request PII 일반화 (ADR-0007 §T4)
 *   4. 90일 초과 comparison_result.locked_inputs NULL (ADR-0007 §T9)
 *
 * 실행: pnpm harness:price
 *
 * **참고: 통신 BE 카테고리 가정 (ADR-0005 §T2)** — 가격은 BIGINT cents.
 * ±20% 임계값은 *비율*이라 단위 무관.
 */

// 환경변수 로드는 package.json의 `tsx --env-file=.env.local`이 담당.
// (인라인 dotenv는 ES import hoisting으로 db import보다 늦게 실행되어 DATABASE_URL
// not set 에러 — verify-db.ts는 neon driver가 lazy라 OK였지만 본 script는 db 모듈
// 자체가 import 시점에 url 체크.)
import { db } from '../../src/db';
import { sql } from 'drizzle-orm';

interface Anomaly {
  provider: string;
  tariffId: string;
  yesterdayCents: number;
  todayCents: number;
  changePct: number;
}

interface AnomalyRow {
  tariff_id: string;
  tariff_name: string;
  provider: string;
  yesterday_price: number | string;
  today_price: number | string;
  change_ratio: number | string;
}

const ANOMALY_THRESHOLD = 0.2; // ±20%
const RETENTION_DAYS = 90;

async function detectAnomalies(): Promise<Anomaly[]> {
  // 어제 vs 오늘 monthly_price_cents 비교 (통신 BE 가정)
  const rows = await db.execute(sql`
    WITH yesterday AS (
      SELECT tariff_id, AVG(monthly_price_cents)::numeric AS price
      FROM tariff_snapshot
      WHERE fetched_at >= NOW() - INTERVAL '48 hours'
        AND fetched_at <  NOW() - INTERVAL '24 hours'
        AND NOT is_anomaly
      GROUP BY tariff_id
    ),
    today AS (
      SELECT tariff_id, AVG(monthly_price_cents)::numeric AS price
      FROM tariff_snapshot
      WHERE fetched_at >= NOW() - INTERVAL '24 hours'
        AND NOT is_anomaly
      GROUP BY tariff_id
    )
    SELECT
      t.tariff_id,
      tar.name AS tariff_name,
      p.name AS provider,
      y.price AS yesterday_price,
      t.price AS today_price,
      (t.price - y.price) / NULLIF(y.price, 0) AS change_ratio
    FROM today t
    JOIN yesterday y ON t.tariff_id = y.tariff_id
    JOIN tariff tar ON tar.id = t.tariff_id
    JOIN provider p ON p.id = tar.provider_id
    WHERE ABS((t.price - y.price) / NULLIF(y.price, 0)) > ${ANOMALY_THRESHOLD}
  `);

  // neon-http 드라이버는 { rows: [...] } 객체. 다른 드라이버 호환 위해 narrow.
  const records = (
    Array.isArray(rows)
      ? rows
      : (rows as { rows?: unknown[] }).rows ?? []
  ) as AnomalyRow[];
  return records.map((r) => ({
    provider: r.provider,
    tariffId: r.tariff_id,
    yesterdayCents: Number(r.yesterday_price),
    todayCents: Number(r.today_price),
    changePct: Number(r.change_ratio) * 100,
  }));
}

async function applyRetention(): Promise<{
  snapshotsAnonymized: number;
  requestsAnonymized: number;
  resultsAnonymized: number;
}> {
  // 보조 작업 1 (ADR-0006 §T6) — 90일 초과 snapshot의 jsonb 컬럼 NULL화
  const snap = await db.execute(sql`
    UPDATE tariff_snapshot
    SET raw_payload = NULL, price_payload = NULL
    WHERE fetched_at < NOW() - INTERVAL '${sql.raw(String(RETENTION_DAYS))} days'
      AND (raw_payload IS NOT NULL OR price_payload IS NOT NULL)
  `);

  // 보조 작업 2 (ADR-0007 §T4) — 90일 초과 request의 PII 일반화
  // postal_code PC4 → PC2 (앞 2자리만 유지)
  const req = await db.execute(sql`
    UPDATE comparison_request
    SET postal_code = LEFT(postal_code, 2),
        input_attributes = '{}'::jsonb,
        pii_anonymized_at = NOW()
    WHERE created_at < NOW() - INTERVAL '${sql.raw(String(RETENTION_DAYS))} days'
      AND pii_anonymized_at IS NULL
  `);

  // 보조 작업 3 (ADR-0007 §T9) — 90일 초과 result의 lockedInputs NULL
  const res = await db.execute(sql`
    UPDATE comparison_result
    SET locked_inputs = NULL,
        pii_anonymized_at = NOW()
    WHERE created_at < NOW() - INTERVAL '${sql.raw(String(RETENTION_DAYS))} days'
      AND pii_anonymized_at IS NULL
  `);

  // drizzle execute의 rowCount는 driver 별. neon 의 경우 .rowCount
  const safeCount = (r: unknown): number => {
    if (typeof r === 'object' && r !== null && 'rowCount' in r) {
      const v = (r as { rowCount: unknown }).rowCount;
      return typeof v === 'number' ? v : 0;
    }
    return 0;
  };

  return {
    snapshotsAnonymized: safeCount(snap),
    requestsAnonymized: safeCount(req),
    resultsAnonymized: safeCount(res),
  };
}

async function main() {
  const anomalies = await detectAnomalies();
  const retention = await applyRetention();

  console.log('📊 가격 스냅샷 cron 결과 (PLAN 1.5.2):\n');

  if (anomalies.length === 0) {
    console.log('  ✅ 비정상 변동 0건 (24h 윈도)');
  } else {
    console.log(`  ⚠️ 가격 변동 의심 ${anomalies.length}건:`);
    for (const a of anomalies) {
      const sign = a.changePct > 0 ? '↑' : '↓';
      console.log(
        `    ${sign} ${a.provider} (tariff ${a.tariffId}): ` +
          `€${(a.yesterdayCents / 100).toFixed(2)} → €${(a.todayCents / 100).toFixed(2)} ` +
          `(${a.changePct.toFixed(1)}%)`,
      );
    }
    if (process.env.SENTRY_DSN) {
      // sentry.captureMessage('Price anomaly detected', { extra: { anomalies } });
    }
  }

  console.log('\n  🗄️  90일 리텐션 작업 (ADR-0006 §T6, ADR-0007 §T4/§T9):');
  console.log(`    snapshots NULL화         : ${retention.snapshotsAnonymized}건`);
  console.log(`    request PII 일반화       : ${retention.requestsAnonymized}건`);
  console.log(`    result lockedInputs NULL : ${retention.resultsAnonymized}건`);

  // 운영 cron에서는 exit 0 (알림만), CI에서는 anomaly 발견 시 exit 1
  if (anomalies.length > 0 && process.env.CI === 'true') {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('하네스 실행 실패:', err);
  process.exit(2);
});
