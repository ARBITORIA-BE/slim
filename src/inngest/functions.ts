/**
 * Inngest cron + 이벤트 함수 (PLAN 1.6).
 *
 * 결정 근거: docs/adr/0008-fetcher-interface-and-cron.md §T6 / §T7 / §T10
 *
 * 본 모듈이 정의하는 것:
 *   - dailyFetchAll: 매일 06:00 UTC + 수동 이벤트 트리거. registry의 모든
 *     fetcher를 순회 호출 (1.9 격리 — for-loop continue).
 *
 * persistFetchResult 는 src/inngest/persist.ts 로 분리 (Sub-task 5 Phase A).
 * cron + seed 스크립트 둘 다 같은 모듈 import.
 *
 * 1.7(현재) 시점에는 `registry`가 빈 배열 — cron은 안전하게 no-op로 끝남.
 * 1.8 진입 시 fetcher 3개가 registry에 추가되면 자동 가동.
 */

import { registry, type Fetcher } from '@/fetchers';
import { inngest } from '@/lib/inngest';

import { persistFetchResult } from './persist';

// ─── Cron 함수 (T6 일 1회 + 수동 이벤트) ─────────────────────────────────

/**
 * 매일 06:00 UTC = BE 07-08시 (DST 따라). 사용자 깨어나기 전 신선 데이터 +
 * 공급사 사이트 트래픽 골짜기.
 *
 * `TZ=UTC` 명시 — DST 전환 시 schedule drift 방지 (Inngest 권장).
 * 동일 함수가 `fetchers/run.requested` 이벤트도 받음 — 어드민/dev 수동 재실행.
 *
 * Cron 트리거 시 `event` 인자는 Inngest 가이드상 undefined일 수 있다
 * (https://www.inngest.com/docs/reference/functions/create — 'scheduled
 * functions ... will not receive an event argument'). 다중 트리거 함수에서는
 * runtime 분기로 안전하게 처리.
 */
export const dailyFetchAll = inngest.createFunction(
  {
    id: 'daily-fetch-all',
    // Free tier 5 concurrent steps 한도 안전 마진 (cron + 수동 동시 발사 가드)
    concurrency: 1,
  },
  [
    { cron: 'TZ=UTC 0 6 * * *' },
    { event: 'fetchers/run.requested' },
  ],
  async ({ step, event, logger }) => {
    // 수동 이벤트의 `only` 필드 지원 — 디버깅 시 특정 fetcher만.
    // cron 트리거는 event=undefined → 항상 전체 registry.
    const eventData = readEventData(event);
    const onlySlugs = eventData?.only;

    const targets: readonly Fetcher[] = onlySlugs
      ? registry.filter((f) => onlySlugs.includes(f.metadata.providerSlug))
      : registry;

    logger.info({
      msg: 'fetcher cron 시작',
      targetCount: targets.length,
      requestedBy: eventData?.requestedBy ?? 'cron',
    });

    const summary: Array<{ slug: string; ok: boolean; reason?: string }> = [];

    // 1.9 격리 — for-loop + continue. 한 fetcher 폭발이 다른 fetcher의
    // step.run을 깨지 않음. Promise.all로 병렬화하지 *않는다* — 격리 우선.
    for (const fetcher of targets) {
      const slug = fetcher.metadata.providerSlug;

      // ─── Step A: 네트워크 + 파싱 (재시도 가능) ─────────────────────────
      const outcome = await step.run(`fetch-${slug}`, async () => {
        return fetcher.fetch();
      });

      if (!outcome.ok) {
        // 실패 격리: logger로 Sentry까지 전이 (4.5.2 정식화 예정).
        // 다음 fetcher로 진행 — registry의 나머지는 영향 0.
        logger.error({
          msg: 'fetcher 실패 — 다음으로 진행 (1.9 격리)',
          fetcherSlug: slug,
          kind: outcome.error.kind,
          errorMessage: outcome.error.message,
        });
        summary.push({ slug, ok: false, reason: outcome.error.kind });
        continue;
      }

      // ─── Step B: DB write (T7 분리 — 네트워크 재시도 시 중복 insert 방지) ─
      await step.run(`persist-${slug}`, async () => {
        await persistFetchResult(outcome.result);
      });

      summary.push({ slug, ok: true });
    }

    logger.info({ msg: 'fetcher cron 종료', summary });
    return { summary };
  },
);

// ─── Helper: cron / event 두 트리거에서 event payload 안전 추출 ──────────

interface FetchersRunRequestedData {
  readonly requestedBy?: 'cron' | 'admin' | 'dev';
  readonly only?: string[];
}

/**
 * Cron 트리거는 event=undefined. 이벤트 트리거는 `{ data: { requestedBy?, only? } }`.
 * 두 케이스를 안전하게 normalize. Inngest SDK가 type narrow를 항상 보장하지는
 * 않으므로 (다중 트리거에서) 런타임 가드 + cast.
 */
function readEventData(event: unknown): FetchersRunRequestedData | undefined {
  if (!event || typeof event !== 'object') return undefined;
  const maybeData = (event as { data?: unknown }).data;
  if (!maybeData || typeof maybeData !== 'object') return undefined;
  return maybeData as FetchersRunRequestedData;
}

// ─── persist re-export (외부 호환) ────────────────────────────────────────
export { persistFetchResult } from './persist';

// ─── 외부 노출 (api/inngest/route.ts에서 사용) ─────────────────────────────

/**
 * 본 모듈이 등록하는 모든 Inngest 함수. `serve({ functions })`가 import.
 * 페이즈 5에서 함수 추가 시 본 배열에 push.
 */
export const functions = [dailyFetchAll];
