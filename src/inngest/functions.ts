/**
 * Inngest cron + 이벤트 함수 (PLAN 1.6).
 *
 * 결정 근거: docs/adr/0008-fetcher-interface-and-cron.md §T6 / §T7 / §T10
 *
 * 본 모듈이 정의하는 것:
 *   - dailyFetchAll: 매일 06:00 UTC + 수동 이벤트 트리거. registry의 모든
 *     fetcher를 순회 호출 (1.9 격리 — for-loop continue).
 *   - persistFetchResult: fetcher 출력을 DB에 반영 (마스터 upsert + snapshot
 *     insert + lastSeenAt 갱신). ADR-0008 §T7 — 네트워크 step과 분리됨.
 *
 * 1.7(현재) 시점에는 `registry`가 빈 배열 — cron은 안전하게 no-op로 끝남.
 * 1.8 진입 시 fetcher 3개가 registry에 추가되면 자동 가동.
 */

import { eq, and } from 'drizzle-orm';

import { db } from '@/db';
import { provider } from '@/db/schema/provider';
import { tariff } from '@/db/schema/tariff';
import { tariffSnapshot } from '@/db/schema/tariff_snapshot';
import { registry, type Fetcher, type FetchResult } from '@/fetchers';
import { inngest } from '@/lib/inngest';

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
      // step.run 내부에서 throw 시 Inngest가 자동 재시도 (default 3회).
      // 단 fetcher는 throw 대신 FetchOutcome.ok=false 반환 권장 (T4) —
      // 부분 raw payload 보존을 위해.
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

// ─── DB write 로직 (T7 Step B 본체) ──────────────────────────────────────

/**
 * 한 fetcher의 FetchResult를 DB에 반영한다. ADR-0006 §후속 작업의 트랜잭션
 * 순서를 따른다:
 *   1. provider 마스터 lookup (slug → id) — fetcher가 잘못된 slug면 실패
 *   2. 각 tariff에 대해:
 *      a. tariff 마스터 upsert (providerId + slug 키)
 *      b. tariff_snapshot insert (append-only — ADR-0006 §T1)
 *      c. tariff.lastSeenAt 갱신 (ADR-0005 §T5)
 *
 * 본 함수는 step.run 내에서만 호출됨 — Inngest가 자동 retry.
 *
 * Note (페이즈 1.8 작업 후 격상): Drizzle 0.36의 `db.transaction()`을
 * 사용하면 (a)+(b)+(c)가 원자적. Neon HTTP 드라이버는 single-statement만
 * 트랜잭션 지원이라 페이즈 5에서 Neon serverless WebSocket 드라이버로 격상 시
 * 재검토. 페이즈 1에서는 *순차 실행 + 부분 실패 허용* — 다음 cron이 자가 복구.
 */
async function persistFetchResult(result: FetchResult): Promise<void> {
  if (result.data.length === 0) {
    // 빈 배열 = 페이지에서 요금제 사라짐. 1.8에서 isActive=false 마킹 로직
    // 추가 예정 (ADR-0005 §T5). 페이즈 1.7 시점에는 no-op.
    return;
  }

  // 1. provider 마스터 lookup
  const firstSnapshot = result.data[0];
  if (!firstSnapshot) return; // noUncheckedIndexedAccess 가드

  const providerSlug = firstSnapshot.providerSlug;
  const providers = await db
    .select({ id: provider.id })
    .from(provider)
    .where(eq(provider.slug, providerSlug))
    .limit(1);
  const providerRow = providers[0];

  if (!providerRow) {
    // fetcher가 등록되지 않은 provider를 가리킴 — 운영자가 provider 시드 누락.
    // throw로 step 재시도 → 사람이 provider 추가 후 자동 복구.
    throw new Error(
      `provider not found: slug='${providerSlug}'. Seed provider row first.`,
    );
  }
  const providerId = providerRow.id;
  const fetchedAt = new Date(result.fetchedAt);

  for (const input of result.data) {
    // 2a. tariff 마스터 upsert (providerId + slug UNIQUE)
    const existing = await db
      .select({ id: tariff.id })
      .from(tariff)
      .where(and(eq(tariff.providerId, providerId), eq(tariff.slug, input.tariffSlug)))
      .limit(1);
    const existingTariff = existing[0];

    let tariffId: string;
    if (existingTariff) {
      // 기존 마스터 — 가격/속성 갱신 + lastSeenAt 동기화 (ADR-0005 §T5)
      await db
        .update(tariff)
        .set({
          name: input.tariffName,
          monthlyPriceCents: input.monthlyPriceCents,
          activationFeeCents: input.activationFeeCents,
          modemRentalCents: input.modemRentalCents,
          commitmentMonths: input.commitmentMonths,
          earlyTerminationFeeCents: input.earlyTerminationFeeCents,
          promoPriceCents: input.promoPriceCents,
          promoMonths: input.promoMonths,
          promoDescription: input.promoDescription,
          attributes: input.attributes,
          isActive: true,
          lastSeenAt: fetchedAt,
          sourceUrl: input.sourceUrl,
        })
        .where(eq(tariff.id, existingTariff.id));
      tariffId = existingTariff.id;
    } else {
      // 새 마스터 — fetcher가 처음 발견한 요금제
      const inserted = await db
        .insert(tariff)
        .values({
          providerId,
          category: input.category,
          name: input.tariffName,
          slug: input.tariffSlug,
          monthlyPriceCents: input.monthlyPriceCents,
          activationFeeCents: input.activationFeeCents,
          modemRentalCents: input.modemRentalCents,
          commitmentMonths: input.commitmentMonths,
          earlyTerminationFeeCents: input.earlyTerminationFeeCents,
          promoPriceCents: input.promoPriceCents,
          promoMonths: input.promoMonths,
          promoDescription: input.promoDescription,
          attributes: input.attributes,
          isActive: true,
          lastSeenAt: fetchedAt,
          sourceUrl: input.sourceUrl,
        })
        .returning({ id: tariff.id });
      const insertedRow = inserted[0];
      if (!insertedRow) {
        throw new Error(`tariff insert returning empty for slug='${input.tariffSlug}'`);
      }
      tariffId = insertedRow.id;
    }

    // 2b. tariff_snapshot insert (ADR-0006 §T1 append-only)
    await db.insert(tariffSnapshot).values({
      tariffId,
      fetchedAt,
      sourceUrl: input.sourceUrl,
      monthlyPriceCents: input.monthlyPriceCents,
      activationFeeCents: input.activationFeeCents,
      modemRentalCents: input.modemRentalCents,
      promoPriceCents: input.promoPriceCents,
      promoMonths: input.promoMonths,
      // ADR-0006 §T2 — 평탄화 5컬럼 + JSONB 미러
      pricePayload: {
        monthly_price_cents: input.monthlyPriceCents,
        activation_fee_cents: input.activationFeeCents,
        modem_rental_cents: input.modemRentalCents,
        commitment_months: input.commitmentMonths,
        early_termination_fee_cents: input.earlyTerminationFeeCents,
        promo_price_cents: input.promoPriceCents,
        promo_months: input.promoMonths,
        promo_description: input.promoDescription,
        attributes: input.attributes,
      },
      rawPayload: input.rawPayload,
      confidence: input.confidence,
      confidenceReason: input.confidenceReason,
      // isAnomaly는 1.5.2 harness:price 워커가 사후 마킹 (ADR-0006 §T5)
      isAnomaly: false,
    });
  }
}

// ─── 외부 노출 (api/inngest/route.ts에서 사용) ─────────────────────────────

/**
 * 본 모듈이 등록하는 모든 Inngest 함수. `serve({ functions })`가 import.
 * 페이즈 5에서 함수 추가 시 본 배열에 push.
 */
export const functions = [dailyFetchAll];
