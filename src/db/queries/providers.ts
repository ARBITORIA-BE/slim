/**
 * Provider/tariff query helpers (Sub-task 6 — ADR-0016 §T5).
 *
 * 사용:
 *   - `/compare/[category]/current-provider/page.tsx` RSC 가 페이지 로드 시 활성
 *     공급사 + 카테고리별 활성 tariff 를 한 번에 prefetch.
 *   - ISR `revalidate=3600` — provider 마스터 변경 빈도 낮음.
 *
 * 패턴 (comparison-stats.ts 동형):
 *   - Drizzle 쿼리 자체는 통합 테스트 영역
 *   - 순수 변환 로직 (`groupTariffsByProvider`) 만 단위 테스트
 */

import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { provider } from '@/db/schema/provider';
import { tariff, type TariffCategory } from '@/db/schema/tariff';

import type { ActiveProvider, ActiveTariff } from './providers-types';

// ─── 반환 타입 + 순수 helper re-export ─────────────────────────────────────
// 타입은 providers-types.ts 에 분리 — db import 없는 모듈에서 공유 가능.
// helper 는 providers-helpers.ts 에 분리 — vitest 가 db import 없이 테스트.
export type { ActiveProvider, ActiveTariff } from './providers-types';
export { groupTariffsByProvider } from './providers-helpers';

// ─── 쿼리 ──────────────────────────────────────────────────────────────────

/**
 * 비교 가능 공급사 목록 (`excluded_reason IS NULL`) — 국가별 필터.
 *
 * 정렬: name asc (사용자 노출 알파벳 순).
 */
export async function getActiveProviders(
  country: 'BE' | 'NL' | 'LU',
): Promise<ActiveProvider[]> {
  return db
    .select({
      id: provider.id,
      name: provider.name,
      slug: provider.slug,
    })
    .from(provider)
    .where(and(eq(provider.country, country), isNull(provider.excludedReason)))
    .orderBy(provider.name);
}

/**
 * 주어진 공급사 집합의 *활성* 카테고리별 요금제 목록.
 *
 * 빈 providerIds 입력 시 빈 배열 반환 (Drizzle inArray 빈 입력 안전 처리).
 * 정렬: name asc.
 */
export async function getActiveTariffsByProviders(
  providerIds: ReadonlyArray<string>,
  category: TariffCategory,
): Promise<ActiveTariff[]> {
  if (providerIds.length === 0) return [];
  return db
    .select({
      id: tariff.id,
      providerId: tariff.providerId,
      name: tariff.name,
      slug: tariff.slug,
    })
    .from(tariff)
    .where(
      and(
        inArray(tariff.providerId, providerIds as string[]),
        eq(tariff.category, category),
        eq(tariff.isActive, true),
      ),
    )
    .orderBy(tariff.name);
}

