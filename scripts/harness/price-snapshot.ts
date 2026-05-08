#!/usr/bin/env tsx
/**
 * Harness: price-snapshot
 *
 * 가격 데이터의 비정상 변동을 감지.
 * 공급사 가격이 24h 사이 ±20% 이상 움직이면 알림 — fetcher 버그 가능성.
 *
 * 실행: pnpm harness:price
 * 운영 cron: 매일 06:00 UTC
 */

import { db } from '../../src/db';   // 실제 빌드 시 alias 처리
import { tariffSnapshot } from '../../src/db/schema';
import { sql } from 'drizzle-orm';

interface Anomaly {
  provider: string;
  tariffId: string;
  yesterday: number;
  today: number;
  changePct: number;
  reason?: string;
}

const ANOMALY_THRESHOLD = 0.2; // ±20%

async function main() {
  // 어제 vs 오늘 가격 비교
  const rows = await db.execute(sql`
    WITH yesterday AS (
      SELECT tariff_id, AVG(unit_price) AS price
      FROM tariff_snapshot
      WHERE fetched_at >= NOW() - INTERVAL '48 hours'
        AND fetched_at <  NOW() - INTERVAL '24 hours'
      GROUP BY tariff_id
    ),
    today AS (
      SELECT tariff_id, AVG(unit_price) AS price
      FROM tariff_snapshot
      WHERE fetched_at >= NOW() - INTERVAL '24 hours'
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

  const anomalies: Anomaly[] = (rows as any[]).map((r) => ({
    provider: r.provider,
    tariffId: r.tariff_id,
    yesterday: Number(r.yesterday_price),
    today: Number(r.today_price),
    changePct: Number(r.change_ratio) * 100,
  }));

  if (anomalies.length === 0) {
    console.log('✅ 가격 스냅샷: 비정상 변동 없음');
    process.exit(0);
  }

  console.log(`⚠️ 가격 변동 의심 ${anomalies.length}건:\n`);
  for (const a of anomalies) {
    const sign = a.changePct > 0 ? '↑' : '↓';
    console.log(
      `${sign} ${a.provider} (tariff ${a.tariffId}): ` +
      `€${a.yesterday.toFixed(4)} → €${a.today.toFixed(4)} ` +
      `(${a.changePct.toFixed(1)}%)`
    );
  }

  // Sentry 알림 (실제 운영 시)
  if (process.env.SENTRY_DSN) {
    // sentry.captureMessage('Price anomaly detected', { extra: { anomalies } });
  }

  // 운영 cron에서는 exit 0 (알림만), CI에서는 exit 1
  process.exit(process.env.CI === 'true' ? 1 : 0);
}

main().catch((err) => {
  console.error('하네스 실행 실패:', err);
  process.exit(2);
});
