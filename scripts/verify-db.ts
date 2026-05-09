#!/usr/bin/env tsx
/**
 * DB 인스턴스 일치 검증 — PLAN 1.5.5 운영 부채 트랙.
 *
 * 사고: 2026-05-09 — db:push가 다른 Neon 브랜치에 적용됨. 운영자가 production
 * 브랜치를 검증할 때 0 tables 발견. 본 스크립트는 *접속 대상*을 노출해 동일
 * 사고 재발을 방지한다.
 *
 * 출력:
 *   1. 접속 host + database 이름 (.env.local DATABASE_URL 파싱)
 *   2. Postgres 자체 메타 (current_database, current_user, version)
 *   3. 적용된 테이블 목록 vs 기대 6개
 *   4. provider 행 수 (시드 진행 상태)
 *
 * 사용:
 *   pnpm exec tsx scripts/verify-db.ts
 *   → 운영자가 Neon Console의 production 브랜치 connection string과 host
 *     일치 여부를 *육안*으로 확인
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL not set');

// URL 파싱 (비번 마스킹)
const parsed = new URL(url);
const masked = `${parsed.protocol}//${parsed.username}:****@${parsed.host}${parsed.pathname}${parsed.search}`;

const sql = neon(url);

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔌 접속 대상 (DATABASE_URL)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  URL : ${masked}`);
  console.log(`  host: ${parsed.host}`);
  console.log(`  db  : ${parsed.pathname.replace(/^\//, '')}`);
  console.log(`  user: ${parsed.username}`);

  // Neon endpoint name 추출 (host 첫 토큰)
  const epMatch = parsed.host.match(/^(ep-[a-z0-9-]+?)(-pooler)?\./);
  const actualEndpoint = epMatch?.[1];
  if (actualEndpoint) {
    console.log(`  endpoint: ${actualEndpoint}`);
    console.log(
      '  (Neon Console → 프로젝트 → Branches → Connection details에서 일치 확인)',
    );
  }

  // ─── 1.5.5 가드: 기대 endpoint와 실제 일치 검증 ─────────────────────────
  // 사고: 2026-05-09 — db:push가 외부 endpoint(silent-darkness)로 적용됨.
  // 해결: EXPECTED_DB_ENDPOINT env var를 .env.local에 두고 매 verify에서 비교.
  // 운영자가 Neon production 브랜치 endpoint를 한 번 명시하면 불일치 시 게이트 차단.
  const expectedEndpoint = process.env.EXPECTED_DB_ENDPOINT?.trim();
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔒 Endpoint 가드 (PLAN 1.5.5)');
  console.log('═══════════════════════════════════════════════════════════════');
  if (!expectedEndpoint) {
    console.log(
      '  ⚠️  EXPECTED_DB_ENDPOINT 미설정 — 가드 skip (.env.local에 추가 권장)',
    );
    console.log(
      `      예: EXPECTED_DB_ENDPOINT="${actualEndpoint ?? 'ep-...'}"`,
    );
  } else if (!actualEndpoint) {
    console.log('  ❌ 실제 endpoint 추출 실패 — DATABASE_URL host 형식 확인 필요');
    process.exit(1);
  } else if (expectedEndpoint !== actualEndpoint) {
    console.log(`  ❌ 미스매치: 기대=${expectedEndpoint} / 실제=${actualEndpoint}`);
    console.log('      .env.local의 DATABASE_URL을 production 브랜치로 갱신하거나');
    console.log('      EXPECTED_DB_ENDPOINT를 의도된 endpoint로 갱신.');
    process.exit(1);
  } else {
    console.log(`  ✅ 일치: ${actualEndpoint}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🐘 Postgres 자체 메타');
  console.log('═══════════════════════════════════════════════════════════════');
  const meta = await sql`
    SELECT current_database() AS db,
           current_user AS usr,
           inet_server_addr() AS server_addr,
           version() AS version
  `;
  const m = meta[0];
  if (m) {
    console.log(`  current_database: ${m.db}`);
    console.log(`  current_user    : ${m.usr}`);
    console.log(`  server_addr     : ${m.server_addr ?? '(N/A — pooler)'}`);
    console.log(`  version         : ${String(m.version).split(' on ')[0]}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📋 적용된 테이블');
  console.log('═══════════════════════════════════════════════════════════════');
  const expected = [
    'provider',
    'tariff',
    'tariff_snapshot',
    'comparison_request',
    'comparison_result',
    'comparison_result_item',
  ];

  const rows = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  const present = rows.map((r) => r.table_name as string);
  console.log(`  발견 ${present.length}개:`);
  for (const t of present) console.log(`    ✓ ${t}`);

  const missing = expected.filter((t) => !present.includes(t));
  if (missing.length > 0) {
    console.log(`\n  ❌ 누락 ${missing.length}개:`);
    for (const t of missing) console.log(`    ✗ ${t}`);
    console.log('\n  → pnpm db:push 재실행 필요');
    process.exit(1);
  }
  console.log(`\n  ✅ 6개 기대 테이블 모두 적용됨`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🌱 시드 상태');
  console.log('═══════════════════════════════════════════════════════════════');
  const providerCount = await sql`SELECT count(*)::int AS c FROM provider`;
  const c = providerCount[0]?.c ?? 0;
  console.log(`  provider 행 수: ${c}`);
  if (c < 2) {
    console.log(
      '  ⚠️  Proximus + Telenet 시드 필요 (SQL 본문 참조: docs/adr/0009)',
    );
  } else {
    const samples = await sql`SELECT slug, name FROM provider ORDER BY slug LIMIT 5`;
    console.log('  샘플:');
    for (const s of samples) console.log(`    - ${s.slug} (${s.name})`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✓ 운영자 행동: 위 host/endpoint를 Neon Console의');
  console.log('   production 브랜치 Connection details와 *육안* 비교.');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((e) => {
  console.error('실패:', e);
  process.exit(2);
});
