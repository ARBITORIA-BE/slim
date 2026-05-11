/**
 * persistFetchResult — fetcher 출력을 DB에 반영 (ADR-0006 §후속 작업).
 *
 * 분리 이유 (Sub-task 5 Phase A): functions.ts 의 cron + seed 스크립트
 * (`scripts/seed-stub-tariffs.mts`) 둘 다 import 가능하도록. Node 24 native
 * TS strip 모드의 ESM module job 일부 호환성 이슈 회피 + 단일 책임 원칙.
 *
 * 트랜잭션 순서 (functions.ts 원안 그대로):
 *   1. provider 마스터 lookup (slug → id) — 잘못된 slug 면 throw
 *   2. 각 tariff 에 대해:
 *      a. tariff 마스터 upsert ((providerId, slug) UNIQUE)
 *      b. tariff_snapshot insert (append-only, ADR-0006 §T1)
 *      c. tariff.lastSeenAt 갱신 (ADR-0005 §T5)
 *
 * Note (페이즈 5 격상): Drizzle 0.36 + Neon serverless WebSocket 드라이버 도입
 * 시 db.transaction() 으로 (a)+(b)+(c) 원자화. 페이즈 1~3 은 *순차 실행 + 부분
 * 실패 허용* — 다음 cron (또는 seed 재실행) 이 자가 복구.
 */

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { provider } from '@/db/schema/provider';
import { tariff } from '@/db/schema/tariff';
import { tariffSnapshot } from '@/db/schema/tariff_snapshot';
import type { FetchResult } from '@/fetchers';

export async function persistFetchResult(result: FetchResult): Promise<void> {
  if (result.data.length === 0) {
    // 빈 배열 = 페이지에서 요금제 사라짐. 1.8 에서 isActive=false 마킹 로직
    // 추가 예정 (ADR-0005 §T5). 페이즈 1.7 시점에는 no-op.
    return;
  }

  // 1. provider 마스터 lookup
  const firstSnapshot = result.data[0];
  if (!firstSnapshot) return;

  const providerSlug = firstSnapshot.providerSlug;
  const providers = await db
    .select({ id: provider.id })
    .from(provider)
    .where(eq(provider.slug, providerSlug))
    .limit(1);
  const providerRow = providers[0];

  if (!providerRow) {
    throw new Error(
      `provider not found: slug='${providerSlug}'. Seed provider row first.`,
    );
  }
  const providerId = providerRow.id;
  const fetchedAt = new Date(result.fetchedAt);

  for (const input of result.data) {
    // 2a. tariff 마스터 upsert
    const existing = await db
      .select({ id: tariff.id })
      .from(tariff)
      .where(and(eq(tariff.providerId, providerId), eq(tariff.slug, input.tariffSlug)))
      .limit(1);
    const existingTariff = existing[0];

    let tariffId: string;
    if (existingTariff) {
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
      isAnomaly: false,
    });
  }
}
