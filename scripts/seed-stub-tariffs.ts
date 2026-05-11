/**
 * seed-stub-tariffs — Sub-task 5 Phase A.
 *
 * 모든 stub fetcher 를 *직접* 호출 + persistFetchResult 로 DB upsert.
 * Inngest cron 미실행 환경 (개발/테스트) 에서 tariff + tariff_snapshot 시드 용.
 *
 * 실행:
 *   pnpm exec tsx --env-file=.env.local scripts/seed-stub-tariffs.ts
 *
 * 왜 `.ts` (`.mts` 아님)?  tsx (esbuild) 의 ESM 로더가 `.mts` 모듈 잡에서
 * tsconfig `@/*` path alias 를 제대로 해석하지 못한다 ("does not provide an
 * export named ..." SyntaxError). `.ts` 는 tsx 가 CJS 로 변환 — alias 정상,
 * 단 top-level await 불가 → `main()` 비동기 래퍼 사용 (`verify-db.ts` 동형).
 *
 * 멱등성: tariff 마스터는 (provider, slug) UNIQUE upsert. tariff_snapshot 은
 * append-only — 매 실행마다 새 snapshot row 추가. 비교 엔진은 DISTINCT ON 으로
 * 최신만 사용 (ADR-0006 §T7) → 중복 데이터로 인한 결과 왜곡 0.
 *
 * 페이즈 5 (실 스크래핑) 진입 시: stub fetcher 가 실 fetcher 로 교체되므로
 * 본 스크립트도 자연 적용. 별도 변경 0.
 */

import { registry } from '@/fetchers';
import { persistFetchResult } from '@/inngest/persist';

async function main(): Promise<void> {
  let totalOk = 0;
  let totalFail = 0;
  let totalTariffs = 0;

  for (const fetcher of registry) {
    const slug = fetcher.metadata.providerSlug;
    const outcome = await fetcher.fetch();

    if (!outcome.ok) {
      console.warn(
        `✗ ${slug} 실패 (${outcome.error.kind}): ${outcome.error.message}`,
      );
      totalFail += 1;
      continue;
    }

    const tariffCount = outcome.result.data.length;
    await persistFetchResult(outcome.result);
    console.log(`✓ ${slug}: ${tariffCount} tariff upsert + snapshot insert`);
    totalOk += 1;
    totalTariffs += tariffCount;
  }

  console.log(
    `\n요약: ${totalOk} fetcher 성공 / ${totalFail} 실패 / 총 ${totalTariffs} tariff`,
  );
}

main().catch((err) => {
  console.error('seed-stub-tariffs 실행 실패:', err);
  process.exit(1);
});
