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

/**
 * 제외 공급사 시드 (excludedReason NOT NULL) — 헌법 §3 P3 정합.
 *
 * 왜 필요한가 (2026-08-15 실측):
 *   `/data-sources` 제외 공급사 섹션이 **비어 있었다** (본 파일이 3개 비교 대상만
 *   시드하고 excludedReason 행을 하나도 넣지 않음). 그런데 `/guides/proximus-vs-
 *   telenet-vs-orange-be` 가 "Mobile Vikings, Scarlet, hey! ... see the full
 *   exclusion list on /data-sources" 라고 라이브에서 안내 중이었다.
 *   = 존재하지 않는 목록을 가리키는 상태 = P3("제외된 공급사도 이름을 밝힌다") 위반.
 *
 * 실재 확인 방법 (2026-08-15): 각 공식 도메인 1회 GET, HTTP 200 + <title> 확인.
 *   1차에서 미해결이던 hey! / Lebara / Digi 는 2차 대체 도메인 재정찰로 확인:
 *     - hey!  → heytelecom.be (hey.be 아님)
 *     - Digi  → digi-belgium.be (digi.be 아님)
 *     - Lebara → mobile.lebara.com/be/nl — HTTP 403 봇 차단 관측 (사유에 반영)
 *   **Youfone BE 는 전 후보 도메인 실패 → 편입 보류.** 실재를 확인하지 못한 사업자를
 *   목록에 올리는 것은 P1 위반이다 — 도메인 확인 후 별 라운드.
 *
 * legalName 정책: 제외 공급사는 `name` + `excludedReason` 만 렌더된다
 *   (data-sources/page.tsx). legalName 은 스키마 notNull 때문에 필요한 내부 값이라
 *   **상업 브랜드명을 넣는다** — 법인 정식 명칭 검증은 정찰 라운드로 이연.
 *   (비교 대상 3사는 GTC/ADR 출처를 단 vatId 를 갖는다 — 그 기준은 청구 대상에만 적용.)
 *
 * vatId 정책: 제외 공급사는 **null 유지**. vat_id 에 UNIQUE 인덱스가 걸려 있어
 *   미검증 관측값을 넣으면 향후 정확한 값 삽입을 막을 수 있다. 관측값은 주석으로만.
 */
const SURVEY_PENDING =
  'Not yet assessed — fetcher feasibility survey pending (2026-08-15).';

const EXCLUDED_PROVIDERS_TO_SEED: readonly NewProvider[] = [
  {
    country: 'BE',
    name: 'Mobile Vikings',
    legalName: 'Mobile Vikings', // 상업 브랜드명 — 법인명 미검증 (정찰 이연)
    slug: 'mobile-vikings-be',
    website: 'https://mobilevikings.be',
    affiliateStatus: 'none',
    excludedReason: SURVEY_PENDING,
  },
  {
    country: 'BE',
    name: 'Scarlet',
    legalName: 'Scarlet',
    slug: 'scarlet-be',
    website: 'https://www.scarlet.be',
    affiliateStatus: 'none',
    excludedReason: SURVEY_PENDING,
  },
  {
    country: 'BE',
    name: 'BASE',
    legalName: 'BASE',
    // 정찰 리드 (2026-08-15): base.be 홈페이지에 BE0473416418 노출 — 본 파일의
    // telenet-be vatId 와 동일. Telenet 그룹 브랜드 여부는 정찰 라운드에서 확정.
    slug: 'base-be',
    website: 'https://www.base.be',
    affiliateStatus: 'none',
    excludedReason: SURVEY_PENDING,
  },
  {
    country: 'BE',
    name: 'Edpnet',
    legalName: 'Edpnet',
    // 정찰 리드 (2026-08-15): edpnet.be 홈페이지에 BE0799091641 노출 (미검증).
    slug: 'edpnet-be',
    website: 'https://www.edpnet.be',
    affiliateStatus: 'none',
    excludedReason: SURVEY_PENDING,
  },
  {
    country: 'BE',
    name: 'Lycamobile',
    legalName: 'Lycamobile',
    slug: 'lycamobile-be',
    website: 'https://www.lycamobile.be',
    affiliateStatus: 'none',
    excludedReason: SURVEY_PENDING,
  },
  {
    country: 'BE',
    name: 'JIM Mobile',
    legalName: 'JIM Mobile',
    slug: 'jim-mobile-be',
    website: 'https://jimmobile.be',
    affiliateStatus: 'none',
    excludedReason: SURVEY_PENDING,
  },
  {
    country: 'BE',
    name: 'hey!',
    legalName: 'hey!',
    // 1차 정찰에서 hey.be 미해결 → 2차 재정찰로 heytelecom.be 확인 (2026-08-15).
    // 가이드 본문(/guides/proximus-vs-telenet-vs-orange-be §3)이 명시하는 사업자.
    slug: 'hey-be',
    website: 'https://www.heytelecom.be',
    affiliateStatus: 'none',
    excludedReason: SURVEY_PENDING,
  },
  {
    country: 'BE',
    name: 'Digi Belgium',
    legalName: 'Digi Belgium',
    slug: 'digi-be',
    website: 'https://www.digi-belgium.be',
    affiliateStatus: 'none',
    excludedReason: SURVEY_PENDING,
  },
  {
    country: 'BE',
    name: 'Lebara',
    legalName: 'Lebara',
    slug: 'lebara-be',
    website: 'https://mobile.lebara.com/be/nl',
    affiliateStatus: 'none',
    // 2026-08-15 실측: HTTP 403 + "Just a moment..." 인터스티셜 = 봇 차단.
    // ADR-0013 Appendix B 의 Orange Love 번들 WAF 403 선례와 동형 패턴.
    excludedReason:
      'Automated price fetch blocked by bot protection (HTTP 403 challenge observed 2026-08-15) — inclusion would require manual entry, which conflicts with the automated-source policy.',
  },
  {
    country: 'BE',
    name: 'VOO',
    legalName: 'VOO',
    slug: 'voo-be',
    website: 'https://www.voo.be',
    affiliateStatus: 'none',
    // 출처: ADR-0034 Amendment 1 (2026-06-04) — Voo–Orange Belgium 합병
    // 2025-10-01 완료 확인, 이에 따라 PLAN 1.5.9 Voo fetcher 취소.
    excludedReason:
      'Merged into Orange Belgium (completed 2025-10-01) — coverage is provided under the Orange listing.',
  },
];

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  seed-providers — provider 마스터 멱등 시드');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let inserted = 0;
  let alreadyExists = 0;
  let vatBackfilled = 0;

  for (const p of [...PROVIDERS_TO_SEED, ...EXCLUDED_PROVIDERS_TO_SEED]) {
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
      const tag = p.excludedReason ? 'EXCLUDED' : `vat_id=${p.vatId}`;
      console.log(`  ✓ ${p.slug}: INSERT (${tag})`);
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
