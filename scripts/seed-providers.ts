/**
 * seed-providers — provider 마스터 행 멱등 시드 (PLAN 1.5.8 운영 부채).
 *
 * 사고 배경 (2026-06-05, PR #25 머지 직후):
 *   Orange BE fetcher 머지 후 Inngest cron invoke 가 5m 11s hang + 3 retries 실패.
 *   에러: "provider not found: slug='orange-be'. Seed provider row first."
 *   src/inngest/persist.ts L47 — persistFetchResult 가 provider 마스터 행을 lookup
 *   하는데, fetcher 만 추가하고 provider INSERT 누락 시 매번 동일 에러.
 *   1.5.6 (Proximus + Telenet) 도 동일 패턴 — Neon SQL Editor 에서 수동 INSERT.
 *   운영자가 직접 INSERT 후 Rerun 으로 13s 정상 완료.
 *
 * 본 스크립트:
 *   (a) 멱등 INSERT — 3 fetcher (Proximus / Telenet / Orange BE) provider 행
 *       `ON CONFLICT (slug) DO NOTHING` — 이미 존재하면 보존.
 *   (b) vat_id 백필 — 기존 행에 vat_id 가 NULL 인 경우만 UPDATE.
 *       1.5.6 시점 시드에서 vat_id 누락 발견 (Proximus/Telenet NULL).
 *       ADR-0013 Appendix B Amendment (2026-05-28) 에 정정된 VAT 사용:
 *         Proximus  BE0202239951 (postpaid GTC L45)
 *         Telenet   BE0473416418 (Algemene voorwaarden BTW)
 *         Orange BE BE0456810810 (postpaid GTC L45 — 2026-06-05 INSERT 시 채워짐)
 *
 * 실행:
 *   pnpm exec tsx --env-file=.env.local scripts/seed-providers.ts
 *
 * 운영자 트랙:
 *   새 fetcher 추가 PR 머지 *직후* 1회 실행. provider 마스터 행이 없으면
 *   Inngest cron 이 영구 retry hang — 1.5.6/1.5.8 사고 재발 방지.
 *   CLAUDE.md §4 work flow "새 fetcher 추가 시 provider seed 필수" 명시.
 *
 * 멱등성 보장:
 *   - 1차 실행: 3 INSERT (또는 0 if 이미 존재) + 0~2 UPDATE (vat_id 백필)
 *   - 2차 실행: 0 INSERT (모두 skip) + 0 UPDATE (이미 vat_id 채워짐)
 *   - 본 스크립트는 절대 DELETE 하지 않음. 기존 행은 보존만.
 *
 * 결정 근거:
 *   - docs/adr/0001-provider-schema.md (provider 마스터 테이블 §affiliate_status)
 *   - docs/adr/0013-fetcher-real-scraping-risk-assessment.md Appendix B Amendment (2026-05-28, VAT 출처)
 *   - CLAUDE.md §4 (work flow: 새 fetcher 추가 시 provider seed 필수)
 */

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { provider, type NewProvider } from '@/db/schema/provider';

/**
 * 시드 대상 provider 정의 (registry 와 1:1 매핑).
 *
 * 왜 registry 에서 자동 생성 안 하는가?
 *   Fetcher metadata 는 providerSlug + displayName + country + homepageUrl 만
 *   노출. provider 마스터에는 legal_name / vat_id / affiliate_status 등 fetcher
 *   가 모르는 운영 정보가 들어간다. 시드 정의는 별도 단일 출처로 유지.
 */
const PROVIDERS_TO_SEED: readonly NewProvider[] = [
  {
    country: 'BE',
    name: 'Proximus',
    legalName: 'Proximus NV/SA',
    slug: 'proximus-be',
    vatId: 'BE0202239951', // ADR-0013 Appendix B Amendment 2026-05-28
    website: 'https://www.proximus.be',
    affiliateStatus: 'none',
  },
  {
    country: 'BE',
    name: 'Telenet',
    legalName: 'Telenet Group BVBA', // 기존 DB 행과 정합 (legalName 형식 보존)
    slug: 'telenet-be',
    vatId: 'BE0473416418', // ADR-0013 Appendix B Amendment 2026-05-28
    website: 'https://www.telenet.be',
    affiliateStatus: 'none',
  },
  {
    country: 'BE',
    name: 'Orange',
    legalName: 'Orange Belgium s.a.',
    slug: 'orange-be',
    vatId: 'BE0456810810', // GC_2307006_postpaid_FR_20241015.pdf L45
    website: 'https://www.orange.be',
    affiliateStatus: 'none',
  },
];

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  seed-providers — provider 마스터 멱등 시드');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let inserted = 0;
  let alreadyExists = 0;
  let vatBackfilled = 0;

  for (const p of PROVIDERS_TO_SEED) {
    // 1) 존재 확인
    const existing = await db
      .select({ id: provider.id, vatId: provider.vatId })
      .from(provider)
      .where(eq(provider.slug, p.slug))
      .limit(1);
    const existingRow = existing[0];

    if (!existingRow) {
      // 2a) 신규 INSERT
      await db.insert(provider).values(p);
      console.log(`  ✓ ${p.slug}: INSERT (vat_id=${p.vatId})`);
      inserted += 1;
      continue;
    }

    // 2b) 이미 존재 — 보존
    console.log(`  • ${p.slug}: 이미 존재 (id=${existingRow.id})`);
    alreadyExists += 1;

    // 3) vat_id 백필 (기존 NULL 만)
    if (existingRow.vatId === null && p.vatId) {
      await db
        .update(provider)
        .set({ vatId: p.vatId })
        .where(and(eq(provider.slug, p.slug), isNull(provider.vatId)));
      console.log(`    └ vat_id 백필: NULL → ${p.vatId}`);
      vatBackfilled += 1;
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(
    `  요약: ${inserted} INSERT + ${alreadyExists} 보존 (${vatBackfilled} vat_id 백필)`,
  );
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((err) => {
  console.error('seed-providers 실행 실패:', err);
  process.exit(1);
});
